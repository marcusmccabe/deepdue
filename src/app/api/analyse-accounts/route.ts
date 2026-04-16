import { NextRequest, NextResponse } from "next/server";
import { getCachedAnalysis, setCachedAnalysis } from "@/lib/analysis-cache";
import type { AccountsAnalysis } from "@/lib/analysis-types";

// Allow up to 60 s for the full pipeline (Vercel Pro; free tier caps at 10 s)
export const maxDuration = 60;

const CH_BASE = "https://api.company-information.service.gov.uk";
const CH_DOC_BASE = "https://document-api.company-information.service.gov.uk";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

const SYSTEM_PROMPT =
  "You are a CFO-level analyst reviewing UK Companies House filed accounts. Produce a neutral factual briefing — not a credit opinion. Never use words like creditworthy, high risk, or recommended. Return a single JSON object with exactly these keys:\n" +
  "financialHealth — object with: revenue, grossProfit, operatingProfit, netProfit (each with value as string e.g. '£4.2m' and yoyChange as string e.g. '+12%' or 'n/a'), cashPosition (string), netAssets (string)\n" +
  "margins — object with: grossMargin (string e.g. '34%'), operatingMargin (string), trend (one sentence on whether margins are expanding or compressing and any stated reason)\n" +
  "balanceSheet — object with: currentRatio (string or 'n/a'), gearing (string or 'n/a'), assetWriteDowns (string or 'None noted')\n" +
  "cashFlowSignals — object with: profitToCashConversion (one sentence), capex (string or 'Not disclosed'), summary (one sentence)\n" +
  "directorFlags — object with: directorLoans (string describing amount and direction or 'None'), relatedPartyTransactions (string or 'None disclosed'), remunerationNotes (string or 'Not disclosed')\n" +
  "strategicDirection — object with: managementOutlook (string), marketsOrGeographies (string or 'Not mentioned'), acquisitionsOrRestructuring (string or 'None mentioned'), rdOrInvestment (string or 'Not mentioned')\n" +
  "risksAndWarnings — object with: explicitRisks (array of strings, empty array if none), materialUncertainties (string or 'None stated'), goingConcern (string — must state whether confirmed clean or qualified and exact wording if qualified)\n" +
  "auditOpinion — object with: opinion (one of: 'Clean', 'Qualified', 'Adverse', 'Disclaimer of opinion'), qualifications (string or 'None'), auditorName (string), auditorChanged (boolean)\n" +
  "complianceSignals — object with: lateFilingHistory (string or 'None noted'), dormancyOrStrikeOff (string or 'None noted'), chargesRegistered (string or 'None registered')\n" +
  "Return only the JSON object. No preamble, no markdown, no explanation.";

