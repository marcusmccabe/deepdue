import { NextRequest, NextResponse } from "next/server";
import { getCachedAnalysis, setCachedAnalysis } from "@/lib/analysis-cache";
import type { AccountsAnalysis } from "@/lib/analysis-types";

// Allow up to 60 s for the full pipeline (Vercel Pro; free tier caps at 10 s)
export const maxDuration = 60;

const CH_BASE = "https://api.company-information.service.gov.uk";
const CH_DOC_BASE = "https://document-api.company-information.service.gov.uk";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

// Exact system prompt as specified
const SYSTEM_PROMPT =
  "You are a financial analyst specialising in UK company accounts. Analyse the provided accounts document and extract the following in JSON format only, no other text: { risks: [ { severity: 'high' | 'medium' | 'low', title: string, detail: string } ], financials: { revenue: number | null, profit: number | null, assets: number | null, liabilities: number | null, employees: number | null, currency: string }, summary: string, auditOpinion: 'clean' | 'qualified' | 'adverse' | 'disclaimer' | 'unknown', goingConcern: boolean, keyEvents: string[] }";

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

  // ── 5. Claude analysis ────────────────────────────────────────────────────
  let rawText: string;

  try {
    const anthropicRes = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
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
      }),
    });

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
        assets: parsed.financials?.assets ?? null,
        liabilities: parsed.financials?.liabilities ?? null,
        employees: parsed.financials?.employees ?? null,
        currency: parsed.financials?.currency ?? "GBP",
      },
      summary: parsed.summary ?? "",
      auditOpinion: parsed.auditOpinion ?? "unknown",
      goingConcern: parsed.goingConcern ?? false,
      keyEvents: parsed.keyEvents ?? [],
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
