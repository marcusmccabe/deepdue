import { NextRequest, NextResponse } from "next/server";
import { getCachedAnalysis, setCachedAnalysis } from "@/lib/analysis-cache";
import type { AccountsAnalysis } from "@/lib/analysis-types";
import { analyseWithGemini } from "@/lib/gemini-analysis";
import { analyseWithMistral } from "@/lib/mistral-analysis";
import { analyseWithDocAI } from "@/lib/docai-analysis";

export const maxDuration = 300;

const CH_BASE = "https://api.company-information.service.gov.uk";
const CH_DOC_BASE = "https://document-api.company-information.service.gov.uk";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

const SYSTEM_PROMPT = `You are a senior CFO and credit analyst reviewing UK Companies House filings. Your job is to produce a rigorous, specific, and commercially useful analysis of this company based on the filed accounts document provided.

CRITICAL RULES:
- Every observation must be specific to this company. Never write generic statements that could apply to any business.
- Length of each section should be proportional to what the accounts actually contain. If a section has nothing material to report, say so in one sentence and move on. Never pad.
- Always cite specific figures, dates, and named parties where they appear in the accounts.
- Tone: CFO / senior credit analyst — technical, precise, and direct.
- If information for a section is not present in the accounts, state "Not disclosed in these accounts" rather than guessing.

ACCURACY RULES — these must never be violated:
- Never describe revenue as "record" or "highest ever" if the current year figure is lower than the prior year figure shown in the accounts
- Never describe performance as "strong" in the executive summary if revenue declined year-on-year, unless profitability improved significantly and this is explicitly qualified
- Always cross-check directional language (record, growth, decline, improvement) against the actual numbers before using it
- If revenue declined but profit improved, frame it accurately: e.g. "revenue declined X% but profitability improved significantly"

Respond in the following JSON structure only, with no additional text or markdown:

{
  "executiveSummary": "3-5 sentence verdict on this company. Lead with the single most important thing a credit analyst or counterparty needs to know. Include the reporting period and most recent year-end revenue and profit figures.",

  "financialPerformance": {
    "summary": "Analysis of revenue and profit trends. Include specific figures for current and prior year. Assess whether margins are expanding or compressing and why based on what the accounts say.",
    "revenueGrowth": "Specific revenue figures for current and prior year with percentage change.",
    "marginAnalysis": "Gross margin, operating margin, and net margin with year-on-year comparison and commentary on drivers.",
    "yearOnYearTrend": "Overall assessment of financial trajectory — improving, stable, or deteriorating, with specific evidence."
  },

  "balanceSheetStrength": {
    "summary": "Assessment of balance sheet health.",
    "assets": "Total assets, net assets, and key asset composition.",
    "debt": "Total liabilities, any long-term debt, gearing ratio if calculable.",
    "workingCapital": "Current assets vs current liabilities, working capital position, and any concerns."
  },

  "cashPosition": {
    "summary": "Assessment of cash and liquidity.",
    "cashAndEquivalents": "Specific cash figure and whether it is adequate for the scale of the business.",
    "cashConversion": "Assessment of how well profit converts to cash based on operating cash flow if disclosed.",
    "liquidityRisk": "Any liquidity concerns or strengths evident from the accounts."
  },

  "managementCommentary": {
    "summary": "What did the directors actually say in their strategic report or directors report? Extract and critically assess the key themes — do not just repeat what they said, assess whether the narrative matches the numbers.",
    "keyThemes": ["Array of specific themes or statements from the directors report"],
    "assessment": "Does the management narrative align with the financial reality shown in the accounts? Note any discrepancies between optimistic commentary and deteriorating numbers."
  },

  "auditorAndGoingConcern": {
    "auditorName": "Name of the auditor if disclosed.",
    "auditOpinion": "Clean, qualified, adverse, or disclaimer of opinion.",
    "goingConcernFlag": true or false,
    "goingConcernDetail": "If going concern language is present, quote or closely paraphrase the specific language used. If clean, state that explicitly.",
    "emphasisOfMatter": "Any emphasis of matter paragraphs or other matters the auditor drew attention to. If none, state that."
  },

  "relatedPartyTransactions": {
    "summary": "Overview of related party transactions disclosed.",
    "transactions": ["Array of specific named transactions — include party name, nature of transaction, and amount where disclosed"],
    "assessment": "Are these transactions material? Do they suggest a complex group structure, potential conflicts of interest, or unusual financial arrangements?"
  },

  "filingBehaviour": {
    "accountsMadeUpTo": "Year end date of these accounts.",
    "filingPattern": "Assessment of whether the company files on time or late based on any information available.",
    "accountsType": "Full, abbreviated, micro, or dormant accounts."
  },

  "keyRisks": {
    "summary": "Specific risks disclosed in these accounts — not generic categories.",
    "risks": ["Array of specific risk statements extracted from the accounts — quote or closely paraphrase the actual language used, include the specific risk and any mitigation mentioned"]
  },

  "strategicDirection": {
    "summary": "What is the company actually doing strategically based on the accounts?",
    "initiatives": ["Array of specific strategic initiatives, investments, or changes mentioned"],
    "outlook": "Management's stated outlook or forward-looking statements if any."
  },

  "creditAssessment": {
    "overallRating": "Low / Medium / High risk",
    "ratingRationale": "Specific reasoning for this rating based on the financial evidence — minimum 3 sentences citing specific figures and observations.",
    "keyStrengths": ["Array of specific financial or operational strengths"],
    "keyConcerns": ["Array of specific financial or operational concerns"]
  },

  "redFlags": ["Array of specific red flags only — each must be a concrete, evidenced observation. Examples: 'Accounts filed 4 months late', 'Auditor has raised going concern doubt', 'Net liabilities position of £Xm', 'Revenue declined 23% year on year'. Do not include generic risks. If there are no material red flags, return an empty array."],

  "financialHealth": {
    "revenue": {
      "value": "current year total revenue/turnover as a plain integer with no £ sign, commas, or suffix (e.g. 235215041). Use 0 if genuinely not present in the accounts.",
      "prior": "prior year total revenue/turnover as a plain integer. Use 0 if not present.",
      "yoyChange": "percentage change as a string (e.g. \"-7.7%\" or \"+12.3%\"). Use \"n/a\" if cannot be calculated."
    },
    "netProfit": {
      "value": "current year net profit (profit after tax) as a plain integer. Use negative integers for losses (e.g. -450000). Use 0 if not present.",
      "prior": "prior year net profit as a plain integer. Use 0 if not present.",
      "yoyChange": "percentage change as a string. Use \"n/a\" if cannot be calculated."
    },
    "operatingProfit": {
      "value": "current year operating profit as a plain integer. Use negative for losses. Use 0 if not present.",
      "prior": "prior year operating profit as a plain integer. Use 0 if not present.",
      "yoyChange": "percentage change as a string. Use \"n/a\" if cannot be calculated."
    }
  },

  "signals": {
    "creditRisk": "one of: Low | Medium | High — must be consistent with creditAssessment.overallRating",
    "cashHealth": "one of: Good | Adequate | Weak — Good if strong liquidity and cash generation, Weak if liquidity concerns or cash outflows raised, Adequate otherwise",
    "directorRisk": "one of: Low | Medium | High — High if single director or recent director resignations noted, Medium if small stable board, Low if strong governance structures disclosed",
    "auditOpinion": "one of: Clean | Qualified | Going concern — Clean if unqualified opinion with no going concern issues, Going concern if going concern language present, Qualified otherwise"
  }
}`;

