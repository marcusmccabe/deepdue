import SearchToggleBar from "@/components/SearchToggleBar";
import { UserMenu } from "@/components/UserMenu";
import { createClient } from "@/lib/supabase/server";

const NAV_ITEMS = [
  { icon: "🔍", label: "Search", active: false, href: undefined },
  { icon: "📊", label: "Dashboard", active: true, href: undefined },
  { icon: "⭐", label: "Watchlist", active: false, href: "/watchlist" },
  { icon: "📄", label: "Reports", active: false, href: undefined },
  { icon: "🔔", label: "Alerts", active: false, href: "/alerts" },
  { icon: "💳", label: "Pricing", active: false, href: "/pricing" },
  { icon: "⚙️", label: "Settings", active: false, href: undefined },
];

function alertBadge(type: string): { bg: string; color: string } {
  const t = (type ?? "").toLowerCase();
  if (t.includes("filing")) return { bg: "rgba(79,70,229,0.10)", color: "#4f46e5" };
  if (t.includes("director") || t.includes("officer")) return { bg: "rgba(234,179,8,0.12)", color: "#a16207" };
  if (t.includes("status") || t.includes("dissolved")) return { bg: "rgba(220,38,38,0.10)", color: "#dc2626" };
  return { bg: "#f1f5f9", color: "#475569" };
}

