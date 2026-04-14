"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  company_name: string;
  company_number: string;
  company_status: string;
  address_snippet: string;
}

interface Props {
  /** Pre-populate the input and trigger a search (e.g. from URL ?q=) */
  initialQuery?: string;
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  const dissolved = status === "dissolved";
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: "600",
        color: active ? "#059669" : dissolved ? "#dc2626" : "#94a3b8",
        backgroundColor: active
          ? "rgba(5,150,105,0.08)"
          : dissolved
          ? "rgba(220,38,38,0.08)"
          : "rgba(148,163,184,0.12)",
        padding: "2px 7px",
        borderRadius: "100px",
        textTransform: "capitalize",
        marginLeft: "8px",
        flexShrink: 0,
      }}
    >
      {status || "unknown"}
    </span>
  );
}

export default function SearchBar({ initialQuery = "" }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [noResults, setNoResults] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([]);
      setOpen(false);
      setNoResults(false);
      return;
    }
    setLoading(true);
    setNoResults(false);
    try {
      const res = await fetch(
        `/api/companies-house?path=/search/companies&q=${encodeURIComponent(q)}&items_per_page=8`
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      const items: SearchResult[] = data.items ?? [];
      setResults(items);
      setOpen(true);
      setNoResults(items.length === 0);
    } catch {
      setResults([]);
      setNoResults(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search as user types
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(query), 350);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, doSearch]);

  // Trigger search if initialQuery is set on mount
  useEffect(() => {
    if (initialQuery && initialQuery.length >= 3) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function handleSelect(companyNumber: string) {
    setOpen(false);
    router.push(`/company/${companyNumber}`);
  }

  const showDropdown = open && (results.length > 0 || noResults);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* ── Input ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "9px 14px",
          backgroundColor: "#ffffff",
          border: `1px solid ${open ? "#a5b4fc" : "#e2e8f0"}`,
          borderRadius: "8px",
          width: "100%",
          boxShadow: open
            ? "0 0 0 3px rgba(99,102,241,0.12)"
            : "0 1px 3px rgba(0,0,0,0.04)",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      >
        {/* Icon: spinner or magnifier */}
        {loading ? (
          <div
            style={{
              width: "14px",
              height: "14px",
              border: "2px solid #e2e8f0",
              borderTop: "2px solid #4f46e5",
              borderRadius: "50%",
              flexShrink: 0,
              animation: "spin 0.7s linear infinite",
            }}
          />
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 15 15"
            fill="none"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path
              d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.309 10.016C8.535 10.632 7.558 11 6.5 11C4.015 11 2 8.985 2 6.5C2 4.015 4.015 2 6.5 2C8.985 2 11 4.015 11 6.5C11 7.558 10.632 8.535 10.016 9.309L12.854 12.146C13.049 12.342 13.049 12.658 12.854 12.854C12.658 13.049 12.342 13.049 12.146 12.854L9.309 10.016Z"
              fill="#94a3b8"
              fillRule="evenodd"
              clipRule="evenodd"
            />
          </svg>
        )}

        <input
          type="text"
          value={query}
          placeholder="Search any UK company…"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          style={{
            border: "none",
            outline: "none",
            fontSize: "13px",
            color: "#0f172a",
            flex: 1,
            backgroundColor: "transparent",
          }}
        />

        {!loading && (
          <span
            style={{
              padding: "2px 6px",
              backgroundColor: "#f1f5f9",
              border: "1px solid #e2e8f0",
              borderRadius: "4px",
              fontSize: "11px",
              color: "#94a3b8",
              fontWeight: "500",
              whiteSpace: "nowrap",
            }}
          >
            ⌘K
          </span>
        )}
      </div>

      {/* ── Dropdown ── */}
      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: "420px",
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          {results.length > 0 ? (
            results.map((r, i) => (
              <div
                key={r.company_number}
                role="option"
                aria-selected="false"
                onClick={() => handleSelect(r.company_number)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor =
                    "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor =
                    "transparent";
                }}
                style={{
                  padding: "11px 14px",
                  cursor: "pointer",
                  borderBottom:
                    i < results.length - 1 ? "1px solid #f1f5f9" : "none",
                  backgroundColor: "transparent",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "3px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#0f172a",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "260px",
                    }}
                  >
                    {r.company_name}
                  </span>
                  <StatusPill status={r.company_status} />
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#475569",
                      fontFamily: "'Courier New', monospace",
                      flexShrink: 0,
                    }}
                  >
                    {r.company_number}
                  </span>
                  {r.address_snippet && (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#94a3b8",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      · {r.address_snippet}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                fontSize: "13px",
                color: "#94a3b8",
              }}
            >
              No companies found for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
