import { NextRequest, NextResponse } from "next/server";
import type { FinancialYear, FinancialSnapshot } from "@/lib/financial-snapshot-types";

export const maxDuration = 30;

const CH_BASE = "https://api.company-information.service.gov.uk";
const CH_DOC_BASE = "https://document-api.company-information.service.gov.uk";
const MAX_DOC_BYTES = 6 * 1024 * 1024;
const CACHE_TTL = 86_400_000; // 24 h

const cache = new Map<string, { data: FinancialSnapshot; ts: number }>();

function chAuth(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY ?? "";
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

// ── Concept name suffixes (without namespace prefix) ────────────────────────
// Ordered by likelihood — first match wins.
const TURNOVER_CONCEPTS = [
  "TurnoverRevenue",
  "Turnover",
  "Revenue",
  "TurnoverGrossProfit",
  "RevenueFromContractsWithCustomers",
  "GrossRevenue",
  "NetRevenue",
];
const OP_PROFIT_CONCEPTS = [
  "OperatingProfitLoss",
  "OperatingProfit",
  "ProfitLossFromOperations",
  "ProfitLossBeforeInterestTaxDepreciationAmortisation",
  "ProfitBeforeInterestAndTaxation",
];
const NET_ASSETS_CONCEPTS = [
  "NetAssetsLiabilities",
  "NetAssets",
  "TotalEquity",
  "Equity",
  "ShareholdersEquity",
  "NetAssetsLiabilities1",
  "EquityAttributableToOwnersOfParent",
];
const CASH_CONCEPTS = [
  "CashBankInHand",
  "Cash",
  "CashAndCashEquivalents",
  "CashCashEquivalents",
  "CashAndBankBalances",
  "CashAtBankAndInHand",
  "CashInHand",
];
const LIABILITIES_CONCEPTS = [
  "TotalLiabilities",
  "LiabilitiesTotal",
  "Creditors",
  "TotalCreditors",
  "TotalCurrentLiabilities",
  "CurrentLiabilities",
  "CreditorsAmountsFallingDueWithinOneYear",
];

// ── iXBRL parsing helpers ───────────────────────────────────────────────────

/**
 * Finds context IDs in the iXBRL that correspond to a specific period-end date.
 * Returns { period, instant } where:
 *   - period  = xbrli:context with an endDate matching targetDate (P&L items)
 *   - instant = xbrli:context with an instant matching targetDate (balance sheet items)
 */
function findContexts(
  html: string,
  targetDate: string
): { period: string | null; instant: string | null } {
  let periodCtx: string | null = null;
  let instantCtx: string | null = null;

  // Handles both "xbrli:context" and plain "context" element names
  const contextRe =
    /<(?:[a-z]+:)?context\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/(?:[a-z]+:)?context>/gi;
  let m: RegExpExecArray | null;

  while ((m = contextRe.exec(html)) !== null) {
    if (periodCtx && instantCtx) break;
    const [, id, body] = m;

    if (!periodCtx) {
      const endM = body.match(
        /<(?:[a-z]+:)?endDate>\s*([^\s<]+)\s*<\/(?:[a-z]+:)?endDate>/i
      );
      if (endM && endM[1].trim() === targetDate) periodCtx = id;
    }

    if (!instantCtx) {
      const instM = body.match(
        /<(?:[a-z]+:)?instant>\s*([^\s<]+)\s*<\/(?:[a-z]+:)?instant>/i
      );
      if (instM && instM[1].trim() === targetDate) instantCtx = id;
    }
  }

  return { period: periodCtx, instant: instantCtx };
}

/**
 * Extracts the first matching financial concept from the iXBRL.
 * If ctxRef is provided, only returns a value where contextRef matches.
 * Falls back to the first occurrence if ctxRef is null.
 */
function extractConcept(
  html: string,
  ctxRef: string | null,
  concepts: string[]
): number | null {
  for (const concept of concepts) {
    const conceptLower = concept.toLowerCase();

    const re = /<ix:nonFraction\b([^>]*)>([\s\S]*?)<\/ix:nonFraction>/gi;
    let m: RegExpExecArray | null;

    while ((m = re.exec(html)) !== null) {
      const [, attrs, rawContent] = m;

      // Concept name match (any namespace prefix, case-insensitive)
      const nameM = attrs.match(/\bname="[^:]+:([^"]+)"/i);
      if (!nameM || nameM[1].toLowerCase() !== conceptLower) continue;

      // Context filter
      if (ctxRef !== null) {
        const ctxM = attrs.match(/\bcontextRef="([^"]+)"/i);
        if (!ctxM || ctxM[1] !== ctxRef) continue;
      }

      // Scale (multiply displayed value by 10^scale to get actual)
      const scaleM = attrs.match(/\bscale="(-?\d+)"/i);
      const scale = scaleM ? parseInt(scaleM[1], 10) : 0;

      // Sign inversion (sign="-" means the positive display represents a negative value)
      const signM = attrs.match(/\bsign="([-+])"/i);
      const negate = signM?.[1] === "-";

      // Strip nested HTML tags and whitespace/formatting from value
      const stripped = rawContent
        .replace(/<[^>]+>/g, "")
        .replace(/[\s,  ]/g, "");

      if (!stripped || stripped === "-" || stripped === "—") continue;

      const num = parseFloat(stripped);
      if (isNaN(num)) continue;

      let val = num * Math.pow(10, scale);
      if (negate) val = -val;
      return val;
    }
  }
  return null;
}

