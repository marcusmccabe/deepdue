/**
 * Shared types for AI accounts analysis.
 * No Node.js-only imports — safe to use in both Server Components and
 * client components.
 */

export interface FinancialLineItem {
  value: string;
  yoyChange: string;
}

export interface FinancialHealth {
  revenue: FinancialLineItem;
  grossProfit: FinancialLineItem;
  operatingProfit: FinancialLineItem;
  netProfit: FinancialLineItem;
  cashPosition: string;
  netAssets: string;
}

export interface Margins {
  grossMargin: string;
  operatingMargin: string;
  trend: string;
}

export interface BalanceSheet {
  currentRatio: string;
  gearing: string;
  assetWriteDowns: string;
}

export interface CashFlowSignals {
  profitToCashConversion: string;
  capex: string;
  summary: string;
}

export interface DirectorFlags {
  directorLoans: string;
  relatedPartyTransactions: string;
  remunerationNotes: string;
}

export interface StrategicDirection {
  managementOutlook: string;
  marketsOrGeographies: string;
  acquisitionsOrRestructuring: string;
  rdOrInvestment: string;
}

export interface RisksAndWarnings {
  explicitRisks: string[];
  materialUncertainties: string;
  goingConcern: string;
}

export interface AuditOpinion {
  opinion: "Clean" | "Qualified" | "Adverse" | "Disclaimer of opinion";
  qualifications: string;
  auditorName: string;
  auditorChanged: boolean;
}

export interface ComplianceSignals {
  lateFilingHistory: string;
  dormancyOrStrikeOff: string;
  chargesRegistered: string;
}

export interface AccountsAnalysis {
  financialHealth: FinancialHealth;
  margins: Margins;
  balanceSheet: BalanceSheet;
  cashFlowSignals: CashFlowSignals;
  directorFlags: DirectorFlags;
  strategicDirection: StrategicDirection;
  risksAndWarnings: RisksAndWarnings;
  auditOpinion: AuditOpinion;
  complianceSignals: ComplianceSignals;
  // Metadata added by our route — not part of the AI response
  analysedAt: string;
  companyNumber: string;
  documentDate?: string;
  cached?: boolean;
  error?: string;
  provider?: "anthropic" | "gemini";
}
