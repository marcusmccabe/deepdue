import { Mistral } from "@mistralai/mistralai";
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

export async function analyseWithMistral(
  pdfBase64: string,
  companyNumber: string,
  documentDate?: string
): Promise<AccountsAnalysis> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY is not configured");

  const client = new Mistral({ apiKey });

  const response = await client.chat.complete({
    model: "mistral-large-latest",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "document_url",
            documentUrl: `data:application/pdf;base64,${pdfBase64}`,
          } as { type: "document_url"; documentUrl: string },
          {
            type: "text",
            text: "Please analyse this company accounts document.",
          },
        ],
      },
    ],
  });

  const rawText =
    (response.choices?.[0]?.message?.content as string | undefined) ?? "";

  console.log(
    `[mistral-analysis] ${companyNumber}: Mistral responded (${rawText.length} chars)`
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
    provider: "mistral",
  };
}
