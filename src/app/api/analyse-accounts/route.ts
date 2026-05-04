import { NextRequest, NextResponse } from "next/server";
import { analyseCompany, AnalyseError } from "@/lib/analyse-company";

// Allow up to 60 s for the full pipeline (Vercel Pro; free tier caps at 10 s)
export const maxDuration = 60;

/**
 * GET /api/analyse-accounts?companyNumber=12345678
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyNumber = searchParams.get("companyNumber")?.toUpperCase();

  if (!companyNumber) {
    return NextResponse.json(
      { error: "Missing companyNumber query parameter" },
      { status: 400 }
    );
  }

  try {
    const analysis = await analyseCompany(companyNumber);
    if (!analysis) {
      return NextResponse.json(
        { error: "No analysis result returned" },
        { status: 500 }
      );
    }
    return NextResponse.json(analysis);
  } catch (err) {
    const status = err instanceof AnalyseError ? err.status : 502;
    const message =
      err instanceof Error ? err.message : "Unexpected error during analysis";
    return NextResponse.json({ error: message }, { status });
  }
}