function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const active = (status ?? "").toLowerCase() === "active";
  return (
    <span
      style={{
        fontSize: small ? "10px" : "11px",
        fontWeight: "600",
        padding: small ? "2px 6px" : "3px 8px",
        borderRadius: "100px",
        backgroundColor: active ? "rgba(5,150,105,0.10)" : "rgba(220,38,38,0.10)",
        color: active ? "#059669" : "#dc2626",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {active ? "Active" : "Dissolved"}
    </span>
  );
}

function accountsText(lastAccountsDate: string | null): { text: string; old: boolean } {
  if (!lastAccountsDate) return { text: "No accounts on record", old: false };
  const filed = new Date(lastAccountsDate);
  const now = new Date();
  const months =
    (now.getFullYear() - filed.getFullYear()) * 12 +
    (now.getMonth() - filed.getMonth());
  if (months <= 0) return { text: "Accounts filed recently", old: false };
  return {
    text: `Accounts filed ${months} month${months !== 1 ? "s" : ""} ago`,
    old: months > 12,
  };
}

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Supabase queries ──────────────────────────────────────────────────────
  let watchlistCount = 0;
  let alertsWeekCount = 0;
  let searchesMonthCount = 0;
  let reportsCount = 0;
  let recentSearches: {
    company_name: string;
    company_number: string;
    company_status: string | null;
    searched_at: string;
  }[] = [];
  let watchlistRows: {
    company_name: string;
    company_number: string;
    company_status: string;
    last_accounts_date: string | null;
    next_accounts_due: string | null;
  }[] = [];
  let recentAlerts: {
    id: string;
    alert_type: string;
    company_name: string;
    description: string;
    created_at: string;
  }[] = [];

  if (user) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      watchlistCountRes,
      alertsWeekRes,
      searchesMonthRes,
      reportsTotalRes,
      recentSearchesRes,
      watchlistRowsRes,
      recentAlertsRes,
    ] = await Promise.all([
      supabase
        .from("watchlist")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", sevenDaysAgo.toISOString()),
      supabase
        .from("searches")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("searched_at", monthStart.toISOString()),
      supabase
        .from("analysis_cache")
        .select("company_number", { count: "exact", head: true }),
      supabase
        .from("searches")
        .select("company_name, company_number, company_status, searched_at")
        .eq("user_id", user.id)
        .order("searched_at", { ascending: false })
        .limit(6),
      supabase
        .from("watchlist")
        .select("company_name, company_number, company_status, last_accounts_date, next_accounts_due")
        .eq("user_id", user.id)
        .order("company_name")
        .limit(5),
      supabase
        .from("alerts")
        .select("id, alert_type, company_name, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    watchlistCount = watchlistCountRes.count ?? 0;
    alertsWeekCount = alertsWeekRes.count ?? 0;
    searchesMonthCount = searchesMonthRes.count ?? 0;
    reportsCount = reportsTotalRes.count ?? 0;
    recentSearches = (recentSearchesRes.data ?? []) as typeof recentSearches;
    watchlistRows = (watchlistRowsRes.data ?? []) as typeof watchlistRows;
    recentAlerts = (recentAlertsRes.data ?? []) as typeof recentAlerts;
  }

  const statCards = [
    { label: "Monitored", value: String(watchlistCount), desc: "companies" },
    { label: "Alerts this week", value: String(alertsWeekCount), desc: "" },
    { label: "Searches this month", value: String(searchesMonthCount), desc: "" },
    { label: "Reports generated", value: String(reportsCount), desc: "" },
  ];

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
      {/* ── Sidebar ── */}
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
        {/* Logo */}
        <div style={{ padding: "20px", borderBottom: "1px solid #e2e8f0" }}>
          <div
            style={{
              fontFamily:
                'var(--font-instrument-serif), "Instrument Serif", serif',
              fontSize: "20px",
              lineHeight: "1",
            }}
          >
            <span style={{ color: "#0f172a" }}>Deep</span>
            <span style={{ color: "#4f46e5" }}>Due</span>
            <span style={{ color: "#94a3b8", fontSize: "14px" }}>.ai</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: "8px" }}>
          {NAV_ITEMS.map((item) => {
            const navStyle = {
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 20px",
              fontSize: "13px",
              cursor: "pointer",
              borderLeft: item.active
                ? "4px solid #4338ca"
                : "4px solid transparent",
              backgroundColor: item.active
                ? "rgba(79,70,229,0.12)"
                : "transparent",
              color: item.active ? "#4338ca" : "#475569",
              fontWeight: item.active ? "600" : "400",
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
                    lineHeight: "1",
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

        {/* User row */}
        <UserMenu email={user?.email} />
      </aside>

      {/* ── Main content ── */}
      <main
        style={{
          marginLeft: "220px",
          flex: 1,
          padding: "28px 32px",
          minHeight: "100vh",
        }}
      >
        {/* 1. Top greeting row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <div>
            <h1
              style={{
                fontFamily:
                  'var(--font-instrument-serif), "Instrument Serif", serif',
                fontSize: "26px",
                fontWeight: "400",
                color: "#0f172a",
                lineHeight: "1.2",
                marginBottom: "4px",
              }}
            >
              Dashboard
            </h1>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
              {user?.email ?? ""}
            </p>
          </div>
          <SearchToggleBar />
          <div />
        </div>

        {/* 2. Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "14px",
            marginBottom: "24px",
          }}
        >
          {statCards.map((card) => (
            <div
              key={card.label}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "16px 18px",
                boxShadow:
                  "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "#94a3b8",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                {card.label}
              </div>
              <div
                style={{
                  fontSize: "32px",
                  fontWeight: "800",
                  color: "#0f172a",
                  lineHeight: "1",
                  marginBottom: card.desc ? "4px" : "0",
                }}
              >
                {card.value}
              </div>
              {card.desc && (
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                  {card.desc}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 3. Two-column grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: "20px",
            alignItems: "start",
          }}
        >
          {/* ── Main column ── */}
          <div>
            {/* Recent searches card */}
            <div
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                boxShadow:
                  "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "16px 18px",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "#0f172a",
                  }}
                >
                  Recent searches
                </div>
              </div>

              {recentSearches.length === 0 ? (
                <div
                  style={{
                    padding: "40px 24px",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>🔍</div>
                  <div style={{ fontWeight: "600", color: "#64748b", marginBottom: "4px" }}>
                    No searches yet
                  </div>
                  Search for a company to see your history here
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Company", "Number", "Status", "Searched", ""].map(
                        (col) => (
                          <th
                            key={col}
                            style={{
                              padding: "10px 18px",
                              textAlign: "left",
                              fontSize: "11px",
                              fontWeight: "600",
                              color: "#94a3b8",
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              borderBottom: "1px solid #e2e8f0",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {col}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {recentSearches.map((row, i) => (
                      <tr
                        key={`${row.company_number}-${i}`}
                        style={{
                          borderBottom:
                            i < recentSearches.length - 1
                              ? "1px solid #f1f5f9"
                              : "none",
                        }}
                      >
                        <td
                          style={{
                            padding: "13px 18px",
                            fontSize: "13px",
                            fontWeight: "500",
                            color: "#0f172a",
                          }}
                        >
                          {row.company_name}
                        </td>
                        <td
                          style={{
                            padding: "13px 18px",
                            fontSize: "12px",
                            color: "#475569",
                            fontFamily: "'Courier New', monospace",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.company_number}
                        </td>
                        <td style={{ padding: "13px 18px" }}>
                          <StatusBadge status={row.company_status ?? ""} />
                        </td>
                        <td
                          style={{
                            padding: "13px 18px",
                            fontSize: "12px",
                            color: "#94a3b8",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {relativeTime(row.searched_at)}
                        </td>
                        <td style={{ padding: "13px 18px" }}>
                          <a
                            href={`/company/${row.company_number}`}
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#4f46e5",
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            View →
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── Right column ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Watchlist card */}
            <div
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                boxShadow:
                  "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: "700",
                    color: "#0f172a",
                  }}
                >
                  Watchlist
                </div>
                <a
                  href="/watchlist"
                  style={{
                    fontSize: "12px",
                    color: "#4f46e5",
                    fontWeight: "500",
                    textDecoration: "none",
                  }}
                >
                  View all
                </a>
              </div>

              {watchlistRows.length === 0 ? (
                <div
                  style={{
                    padding: "28px 16px",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ fontSize: "20px", marginBottom: "6px" }}>⭐</div>
                  <div style={{ fontWeight: "600", color: "#64748b", marginBottom: "3px" }}>
                    No companies yet
                  </div>
                  Add companies from any company page
                </div>
              ) : (
                <div>
                  {watchlistRows.map((row, i) => {
                    const accts = accountsText(row.last_accounts_date);
                    return (
                      <div
                        key={row.company_number}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          padding: "11px 16px",
                          borderBottom:
                            i < watchlistRows.length - 1
                              ? "1px solid #f1f5f9"
                              : "none",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, marginRight: "8px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              marginBottom: "4px",
                              flexWrap: "wrap",
                            }}
                          >
                            <a
                              href={`/company/${row.company_number}`}
                              style={{
                                fontSize: "13px",
                                fontWeight: "500",
                                color: "#0f172a",
                                textDecoration: "none",
                              }}
                            >
                              {row.company_name}
                            </a>
                            <StatusBadge status={row.company_status} small />
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: accts.old ? "#d97706" : "#94a3b8",
                            }}
                          >
                            {accts.text}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent alerts card */}
            <div
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                boxShadow:
                  "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: "700",
                    color: "#0f172a",
                  }}
                >
                  Recent alerts
                </div>
                <a
                  href="/alerts"
                  style={{
                    fontSize: "12px",
                    color: "#4f46e5",
                    fontWeight: "500",
                    textDecoration: "none",
                  }}
                >
                  View all
                </a>
              </div>

              {recentAlerts.length === 0 ? (
                <div
                  style={{
                    padding: "28px 16px",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ fontSize: "20px", marginBottom: "6px" }}>🔔</div>
                  <div style={{ fontWeight: "600", color: "#64748b", marginBottom: "3px" }}>
                    No alerts yet
                  </div>
                  Alerts appear when watched companies update
                </div>
              ) : (
                <div>
                  {recentAlerts.map((alert, i) => {
                    const badge = alertBadge(alert.alert_type);
                    return (
                      <div
                        key={alert.id}
                        style={{
                          padding: "11px 16px",
                          borderBottom:
                            i < recentAlerts.length - 1
                              ? "1px solid #f1f5f9"
                              : "none",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginBottom: "4px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: "600",
                              padding: "2px 7px",
                              borderRadius: "100px",
                              backgroundColor: badge.bg,
                              color: badge.color,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {alert.alert_type}
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: "500",
                              color: "#0f172a",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {alert.company_name}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#475569",
                            marginBottom: "3px",
                          }}
                        >
                          {alert.description}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                          {relativeTime(alert.created_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
