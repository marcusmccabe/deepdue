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

function extractFinancials(src: Record<string, unknown> | null | undefined): DataLedgerFinancials {
  return {
    totalAssets: (src?.totalAssets as number | null) ?? null,
    totalLiabilities: (src?.totalLiabilities as number | null) ?? null,
    equity: (src?.equity as number | null) ?? null,
    currentAssets: (src?.currentAssets as number | null) ?? null,
    fixedAssets: (src?.fixedAssets as number | null) ?? null,
    currentLiabilities: (src?.currentLiabilities as number | null) ?? null,
    cash: (src?.cash as number | null) ?? null,
    turnover: (src?.turnover as number | null) ?? null,
    profitLoss: (src?.profitLoss as number | null) ?? null,
    debtToEquity: (src?.debtToEquity as number | null) ?? null,
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
    console.log(`[dataledger] ${companyNumber} fetching from DataLedger API`);
    const res = await fetch(`${DATALEDGER_BASE}/companies/${companyNumber}`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });

    console.log(`[dataledger] ${companyNumber} response status=${res.status}`);

    if (res.status === 404 || res.status === 204 || res.status === 204) {
      const data: DataLedgerResponse = { found: false };
      cache.set(companyNumber, { data, ts: Date.now() });
      return NextResponse.json(data);
    }

    if (!res.ok) {
      console.error(`[dataledger] ${companyNumber} unexpected status ${res.status}`);
      return NextResponse.json({ found: false });
    }

    const json = await res.json() as Record<string, unknown>;

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
      currentYearFinancials: extractFinancials(
        json.currentYearFinancials as Record<string, unknown> | null
      ),
      previousYearFinancials: extractFinancials(
        json.previousYearFinancials as Record<string, unknown> | null
      ),
    };

    console.log(
      `[dataledger] ${companyNumber} ok — totalAssets=${data.currentYearFinancials.totalAssets} equity=${data.currentYearFinancials.equity} turnover=${data.currentYearFinancials.turnover}`
    );

    cache.set(companyNumber, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[dataledger] ${companyNumber} fetch error:`, err);
    return NextResponse.json({ found: false });
  }
}
