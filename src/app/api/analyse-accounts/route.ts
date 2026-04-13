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
  "You are a senior financial analyst and forensic accountant specialising in UK company accounts. Analyse the provided accounts document thoroughly including all notes, the directors report, auditor report, cash flow statement, and balance sheet.\n\nIMPORTANT — Proportionality: When assessing risk severity, consider the size of the issue relative to the company's overall financial position. A £17k write-off at a company with £18m net assets is LOW risk at most. A £500k write-off at a company with £600k net assets is HIGH risk. Always contextualise figures against total assets, revenue and net assets before assigning severity.\n\nIMPORTANT — Risk quantity: Only flag genuine risks. Do not pad the list. If there are only 2 real risks, return 2. Maximum 5 risks total. Quality over quantity.\n\nExtract the following in JSON format only, no other text, no markdown, no code blocks:\n{\nverdict: string (one sentence, max 20 words, summarising the overall risk position, e.g. 'Financially stable with strong cash reserves and consistent profitability.' or 'High risk — mounting losses, going concern flag raised, and declining revenue.' or 'Moderate risk — profitable but cash position is deteriorating and debt is rising.'),\nverdictRating: 'low' | 'medium' | 'high' | 'critical',\nconclusion: string (2-3 sentences of plain English a non-accountant credit controller can act on, e.g. 'We would recommend proceeding with caution. The company is loss-making but has sufficient cash to sustain operations for approximately 18 months. Request trade references and consider a reduced credit limit until the next set of accounts is filed.'),\nrisks: [ { severity: 'high' | 'medium' | 'low', title: string, detail: string } ],\nfinancials: {\nrevenue: number | null,\nprofit: number | null,\ngrossProfit: number | null,\noperatingProfit: number | null,\nassets: number | null,\nliabilities: number | null,\nnetAssets: number | null,\ncash: number | null,\ndebt: number | null,\nemployees: number | null,\ncurrency: string,\nperiodEnd: string | null\n},\npriorYearFinancials: {\nrevenue: number | null,\nprofit: number | null,\nassets: number | null,\nliabilities: number | null,\ncash: number | null\n} | null,\nsummary: string,\nauditOpinion: 'clean' | 'qualified' | 'adverse' | 'disclaimer' | 'unknown',\nauditorName: string | null,\nauditorChanged: boolean | null,\ngoingConcern: boolean,\ngoingConcernDetail: string | null,\ngoingConcernRunwayMonths: number | null,\ndirectorLoans: {\npresent: boolean,\ndetail: string | null,\ntotalValue: number | null\n},\nrelatedPartyTransactions: {\npresent: boolean,\ndetail: string | null\n},\nlegalProceedings: {\npresent: boolean,\ndetail: string | null\n},\ncyberOrOperationalRisk: {\npresent: boolean,\ndetail: string | null\n},\ncashFlowAnalysis: {\noperatingCashFlow: number | null,\nfreeCashFlow: number | null,\ncashBurnMonthly: number | null,\ncashRunwayMonths: number | null,\ndetail: string\n},\nrevenueConcentration: {\nconcentrated: boolean | null,\ndetail: string | null\n},\nmanagementSentiment: 'positive' | 'cautious' | 'negative' | 'mixed' | 'unknown',\nmanagementSentimentDetail: string | null,\nyearOnYearNarrative: string | null,\nkeyEvents: string[],\nemphasisOfMatter: string | null,\nsectorBenchmarkCommentary: string | null\n}";

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
  } catch {
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

    analysis = {
      risks: parsed.risks ?? [],
      financials: {
        revenue: parsed.financials?.revenue ?? null,
        profit: parsed.financials?.profit ?? null,
        grossProfit: parsed.financials?.grossProfit ?? null,
        operatingProfit: parsed.financials?.operatingProfit ?? null,
        assets: parsed.financials?.assets ?? null,
        liabilities: parsed.financials?.liabilities ?? null,
        netAssets: parsed.financials?.netAssets ?? null,
        cash: parsed.financials?.cash ?? null,
        debt: parsed.financials?.debt ?? null,
        employees: parsed.financials?.employees ?? null,
        currency: parsed.financials?.currency ?? "GBP",
        periodEnd: parsed.financials?.periodEnd ?? null,
      },
      priorYearFinancials: parsed.priorYearFinancials
        ? {
            revenue: parsed.priorYearFinancials.revenue ?? null,
            profit: parsed.priorYearFinancials.profit ?? null,
            assets: parsed.priorYearFinancials.assets ?? null,
            liabilities: parsed.priorYearFinancials.liabilities ?? null,
            cash: parsed.priorYearFinancials.cash ?? null,
          }
        : null,
      summary: parsed.summary ?? "",
      auditOpinion: parsed.auditOpinion ?? "unknown",
      auditorName: parsed.auditorName ?? null,
      auditorChanged: parsed.auditorChanged ?? null,
      goingConcern: parsed.goingConcern ?? false,
      goingConcernDetail: parsed.goingConcernDetail ?? null,
      goingConcernRunwayMonths: parsed.goingConcernRunwayMonths ?? null,
      directorLoans: {
        present: parsed.directorLoans?.present ?? false,
        detail: parsed.directorLoans?.detail ?? null,
        totalValue: parsed.directorLoans?.totalValue ?? null,
      },
      relatedPartyTransactions: {
        present: parsed.relatedPartyTransactions?.present ?? false,
        detail: parsed.relatedPartyTransactions?.detail ?? null,
      },
      legalProceedings: {
        present: parsed.legalProceedings?.present ?? false,
        detail: parsed.legalProceedings?.detail ?? null,
      },
      cyberOrOperationalRisk: {
        present: parsed.cyberOrOperationalRisk?.present ?? false,
        detail: parsed.cyberOrOperationalRisk?.detail ?? null,
      },
      cashFlowAnalysis: {
        operatingCashFlow: parsed.cashFlowAnalysis?.operatingCashFlow ?? null,
        freeCashFlow: parsed.cashFlowAnalysis?.freeCashFlow ?? null,
        cashBurnMonthly: parsed.cashFlowAnalysis?.cashBurnMonthly ?? null,
        cashRunwayMonths: parsed.cashFlowAnalysis?.cashRunwayMonths ?? null,
        detail: parsed.cashFlowAnalysis?.detail ?? "",
      },
      revenueConcentration: {
        concentrated: parsed.revenueConcentration?.concentrated ?? null,
        detail: parsed.revenueConcentration?.detail ?? null,
      },
      managementSentiment: parsed.managementSentiment ?? "unknown",
      managementSentimentDetail: parsed.managementSentimentDetail ?? null,
      yearOnYearNarrative: parsed.yearOnYearNarrative ?? null,
      keyEvents: parsed.keyEvents ?? [],
      emphasisOfMatter: parsed.emphasisOfMatter ?? null,
      sectorBenchmarkCommentary: parsed.sectorBenchmarkCommentary ?? null,
      verdict: parsed.verdict ?? "",
      verdictRating: parsed.verdictRating ?? "medium",
      conclusion: parsed.conclusion ?? "",
      analysedAt: new Date().toISOString(),
      companyNumber,
      documentDate: filing.date,
      cached: false,
    };
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
