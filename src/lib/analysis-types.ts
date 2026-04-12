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
  assets: number | null;
  liabilities: number | null;
  employees: number | null;
  currency: string;
}

export interface AccountsAnalysis {
  risks: AnalysisRisk[];
  financials: AnalysisFinancials;
  summary: string;
  auditOpinion: "clean" | "qualified" | "adverse" | "disclaimer" | "unknown";
  goingConcern: boolean;
  keyEvents: string[];
  // Metadata added by our route — not part of Claude's response
  analysedAt: string;
  companyNumber: string;
  documentDate?: string;
  cached?: boolean;
  error?: string;
}
