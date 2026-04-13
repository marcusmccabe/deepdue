/**
 * Shared types for AI accounts analysis.
 * No Node.js-only imports — safe to use in both Server Components and
 * client components.
 */

export interface FinancialSnapshot {
  revenue: number | null;
  grossProfit: number | null;
  operatingProfit: number | null;
  netProfit: number | null;
  cash: number | null;
  netAssets: number | null;
  totalDebt: number | null;
  employeeCount: number | null;
}

export interface AttentionItem {
  heading: string;
  detail: string;
}

export interface AuditOpinion {
  opinion: "clean" | "qualified" | "adverse" | "disclaimer" | "unknown";
  auditorName: string | null;
  auditorChanged: boolean | null;
  emphasisOfMatter: string | null;
}

export interface GoingConcern {
  flagged: boolean;
  detail: string | null;
}

export interface DirectorLoans {
  present: boolean;
  detail: string | null;
}

export interface RelatedPartyTransactions {
  present: boolean;
  detail: string | null;
}

export interface GroupEntity {
  name: string;
  relationship: string;
}

export interface StrategicIntelligence {
  plannedProducts?: string[];
  plannedMarkets?: string[];
  groupEntitiesMentioned?: GroupEntity[];
  strategicInitiatives?: string[];
  competitivePositioning?: string | null;
  regulatoryOrLegalDevelopments?: string[];
}

export interface AccountsAnalysis {
  financialSnapshot?: FinancialSnapshot;
  keyMovements?: string[];
  itemsForAttention?: AttentionItem[];
  keyEvents?: string[];
  managementCommentary?: string;
  auditOpinion?: AuditOpinion;
  goingConcern?: GoingConcern;
  directorLoans?: DirectorLoans;
  relatedPartyTransactions?: RelatedPartyTransactions;
  strategicIntelligence?: StrategicIntelligence;
  // Metadata added by our route — not part of Claude's response
  analysedAt: string;
  companyNumber: string;
  documentDate?: string;
  cached?: boolean;
  error?: string;
}