async function fetchAndParseIxbrl(
  docId: string,
  periodEnd: string
): Promise<Omit<FinancialYear, "periodEnd" | "year">> {
  const empty = {
    turnover: null,
    operatingProfit: null,
    netAssets: null,
    cashAtBank: null,
    totalLiabilities: null,
    hasData: false,
  };

  try {
    const res = await fetch(`${CH_DOC_BASE}/document/${docId}/content`, {
      headers: { Authorization: chAuth(), Accept: "application/xhtml+xml" },
      cache: "no-store",
    });

    if (!res.ok) return empty;

    const ct = res.headers.get("content-type") ?? "";
    const isIxbrl =
      ct.includes("xhtml") || ct.includes("xml") || ct.includes("xbrl");
    if (!isIxbrl) {
      // PDF or unknown — not structured data
      await res.body?.cancel();
      return empty;
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_DOC_BYTES) return empty;

    const html = new TextDecoder("utf-8").decode(buf);

    const { period: periodCtx, instant: instantCtx } = findContexts(
      html,
      periodEnd
    );

    // P&L figures use period (duration) context; balance-sheet uses instant context
    const turnover = extractConcept(html, periodCtx, TURNOVER_CONCEPTS);
    const operatingProfit = extractConcept(html, periodCtx, OP_PROFIT_CONCEPTS);
    const netAssets = extractConcept(html, instantCtx, NET_ASSETS_CONCEPTS);
    const cashAtBank = extractConcept(html, instantCtx, CASH_CONCEPTS);
    const totalLiabilities = extractConcept(
      html,
      instantCtx,
      LIABILITIES_CONCEPTS
    );

    // If context-filtered extraction came up empty, fall back to first-match
    const result = {
      turnover:
        turnover ??
        (periodCtx === null
          ? extractConcept(html, null, TURNOVER_CONCEPTS)
          : null),
      operatingProfit:
        operatingProfit ??
        (periodCtx === null
          ? extractConcept(html, null, OP_PROFIT_CONCEPTS)
          : null),
      netAssets:
        netAssets ??
        (instantCtx === null
          ? extractConcept(html, null, NET_ASSETS_CONCEPTS)
          : null),
      cashAtBank:
        cashAtBank ??
        (instantCtx === null
          ? extractConcept(html, null, CASH_CONCEPTS)
          : null),
      totalLiabilities:
        totalLiabilities ??
        (instantCtx === null
          ? extractConcept(html, null, LIABILITIES_CONCEPTS)
          : null),
    };

    const hasData = Object.values(result).some((v) => v !== null);
    return { ...result, hasData };
  } catch {
    return empty;
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

/**
 * GET /api/financial-snapshot?companyNumber=12345678
 *
 * Fetches up to 3 years of structured financial figures from iXBRL-tagged
 * annual accounts filed at Companies House.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyNumber = searchParams.get("companyNumber")?.toUpperCase();

  if (!companyNumber) {
    return NextResponse.json(
      { error: "Missing companyNumber" },
      { status: 400 }
    );
  }

  // Cache check
  const hit = cache.get(companyNumber);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return NextResponse.json({ ...hit.data, cached: true });
  }

  // Fetch accounts filing history
  let filings: Array<{
    type?: string;
    date?: string;
    description_values?: Record<string, string>;
    links?: { document_metadata?: string };
  }>;

  try {
    const res = await fetch(
      `${CH_BASE}/company/${companyNumber}/filing-history?category=accounts&items_per_page=15`,
      { headers: { Authorization: chAuth() }, cache: "no-store" }
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `Filing history ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    filings = data.items ?? [];
  } catch {
    return NextResponse.json({ error: "Network error" }, { status: 502 });
  }

  // Filter: full accounts (AA) or amended full accounts (AAMD) with document links
  const ACCOUNT_TYPES = new Set(["AA", "AAMD"]);
  const candidates = filings
    .filter((f) => ACCOUNT_TYPES.has(f.type ?? "") && f.links?.document_metadata)
    .slice(0, 3);

  // Download & parse each filing in parallel
  const settled = await Promise.allSettled(
    candidates.map(async (filing): Promise<FinancialYear> => {
      const periodEnd =
        filing.description_values?.made_up_date ?? filing.date ?? "";
      const year = periodEnd.substring(0, 4);

      const metaUrl = filing.links!.document_metadata!;
      const idMatch = metaUrl.match(/\/document\/([^/?]+)/);
      if (!idMatch) {
        return {
          periodEnd,
          year,
          turnover: null,
          operatingProfit: null,
          netAssets: null,
          cashAtBank: null,
          totalLiabilities: null,
          hasData: false,
        };
      }

      const figures = await fetchAndParseIxbrl(idMatch[1], periodEnd);
      return { periodEnd, year, ...figures };
    })
  );

  const years: FinancialYear[] = settled
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<FinancialYear>).value);

  const snapshot: FinancialSnapshot = {
    companyNumber,
    years,
    fetchedAt: new Date().toISOString(),
    source: years.some((y) => y.hasData) ? "ixbrl" : "none",
  };

  cache.set(companyNumber, { data: snapshot, ts: Date.now() });
  return NextResponse.json(snapshot);
}
