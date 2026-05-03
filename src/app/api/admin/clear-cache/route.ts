import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_SECRET = "docudata-cache-clear-2026";

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(request: NextRequest) {
  if (request.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceRoleClient();

  const { error, count } = await supabase
    .from("analysis_cache")
    .delete({ count: "exact" })
    .neq("company_number", "");

  if (error) {
    console.error("[clear-cache] delete error:", error.message);
    return NextResponse.json(
      { error: "Failed to clear cache", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Cache cleared — ${count ?? 0} row(s) deleted.`,
    deletedCount: count ?? 0,
  });
}
