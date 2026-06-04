"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";

// ── Palette (max 5 companies) ────────────────────────────────────────────────
const PALETTE = ["#534AB7", "#639922", "#185FA5", "#BA7517", "#A32D2D"];

const COLOR = {
  primary: "#0f172a",
  secondary: "#475569",
  muted: "#94a3b8",
  tertiary: "#e2e8f0",
  bgPrimary: "#ffffff",
  bgSecondary: "#f8fafc",
  indigo: "#4f46e5",
  indigoBox: "rgba(79,70,229,0.10)",
};

const RADIUS_MD = "8px";

// ── Types ────────────────────────────────────────────────────────────────────
interface SearchResult {
  title: string;
  company_number: string;
  company_status: string;
}

interface CompanyResult {
  companyNumber: string;
  companyName: string;
  accountsPeriod: string;
  yearLabelCurrent: string;
  yearLabelPrior: string;
  signals: {
    creditRisk: string;
    cashHealth: string;
    directorRisk: string;
    auditOpinion: string;
  };
  financials: {
    revenueCurrent: number | null;
    revenuePrior: number | null;
    profitCurrent: number | null;
    profitPrior: number | null;
    marginCurrent: number | null;
    marginPrior: number | null;
  };
}

interface ComparativeResult {
  sectorStrengths: string;
  commonWeaknesses: string;
  inferences: string;
  riskFlags: string;
  competitivePositioning: string;
  strengthRanking: Array<{
    companyNumber: string;
    companyName: string;
    score: number;
    rationale: string;
  }>;
}

