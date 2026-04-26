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

export interface DataLedgerFinancials {
  totalAssets: number | null;
  totalLiabilities: number | null;
  equity: number | null;
  currentAssets: number | null;
  fixedAssets: number | null;
  currentLiabilities: number | null;
  cash: number | null;
  turnover: number | null;
  profitLoss: number | null;
  debtToEquity: number | null;
}

export interface DataLedgerData {
  found: true;
  companyNumber: string;
  companyName: string;
  isActive: boolean;
  incorporationDate: string | null;
  averageNumberEmployeesDuringPeriod: number | null;
  accountsLastMadeUpDate: string | null;
  accountsNextDueDate: string | null;
  currentYearFinancials: DataLedgerFinancials;
  previousYearFinancials: Partial<DataLedgerFinancials>;
}

export type DataLedgerResponse = DataLedgerData | { found: false };
