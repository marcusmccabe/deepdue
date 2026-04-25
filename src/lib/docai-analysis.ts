import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import type { AccountsAnalysis } from "./analysis-types";

// Kept in sync with the prompt in src/app/api/analyse-accounts/route.ts
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

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

export async function analyseWithDocAI(
  pdfBuffer: Buffer,
  companyNumber: string,
  documentDate?: string
): Promise<AccountsAnalysis> {
  const apiKey = process.env.GOOGLE_DOCUMENT_AI_API_KEY;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const processorId = process.env.GOOGLE_CLOUD_PROCESSOR_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us";

  if (!apiKey) throw new Error("GOOGLE_DOCUMENT_AI_API_KEY is not configured");
  if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT_ID is not configured");
  if (!processorId) throw new Error("GOOGLE_CLOUD_PROCESSOR_ID is not configured");

  // ── Step 1: OCR via Google Document AI ──────────────────────────────────────
  const client = new DocumentProcessorServiceClient({ apiKey });

  const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  const [result] = await client.processDocument({
    name: processorName,
    rawDocument: {
      content: pdfBuffer.toString("base64"),
      mimeType: "application/pdf",
    },
  });

  const pages = result.document?.pages ?? [];
  const extractedText = pages
    .flatMap((page) =>
      (page.paragraphs ?? []).map((para) => {
        const segments = para.layout?.textAnchor?.textSegments ?? [];
        return segments
          .map((seg) => {
            const start = Number(seg.startIndex ?? 0);
            const end = Number(seg.endIndex ?? 0);
            return result.document?.text?.slice(start, end) ?? "";
          })
          .join("");
      })
    )
    .join("\n")
    .trim();

  // Fall back to full document text if paragraph extraction produced nothing
  const ocrText = extractedText || (result.document?.text ?? "");

  if (!ocrText) {
    throw new Error("Document AI OCR produced no text from the PDF");
  }

  console.log(
    `[docai-analysis] ${companyNumber}: OCR extracted ${ocrText.length} chars`
  );

  // ── Step 2: Send OCR text to Claude as plain text ────────────────────────────
  const anthropicRes = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is the full text extracted from a UK Companies House filed accounts PDF document:\n\n${ocrText}\n\nPlease analyse this company accounts document.`,
        },
      ],
    }),
  });

  if (!anthropicRes.ok) {
    const body = await anthropicRes.text().catch(() => "");
    throw new Error(
      `Anthropic API error in DocAI fallback (${anthropicRes.status}): ${body.slice(0, 200)}`
    );
  }

  const aiData = await anthropicRes.json();
  const rawText: string = aiData.content?.[0]?.text ?? "";

  console.log(
    `[docai-analysis] ${companyNumber}: Claude responded (${rawText.length} chars)`
  );

  const jsonText = rawText
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();

  const parsed = JSON.parse(jsonText);

  const lineItem = (x: { value?: string; yoyChange?: string } | undefined) => ({
    value: x?.value ?? "n/a",
    yoyChange: x?.yoyChange ?? "n/a",
  });

  return {
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
    documentDate,
    cached: false,
    provider: "google-docai",
  };
}
