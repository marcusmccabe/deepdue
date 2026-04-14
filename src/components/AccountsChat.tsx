"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AccountsChat({
  companyNumber,
  companyName,
}: {
  companyNumber: string;
  companyName: string;
}) {
  // Imperative portal container — position:fixed is applied via DOM API,
  // completely immune to Tailwind's * selector and any stylesheet.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Ask me anything about ${companyName}'s filed accounts.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = document.createElement("div");
    // Set position via DOM API — cannot be overridden by any CSS rule
    el.style.position = "fixed";
    el.style.bottom = "24px";
    el.style.right = "24px";
    el.style.zIndex = "9999";
    el.style.display = "flex";
    el.style.flexDirection = "column";
    el.style.alignItems = "flex-end";
    document.body.appendChild(el);
    setContainer(el);
    return () => {
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  // Nothing until the container is mounted into the real DOM
  if (!container) return null;

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyNumber,
          companyName,
          messages: updated.filter((m) => m !== messages[0]),
        }),
      });
      const data = await res.json();
      const reply =
        data.reply ||
        data.error ||
        "Sorry, I couldn't retrieve an answer. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't retrieve an answer. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // The portal renders into the fixed container we created above.
  // No position:fixed needed here — the container itself is fixed.
  return createPortal(
    <>
      <style>{`
        @keyframes acDotBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
      `}</style>

      {/* Expanded panel */}
      {isOpen && (
        <div
          style={{
            width: "380px",
            maxHeight: "500px",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            marginBottom: "12px",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "15px 18px",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4f46e5"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span
                style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}
              >
                Ask about these accounts
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                color: "#94a3b8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "14px 14px 8px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent:
                    msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "10px 14px",
                    borderRadius:
                      msg.role === "user"
                        ? "14px 14px 4px 14px"
                        : "14px 14px 14px 4px",
                    backgroundColor:
                      msg.role === "user" ? "#4f46e5" : "#f1f5f9",
                    color: msg.role === "user" ? "#ffffff" : "#0f172a",
                    fontSize: "13px",
                    lineHeight: "1.5",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "4px",
                    alignItems: "center",
                    padding: "10px 16px",
                    borderRadius: "14px 14px 14px 4px",
                    backgroundColor: "#f1f5f9",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        display: "inline-block",
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: "#94a3b8",
                        animation: `acDotBounce 1.2s ease-in-out ${
                          i * 0.15
                        }s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              padding: "12px 14px",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask a question..."
              disabled={loading}
              style={{
                flex: 1,
                padding: "9px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "13px",
                outline: "none",
                backgroundColor: loading ? "#f8fafc" : "#ffffff",
                color: "#0f172a",
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                padding: "9px 14px",
                borderRadius: "8px",
                border: "none",
                backgroundColor:
                  loading || !input.trim() ? "#cbd5e1" : "#4f46e5",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: "600",
                cursor: loading || !input.trim() ? "default" : "pointer",
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          backgroundColor: "#4f46e5",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(79,70,229,0.4)",
          color: "#ffffff",
        }}
      >
        {isOpen ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </>,
    container
  );
}