interface CompareResponse {
  status: "ok" | "missing";
  missing?: string[];
  companies?: CompanyResult[];
  comparative?: ComparativeResult;
  askContext?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

type SignalTone = "green" | "amber" | "red" | "neutral";
function signalTone(value: string): SignalTone {
  const v = (value ?? "").toLowerCase();
  if (/low|good|clean|unqualified/.test(v)) return "green";
  if (/medium|adequate/.test(v)) return "amber";
  if (/high|weak|qualified|adverse|disclaimer|going concern/.test(v))
    return "red";
  return "neutral";
}

function signalPillStyle(tone: SignalTone): CSSProperties {
  if (tone === "green")
    return { backgroundColor: "#EAF3DE", color: "#3B6D11" };
  if (tone === "amber")
    return { backgroundColor: "#FAEEDA", color: "#854F0B" };
  if (tone === "red") return { backgroundColor: "#FCEBEB", color: "#A32D2D" };
  return { backgroundColor: COLOR.bgSecondary, color: COLOR.muted };
}

function fmtMillions(value: number | null): string {
  if (value === null) return "—";
  return (value / 1_000_000).toFixed(1) + "m";
}

// ── Component ────────────────────────────────────────────────────────────────
export default function CompareClient({
  initialCompanyNumbers,
}: {
  initialCompanyNumbers: string[];
}) {
  const router = useRouter();

  // Selected companies — numbers + provisional names from search
  const [selected, setSelected] = useState<
    Array<{ companyNumber: string; companyName: string }>
  >(() =>
    initialCompanyNumbers.map((n) => ({ companyNumber: n, companyName: n }))
  );
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [limitNote, setLimitNote] = useState("");
  const dropdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compare result
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [comparative, setComparative] = useState<ComparativeResult | null>(null);
  const [askContext, setAskContext] = useState<string>("");
  const [intelLoading, setIntelLoading] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<string[]>([]);
  const [analysisProgress, setAnalysisProgress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ask bar state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [askInput, setAskInput] = useState("");
  const [askLoading, setAskLoading] = useState(false);

  // ── URL sync ───────────────────────────────────────────────────────────────
  const selectedKey = selected.map((s) => s.companyNumber).join(",");
  useEffect(() => {
    const url = selectedKey ? `/compare?c=${selectedKey}` : "/compare";
    router.replace(url);
  }, [selectedKey, router]);

  // ── Debounced search ───────────────────────────────────────────────────────
  useEffect(() => {
    if (dropdownTimer.current) clearTimeout(dropdownTimer.current);
    if (query.length < 3) {
      setResults([]);
      setDropdownOpen(false);
      return;
    }
    dropdownTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/companies-house?path=/search/companies&q=${encodeURIComponent(query)}&items_per_page=6`
        );
        const data = await res.json();
        setResults((data.items ?? []) as SearchResult[]);
        setDropdownOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (dropdownTimer.current) clearTimeout(dropdownTimer.current);
    };
  }, [query]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // ── Add / remove ──────────────────────────────────────────────────────────
  const addCompany = useCallback(
    (companyNumber: string, companyName: string) => {
      setSelected((prev) => {
        if (prev.some((p) => p.companyNumber === companyNumber)) return prev;
        if (prev.length >= 5) {
          setLimitNote("Maximum 5 companies");
          setTimeout(() => setLimitNote(""), 2000);
          return prev;
        }
        return [...prev, { companyNumber, companyName }];
      });
      setQuery("");
      setResults([]);
      setDropdownOpen(false);
    },
    []
  );

  const removeCompany = useCallback((companyNumber: string) => {
    setSelected((prev) => prev.filter((p) => p.companyNumber !== companyNumber));
  }, []);

  // ── Trigger compare (handles missing → analyse → poll → re-compare) ──────
  const runCompare = useCallback(
    async (numbers: string[]) => {
      if (numbers.length < 2) {
        setCompanies([]);
        setComparative(null);
        setAskContext("");
        setPendingAnalysis([]);
        setErrorMsg(null);
        return;
      }
      setIntelLoading(true);
      setErrorMsg(null);

      try {
        let attempts = 0;
        while (attempts < 30) {
          const res = await fetch("/api/compare-companies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyNumbers: numbers }),
          });
          if (!res.ok) {
            setErrorMsg(`Compare failed (${res.status})`);
            setIntelLoading(false);
            setPendingAnalysis([]);
            return;
          }
          const data: CompareResponse = await res.json();

          if (data.status === "ok") {
            setCompanies(data.companies ?? []);
            setComparative(data.comparative ?? null);
            setAskContext(data.askContext ?? "");
            setPendingAnalysis([]);
            setIntelLoading(false);
            // Sync display names with returned company names
            setSelected((prev) =>
              prev.map((p) => {
                const match = (data.companies ?? []).find(
                  (c) => c.companyNumber === p.companyNumber
                );
                return match ? { ...p, companyName: match.companyName } : p;
              })
            );
            return;
          }

          if (data.status === "missing") {
            const missing = data.missing ?? [];
            setPendingAnalysis(missing);
            // First time we see missing → trigger analysis for each
            if (attempts === 0) {
              for (const num of missing) {
                const companyName = selectedRef.current.find(s => s.companyNumber === num)?.companyName ?? num;
                setAnalysisProgress(`Analysing ${companyName}…`);
                await fetch(
                  `/api/analyse-accounts?companyNumber=${encodeURIComponent(num)}`,
                  { cache: "no-store" }
                ).catch(() => null);
              }
              setAnalysisProgress(null);
            } else {
              // poll wait
              await new Promise((r) => setTimeout(r, 4000));
            }
            attempts++;
            continue;
          }

          break;
        }
        setErrorMsg("Analysis timed out — please try again");
        setIntelLoading(false);
        setPendingAnalysis([]);
      } catch (err) {
        console.error(err);
        setErrorMsg("Compare request failed");
        setIntelLoading(false);
        setPendingAnalysis([]);
      }
    },
    []
  );

  useEffect(() => {
    runCompare(selected.map((s) => s.companyNumber));
  }, [selectedKey, runCompare]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ask AI ────────────────────────────────────────────────────────────────
  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = askInput.trim();
    if (!q || askLoading || !askContext) return;
    const nextHistory: ChatMessage[] = [
      ...chatHistory,
      { role: "user", content: q },
    ];
    setChatHistory(nextHistory);
    setAskInput("");
    setAskLoading(true);
    try {
      const companyNames = companies.map((c) => c.companyName).join(", ");
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          companyName: companyNames || "the compared companies",
          companyNumber: companies.map((c) => c.companyNumber).join(","),
          analysisContext: `Context: ${askContext}. Answer questions about these specific companies using this context.`,
          chatHistory: chatHistory,
        }),
      });
      const data = await res.json();
      const answer = data.answer ?? data.error ?? "No response.";
      setChatHistory([...nextHistory, { role: "assistant", content: answer }]);
    } catch {
      setChatHistory([
        ...nextHistory,
        { role: "assistant", content: "Request failed." },
      ]);
    } finally {
      setAskLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const cardStyle: CSSProperties = {
    backgroundColor: COLOR.bgPrimary,
    border: `0.5px solid ${COLOR.tertiary}`,
    borderRadius: "10px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    marginBottom: "16px",
  };

  return (
    <div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Search + selection ─────────────────────────────────────────── */}
      <div style={{ ...cardStyle, padding: "16px" }}>
        <div ref={containerRef} style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              border: `0.5px solid ${COLOR.tertiary}`,
              borderRadius: RADIUS_MD,
              height: "40px",
              padding: "0 12px",
              backgroundColor: "#ffffff",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
              <path
                d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.309 10.016C8.535 10.632 7.558 11 6.5 11C4.015 11 2 8.985 2 6.5C2 4.015 4.015 2 6.5 2C8.985 2 11 4.015 11 6.5C11 7.558 10.632 8.535 10.016 9.309L12.854 12.146C13.049 12.342 13.049 12.658 12.854 12.854C12.658 13.049 12.342 13.049 12.146 12.854L9.309 10.016Z"
                fill={COLOR.muted}
                fillRule="evenodd"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setDropdownOpen(true)}
              placeholder="Search for a company to compare…"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: "13px",
                color: COLOR.primary,
                backgroundColor: "transparent",
              }}
            />
            {searchLoading && (
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  border: `2px solid ${COLOR.tertiary}`,
                  borderTopColor: COLOR.indigo,
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
            )}
          </div>

          {dropdownOpen && results.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                backgroundColor: "#ffffff",
                border: `1px solid ${COLOR.tertiary}`,
                borderRadius: "10px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
                zIndex: 30,
                overflow: "hidden",
              }}
            >
              {results.map((r, i) => (
                <div
                  key={r.company_number}
                  onClick={() =>
                    addCompany(r.company_number, toTitleCase(r.title))
                  }
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    borderBottom:
                      i < results.length - 1
                        ? `1px solid ${COLOR.bgSecondary}`
                        : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.backgroundColor =
                      COLOR.bgSecondary)
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.backgroundColor =
                      "transparent")
                  }
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: COLOR.primary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {toTitleCase(r.title)}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: COLOR.muted,
                        fontFamily: "monospace",
                      }}
                    >
                      {r.company_number}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 7px",
                      borderRadius: "100px",
                      backgroundColor:
                        r.company_status === "active" ? "#dcfce7" : "#f3f4f6",
                      color:
                        r.company_status === "active" ? "#15803d" : "#4b5563",
                      textTransform: "capitalize",
                    }}
                  >
                    {r.company_status || "unknown"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pills */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginTop: selected.length > 0 ? "12px" : 0,
          }}
        >
          {selected.map((s, i) => (
            <div
              key={s.companyNumber}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 8px 5px 10px",
                border: `1.5px solid ${PALETTE[i % PALETTE.length]}`,
                borderRadius: "100px",
                fontSize: "12px",
                color: COLOR.primary,
                backgroundColor: "#ffffff",
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: PALETTE[i % PALETTE.length],
                }}
              />
              <span>{s.companyName}</span>
              <button
                onClick={() => removeCompany(s.companyNumber)}
                aria-label={`Remove ${s.companyName}`}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "14px",
                  cursor: "pointer",
                  color: COLOR.muted,
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "8px",
          }}
        >
          <div style={{ fontSize: "11px", color: COLOR.muted }}>
            {limitNote && <span>{limitNote}</span>}
            {!limitNote && selected.length === 1 && (
              <span>Add at least one more company to compare</span>
            )}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: COLOR.muted,
              textAlign: "right",
            }}
          >
            {selected.length} / 5 companies
          </div>
        </div>
      </div>

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {selected.length === 0 && (
        <div
          style={{
            ...cardStyle,
            padding: "80px 16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>⚖️</div>
          <div style={{ fontSize: "13px", color: COLOR.muted }}>
            Search for companies above to begin comparing
          </div>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────── */}
      {errorMsg && (
        <div
          style={{
            ...cardStyle,
            padding: "12px 16px",
            borderColor: "#FCA5A5",
            backgroundColor: "#FEF2F2",
            color: "#A32D2D",
            fontSize: "12px",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* ── Pending analysis rows ────────────────────────────────────── */}
      {pendingAnalysis.length > 0 && (
        <div style={{ ...cardStyle, padding: "12px 16px" }}>
          {pendingAnalysis.map((num) => {
            const meta = selected.find((s) => s.companyNumber === num);
            return (
              <div
                key={num}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "6px 0",
                  fontSize: "12px",
                  color: COLOR.secondary,
                }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    border: `2px solid ${COLOR.tertiary}`,
                    borderTopColor: COLOR.indigo,
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                <span>{meta?.companyName || num} — running analysis…</span>
              </div>
            );
          })}
          {analysisProgress && (
            <div
              style={{
                fontSize: "12px",
                color: COLOR.indigo,
                paddingTop: "4px",
              }}
            >
              {analysisProgress}
            </div>
          )}
        </div>
      )}

      {/* ── Signal grid ──────────────────────────────────────────────── */}
      {companies.length >= 2 && (
        <SignalGrid companies={companies} />
      )}

      {/* ── Charts ─────────────────────────────────────────────────── */}
      {companies.length >= 2 && <ChartsGrid companies={companies} comparative={comparative} intelLoading={intelLoading} />}

      {/* ── AI intelligence panels ───────────────────────────────────── */}
      {selected.length >= 2 && (
        <IntelligencePanels
          companies={companies}
          comparative={comparative}
          loading={intelLoading}
        />
      )}

      {/* ── Ask bar ─────────────────────────────────────────────────── */}
      {selected.length >= 2 && askContext && (
        <div style={{ ...cardStyle }}>
          <form
            onSubmit={handleAsk}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "6px",
                backgroundColor: COLOR.indigoBox,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: COLOR.indigo,
                fontSize: "13px",
              }}
            >
              💬
            </div>
            <input
              type="text"
              value={askInput}
              onChange={(e) => setAskInput(e.target.value)}
              placeholder="Ask anything about these companies…"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: "13px",
                color: COLOR.primary,
                backgroundColor: "transparent",
              }}
            />
            {askLoading && (
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  border: `2px solid ${COLOR.tertiary}`,
                  borderTopColor: COLOR.indigo,
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
            )}
            <button
              type="submit"
              disabled={!askInput.trim() || askLoading}
              style={{
                padding: "6px 14px",
                border: "none",
                borderRadius: RADIUS_MD,
                backgroundColor: COLOR.indigo,
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
                opacity: !askInput.trim() || askLoading ? 0.6 : 1,
              }}
            >
              Ask
            </button>
          </form>

          {chatHistory.length > 0 && (
            <div
              style={{
                borderTop: `0.5px solid ${COLOR.tertiary}`,
                padding: "12px 16px",
                fontSize: "13px",
                color: COLOR.secondary,
                lineHeight: 1.65,
              }}
            >
              {chatHistory.map((m, i) => (
                <div key={i} style={{ marginBottom: "10px" }}>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: COLOR.muted,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "3px",
                    }}
                  >
                    {m.role === "user" ? "You" : "AI"}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Signal grid ──────────────────────────────────────────────────────────────
function SignalGrid({ companies }: { companies: CompanyResult[] }) {
  const rows: Array<{ key: keyof CompanyResult["signals"]; label: string }> = [
    { key: "creditRisk", label: "Credit risk" },
    { key: "cashHealth", label: "Cash health" },
    { key: "directorRisk", label: "Director risk" },
    { key: "auditOpinion", label: "Audit opinion" },
  ];

  const colTemplate = `140px repeat(${companies.length}, minmax(120px, 1fr))`;

  return (
    <div
      style={{
        backgroundColor: COLOR.bgPrimary,
        border: `0.5px solid ${COLOR.tertiary}`,
        borderRadius: "10px",
        overflow: "auto",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: colTemplate,
          minWidth: `${140 + companies.length * 120}px`,
        }}
      >
        {/* Header row */}
        <div
          style={{
            borderRight: `0.5px solid ${COLOR.tertiary}`,
            borderBottom: `0.5px solid ${COLOR.tertiary}`,
            backgroundColor: COLOR.bgSecondary,
            padding: "10px 14px",
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            color: COLOR.muted,
            letterSpacing: "0.05em",
            display: "flex",
            alignItems: "center",
          }}
        >
          Signal
        </div>
        {companies.map((c, i) => (
          <div
            key={c.companyNumber}
            style={{
              borderRight:
                i < companies.length - 1
                  ? `0.5px solid ${COLOR.tertiary}`
                  : "none",
              borderBottom: `0.5px solid ${COLOR.tertiary}`,
              backgroundColor: COLOR.bgSecondary,
              padding: "10px 12px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                fontWeight: 500,
                color: COLOR.primary,
                lineHeight: 1.4,
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: PALETTE[i % PALETTE.length],
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textAlign: "left",
                }}
              >
                {c.companyName}
              </span>
            </div>
            <div style={{ fontSize: "10px", color: COLOR.muted, marginTop: "3px" }}>
              {c.accountsPeriod
                ? new Date(c.accountsPeriod).toLocaleDateString("en-GB", {
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </div>
          </div>
        ))}

        {/* Signal rows */}
        {rows.map((row, rIdx) => (
          <div key={row.key} style={{ display: "contents" }}>
            <div
              style={{
                borderRight: `0.5px solid ${COLOR.tertiary}`,
                borderBottom:
                  rIdx < rows.length - 1
                    ? `0.5px solid ${COLOR.tertiary}`
                    : "none",
                backgroundColor:
                  rIdx % 2 === 0 ? COLOR.bgPrimary : COLOR.bgSecondary,
                padding: "10px 14px",
                fontSize: "11px",
                textTransform: "uppercase",
                color: COLOR.muted,
                letterSpacing: "0.05em",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
              }}
            >
              {row.label}
            </div>
            {companies.map((c, i) => {
              const value = c.signals[row.key] || "Unknown";
              const tone = signalTone(value);
              return (
                <div
                  key={c.companyNumber}
                  style={{
                    borderRight:
                      i < companies.length - 1
                        ? `0.5px solid ${COLOR.tertiary}`
                        : "none",
                    borderBottom:
                      rIdx < rows.length - 1
                        ? `0.5px solid ${COLOR.tertiary}`
                        : "none",
                    backgroundColor:
                      rIdx % 2 === 0 ? COLOR.bgPrimary : COLOR.bgSecondary,
                    padding: "10px 12px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: "100px",
                      fontSize: "11px",
                      fontWeight: 500,
                      ...signalPillStyle(tone),
                    }}
                  >
                    {value}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Custom legend ────────────────────────────────────────────────────────────
function Legend({ companies }: { companies: CompanyResult[] }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        marginBottom: "10px",
      }}
    >
      {companies.map((c, i) => (
        <div
          key={c.companyNumber}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            color: COLOR.secondary,
          }}
        >
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "2px",
              backgroundColor: PALETTE[i % PALETTE.length],
            }}
          />
          <span>{c.companyName}</span>
        </div>
      ))}
    </div>
  );
}

// ── Charts ──────────────────────────────────────────────────────────────────
function ChartsGrid({
  companies,
  comparative,
  intelLoading,
}: {
  companies: CompanyResult[];
  comparative: ComparativeResult | null;
  intelLoading: boolean;
}) {
  const cardStyle: CSSProperties = {
    backgroundColor: COLOR.bgPrimary,
    border: `0.5px solid ${COLOR.tertiary}`,
    borderRadius: "10px",
    padding: "16px",
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1rem",
        marginBottom: "16px",
      }}
    >
      <div style={cardStyle}>
        <ChartTitle>Revenue</ChartTitle>
        <Legend companies={companies} />
        <RevenueChart companies={companies} />
      </div>
      <div style={cardStyle}>
        <ChartTitle>Operating margin trend</ChartTitle>
        <Legend companies={companies} />
        <MarginChart companies={companies} />
      </div>
      <div style={cardStyle}>
        <ChartTitle>Net profit (current year)</ChartTitle>
        <Legend companies={companies} />
        <ProfitChart companies={companies} />
      </div>
      <div style={cardStyle}>
        <ChartTitle>Strength ranking</ChartTitle>
        <StrengthRanking
          companies={companies}
          comparative={comparative}
          loading={intelLoading}
        />
      </div>
    </div>
  );
}

function ChartTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "12px",
        fontWeight: 600,
        color: COLOR.primary,
        marginBottom: "8px",
      }}
    >
      {children}
    </div>
  );
}

function RevenueChart({ companies }: { companies: CompanyResult[] }) {
  const yearLabels = useMemo(() => {
    const labels = new Set<string>();
    companies.forEach((c) => {
      if (c.yearLabelPrior && c.yearLabelPrior !== "—")
        labels.add(c.yearLabelPrior);
      if (c.yearLabelCurrent && c.yearLabelCurrent !== "—")
        labels.add(c.yearLabelCurrent);
    });
    return Array.from(labels).sort();
  }, [companies]);

  const groups = yearLabels.length > 0 ? yearLabels : ["Prior", "Current"];

  const allValues: number[] = [];
  companies.forEach((c) => {
    if (c.financials.revenuePrior != null)
      allValues.push(c.financials.revenuePrior);
    if (c.financials.revenueCurrent != null)
      allValues.push(c.financials.revenueCurrent);
  });
  const maxVal = Math.max(1, ...allValues);

  const chartH = 180;
  const groupCount = groups.length;
  const barsPerGroup = companies.length;
  const groupGap = 24;
  const barW = 18;
  const innerGap = 4;
  const groupW = barsPerGroup * barW + (barsPerGroup - 1) * innerGap;
  const totalW = groupCount * groupW + (groupCount - 1) * groupGap + 40;
  const missing: string[] = [];
  companies.forEach((c) => {
    if (c.financials.revenueCurrent == null || c.financials.revenuePrior == null) {
      missing.push(c.companyName);
    }
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={totalW} height={chartH + 40} role="img" aria-label="Revenue chart">
        {/* Y-axis baseline */}
        <line
          x1={30}
          y1={chartH}
          x2={totalW - 10}
          y2={chartH}
          stroke={COLOR.tertiary}
        />
        {groups.map((label, gi) => {
          const groupX = 30 + gi * (groupW + groupGap);
          return (
            <g key={label}>
              {companies.map((c, ci) => {
                const isPrior = gi === 0 && groups.length > 1;
                const val = isPrior
                  ? c.financials.revenuePrior
                  : c.financials.revenueCurrent;
                // If 2 groups, gi=0 prior, gi=1 current. If 1 group, current.
                const v =
                  groups.length > 1
                    ? gi === 0
                      ? c.financials.revenuePrior
                      : c.financials.revenueCurrent
                    : c.financials.revenueCurrent;
                void val;
                const value = v ?? 0;
                const h = (value / maxVal) * chartH;
                const x = groupX + ci * (barW + innerGap);
                const y = chartH - h;
                return (
                  <g key={c.companyNumber}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      fill={PALETTE[ci % PALETTE.length]}
                      rx={2}
                    />
                    <title>{`${c.companyName}: £${fmtMillions(v)}`}</title>
                  </g>
                );
              })}
              <text
                x={groupX + groupW / 2}
                y={chartH + 16}
                textAnchor="middle"
                fontSize="10"
                fill={COLOR.muted}
              >
                {label}
              </text>
            </g>
          );
        })}
        <text x={4} y={12} fontSize="10" fill={COLOR.muted}>
          £m
        </text>
        <text
          x={28}
          y={14}
          fontSize="10"
          fill={COLOR.muted}
          textAnchor="end"
        >
          {(maxVal / 1_000_000).toFixed(1)}
        </text>
        <text x={28} y={chartH + 4} fontSize="10" fill={COLOR.muted} textAnchor="end">
          0
        </text>
      </svg>
      {missing.length > 0 && (
        <div style={{ fontSize: "11px", color: COLOR.muted, marginTop: "4px" }}>
          ⚠ Revenue data unavailable for {missing.join(", ")}
        </div>
      )}
    </div>
  );
}

function MarginChart({ companies }: { companies: CompanyResult[] }) {
  const chartH = 180;
  const chartW = 380;
  const padL = 30;
  const padR = 10;

  const allVals: number[] = [];
  companies.forEach((c) => {
    if (c.financials.marginPrior != null) allVals.push(c.financials.marginPrior);
    if (c.financials.marginCurrent != null)
      allVals.push(c.financials.marginCurrent);
  });
  if (allVals.length === 0) allVals.push(0, 10);
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(10, ...allVals);
  const range = maxV - minV || 1;

  const yFor = (v: number) => chartH - ((v - minV) / range) * chartH;

  const x0 = padL + 10;
  const x1 = chartW - padR;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={chartW} height={chartH + 30} role="img" aria-label="Margin trend">
        <line
          x1={padL}
          y1={chartH}
          x2={chartW - padR}
          y2={chartH}
          stroke={COLOR.tertiary}
        />
        <line
          x1={padL}
          y1={0}
          x2={padL}
          y2={chartH}
          stroke={COLOR.tertiary}
        />

        {/* Y ticks */}
        <text x={padL - 4} y={12} fontSize="10" fill={COLOR.muted} textAnchor="end">
          {maxV.toFixed(0)}%
        </text>
        <text x={padL - 4} y={chartH} fontSize="10" fill={COLOR.muted} textAnchor="end">
          {minV.toFixed(0)}%
        </text>

        {companies.map((c, i) => {
          const dashed = /qualified/i.test(c.signals.auditOpinion);
          const prior = c.financials.marginPrior;
          const current = c.financials.marginCurrent;
          if (prior == null && current == null) return null;
          const yp = prior != null ? yFor(prior) : null;
          const yc = current != null ? yFor(current) : null;
          return (
            <g key={c.companyNumber}>
              {yp != null && yc != null && (
                <line
                  x1={x0}
                  y1={yp}
                  x2={x1}
                  y2={yc}
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth={2}
                  strokeDasharray={dashed ? "5 3" : undefined}
                />
              )}
              {yp != null && (
                <circle
                  cx={x0}
                  cy={yp}
                  r={4}
                  fill={PALETTE[i % PALETTE.length]}
                />
              )}
              {yc != null && (
                <circle
                  cx={x1}
                  cy={yc}
                  r={4}
                  fill={PALETTE[i % PALETTE.length]}
                />
              )}
            </g>
          );
        })}

        <text
          x={x0}
          y={chartH + 16}
          fontSize="10"
          fill={COLOR.muted}
          textAnchor="middle"
        >
          {companies[0]?.yearLabelPrior || "Prior"}
        </text>
        <text
          x={x1}
          y={chartH + 16}
          fontSize="10"
          fill={COLOR.muted}
          textAnchor="middle"
        >
          {companies[0]?.yearLabelCurrent || "Current"}
        </text>
      </svg>
    </div>
  );
}

function ProfitChart({ companies }: { companies: CompanyResult[] }) {
  const values = companies.map((c) => c.financials.profitCurrent ?? 0);
  const absMax = Math.max(1, ...values.map((v) => Math.abs(v)));
  const useMillions = absMax >= 1_000_000;
  const divisor = useMillions ? 1_000_000 : 1_000;
  const unit = useMillions ? "£m" : "£k";

  const chartH = 180;
  const barW = 36;
  const gap = 24;
  const padL = 40;
  const totalW = padL + companies.length * (barW + gap);

  const zeroY = chartH / 2;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={totalW} height={chartH + 30}>
        <line
          x1={padL}
          y1={zeroY}
          x2={totalW - 10}
          y2={zeroY}
          stroke={COLOR.tertiary}
        />
        <text x={padL - 6} y={12} fontSize="10" fill={COLOR.muted} textAnchor="end">
          {unit}
        </text>
        {companies.map((c, i) => {
          const v = c.financials.profitCurrent ?? 0;
          const h = (Math.abs(v) / absMax) * (chartH / 2 - 4);
          const x = padL + i * (barW + gap);
          const y = v >= 0 ? zeroY - h : zeroY;
          return (
            <g key={c.companyNumber}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                fill={PALETTE[i % PALETTE.length]}
                rx={2}
              />
              <text
                x={x + barW / 2}
                y={chartH + 16}
                fontSize="10"
                fill={COLOR.muted}
                textAnchor="middle"
              >
                {Math.round(v / divisor).toLocaleString("en-GB")}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StrengthRanking({
  companies,
  comparative,
  loading,
}: {
  companies: CompanyResult[];
  comparative: ComparativeResult | null;
  loading: boolean;
}) {
  if (loading || !comparative) {
    return (
      <div>
        {Array.from({ length: Math.max(2, companies.length) }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 0",
              borderBottom:
                i < companies.length - 1
                  ? `0.5px solid ${COLOR.tertiary}`
                  : "none",
            }}
          >
            <Shimmer w="20px" h="20px" round />
            <Shimmer w="120px" h="12px" />
            <div style={{ flex: 1 }}>
              <Shimmer w="100%" h="6px" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const colorFor = (companyNumber: string) => {
    const idx = companies.findIndex((c) => c.companyNumber === companyNumber);
    return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
  };

  return (
    <div>
      {comparative.strengthRanking.map((row, i) => {
        const isFirst = i === 0;
        return (
          <div
            key={row.companyNumber}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 0",
              borderBottom:
                i < comparative.strengthRanking.length - 1
                  ? `0.5px solid ${COLOR.tertiary}`
                  : "none",
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                fontWeight: 600,
                backgroundColor: isFirst ? "#FAEEDA" : COLOR.bgSecondary,
                color: isFirst ? "#854F0B" : COLOR.muted,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: COLOR.primary,
                minWidth: "160px",
                maxWidth: "160px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={row.rationale}
            >
              {row.companyName}
            </div>
            <div
              style={{
                flex: 1,
                height: "6px",
                backgroundColor: COLOR.tertiary,
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, row.score))}%`,
                  height: "100%",
                  backgroundColor: colorFor(row.companyNumber),
                }}
              />
            </div>
            <div
              style={{
                fontSize: "11px",
                color: COLOR.muted,
                textAlign: "right",
                minWidth: "28px",
              }}
            >
              {row.score}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Shimmer({
  w,
  h,
  round,
}: {
  w: string;
  h: string;
  round?: boolean;
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: round ? "50%" : "4px",
        background:
          "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)",
        backgroundSize: "400px 100%",
        animation: "shimmer 1.4s linear infinite",
      }}
    />
  );
}

// ── Intelligence panels ─────────────────────────────────────────────────────
function IntelligencePanels({
  companies,
  comparative,
  loading,
}: {
  companies: CompanyResult[];
  comparative: ComparativeResult | null;
  loading: boolean;
}) {
  const cardStyle: CSSProperties = {
    backgroundColor: COLOR.bgPrimary,
    border: `0.5px solid ${COLOR.tertiary}`,
    borderRadius: "10px",
    marginBottom: "16px",
    overflow: "hidden",
  };

  const panelBase: CSSProperties = {
    backgroundColor: COLOR.bgSecondary,
    border: `0.5px solid ${COLOR.tertiary}`,
    borderRadius: RADIUS_MD,
    padding: "12px 14px",
  };

  const panelLeftBorder = (color: string): CSSProperties => ({
    backgroundColor: COLOR.bgSecondary,
    border: `0.5px solid ${COLOR.tertiary}`,
    borderLeft: `2px solid ${color}`,
    borderRadius: `0 ${RADIUS_MD} ${RADIUS_MD} 0`,
    padding: "12px 14px",
  });

  return (
    <div style={cardStyle}>
      <div
        style={{
          padding: "14px 16px",
          borderBottom: `0.5px solid ${COLOR.tertiary}`,
          backgroundColor: COLOR.bgSecondary,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "6px",
              backgroundColor: COLOR.indigoBox,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: COLOR.indigo,
            }}
          >
            ✦
          </div>
          <span style={{ fontSize: "13px", fontWeight: 500, color: COLOR.primary }}>
            AI comparative intelligence
          </span>
        </div>
        <div
          style={{
            fontSize: "11px",
            color: COLOR.muted,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {loading ? (
            <>
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  border: `2px solid ${COLOR.tertiary}`,
                  borderTopColor: COLOR.indigo,
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
              <span>Analysing {companies.length || "…"} companies…</span>
            </>
          ) : (
            <span>Generated from {companies.length} filed accounts</span>
          )}
        </div>
      </div>

      {/* Row 1 — three columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "12px",
          padding: "16px",
        }}
      >
        <Panel
          style={panelBase}
          icon="🛡"
          iconColor="#3B6D11"
          title="Sector strengths"
          body={comparative?.sectorStrengths}
          loading={loading}
        />
        <Panel
          style={panelBase}
          icon="⚠"
          iconColor="#854F0B"
          title="Common weaknesses"
          body={comparative?.commonWeaknesses}
          loading={loading}
        />
        <Panel
          style={panelBase}
          icon="💡"
          iconColor="#534AB7"
          title="Inferences"
          body={comparative?.inferences}
          loading={loading}
        />
      </div>

      {/* Row 2 — two columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          padding: "0 16px 16px",
        }}
      >
        <Panel
          style={panelLeftBorder("#E24B4A")}
          icon="🚩"
          iconColor="#A32D2D"
          title="Risk flags"
          body={comparative?.riskFlags}
          loading={loading}
        />
        <Panel
          style={panelLeftBorder("#534AB7")}
          icon="📈"
          iconColor="#534AB7"
          title="Competitive positioning"
          body={comparative?.competitivePositioning}
          loading={loading}
        />
      </div>
    </div>
  );
}

function Panel({
  style,
  icon,
  iconColor,
  title,
  body,
  loading,
}: {
  style: CSSProperties;
  icon: string;
  iconColor: string;
  title: string;
  body: string | undefined;
  loading: boolean;
}) {
  return (
    <div style={style}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          fontWeight: 500,
          color: COLOR.primary,
          marginBottom: "5px",
        }}
      >
        <span style={{ color: iconColor }}>{icon}</span>
        <span>{title}</span>
      </div>
      {loading ? (
        <div
          style={{
            height: "60px",
            background:
              "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)",
            backgroundSize: "400px 100%",
            animation: "shimmer 1.4s linear infinite",
            borderRadius: "4px",
          }}
        />
      ) : (
        <div
          style={{
            fontSize: "12px",
            color: COLOR.secondary,
            lineHeight: 1.65,
          }}
        >
          {body || "—"}
        </div>
      )}
    </div>
  );
}
