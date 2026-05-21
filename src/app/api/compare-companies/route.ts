import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { AccountsAnalysis } from "@/lib/analysis-types";
import type { FinancialSnapshot, FinancialYear } from "@/lib/financial-snapshot-types";

export const maxDuration = 300;

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const CH_BASE = "https://api.company-information.service.gov.uk";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function chAuth(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY ?? "";
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

// ── Signal derivations (mirrors AIAnalysisCard) ─────────────────────────────
function deriveSignals(analysis: AccountsAnalysis) {
  const cp = analysis.cashPosition;
  const ag = analysis.auditorAndGoingConcern;
  const rp = analysis.relatedPartyTransactions;
  const ca = analysis.creditAssessment;

  const ratingText = (ca?.overallRating ?? "").toLowerCase();
  const creditRisk = ratingText.includes("high")
    ? "High"
    : ratingText.includes("low")
    ? "Low"
    : ratingText
    ? "Medium"
    : "Unknown";

  const cashSummary = (cp?.summary ?? "").toLowerCase();
  const cashHealth = /weak|tight|stretched|insufficient|risk|concern|thin/.test(cashSummary)
    ? "Weak"
    : /good|strong|healthy|robust/.test(cashSummary)
    ? "Good"
    : cashSummary
    ? "Adequate"
    : "Unknown";

  const dirCount = rp?.transactions?.length ?? 0;
  const directorRisk = dirCount === 0 ? "Low" : dirCount > 2 ? "High" : "Medium";

  const opinion = ag?.auditOpinion ?? "";
  const auditOpinion = ag?.goingConcernFlag
    ? "Going concern"
    : opinion || "Unknown";

  return { creditRisk, cashHealth, directorRisk, auditOpinion };
}

// ── Period year extraction ─────────────────────────────────────────────────
function periodYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = iso.match(/(\d{4})/);
  return m ? m[1] : iso;
}

interface CompanyMeta {
  companyNumber: string;
  companyName: string;
  accountsPeriod: string;
  yearLabelCurrent: string;
  yearLabelPrior: string;
  analysis: AccountsAnalysis;
  signals: { creditRisk: string; cashHealth: string; directorRisk: string; auditOpinion: string };
  financials: {
    revenueCurrent: number | null;
    revenuePrior: number | null;
    profitCurrent: number | null;
    profitPrior: number | null;
    marginCurrent: number | null;
    marginPrior: number | null;
  };
}

async function fetchCompanyName(companyNumber: string): Promise<string> {
  try {
    const res = await fetch(`${CH_BASE}/company/${companyNumber}`, {
      headers: { Authorization: chAuth() },
      cache: "no-store",
    });
    if (!res.ok) return companyNumber;
    const data = await res.json();
    return (data.company_name as string) || companyNumber;
  } catch {
    return companyNumber;
  }
}

