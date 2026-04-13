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
  "You are a forensic accountant producing a neutral factual briefing from UK company accounts. Your role is to extract and summarise what the accounts say — you do not give credit opinions, risk ratings, or recommendations. Never use evaluative language such as 'creditworthy', 'high risk', 'concerning', 'worrying', 'recommended', or any equivalent. State facts only.\n\nExtract the following in JSON format only, no other text, no markdown, no code blocks:\n{\nfinancialSnapshot: {\nrevenue: number | null,\ngrossProfit: number | null,\noperatingProfit: number | null,\nnetProfit: number | null,\ncash: number | null,\nnetAssets: number | null,\ntotalDebt: number | null,\nemployeeCount: number | null\n},\nkeyMovements: string[] (max 8 items — plain factual statements about year-on-year changes with numbers, e.g. 'Revenue increased 9% from £373m to £408m.' or 'Operating cash flow fell 61% from £3.1m to £1.3m.' or 'Net assets increased 36% to £3.0m.' or 'Debtor balances increased by £3.4m.' No opinion words.),\nitemsForAttention: [ { heading: string, detail: string } ] (max 5 items — factual observations a professional would want to note: going concern notes, qualified audit opinions, director loans, large related party balances, significant debtor increases, overdue filings, charges registered, legal proceedings mentioned in notes. Only include genuine disclosures or anomalies. Do not include items simply because a metric moved. If there are no genuine items return an empty array.),\nkeyEvents: string[] (max 6 items — plain factual statements about specific events during the year: director appointments and resignations, dividends paid, acquisitions, disposals, significant contracts mentioned, restructuring. Each is one sentence.),\nmanagementCommentary: string (2-3 sentences neutrally summarising what the directors said about the year and outlook. Do not endorse or contradict their statements. Just report what they said. Prefix with 'Directors reported...' or 'According to the strategic report...'),\nauditOpinion: {\nopinion: 'clean' | 'qualified' | 'adverse' | 'disclaimer' | 'unknown',\nauditorName: string | null,\nauditorChanged: boolean | null,\nemphasisOfMatter: string | null\n},\ngoingConcern: {\nflagged: boolean,\ndetail: string | null\n},\ndirectorLoans: {\npresent: boolean,\ndetail: string | null\n},\nrelatedPartyTransactions: {\npresent: boolean,\ndetail: string | null\n},\nstrategicIntelligence: {\nplannedProducts: string[] (array of strings — new products, services, or business lines directors state they intend to launch or develop; empty array if none mentioned),\nplannedMarkets: string[] (array of strings — new geographies, sectors, or customer segments the company states it intends to enter or expand into; empty array if none mentioned),\ngroupEntitiesMentioned: [ { name: string, relationship: string } ] (array — every company, entity or organisation mentioned anywhere in the document other than the company itself, including subsidiaries, sister companies, parent companies, joint ventures, foundations, associated entities, and named third parties in related party notes — do not miss any entity mentioned in any section of the document. Example: { name: 'Specialist Indemnity Services Limited', relationship: 'Sister company — planned vehicle for insurance backing of indemnity services' }),\nstrategicInitiatives: string[] (array of strings — specific strategic projects, investments, restructuring plans, technology initiatives, or operational changes disclosed in narrative sections; empty array if none),\ncompetitivePositioning: string | null (statements the directors make about their market position, competitive advantages, or how they differentiate from competitors — quote or closely paraphrase their own words; null if nothing relevant),\nregulatoryOrLegalDevelopments: string[] (array of strings — mentions of regulatory changes the company is responding to, legal proceedings, compliance initiatives, or government policy changes affecting the business; empty array if none)\n}\n}";

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

  // ── checkOnly — lightweight cache probe, no analysis run ─────────────────
  if (searchParams.get("checkOnly") === "true") {
    const exists = getCachedAnalysis(companyNumber);
    return NextResponse.json({ available: exists !== null });
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
      financialSnapshot: parsed.financialSnapshot
        ? {
            revenue: parsed.financialSnapshot.revenue ?? null,
            grossProfit: parsed.financialSnapshot.grossProfit ?? null,
            operatingProfit: parsed.financialSnapshot.operatingProfit ?? null,
            netProfit: parsed.financialSnapshot.netProfit ?? null,
            cash: parsed.financialSnapshot.cash ?? null,
            netAssets: parsed.financialSnapshot.netAssets ?? null,
            totalDebt: parsed.financialSnapshot.totalDebt ?? null,
            employeeCount: parsed.financialSnapshot.employeeCount ?? null,
          }
        : undefined,
      keyMovements: parsed.keyMovements ?? [],
      itemsForAttention: (parsed.itemsForAttention ?? []).map(
        (item: { heading?: string; detail?: string }) => ({
          heading: item.heading ?? "",
          detail: item.detail ?? "",
        })
      ),
      keyEvents: parsed.keyEvents ?? [],
      managementCommentary: parsed.managementCommentary ?? undefined,
      auditOpinion: parsed.auditOpinion
        ? {
            opinion: parsed.auditOpinion.opinion ?? "unknown",
            auditorName: parsed.auditOpinion.auditorName ?? null,
            auditorChanged: parsed.auditOpinion.auditorChanged ?? null,
            emphasisOfMatter: parsed.auditOpinion.emphasisOfMatter ?? null,
          }
        : undefined,
      goingConcern: parsed.goingConcern
        ? {
            flagged: parsed.goingConcern.flagged ?? false,
            detail: parsed.goingConcern.detail ?? null,
          }
        : undefined,
      directorLoans: parsed.directorLoans
        ? {
            present: parsed.directorLoans.present ?? false,
            detail: parsed.directorLoans.detail ?? null,
          }
        : undefined,
      relatedPartyTransactions: parsed.relatedPartyTransactions
        ? {
            present: parsed.relatedPartyTransactions.present ?? false,
            detail: parsed.relatedPartyTransactions.detail ?? null,
          }
        : undefined,
      strategicIntelligence: parsed.strategicIntelligence
        ? {
            plannedProducts: parsed.strategicIntelligence.plannedProducts ?? [],
            plannedMarkets: parsed.strategicIntelligence.plannedMarkets ?? [],
            groupEntitiesMentioned: (
              parsed.strategicIntelligence.groupEntitiesMentioned ?? []
            ).map((e: { name?: string; relationship?: string }) => ({
              name: e.name ?? "",
              relationship: e.relationship ?? "",
            })),
            strategicInitiatives: parsed.strategicIntelligence.strategicInitiatives ?? [],
            competitivePositioning:
              parsed.strategicIntelligence.competitivePositioning ?? null,
            regulatoryOrLegalDevelopments:
              parsed.strategicIntelligence.regulatoryOrLegalDevelopments ?? [],
          }
        : undefined,
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
