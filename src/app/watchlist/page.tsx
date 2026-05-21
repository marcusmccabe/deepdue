import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/UserMenu";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const NAV_ITEMS = [
  { icon: "🔍", label: "Search", href: "/" },
  { icon: "📊", label: "Dashboard", href: "/dashboard" },
  { icon: "📁", label: "Portfolio", href: "/portfolio" },
  { icon: "⭐", label: "Watchlist", href: "/watchlist", active: true },
  { icon: "⚖️", label: "Compare", href: "/compare" },
  { icon: "📄", label: "Reports", href: undefined },
  { icon: "🔔", label: "Alerts", href: "/alerts" },
  { icon: "💳", label: "Pricing", href: "/pricing" },
  { icon: "⚙️", label: "Settings", href: undefined },
];

async function removeFromWatchlist(formData: FormData) {
  "use server";
  const companyNumber = formData.get("company_number") as string;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from("watchlist")
      .delete()
      .eq("user_id", user.id)
      .eq("company_number", companyNumber);
  }
  revalidatePath("/watchlist");
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDueDateStyle(dateStr: string | null): { color: string; label?: string } {
  if (!dateStr) return { color: "#94a3b8" };
  const due = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeMonths = new Date(today);
  threeMonths.setMonth(threeMonths.getMonth() + 3);
  if (due < today) return { color: "#dc2626", label: "Overdue" };
  if (due < threeMonths) return { color: "#d97706", label: "Due soon" };
  return { color: "#475569" };
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? "";
  let bg = "rgba(148,163,184,0.15)";
  let color = "#64748b";
  let label = status ?? "Unknown";
  if (s === "active") {
    bg = "rgba(5,150,105,0.10)";
    color = "#059669";
    label = "Active";
  } else if (s === "dissolved") {
    bg = "rgba(220,38,38,0.10)";
    color = "#dc2626";
    label = "Dissolved";
  }
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: "600",
        padding: "3px 8px",
        borderRadius: "100px",
        backgroundColor: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

type WatchlistRow = {
  company_number: string;
  company_name: string;
  company_status: string;
  last_accounts_date: string | null;
  next_accounts_due: string | null;
};

export default async function WatchlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("watchlist")
    .select("company_number, company_name, company_status, last_accounts_date, next_accounts_due")
    .eq("user_id", user.id)
    .order("company_name");

  const watchlist: WatchlistRow[] = rows ?? [];

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
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
              fontFamily: 'var(--font-instrument-serif), "Instrument Serif", serif',
              fontSize: "20px",
              lineHeight: "1",
            }}
          >
            <span style={{ color: "#0f172a" }}>Docu</span>
            <span style={{ color: "#4f46e5" }}>Data</span>
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
              borderLeft: active ? "4px solid #4338ca" : "4px solid transparent",
              backgroundColor: active ? "rgba(79,70,229,0.12)" : "transparent",
              color: active ? "#4338ca" : "#475569",
              fontWeight: active ? "600" : ("400" as const),
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

        <UserMenu email={user.email} />
      </aside>

      {/* Main */}
      <main
        style={{
          marginLeft: "220px",
          flex: 1,
          padding: "28px 32px",
          minHeight: "100vh",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h1
            style={{
              fontFamily: 'var(--font-instrument-serif), "Instrument Serif", serif',
              fontSize: "26px",
              fontWeight: "400",
              color: "#0f172a",
              lineHeight: "1.2",
              marginBottom: "4px",
            }}
          >
            Watchlist
          </h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            {watchlist.length} {watchlist.length === 1 ? "company" : "companies"} monitored
          </p>
        </div>

        {/* Table card */}
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          {watchlist.length === 0 ? (
            <div
              style={{
                padding: "56px 32px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>⭐</div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0f172a",
                  marginBottom: "6px",
                }}
              >
                No companies on your watchlist yet
              </div>
              <div style={{ fontSize: "13px", color: "#94a3b8", maxWidth: "400px", margin: "0 auto" }}>
                Search for a company and click + Watchlist to add it
              </div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Company", "Status", "Last Accounts", "Next Due", ""].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: "10px 18px",
                        textAlign: "left",
                        fontSize: "11px",
                        fontWeight: "600",
                        color: "#94a3b8",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase" as const,
                        borderBottom: "1px solid #e2e8f0",
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {watchlist.map((row, i) => {
                  const dueStyle = getDueDateStyle(row.next_accounts_due);
                  return (
                    <tr
                      key={row.company_number}
                      style={{
                        borderBottom: i < watchlist.length - 1 ? "1px solid #f1f5f9" : "none",
                      }}
                    >
                      <td style={{ padding: "14px 18px" }}>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: "600",
                            color: "#0f172a",
                            marginBottom: "2px",
                          }}
                        >
                          {row.company_name}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#94a3b8",
                            fontFamily: "'Courier New', monospace",
                          }}
                        >
                          {row.company_number}
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <StatusBadge status={row.company_status} />
                      </td>
                      <td
                        style={{
                          padding: "14px 18px",
                          fontSize: "13px",
                          color: "#475569",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDate(row.last_accounts_date)}
                      </td>
                      <td style={{ padding: "14px 18px", whiteSpace: "nowrap" as const }}>
                        <div style={{ fontSize: "13px", color: dueStyle.color, fontWeight: dueStyle.label ? "600" : "400" }}>
                          {formatDate(row.next_accounts_due)}
                        </div>
                        {dueStyle.label && (
                          <div style={{ fontSize: "10px", color: dueStyle.color, marginTop: "2px" }}>
                            {dueStyle.label}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <a
                            href={`/company/${row.company_number}`}
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#4f46e5",
                              textDecoration: "none",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              border: "1px solid rgba(79,70,229,0.25)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            View →
                          </a>
                          <form action={removeFromWatchlist}>
                            <input type="hidden" name="company_number" value={row.company_number} />
                            <button
                              type="submit"
                              style={{
                                fontSize: "12px",
                                fontWeight: "500",
                                color: "#94a3b8",
                                background: "none",
                                border: "1px solid #e2e8f0",
                                borderRadius: "6px",
                                padding: "5px 10px",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Remove
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