// ── Startup env-var check ─────────────────────────────────────────────────────
const REQUIRED_FALLBACK_VARS = [
  "MISTRAL_API_KEY",
  "GOOGLE_DOCUMENT_AI_API_KEY",
  "GOOGLE_CLOUD_PROJECT_ID",
  "GOOGLE_CLOUD_PROCESSOR_ID",
  "GOOGLE_CLOUD_LOCATION",
] as const;

for (const v of REQUIRED_FALLBACK_VARS) {
  if (!process.env[v]) {
    console.warn(`[analyse-accounts] WARNING: environment variable ${v} is not set — the corresponding fallback provider will be unavailable`);
  }
}

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
 *  5. Try Anthropic with PDF
 *     → on 400: try Gemini → try Mistral → try Google Document AI OCR
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
  const cached = await getCachedAnalysis(companyNumber);
  if (cached) {
    return NextResponse.json(cached);
  }

  // ── 2. Filing history — accounts category only ────────────────────────────
  let filingItems: Array<{
    category?: string;
    type?: string;
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

  // ── 3. Most recent accounts filing — prefer full accounts over abbreviated ──
  // Priority: AA (full) → AAMD (amended full) → AA01 (dormant/balance-sheet)
  // → first item with a downloadable document as final fallback.
  const PREFERRED_TYPES = ["AA", "AAMD", "AA01"];
  const withDocument = filingItems.filter((f) => f.links?.document_metadata);

  const filing =
    PREFERRED_TYPES.reduce<(typeof withDocument)[0] | undefined>(
      (found, type) =>
        found ?? withDocument.find((f) => f.type === type),
      undefined
    ) ?? withDocument[0];

  if (!filing) {
    return NextResponse.json(
      { error: "No accounts document found for this company" },
      { status: 404 }
    );
  }

  console.log(
    `[analyse-accounts][diag] selected filing type: ${filing.type ?? "unknown"} | date: ${filing.date ?? "unknown"}`
  );

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
  let pdfBuffer: Buffer;

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

    const arrayBuffer = await pdfRes.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: "Document exceeds 20 MB size limit" },
        { status: 413 }
      );
    }

    pdfBuffer = Buffer.from(arrayBuffer);
    pdfBase64 = pdfBuffer.toString("base64");
    console.log(
      `[analyse-accounts] ${companyNumber}: downloaded ${Math.round(arrayBuffer.byteLength / 1024)} KB PDF`
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

  let anthropicRes!: Response;
  let anthropicHit400 = false;

  try {
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

    if (anthropicRes.status === 400) {
      anthropicHit400 = true;
    } else if (!anthropicRes.ok) {
      const body = await anthropicRes.text().catch(() => "");
      console.error("[analyse-accounts] Anthropic error:", body);
      return NextResponse.json(
        { error: `Anthropic API error (${anthropicRes.status})` },
        { status: 502 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Network error calling Anthropic API" },
      { status: 502 }
    );
  }

  // ── Fallback chain (triggered on Anthropic 400) ───────────────────────────
  if (anthropicHit400) {
    console.log(
      `[analyse-accounts] ${companyNumber}: Anthropic 400 — trying Gemini`
    );

    // Try Gemini
    try {
      const geminiAnalysis = await analyseWithGemini(
        pdfBase64,
        companyNumber,
        filing.date
      );
      await setCachedAnalysis(companyNumber, geminiAnalysis);
      return NextResponse.json(geminiAnalysis);
    } catch (geminiError) {
      console.error(
        `[analyse-accounts] ${companyNumber}: Gemini failed — trying Mistral`,
        geminiError
      );
    }

    // Try Mistral
    try {
      const mistralAnalysis = await analyseWithMistral(
        pdfBase64,
        companyNumber,
        filing.date
      );
      await setCachedAnalysis(companyNumber, mistralAnalysis);
      return NextResponse.json(mistralAnalysis);
    } catch (mistralError) {
      console.error(
        `[analyse-accounts] ${companyNumber}: Mistral failed — trying Google Document AI OCR`,
        mistralError
      );
    }

    // Try Google Document AI OCR → Claude text
    try {
      const docaiAnalysis = await analyseWithDocAI(
        pdfBuffer,
        companyNumber,
        filing.date
      );
      await setCachedAnalysis(companyNumber, docaiAnalysis);
      return NextResponse.json(docaiAnalysis);
    } catch (docaiError) {
      console.error(
        `[analyse-accounts] ${companyNumber}: Google Document AI OCR failed — all providers exhausted`,
        docaiError
      );
    }

    return NextResponse.json(
      {
        error:
          "Analysis failed — this document could not be processed by any available AI provider.",
      },
      { status: 502 }
    );
  }

  // ── 6. Parse Anthropic JSON ───────────────────────────────────────────────
  const aiData = await anthropicRes.json();
  rawText = aiData.content?.[0]?.text ?? "";

  console.log(
    `[analyse-accounts] ${companyNumber}: Claude responded (${rawText.length} chars)`
  );

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

    const strArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

    analysis = {
      // ── New 12-section format ────────────────────────────────────────
      executiveSummary:
        typeof parsed.executiveSummary === "string"
          ? parsed.executiveSummary
          : undefined,
      financialPerformance: parsed.financialPerformance
        ? {
            summary: parsed.financialPerformance.summary ?? "",
            revenueGrowth: parsed.financialPerformance.revenueGrowth ?? "",
            marginAnalysis: parsed.financialPerformance.marginAnalysis ?? "",
            yearOnYearTrend: parsed.financialPerformance.yearOnYearTrend ?? "",
          }
        : undefined,
      balanceSheetStrength: parsed.balanceSheetStrength
        ? {
            summary: parsed.balanceSheetStrength.summary ?? "",
            assets: parsed.balanceSheetStrength.assets ?? "",
            debt: parsed.balanceSheetStrength.debt ?? "",
            workingCapital: parsed.balanceSheetStrength.workingCapital ?? "",
          }
        : undefined,
      cashPosition: parsed.cashPosition
        ? {
            summary: parsed.cashPosition.summary ?? "",
            cashAndEquivalents: parsed.cashPosition.cashAndEquivalents ?? "",
            cashConversion: parsed.cashPosition.cashConversion ?? "",
            liquidityRisk: parsed.cashPosition.liquidityRisk ?? "",
          }
        : undefined,
      managementCommentary: parsed.managementCommentary
        ? {
            summary: parsed.managementCommentary.summary ?? "",
            keyThemes: strArray(parsed.managementCommentary.keyThemes),
            assessment: parsed.managementCommentary.assessment ?? "",
          }
        : undefined,
      auditorAndGoingConcern: parsed.auditorAndGoingConcern
        ? {
            auditorName: parsed.auditorAndGoingConcern.auditorName ?? "",
            auditOpinion: parsed.auditorAndGoingConcern.auditOpinion ?? "",
            goingConcernFlag: Boolean(
              parsed.auditorAndGoingConcern.goingConcernFlag
            ),
            goingConcernDetail:
              parsed.auditorAndGoingConcern.goingConcernDetail ?? "",
            emphasisOfMatter:
              parsed.auditorAndGoingConcern.emphasisOfMatter ?? "",
          }
        : undefined,
      relatedPartyTransactions: parsed.relatedPartyTransactions
        ? {
            summary: parsed.relatedPartyTransactions.summary ?? "",
            transactions: strArray(parsed.relatedPartyTransactions.transactions),
            assessment: parsed.relatedPartyTransactions.assessment ?? "",
          }
        : undefined,
      filingBehaviour: parsed.filingBehaviour
        ? {
            accountsMadeUpTo: parsed.filingBehaviour.accountsMadeUpTo ?? "",
            filingPattern: parsed.filingBehaviour.filingPattern ?? "",
            accountsType: parsed.filingBehaviour.accountsType ?? "",
          }
        : undefined,
      keyRisks: parsed.keyRisks
        ? {
            summary: parsed.keyRisks.summary ?? "",
            risks: strArray(parsed.keyRisks.risks),
          }
        : undefined,
      creditAssessment: parsed.creditAssessment
        ? {
            overallRating: parsed.creditAssessment.overallRating ?? "",
            ratingRationale: parsed.creditAssessment.ratingRationale ?? "",
            keyStrengths: strArray(parsed.creditAssessment.keyStrengths),
            keyConcerns: strArray(parsed.creditAssessment.keyConcerns),
          }
        : undefined,
      redFlags: strArray(parsed.redFlags),

      // ── Structured financial data ─────────────────────────────────────
      financialHealth: {
        revenue: {
          value: typeof parsed.financialHealth?.revenue?.value === "number"
            ? parsed.financialHealth.revenue.value
            : (parseInt(String(parsed.financialHealth?.revenue?.value ?? ""), 10) || 0),
          prior: typeof parsed.financialHealth?.revenue?.prior === "number"
            ? parsed.financialHealth.revenue.prior
            : (parseInt(String(parsed.financialHealth?.revenue?.prior ?? ""), 10) || 0),
          yoyChange: parsed.financialHealth?.revenue?.yoyChange ?? "n/a",
        },
        netProfit: {
          value: typeof parsed.financialHealth?.netProfit?.value === "number"
            ? parsed.financialHealth.netProfit.value
            : (parseInt(String(parsed.financialHealth?.netProfit?.value ?? ""), 10) || 0),
          prior: typeof parsed.financialHealth?.netProfit?.prior === "number"
            ? parsed.financialHealth.netProfit.prior
            : (parseInt(String(parsed.financialHealth?.netProfit?.prior ?? ""), 10) || 0),
          yoyChange: parsed.financialHealth?.netProfit?.yoyChange ?? "n/a",
        },
        operatingProfit: {
          value: typeof parsed.financialHealth?.operatingProfit?.value === "number"
            ? parsed.financialHealth.operatingProfit.value
            : (parseInt(String(parsed.financialHealth?.operatingProfit?.value ?? ""), 10) || 0),
          prior: typeof parsed.financialHealth?.operatingProfit?.prior === "number"
            ? parsed.financialHealth.operatingProfit.prior
            : (parseInt(String(parsed.financialHealth?.operatingProfit?.prior ?? ""), 10) || 0),
          yoyChange: parsed.financialHealth?.operatingProfit?.yoyChange ?? "n/a",
        },
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
      // strategicDirection has different shapes between the old and new
      // formats. Detect the new shape (`summary`/`initiatives`/`outlook`) and
      // preserve it; otherwise build the legacy shape.
      strategicDirection:
        parsed.strategicDirection &&
        (typeof parsed.strategicDirection.summary === "string" ||
          Array.isArray(parsed.strategicDirection.initiatives) ||
          typeof parsed.strategicDirection.outlook === "string")
          ? {
              summary: parsed.strategicDirection.summary ?? "",
              initiatives: strArray(parsed.strategicDirection.initiatives),
              outlook: parsed.strategicDirection.outlook ?? "",
            }
          : {
              managementOutlook:
                parsed.strategicDirection?.managementOutlook ?? "",
              marketsOrGeographies:
                parsed.strategicDirection?.marketsOrGeographies ?? "Not mentioned",
              acquisitionsOrRestructuring:
                parsed.strategicDirection?.acquisitionsOrRestructuring ??
                "None mentioned",
              rdOrInvestment:
                parsed.strategicDirection?.rdOrInvestment ?? "Not mentioned",
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
      signals: (() => {
        const validCreditRisk = (v: unknown): v is "Low" | "Medium" | "High" =>
          v === "Low" || v === "Medium" || v === "High";
        const validCashHealth = (v: unknown): v is "Good" | "Adequate" | "Weak" =>
          v === "Good" || v === "Adequate" || v === "Weak";
        const validAuditOpinion = (v: unknown): v is "Clean" | "Qualified" | "Going concern" =>
          v === "Clean" || v === "Qualified" || v === "Going concern";

        // Derive creditRisk from creditAssessment.overallRating if signals not set
        const rawRating: string = (parsed.creditAssessment?.overallRating ?? "").toLowerCase();
        const derivedCreditRisk: "Low" | "Medium" | "High" =
          rawRating.includes("low") ? "Low" : rawRating.includes("high") ? "High" : "Medium";

        // Derive auditOpinion from auditorAndGoingConcern if signals not set
        const rawAudit: string = (
          parsed.auditorAndGoingConcern?.auditOpinion ??
          parsed.auditOpinion?.opinion ?? ""
        ).toLowerCase();
        const derivedAudit: "Clean" | "Qualified" | "Going concern" =
          rawAudit.includes("going concern")
            ? "Going concern"
            : rawAudit === "clean" || rawAudit.includes("unqualified")
            ? "Clean"
            : rawAudit.length > 0 && rawAudit !== "clean"
            ? "Qualified"
            : "Clean";

        return {
          creditRisk: validCreditRisk(parsed.signals?.creditRisk)
            ? parsed.signals.creditRisk
            : derivedCreditRisk,
          cashHealth: validCashHealth(parsed.signals?.cashHealth)
            ? parsed.signals.cashHealth
            : "Adequate",
          directorRisk: validCreditRisk(parsed.signals?.directorRisk)
            ? parsed.signals.directorRisk
            : "Medium",
          auditOpinion: validAuditOpinion(parsed.signals?.auditOpinion)
            ? parsed.signals.auditOpinion
            : derivedAudit,
        };
      })(),
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
  await setCachedAnalysis(companyNumber, analysis);
  return NextResponse.json(analysis);
}
