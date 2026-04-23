export interface FinancialYear {
  periodEnd: string;
  year: string;
  turnover: number | null;
  operatingProfit: number | null;
  netAssets: number | null;
  cashAtBank: number | null;
  totalLiabilities: number | null;
  hasData: boolean;
}

export interface FinancialSnapshot {
  companyNumber: string;
  years: FinancialYear[];
  fetchedAt: string;
  cached?: boolean;
  source: "ixbrl" | "none" | "pdf-only";
  error?: string;
}
