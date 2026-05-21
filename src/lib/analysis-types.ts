/**
 * Shared types for AI accounts analysis.
 * No Node.js-only imports — safe to use in both Server Components and
 * client components.
 */

export interface FinancialLineItem {
  value: string;
  yoyChange: string;
}

export interface FinancialLineItemNumeric {
  value: number;
  prior: number;
  yoyChange: string;
}

export interface FinancialHealth {
  revenue: FinancialLineItemNumeric;
  netProfit: FinancialLineItemNumeric;
  operatingProfit: FinancialLineItemNumeric;
}

export interface SignalScores {
  creditRisk: "Low" | "Medium" | "High";
  cashHealth: "Good" | "Adequate" | "Weak";
  directorRisk: "Low" | "Medium" | "High";
  auditOpinion: "Clean" | "Qualified" | "Going concern";
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
  // ── New 12-section format ───────────────────────────────────────────────
  // Optional so cached old-format analyses and existing fallback providers
  // continue to satisfy the type. The component checks `executiveSummary` at
  // runtime to decide which layout to render.
  executiveSummary?: string;
  financialPerformance?: {
    summary: string;
    revenueGrowth: string;
    marginAnalysis: string;
    yearOnYearTrend: string;
  };
  balanceSheetStrength?: {
    summary: string;
    assets: string;
    debt: string;
    workingCapital: string;
  };
  cashPosition?: {
    summary: string;
    cashAndEquivalents: string;
    cashConversion: string;
    liquidityRisk: string;
  };
  managementCommentary?: {
    summary: string;
    keyThemes: string[];
    assessment: string;
  };
  auditorAndGoingConcern?: {
    auditorName: string;
    auditOpinion: string;
    goingConcernFlag: boolean;
    goingConcernDetail: string;
    emphasisOfMatter: string;
  };
  relatedPartyTransactions?: {
    summary: string;
    transactions: string[];
    assessment: string;
  };
  filingBehaviour?: {
    accountsMadeUpTo: string;
    filingPattern: string;
    accountsType: string;
  };
  keyRisks?: {
    summary: string;
    risks: string[];
  };
  creditAssessment?: {
    overallRating: string;
    ratingRationale: string;
    keyStrengths: string[];
    keyConcerns: string[];
  };
  redFlags?: string[];

  // ── Signal scores — always populated ────────────────────────────────────
  signals?: SignalScores;

  // ── Legacy fields (still produced by the existing parser & cache) ───────
  // Typed as `any` so the legacy rendering path keeps compiling without
  // touching every consumer.
  financialHealth?: any;
  margins?: any;
  balanceSheet?: any;
  cashFlowSignals?: any;
  directorFlags?: any;
  // Note: `strategicDirection` is shared between old and new formats with
  // different shapes. Typed as `any` so both shapes work.
  strategicDirection?: any;
  risksAndWarnings?: any;
  auditOpinion?: any;
  complianceSignals?: any;

  // ── Metadata added by our route — not part of the AI response ───────────
  analysedAt: string;
  companyNumber: string;
  documentDate?: string;
  cached?: boolean;
  error?: string;
  provider?: "anthropic" | "gemini" | "mistral" | "google-docai";
}