function chAuth(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY ?? "";
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

/**
 * GET /api/analyse-accounts?companyNumber=12345678
 *
 * Pipeline:
 *  1. Cache check — return immediately if a fresh result exists
 *  2. Fetch filing history (accounts category) from Companies House
 *  3. Find the most recent filing that has a document_metadata link
 *  4. Download the PDF from the CH Document API
 *  5. Send the PDF (base64) to Claude with the financial analysis prompt
 *  6. Parse the JSON response
 *  7. Store in cache and return to the client
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyNumber = searchParams.get("companyNumber")?.toUpperCase();

  if (!companyNumber) {
    return NextResponse.json(
      { error: "Missing companyNumber query parameter" },
      { status: 400 }
    );
  }

  // ── 1. Cache check ────────────────────────────────────────────────────────
  const cached = getCachedAnalysis(companyNumber);
  if (cached) {
    return NextResponse.json(cached);
  }

  // ── 2. Filing history — accounts category only ────────────────────────────
  let filingItems: Array<{
    category?: string;
    date?: string;
    links?: { document_metadata?: string };
  }>;

  try {
    const filingRes = await fetch(
      `${CH_BASE}/company/${companyNumber}/filing-history?items_per_page=50&category=accounts`,
      { headers: { Authorization: chAuth() }, cache: "no-store" }
    );
    if (!filingRes.ok) {
      return NextResponse.json(
        { error: `Filing history fetch failed (${filingRes.status})` },
        { status: filingRes.status }
      );
    }
    const filingData = await filingRes.json();
    filingItems = filingData.items ?? [];
  } catch {
    return NextResponse.json(
      { error: "Network error fetching filing history" },
      { status: 502 }
    );
  }

  // ── 3. Most recent accounts filing with a downloadable document ───────────
  const filing = filingItems.find(
    (f) => f.category === "accounts" && f.links?.document_metadata
  );

  if (!filing) {
    return NextResponse.json(
      { error: "No accounts document found for this company" },
      { status: 404 }
    );
  }

  const metadataUrl = filing.links!.document_metadata!;
  const idMatch = metadataUrl.match(/\/document\/([^/?]+)/);
  if (!idMatch) {
    return NextResponse.json(
      { error: "Could not extract document ID from filing link" },
      { status: 500 }
    );
  }
  const documentId = idMatch[1];

  // ── 4. Download PDF ───────────────────────────────────────────────────────
  let pdfBase64: string;

  try {
    const pdfRes = await fetch(
      `${CH_DOC_BASE}/document/${documentId}/content`,
      {
        headers: {
          Authorization: chAuth(),
          Accept: "application/pdf",
        },
        cache: "no-store",
      }
    );

    if (!pdfRes.ok) {
      return NextResponse.json(
        { error: `Document download failed (${pdfRes.status})` },
        { status: pdfRes.status }
      );
    }

    const buffer = await pdfRes.arrayBuffer();

    if (buffer.byteLength > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: "Document exceeds 20 MB size limit" },
        { status: 413 }
      );
    }

    pdfBase64 = Buffer.from(buffer).toString("base64");
    console.log(
      `[analyse-accounts] ${companyNumber}: downloaded ${Math.round(buffer.byteLength / 1024)} KB PDF`
    );
    // ── TEMP DIAGNOSTIC: log PDF URL and first 200 chars of base64 ─────────
    console.log(
      `[analyse-accounts][diag] PDF URL: ${CH_DOC_BASE}/document/${documentId}/content`
    );
    console.log(
      `[analyse-accounts][diag] pdfBase64 first 200 chars: ${pdfBase64.slice(0, 200)}`
    );
  } catch {
    return NextResponse.json(
      { error: "Network error downloading document" },
      { status: 502 }
    );
  }

  // ── 5. Claude analysis (with retry on 529 overloaded) ────────────────────
  let rawText: string;

  // Delays before each attempt: attempt 1 immediate, then 2 s / 4 s / 8 s
  const RETRY_DELAYS_MS = [0, 2_000, 4_000, 8_000];

  const anthropicBody = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: "Please analyse this company accounts document.",
          },
        ],
      },
    ],
  });

  // Log request body for debugging (base64 PDF data replaced with length)
  try {
    const bodyForLogging = JSON.parse(anthropicBody);
    for (const msg of bodyForLogging.messages ?? []) {
      for (const block of Array.isArray(msg.content) ? msg.content : []) {
        if (block?.source?.data) {
          block.source.data = `[${block.source.data.length} base64 chars]`;
        }
      }
    }
    console.log(
      "[analyse-accounts] → Anthropic request body:",
      JSON.stringify(bodyForLogging, null, 2)
    );
  } catch {
    console.log("[analyse-accounts] → Anthropic request body (raw):", anthropicBody.slice(0, 500));
  }

  try {
    let anthropicRes!: Response;

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
      if (RETRY_DELAYS_MS[attempt] > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS_MS[attempt])
        );
      }

      anthropicRes = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "pdfs-2024-09-25",
        },
        body: anthropicBody,
      });

      if (anthropicRes.status !== 529) break; // non-529 → stop retrying

      console.warn(
        `[analyse-accounts] ${companyNumber}: Anthropic overloaded (529),` +
          ` attempt ${attempt + 1}/${RETRY_DELAYS_MS.length}`
      );
    }

    if (anthropicRes.status === 529) {
      return NextResponse.json(
        {
          error:
            "Analysis temporarily unavailable — Anthropic API is overloaded. Please try again in a few minutes.",
        },
        { status: 503 }
      );
    }

    if (!anthropicRes.ok) {
      const body = await anthropicRes.text().catch(() => "");
      console.error("[analyse-accounts] Anthropic error:", body);
      return NextResponse.json(
        { error: `Anthropic API error (${anthropicRes.status})` },
        { status: 502 }
      );
    }

    const aiData = await anthropicRes.json();
    rawText = aiData.content?.[0]?.text ?? "";

    console.log(
      `[analyse-accounts] ${companyNumber}: Claude responded (${rawText.length} chars)`
    );
  } catch (err) {
    console.error("[analyse-accounts] Anthropic fetch threw:", err);
    return NextResponse.json(
      { error: "Network error calling Anthropic API" },
      { status: 502 }
    );
  }

  // ── 6. Parse JSON ─────────────────────────────────────────────────────────
  let analysis: AccountsAnalysis;

  try {
    // Strip markdown code fences if Claude wrapped the JSON
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim();

    const parsed = JSON.parse(jsonText);

    const lineItem = (x: { value?: string; yoyChange?: string } | undefined) => ({
      value: x?.value ?? "n/a",
      yoyChange: x?.yoyChange ?? "n/a",
    });

    analysis = {
      financialHealth: {
        revenue: lineItem(parsed.financialHealth?.revenue),
        grossProfit: lineItem(parsed.financialHealth?.grossProfit),
        operatingProfit: lineItem(parsed.financialHealth?.operatingProfit),
        netProfit: lineItem(parsed.financialHealth?.netProfit),
        cashPosition: parsed.financialHealth?.cashPosition ?? "n/a",
        netAssets: parsed.financialHealth?.netAssets ?? "n/a",
      },
      margins: {
        grossMargin: parsed.margins?.grossMargin ?? "n/a",
        operatingMargin: parsed.margins?.operatingMargin ?? "n/a",
        trend: parsed.margins?.trend ?? "",
      },
      balanceSheet: {
        currentRatio: parsed.balanceSheet?.currentRatio ?? "n/a",
        gearing: parsed.balanceSheet?.gearing ?? "n/a",
        assetWriteDowns: parsed.balanceSheet?.assetWriteDowns ?? "None noted",
      },
      cashFlowSignals: {
        profitToCashConversion: parsed.cashFlowSignals?.profitToCashConversion ?? "",
        capex: parsed.cashFlowSignals?.capex ?? "Not disclosed",
        summary: parsed.cashFlowSignals?.summary ?? "",
      },
      directorFlags: {
        directorLoans: parsed.directorFlags?.directorLoans ?? "None",
        relatedPartyTransactions:
          parsed.directorFlags?.relatedPartyTransactions ?? "None disclosed",
        remunerationNotes: parsed.directorFlags?.remunerationNotes ?? "Not disclosed",
      },
      strategicDirection: {
        managementOutlook: parsed.strategicDirection?.managementOutlook ?? "",
        marketsOrGeographies:
          parsed.strategicDirection?.marketsOrGeographies ?? "Not mentioned",
        acquisitionsOrRestructuring:
          parsed.strategicDirection?.acquisitionsOrRestructuring ?? "None mentioned",
        rdOrInvestment: parsed.strategicDirection?.rdOrInvestment ?? "Not mentioned",
      },
      risksAndWarnings: {
        explicitRisks: Array.isArray(parsed.risksAndWarnings?.explicitRisks)
          ? parsed.risksAndWarnings.explicitRisks
          : [],
        materialUncertainties:
          parsed.risksAndWarnings?.materialUncertainties ?? "None stated",
        goingConcern: parsed.risksAndWarnings?.goingConcern ?? "",
      },
      auditOpinion: {
        opinion: parsed.auditOpinion?.opinion ?? "Clean",
        qualifications: parsed.auditOpinion?.qualifications ?? "None",
        auditorName: parsed.auditOpinion?.auditorName ?? "",
        auditorChanged: Boolean(parsed.auditOpinion?.auditorChanged),
      },
      complianceSignals: {
        lateFilingHistory: parsed.complianceSignals?.lateFilingHistory ?? "None noted",
        dormancyOrStrikeOff:
          parsed.complianceSignals?.dormancyOrStrikeOff ?? "None noted",
        chargesRegistered:
          parsed.complianceSignals?.chargesRegistered ?? "None registered",
      },
      analysedAt: new Date().toISOString(),
      companyNumber,
      documentDate: filing.date,
      cached: false,
    };
    // ── TEMP DIAGNOSTIC: log parsed financialHealth ───────────────────────
    console.log(
      `[analyse-accounts][diag] parsed financialHealth:`,
      JSON.stringify(analysis.financialHealth, null, 2)
    );
  } catch {
    console.error("[analyse-accounts] JSON parse failed. Raw text:", rawText.slice(0, 500));
    return NextResponse.json(
      {
        error: "Failed to parse AI response as JSON",
        rawPreview: rawText.slice(0, 300),
      },
      { status: 500 }
    );
  }

  // ── 7. Cache and return ───────────────────────────────────────────────────
  setCachedAnalysis(companyNumber, analysis);
  return NextResponse.json(analysis);
}
