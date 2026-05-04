import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/UserMenu";
import PortfolioClient, {
  type PortfolioCompanyRow,
} from "@/components/PortfolioClient";
import type { AccountsAnalysis } from "@/lib/analysis-types";

const NAV_ITEMS = [
  { icon: "🔍", label: "Search", href: "/" },
  { icon: "📊", label: "Dashboard", href: "/dashboard" },
  { icon: "📁", label: "Portfolio", href: "/portfolio", active: true },
  { icon: "⭐", label: "Watchlist", href: "/watchlist" },
  { icon: "📄", label: "Reports", href: undefined },
  { icon: "🔔", label: "Alerts", href: "/alerts" },
  { icon: "💳", label: "Pricing", href: "/pricing" },
  { icon: "⚙️", label: "Settings", href: undefined },
];

export default async function PortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get (or leave null) the user's primary portfolio
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id, name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const portfolio = portfolios?.[0] ?? null;

  let companies: PortfolioCompanyRow[] = [];
  let analysisByCompany: Record<string, AccountsAnalysis | null> = {};

  if (portfolio) {
    const { data: companyRows } = await supabase
      .from("portfolio_companies")
      .select(
        "id, company_number, company_name, added_at, analysis_status, last_analysed_at"
      )
      .eq("portfolio_id", portfolio.id)
      .eq("user_id", user.id)
      .order("company_name");

    const baseRows = companyRows ?? [];
    const numbers = baseRows.map((r) => r.company_number);

    const [analysisRes, docsRes] = await Promise.all([
      numbers.length > 0
        ? supabase
            .from("analysis_cache")
            .select("company_number, analysis")
            .in("company_number", numbers)
        : Promise.resolve({ data: [] as { company_number: string; analysis: AccountsAnalysis }[] }),
      numbers.length > 0
        ? supabase
            .from("portfolio_documents")
            .select("company_number")
            .eq("user_id", user.id)
            .in("company_number", numbers)
        : Promise.resolve({ data: [] as { company_number: string }[] }),
    ]);

    const analysisMap = new Map<string, AccountsAnalysis>();
    for (const row of analysisRes.data ?? []) {
      analysisMap.set(row.company_number, row.analysis as AccountsAnalysis);
    }
    const docSet = new Set<string>();
    for (const row of docsRes.data ?? []) {
      docSet.add(row.company_number);
    }

    companies = baseRows.map((r) => ({
      id: r.id,
      company_number: r.company_number,
      company_name: r.company_name,
      added_at: r.added_at,
      analysis_status: r.analysis_status,
      last_analysed_at: r.last_analysed_at,
      has_documents: docSet.has(r.company_number),
    }));

    analysisByCompany = Object.fromEntries(
      numbers.map((n) => [n, analysisMap.get(n) ?? null])
    );
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        fontFamily:
          'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: "220px",
          backgroundColor: "#ffffff",
          borderRight: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 10,
        }}
      >
        <div style={{ padding: "20px", borderBottom: "1px solid #e2e8f0" }}>
          <div
            style={{
              fontFamily:
                'var(--font-instrument-serif), "Instrument Serif", serif',
              fontSize: "20px",
              lineHeight: 1,
            }}
          >
            <span style={{ color: "#0f172a" }}>Docu</span>
            <span style={{ color: "#5B5BD6" }}>Data</span>
          </div>
        </div>

        <nav style={{ flex: 1, paddingTop: "8px" }}>
          {NAV_ITEMS.map((item) => {
            const active = !!item.active;
            const navStyle = {
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 20px",
              fontSize: "13px",
              cursor: "pointer",
              borderLeft: active ? "4px solid #5B5BD6" : "4px solid transparent",
              backgroundColor: active ? "rgba(91,91,214,0.12)" : "transparent",
              color: active ? "#5B5BD6" : "#475569",
              fontWeight: (active ? 600 : 400) as 400 | 600,
              textDecoration: "none",
            };
            const inner = (
              <>
                <span
                  style={{
                    fontSize: "15px",
                    width: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </>
            );
            return item.href ? (
              <a key={item.label} href={item.href} style={navStyle}>
                {inner}
              </a>
            ) : (
              <div key={item.label} style={navStyle}>
                {inner}
              </div>
            );
          })}
        </nav>

        <UserMenu email={user.email} />
      </aside>

      <main
        style={{
          marginLeft: "220px",
          flex: 1,
          padding: "28px 32px",
          minHeight: "100vh",
        }}
      >
        <PortfolioClient
          portfolioId={portfolio?.id ?? null}
          companies={companies}
          analysisByCompany={analysisByCompany}
        />
      </main>
    </div>
  );
}
