import SearchBar from "@/components/SearchBar";

const NAV_ITEMS = [
  { icon: "🔍", label: "Search", active: false },
  { icon: "📊", label: "Dashboard", active: true },
  { icon: "⭐", label: "Watchlist", active: false },
  { icon: "📄", label: "Reports", active: false },
  { icon: "🔔", label: "Alerts", active: false },
  { icon: "⚙️", label: "Settings", active: false },
];

const STAT_CARDS = [
  { label: "MONITORED", value: "24", desc: "companies" },
  { label: "ALERTS", value: "3", desc: "this week" },
  { label: "AVG SCORE", value: "72", desc: "portfolio" },
  { label: "REPORTS", value: "8", desc: "this month" },
];

const AI_INSIGHTS = [
  {
    borderColor: "#d97706",
    bg: "rgba(217,119,6,0.06)",
    title: "⚠️ Going Concern Note",
    body: "Auditors flagged material uncertainty in 2024 cash flow projections. Recommend monitoring working capital.",
  },
  {
    borderColor: "#d97706",
    bg: "rgba(217,119,6,0.06)",
    title: "🔒 Cyber Incident Disclosed",
    body: "Ransomware attack Q2 2023. £180k remediation cost noted in accounts. No customer data breach reported.",
  },
  {
    borderColor: "#059669",
    bg: "rgba(5,150,105,0.06)",
    title: "📈 Revenue Growth +51%",
    body: "Turnover rose from £12.4m to £18.7m over 3 years. Gross margins stable at 28-31%.",
  },
  {
    borderColor: "#e2e8f0",
    bg: "#f1f5f9",
    title: "👤 Director Instability",
    body: "3 CFO changes in 18 months. Current appointment October 2023. Recommend monitoring continuity.",
  },
];

const CHART_BARS = [
  { year: "2021", value: 9.8 },
  { year: "2022", value: 12.4 },
  { year: "2023", value: 15.9 },
  { year: "2024", value: 18.7 },
];
const MAX_VALUE = 20;

const WATCHLIST = [
  { name: "Tesco PLC", sector: "Retail", score: 88, change: "+2" },
  { name: "Taylor Wimpey", sector: "Construction", score: 76, change: "—" },
  { name: "Octopus Energy", sector: "Energy", score: 71, change: "-3" },
  { name: "Deliveroo PLC", sector: "Tech", score: 58, change: "-5" },
];

function scoreColor(score: number): string {
  if (score >= 80) return "#059669";
  if (score >= 65) return "#4f46e5";
  return "#d97706";
}

function changeColor(change: string): string {
  if (change.startsWith("+")) return "#059669";
  if (change.startsWith("-")) return "#dc2626";
  return "#94a3b8";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
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
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
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

        {/* User info */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: "700",
              color: "#0f172a",
            }}
          >
            Marcus McCabe
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "#94a3b8",
              marginTop: "2px",
            }}
          >
            Pro plan
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main
        style={{
          marginLeft: "220px",
          flex: 1,
          padding: "28px 32px",
          minHeight: "100vh",
        }}
      >
        {/* Top row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "20px",
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
        </div>

        {/* Search bar – centred in the main content area */}
        <div
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            marginBottom: "28px",
          }}
        >
          <SearchBar initialQuery={q ?? ""} />
        </div>

        {/* ── Stat Cards ── */}
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
                  marginBottom: "4px",
                }}
              >
                {card.value}
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                {card.desc}
              </div>
            </div>
          ))}
        </div>

        {/* ── Main grid: 1fr + 320px ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: "20px",
            alignItems: "start",
          }}
        >
          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Card: AI Document Intelligence */}
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
              {/* Card header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 18px",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      backgroundColor: "#4f46e5",
                      borderRadius: "5px",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "700",
                        color: "#0f172a",
                      }}
                    >
                      AI Document Intelligence
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#94a3b8",
                        marginTop: "1px",
                      }}
                    >
                      Extracted from 2021–2024 filed accounts
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    padding: "4px 10px",
                    backgroundColor: "rgba(79,70,229,0.08)",
                    color: "#4f46e5",
                    borderRadius: "100px",
                    fontSize: "12px",
                    fontWeight: "600",
                    whiteSpace: "nowrap",
                  }}
                >
                  4 insights
                </span>
              </div>

              {/* Insight rows */}
              <div style={{ padding: "14px 18px" }}>
                {AI_INSIGHTS.map((insight, i) => (
                  <div
                    key={insight.title}
                    style={{
                      borderLeft: `3px solid ${insight.borderColor}`,
                      backgroundColor: insight.bg,
                      borderRadius: "0 8px 8px 0",
                      padding: "14px 18px",
                      marginBottom: i < AI_INSIGHTS.length - 1 ? "8px" : "0",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "700",
                        color: "#0f172a",
                        marginBottom: "5px",
                      }}
                    >
                      {insight.title}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#475569",
                        lineHeight: "1.55",
                      }}
                    >
                      {insight.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card: Financial History */}
            <div
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                boxShadow:
                  "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
                padding: "18px",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "#0f172a",
                  }}
                >
                  Financial History
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                  All figures in £m
                </div>
              </div>

              {/* Bar chart */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  height: "80px",
                  gap: "6px",
                  marginBottom: "10px",
                }}
              >
                {CHART_BARS.map((bar, i) => {
                  const isLast = i === CHART_BARS.length - 1;
                  const height = Math.round((bar.value / MAX_VALUE) * 80);
                  return (
                    <div
                      key={bar.year}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: `${height}px`,
                          backgroundColor: isLast
                            ? "#4f46e5"
                            : "rgba(79,70,229,0.08)",
                          border: isLast
                            ? "none"
                            : "1px solid rgba(79,70,229,0.25)",
                          borderRadius: "4px 4px 0 0",
                        }}
                      />
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#94a3b8",
                          marginTop: "5px",
                        }}
                      >
                        {bar.year}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary row */}
              <div
                style={{
                  display: "flex",
                  gap: "28px",
                  paddingTop: "14px",
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#94a3b8",
                      marginBottom: "3px",
                    }}
                  >
                    Revenue 2024
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#0f172a",
                    }}
                  >
                    £18.7m
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#94a3b8",
                      marginBottom: "3px",
                    }}
                  >
                    Net Profit
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#059669",
                    }}
                  >
                    £1.6m
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#94a3b8",
                      marginBottom: "3px",
                    }}
                  >
                    Growth YoY
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#4f46e5",
                    }}
                  >
                    +18%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div>
            {/* Watchlist card */}
            <div
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                boxShadow:
                  "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
                padding: "18px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#0f172a",
                  marginBottom: "16px",
                }}
              >
                Watchlist
              </div>

              {WATCHLIST.map((company, i) => (
                <div
                  key={company.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: i === 0 ? "0" : "14px",
                    paddingBottom: i === WATCHLIST.length - 1 ? "0" : "14px",
                    borderBottom:
                      i === WATCHLIST.length - 1
                        ? "none"
                        : "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "#0f172a",
                      }}
                    >
                      {company.name}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#94a3b8",
                        marginTop: "2px",
                      }}
                    >
                      {company.sector}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: "700",
                        color: scoreColor(company.score),
                      }}
                    >
                      {company.score}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: changeColor(company.change),
                        marginTop: "2px",
                      }}
                    >
                      {company.change}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: "32px",
            fontSize: "11px",
            color: "#94a3b8",
          }}
        >
          Data sourced from Companies House &amp; public filings · AI analysis
          not a regulated credit opinion · Last updated 14 April 2026
        </div>
      </main>
    </div>
  );
}
