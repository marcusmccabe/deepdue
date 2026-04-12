import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://api.company-information.service.gov.uk";

/**
 * GET /api/companies-house?path=/search/companies&q=tesco
 *
 * Proxies any Companies House API request through the server so the API key
 * is never exposed in the browser. The `path` param maps to the CH endpoint;
 * all other params are forwarded as-is.
 *
 * Add ?debug=true to get a diagnostic JSON response instead of hitting CH.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") ?? "";
  const debug = searchParams.get("debug") === "true";

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY ?? "";
  const keyPresent = apiKey.length > 0;
  const keyPreview = keyPresent
    ? apiKey.slice(0, 8) + "*".repeat(Math.max(0, apiKey.length - 8))
    : "(not set)";

  const credentials = Buffer.from(`${apiKey}:`).toString("base64");
  const authHeader = `Basic ${credentials}`;

  // Forward all query params except our internal ones
  const forwarded = new URLSearchParams();
  searchParams.forEach((value, param) => {
    if (param !== "path" && param !== "debug") forwarded.set(param, value);
  });

  const chUrl =
    `${BASE_URL}${path}` +
    (forwarded.toString() ? `?${forwarded.toString()}` : "");

  // Diagnostic logging — always visible in Vercel function logs
  console.log("[companies-house] key present:", keyPresent, "| length:", apiKey.length);

  // Debug mode — return diagnostic info instead of proxying to CH
  if (debug) {
    return NextResponse.json({
      debug: true,
      env: {
        COMPANIES_HOUSE_API_KEY_present: keyPresent,
        COMPANIES_HOUSE_API_KEY_preview: keyPreview,
        COMPANIES_HOUSE_API_KEY_length: apiKey.length,
      },
      auth: {
        header_name: "Authorization",
        header_value: authHeader,
        credentials_base64: credentials,
        decoded_format: keyPresent ? `${keyPreview}:` : "(empty string):",
      },
      request: {
        path_param: path,
        ch_url: chUrl,
      },
    });
  }

  if (!path || !path.startsWith("/")) {
    return NextResponse.json({ error: "Invalid or missing path" }, { status: 400 });
  }

  try {
    const res = await fetch(chUrl, {
      headers: { Authorization: authHeader },
      cache: "no-store",
    });

    console.log("[companies-house] CH response status:", res.status, "for", path);

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach the Companies House API" },
      { status: 502 }
    );
  }
}
