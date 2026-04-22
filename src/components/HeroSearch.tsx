"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  company_name: string;
  company_number: string;
  company_status: string;
  address_snippet: string;
}

export default function HeroSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/companies-house?path=/search/companies&q=${encodeURIComponent(query)}&items_per_page=6`
        );
        const data = await res.json();
        setResults(data.items ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/dashboard?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-block", width: "100%", maxWidth: "480px" }}
    >
      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 18px",
            backgroundColor: "#ffffff",
            border: `1px solid ${open ? "#a5b4fc" : "#e2e8f0"}`,
            borderRadius: "10px",
            boxShadow: open
              ? "0 0 0 3px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.06)"
              : "0 2px 8px rgba(0,0,0,0.06)",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        >
          {loading ? (
            <div
              style={{
                width: "16px",
                height: "16px",
                border: "2px solid #e2e8f0",
                borderTop: "2px solid #4f46e5",
                borderRadius: "50%",
                flexShrink: 0,
                animation: "spin 0.7s linear infinite",
              }}
            />
          ) : (
            <svg
              width="16"
              height="16"
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
            onFocus={() => results.length > 0 && setOpen(true)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            style={{
              border: "none",
              outline: "none",
              fontSize: "15px",
              color: "#0f172a",
              flex: 1,
              backgroundColor: "transparent",
            }}
          />

          <button
            type="submit"
            style={{
              padding: "8px 16px",
              backgroundColor: "#4f46e5",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Search
          </button>
        </div>
      </form>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          {results.map((r, i) => (
            <div
              key={r.company_number}
              onClick={() => handleSelect(r.company_number)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
              }}
              style={{
                padding: "12px 16px",
                cursor: "pointer",
                borderBottom: i < results.length - 1 ? "1px solid #f1f5f9" : "none",
                backgroundColor: "transparent",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0f172a",
                  marginBottom: "2px",
                }}
              >
                {r.company_name}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: "#475569",
                  fontFamily: "'Courier New', monospace",
                  marginBottom: "2px",
                }}
              >
                {r.company_number}
              </span>
              {r.address_snippet && (
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "#94a3b8",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.address_snippet}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