async function fetchSnapshot(
  companyNumber: string,
  origin: string
): Promise<FinancialSnapshot | null> {
  try {
    const res = await fetch(
      `${origin}/api/financial-snapshot?companyNumber=${encodeURIComponent(companyNumber)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return (await res.json()) as FinancialSnapshot;
  } catch {
    return null;
  }
}

function extractFinancials(snapshot: FinancialSnapshot | null) {
  if (!snapshot || !Array.isArray(snapshot.years) || snapshot.years.length === 0) {
    return {
      revenueCurrent: null,
      revenuePrior: null,
      profitCurrent: null,
      profitPrior: null,
      marginCurrent: null,
      marginPrior: null,
      currentPeriodEnd: null as string | null,
      priorPeriodEnd: null as string | null,
    };
  }
  const sorted = [...snapshot.years]
    .filter((y) => y && y.periodEnd)
    .sort((a, b) => (a.periodEnd > b.periodEnd ? -1 : 1));
  const current: FinancialYear | undefined = sorted[0];
  const prior: FinancialYear | undefined = sorted[1];

  const marginOf = (y: FinancialYear | undefined): number | null => {
    if (!y || y.turnover == null || y.operatingProfit == null || y.turnover === 0) return null;
    return (y.operatingProfit / y.turnover) * 100;
  };

  return {
    revenueCurrent: current?.turnover ?? null,
    revenuePrior: prior?.turnover ?? null,
    profitCurrent: current?.operatingProfit ?? null,
    profitPrior: prior?.operatingProfit ?? null,
    marginCurrent: marginOf(current),
    marginPrior: marginOf(prior),
    currentPeriodEnd: current?.periodEnd ?? null,
    priorPeriodEnd: prior?.periodEnd ?? null,
  };
}

interface ComparativeResponse {
  sectorStrengths: string;
  commonWeaknesses: string;
  inferences: string;
  riskFlags: string;
  competitivePositioning: string;
  strengthRanking: Array<{
    companyNumber: string;
    companyName: string;
    score: number;
    rationale: string;
  }>;
  askContext: string;
}

async function callClaude(
  companies: CompanyMeta[],
  retry: boolean
): Promise<ComparativeResponse | null> {
  const system =
    'You are a financial intelligence analyst comparing UK companies. Respond ONLY with a valid JSON object — no preamble, no markdown fences, no explanation. The JSON must match this exact shape:\n{\n  sectorStrengths: string,\n  commonWeaknesses: string,\n  inferences: string,\n  riskFlags: string,\n  competitivePositioning: string,\n  strengthRanking: [\n    {\n      companyNumber: string,\n      companyName: string,\n      score: number,\n      rationale: string\n    }\n  ],\n  askContext: string\n}\nstrengthRanking must be ordered best to worst. score is 0-100. Each string field is 2-3 sentences maximum. askContext is a one-paragraph summary of all companies for use as AI chat context.' +
    (retry ? "\n\nReturn only raw JSON, nothing else." : "");

  const payload = companies.map((c) => ({
    companyNumber: c.companyNumber,
    companyName: c.companyName,
    analysis_data: c.analysis,
  }));

  const userMessage = `Compare these companies and return the JSON:\n${JSON.stringify(payload)}`;

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    console.error("[compare-companies] Anthropic error:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";

  // Strip code fences defensively
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as ComparativeResponse;
  } catch (e) {
    console.error("[compare-companies] JSON parse failed:", e, "text:", text.slice(0, 500));
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body: { companyNumbers?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const companyNumbers = (body.companyNumbers ?? [])
    .map((n) => (n || "").toString().toUpperCase().trim())
    .filter((n) => n.length > 0);

  if (companyNumbers.length < 2 || companyNumbers.length > 5) {
    return NextResponse.json(
      { error: "Provide between 2 and 5 company numbers" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase unavailable" }, { status: 500 });
  }

  const { data: cached, error } = await supabase
    .from("analysis_cache")
    .select("company_number, analysis, accounts_date, cached_at")
    .in("company_number", companyNumbers);

  if (error) {
    console.error("[compare-companies] cache query error:", error.message);
    return NextResponse.json({ error: "Cache query failed" }, { status: 500 });
  }

  const cachedMap = new Map<string, { analysis: AccountsAnalysis; accounts_date: string | null }>();
  for (const row of cached ?? []) {
    cachedMap.set(row.company_number as string, {
      analysis: row.analysis as AccountsAnalysis,
      accounts_date: (row.accounts_date as string | null) ?? null,
    });
  }

  const missing = companyNumbers.filter((n) => !cachedMap.has(n));
  if (missing.length > 0) {
    return NextResponse.json({ status: "missing", missing });
  }

  const origin = new URL(request.url).origin;

  // Parallel: company name + financial snapshot per company
  const enriched: CompanyMeta[] = await Promise.all(
    companyNumbers.map(async (num) => {
      const cacheEntry = cachedMap.get(num)!;
      const analysis = cacheEntry.analysis;
      const [companyName, snapshot] = await Promise.all([
        fetchCompanyName(num),
        fetchSnapshot(num, origin),
      ]);
      const fin = extractFinancials(snapshot);
      const accountsPeriod =
        cacheEntry.accounts_date ||
        analysis.documentDate ||
        fin.currentPeriodEnd ||
        "";
      return {
        companyNumber: num,
        companyName,
        accountsPeriod,
        yearLabelCurrent: periodYear(fin.currentPeriodEnd || accountsPeriod),
        yearLabelPrior: periodYear(fin.priorPeriodEnd),
        analysis,
        signals: deriveSignals(analysis),
        financials: {
          revenueCurrent: fin.revenueCurrent,
          revenuePrior: fin.revenuePrior,
          profitCurrent: fin.profitCurrent,
          profitPrior: fin.profitPrior,
          marginCurrent: fin.marginCurrent,
          marginPrior: fin.marginPrior,
        },
      };
    })
  );

  let comparative = await callClaude(enriched, false);
  if (!comparative) {
    comparative = await callClaude(enriched, true);
  }
  if (!comparative) {
    return NextResponse.json(
      { error: "Failed to parse comparative analysis" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "ok",
    companies: enriched.map((c) => ({
      companyNumber: c.companyNumber,
      companyName: c.companyName,
      accountsPeriod: c.accountsPeriod,
      yearLabelCurrent: c.yearLabelCurrent,
      yearLabelPrior: c.yearLabelPrior,
      signals: c.signals,
      financials: c.financials,
    })),
    comparative: {
      sectorStrengths: comparative.sectorStrengths,
      commonWeaknesses: comparative.commonWeaknesses,
      inferences: comparative.inferences,
      riskFlags: comparative.riskFlags,
      competitivePositioning: comparative.competitivePositioning,
      strengthRanking: comparative.strengthRanking,
    },
    askContext: comparative.askContext,
  });
}
