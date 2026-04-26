import { NextRequest, NextResponse } from "next/server";
import type {
  DataLedgerData,
  DataLedgerFinancials,
  DataLedgerResponse,
} from "@/lib/financial-snapshot-types";

export const maxDuration = 15;

const DATALEDGER_BASE = "https://api.dataledger.uk";
const CACHE_TTL = 86_400_000; // 24 h

const cache = new Map<string, { data: DataLedgerResponse; ts: number }>();

function n(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

function extractCurrentFinancials(src: Record<string, unknown>): DataLedgerFinancials {
  return {
    totalAssets: n(src.cCalculatedTotalAssets),
    totalLiabilities: n(src.cCalculatedTotalLiabilities),
    equity: n(src.cCalculatedEquity),
    currentAssets: n(src.cCalculatedTotalCurrentAssets),
    fixedAssets: n(src.cCalculatedTotalFixedAssets),
    currentLiabilities: null,
    cash: null,
    turnover: null,
    profitLoss: n(src.cProfitLoss),
    debtToEquity: n(src.cDebtToEquityRatio),
    verified: src.cVerified === true,
  };
}

function extractPreviousFinancials(src: Record<string, unknown>): Partial<DataLedgerFinancials> {
  return {
    totalAssets: n(src.pCalculatedTotalAssets),
    totalLiabilities: n(src.pCalculatedTotalLiabilities),
    equity: n(src.pCalculatedEquity),
    currentAssets: n(src.pCalculatedTotalCurrentAssets),
    fixedAssets: n(src.pCalculatedTotalFixedAssets),
    profitLoss: n(src.pProfitLoss),
    debtToEquity: n(src.pDebtToEquityRatio),
    verified: src.pVerified === true,
  };
}

/**
 * GET /api/dataledger?companyNumber=12345678
 *
 * Proxies the DataLedger API for structured UK company financials.
 * Returns { found: false } when the company has no data or the API key is absent.
 * Caches results for 24 h per company number.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyNumber = searchParams.get("companyNumber")?.toUpperCase();

  if (!companyNumber) {
    return NextResponse.json({ error: "Missing companyNumber" }, { status: 400 });
  }

  const hit = cache.get(companyNumber);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return NextResponse.json(hit.data);
  }

  const apiKey = process.env.DATALEDGER_API_KEY;
  if (!apiKey) {
    console.log(`[dataledger] ${companyNumber} DATALEDGER_API_KEY not set — returning not-found`);
    return NextResponse.json({ found: false });
  }

  try {
    const url = `${DATALEDGER_BASE}/v1/companies/${companyNumber}`;
    console.log(`[dataledger] ${companyNumber} fetching URL: ${url}`);
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });

    const rawBody = await res.text();
    console.log(`[dataledger] ${companyNumber} response status=${res.status}`);
    console.log(`[dataledger] ${companyNumber} response body (first 500): ${rawBody.slice(0, 500)}`);

    if (res.status === 404 || res.status === 204) {
      const data: DataLedgerResponse = { found: false };
      cache.set(companyNumber, { data, ts: Date.now() });
      return NextResponse.json(data);
    }

    if (!res.ok) {
      console.error(`[dataledger] ${companyNumber} unexpected status ${res.status}`);
      return NextResponse.json({ found: false });
    }

    const json = JSON.parse(rawBody) as Record<string, unknown>;

    const data: DataLedgerData = {
      found: true,
      companyNumber: (json.companyNumber as string) ?? companyNumber,
      companyName: (json.companyName as string) ?? "",
      isActive: (json.isActive as boolean) ?? false,
      incorporationDate: (json.incorporationDate as string | null) ?? null,
      averageNumberEmployeesDuringPeriod:
        (json.averageNumberEmployeesDuringPeriod as number | null) ?? null,
      accountsLastMadeUpDate: (json.accountsLastMadeUpDate as string | null) ?? null,
      accountsNextDueDate: (json.accountsNextDueDate as string | null) ?? null,
      currentYearFinancials: extractCurrentFinancials(json),
      previousYearFinancials: extractPreviousFinancials(json),
      assetsGrowthRate: n(json.assetsGrowthRate),
      netAssetsGrowthRate: n(json.netAssetsGrowthRate),
    };

    console.log(
      `[dataledger] ${companyNumber} ok — totalAssets=${data.currentYearFinancials.totalAssets} equity=${data.currentYearFinancials.equity} verified=${data.currentYearFinancials.verified} assetsGrowthRate=${data.assetsGrowthRate}`
    );

    cache.set(companyNumber, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[dataledger] ${companyNumber} fetch error:`, err);
    return NextResponse.json({ found: false });
  }
}
