/**
 * Shared types for AI accounts analysis.
 * No Node.js-only imports — safe to use in both Server Components and
 * client components.
 */

export interface AnalysisRisk {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
}

export interface AnalysisFinancials {
  revenue: number | null;
  profit: number | null;
  grossProfit: number | null;
  operatingProfit: number | null;
  assets: number | null;
  liabilities: number | null;
  netAssets: number | null;
  cash: number | null;
  debt: number | null;
  employees: number | null;
  currency: string;
  periodEnd: string | null;
}

export interface PriorYearFinancials {
  revenue: number | null;
  profit: number | null;
  assets: number | null;
  liabilities: number | null;
  cash: number | null;
}

export interface DirectorLoans {
  present: boolean;
  detail: string | null;
  totalValue: number | null;
}

export interface RelatedPartyTransactions {
  present: boolean;
  detail: string | null;
}

export interface LegalProceedings {
  present: boolean;
  detail: string | null;
}

export interface CyberOrOperationalRisk {
  present: boolean;
  detail: string | null;
}

export interface CashFlowAnalysis {
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  cashBurnMonthly: number | null;
  cashRunwayMonths: number | null;
  detail: string;
}

export interface RevenueConcentration {
  concentrated: boolean | null;
  detail: string | null;
}

export interface AccountsAnalysis {
  risks: AnalysisRisk[];
  financials: AnalysisFinancials;
  priorYearFinancials: PriorYearFinancials | null;
  summary: string;
  auditOpinion: "clean" | "qualified" | "adverse" | "disclaimer" | "unknown";
  auditorName: string | null;
  auditorChanged: boolean | null;
  goingConcern: boolean;
  goingConcernDetail: string | null;
  goingConcernRunwayMonths: number | null;
  directorLoans: DirectorLoans;
  relatedPartyTransactions: RelatedPartyTransactions;
  legalProceedings: LegalProceedings;
  cyberOrOperationalRisk: CyberOrOperationalRisk;
  cashFlowAnalysis: CashFlowAnalysis;
  revenueConcentration: RevenueConcentration;
  managementSentiment: "positive" | "cautious" | "negative" | "mixed" | "unknown";
  managementSentimentDetail: string | null;
  yearOnYearNarrative: string | null;
  keyEvents: string[];
  emphasisOfMatter: string | null;
  sectorBenchmarkCommentary: string | null;
  verdict?: string;
  verdictRating?: "low" | "medium" | "high" | "critical";
  conclusion?: string;
  // Metadata added by our route — not part of Claude's response
  analysedAt: string;
  companyNumber: string;
  documentDate?: string;
  cached?: boolean;
  error?: string;
}
