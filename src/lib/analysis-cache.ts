/**
 * Supabase-backed analysis cache — server-side only.
 *
 * Reads and writes to the analysis_cache table. Returns null (cache miss) if
 * the row is missing or older than CACHE_TTL_DAYS.
 */
import { createClient } from "@supabase/supabase-js";
import type { AccountsAnalysis } from "./analysis-types";

const CACHE_TTL_DAYS = 30;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function getCachedAnalysis(
  companyNumber: string
): Promise<AccountsAnalysis | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CACHE_TTL_DAYS);

  const { data, error } = await supabase
    .from("analysis_cache")
    .select("analysis, cached_at")
    .eq("company_number", companyNumber.toUpperCase())
    .gt("cached_at", cutoff.toISOString())
    .maybeSingle();

  if (error || !data) return null;

  return { ...(data.analysis as AccountsAnalysis), cached: true };
}

export async function setCachedAnalysis(
  companyNumber: string,
  analysis: AccountsAnalysis
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from("analysis_cache").upsert(
    {
      company_number: companyNumber.toUpperCase(),
      analysis: { ...analysis, cached: false },
      accounts_date: analysis.documentDate ?? null,
      cached_at: new Date().toISOString(),
    },
    { onConflict: "company_number" }
  );

  if (error) {
    console.error("[analysis-cache] upsert error:", error.message);
  }
}

export async function clearCachedAnalysis(companyNumber: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  await supabase
    .from("analysis_cache")
    .delete()
    .eq("company_number", companyNumber.toUpperCase());
}
