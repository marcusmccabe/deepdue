import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/UserMenu";
import { redirect } from "next/navigation";
import { AlertsList } from "./AlertsList";

const NAV_ITEMS = [
  { icon: "🔍", label: "Search", href: "/" },
  { icon: "📊", label: "Dashboard", href: "/dashboard" },
  { icon: "⭐", label: "Watchlist", href: "/watchlist" },
  { icon: "📄", label: "Reports", href: undefined },
  { icon: "🔔", label: "Alerts", href: "/alerts", active: true },
  { icon: "💳", label: "Pricing", href: "/pricing" },
  { icon: "⚙️", label: "Settings", href: undefined },
];

export default async function AlertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("alerts")
    .select("id, company_number, company_name, alert_type, description, seen, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const alerts = rows ?? [];
  const unseenCount = alerts.filter((a) => !a.seen).length;

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
            Alerts
          </h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            {unseenCount > 0
              ? `${unseenCount} unread alert${unseenCount !== 1 ? "s" : ""}`
              : "All caught up"}
          </p>
        </div>

        {/* Alerts card */}
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
            overflow: "hidden",
            maxWidth: "720px",
          }}
        >
          <AlertsList initialAlerts={alerts} />
        </div>
      </main>
    </div>
  );
}
