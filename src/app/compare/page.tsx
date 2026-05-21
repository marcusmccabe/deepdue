import { UserMenu } from "@/components/UserMenu";
import CompareClient from "@/components/CompareClient";

const NAV_ITEMS = [
  { icon: "🔍", label: "Search", href: "/" },
  { icon: "📊", label: "Dashboard", href: "/dashboard" },
  { icon: "📁", label: "Portfolio", href: "/portfolio" },
  { icon: "⭐", label: "Watchlist", href: "/watchlist" },
  { icon: "⚖️", label: "Compare", href: "/compare", active: true },
  { icon: "📄", label: "Reports", href: undefined },
  { icon: "🔔", label: "Alerts", href: "/alerts" },
  { icon: "💳", label: "Pricing", href: "/pricing" },
  { icon: "⚙️", label: "Settings", href: undefined },
];

interface PageProps {
  searchParams: Promise<{ c?: string }>;
}

export default async function ComparePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const initial = (sp?.c ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 5);

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
              lineHeight: "1",
            }}
          >
            <span style={{ color: "#0f172a" }}>Docu</span>
            <span style={{ color: "#4f46e5" }}>Data</span>
          </div>
        </div>

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
              fontWeight: item.active ? "600" : ("400" as const),
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
      </aside>

      {/* Main */}
      <main style={{ marginLeft: "220px", flex: 1, padding: "24px 32px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <div>
            <h1
              style={{
                fontFamily:
                  'var(--font-instrument-serif), "Instrument Serif", serif',
                fontSize: "28px",
                fontWeight: 400,
                color: "#0f172a",
                margin: 0,
              }}
            >
              Compare companies
            </h1>
            <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0" }}>
              Side-by-side intelligence across up to 5 UK companies.
            </p>
          </div>
          <UserMenu />
        </div>
        <CompareClient initialCompanyNumbers={initial} />
      </main>
    </div>
  );
}
