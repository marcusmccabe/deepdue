import SearchToggleBar from "@/components/SearchToggleBar";

const NAV_ITEMS = [
  { icon: "🔍", label: "Search", active: false },
  { icon: "📊", label: "Dashboard", active: true },
  { icon: "⭐", label: "Watchlist", active: false },
  { icon: "📄", label: "Reports", active: false },
  { icon: "🔔", label: "Alerts", active: false },
  { icon: "⚙️", label: "Settings", active: false },
];

const STAT_CARDS = [
  { label: "Monitored", value: "24", desc: "companies" },
  { label: "Alerts this week", value: "3", desc: "" },
  { label: "Searches this month", value: "47", desc: "" },
  { label: "Reports generated", value: "8", desc: "" },
];

const RECENT_SEARCHES = [
  { name: "Tesco PLC", number: "00445790", sector: "Retail", status: "active" },
  {
    name: "Barratt Developments PLC",
    number: "00604574",
    sector: "Construction",
    status: "active",
  },
  {
    name: "Carillion PLC",
    number: "03675085",
    sector: "Construction",
    status: "dissolved",
  },
  {
    name: "Octopus Energy Ltd",
    number: "09263424",
    sector: "Energy",
    status: "active",
  },
  {
    name: "Deliveroo PLC",
    number: "08167130",
    sector: "Food & Delivery",
    status: "active",
  },
  {
    name: "BHS Group Ltd",
    number: "00308764",
    sector: "Retail",
    status: "dissolved",
  },
];

const WATCHLIST = [
  {
    name: "Tesco PLC",
    status: "active",
    accountsText: "Accounts filed 3 months ago",
    monthsOld: 3,
  },
  {
    name: "Barratt Developments PLC",
    status: "active",
    accountsText: "Accounts filed 8 months ago",
    monthsOld: 8,
  },
  {
    name: "Taylor Wimpey PLC",
    status: "active",
    accountsText: "Accounts filed 14 months ago",
    monthsOld: 14,
  },
  {
    name: "Octopus Energy Ltd",
    status: "active",
    accountsText: "Accounts filed 6 months ago",
    monthsOld: 6,
  },
  {
    name: "Carillion PLC",
    status: "dissolved",
    accountsText: "Accounts filed 15 months ago",
    monthsOld: 15,
  },
];

const ALERTS = [
  {
    type: "New filing",
    company: "Tesco PLC",
    desc: "Annual accounts filed for year ended Jan 2025",
    time: "2 hours ago",
  },
  {
    type: "Director",
    company: "Taylor Wimpey PLC",
    desc: "New director appointed: Jane Smith",
    time: "1 day ago",
  },
  {
    type: "Status",
    company: "Carillion PLC",
    desc: "Company status changed to dissolved",
    time: "3 days ago",
  },
  {
    type: "New filing",
    company: "Octopus Energy Ltd",
    desc: "Confirmation statement filed",
    time: "5 days ago",
  },
];

function alertBadge(type: string): { bg: string; color: string } {
  if (type === "New filing") return { bg: "rgba(79,70,229,0.10)", color: "#4f46e5" };
  if (type === "Director") return { bg: "rgba(234,179,8,0.12)", color: "#a16207" };
  if (type === "Status") return { bg: "rgba(220,38,38,0.10)", color: "#dc2626" };
  return { bg: "#f1f5f9", color: "#475569" };
}

function StatusBadge({
  status,
  small,
}: {
  status: string;
  small?: boolean;
}) {
  const active = status === "active";
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

export default function DashboardPage() {
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
          {NAV_ITEMS.map((item) => (
            <div
              key={item.label}
              style={{
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
              }}
            >
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
            </div>
          ))}
        </nav>

        {/* User row */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>
            Marcus McCabe
          </div>
          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
            Pro plan
          </div>
        </div>
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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
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
              Good morning, Marcus
            </h1>
            <p style={{ fontSize: "13px", color: "#94a3b8" }}>
              4 companies updated since your last visit
            </p>
          </div>
          <SearchToggleBar />
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
          {STAT_CARDS.map((card) => (
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

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Company", "Number", "Sector", "Status", ""].map(
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
                  {RECENT_SEARCHES.map((company, i) => (
                    <tr
                      key={company.number}
                      style={{
                        borderBottom:
                          i < RECENT_SEARCHES.length - 1
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
                        {company.name}
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
                        {company.number}
                      </td>
                      <td
                        style={{
                          padding: "13px 18px",
                          fontSize: "12px",
                          color: "#475569",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {company.sector}
                      </td>
                      <td style={{ padding: "13px 18px" }}>
                        <StatusBadge status={company.status} />
                      </td>
                      <td style={{ padding: "13px 18px" }}>
                        <a
                          href={`/company/${company.number}`}
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
                  href="#"
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

              <div>
                {WATCHLIST.map((company, i) => (
                  <div
                    key={company.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      padding: "11px 16px",
                      borderBottom:
                        i < WATCHLIST.length - 1
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
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: "500",
                            color: "#0f172a",
                          }}
                        >
                          {company.name}
                        </span>
                        <StatusBadge status={company.status} small />
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color:
                            company.monthsOld > 12 ? "#d97706" : "#94a3b8",
                        }}
                      >
                        {company.accountsText}
                      </div>
                    </div>
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#cbd5e1",
                        fontSize: "18px",
                        lineHeight: "1",
                        padding: "0",
                        flexShrink: 0,
                        marginTop: "1px",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
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
                  href="#"
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

              <div>
                {ALERTS.map((alert, i) => {
                  const badge = alertBadge(alert.type);
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "11px 16px",
                        borderBottom:
                          i < ALERTS.length - 1 ? "1px solid #f1f5f9" : "none",
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
                          {alert.type}
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
                          {alert.company}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#475569",
                          marginBottom: "3px",
                        }}
                      >
                        {alert.desc}
                      </div>
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                        {alert.time}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
