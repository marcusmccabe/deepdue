"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AccountsChatProps {
  companyNumber: string;
  companyName: string;
}

type CheckStatus = "idle" | "checking" | "available" | "unavailable";

export default function AccountsChat({
  companyNumber,
  companyName,
}: AccountsChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [checkStatus, setCheckStatus] = useState<CheckStatus>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages change or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // When the drawer first opens, check whether an analysis exists for this company
  useEffect(() => {
    if (!isOpen || checkStatus !== "idle") return;

    setCheckStatus("checking");

    fetch(
      `/api/analyse-accounts?companyNumber=${encodeURIComponent(companyNumber)}&checkOnly=true`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.available) {
          setCheckStatus("available");
          setMessages([
            {
              role: "assistant",
              content: `Hi, I have access to ${companyName}'s filed accounts and extracted analysis. What would you like to know?`,
            },
          ]);
        } else {
          setCheckStatus("unavailable");
        }
      })
      .catch(() => {
        setCheckStatus("unavailable");
      });
  }, [isOpen, checkStatus, companyNumber, companyName]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyNumber,
          companyName,
          messages: updatedMessages,
        }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json();
      setMessages([
        ...updatedMessages,
        { role: "assistant", content: data.reply },
      ]);
    } catch {
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: "Sorry, I couldn't retrieve an answer. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating button — always visible */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            backgroundColor: "#4f46e5",
            color: "#ffffff",
            border: "none",
            borderRadius: "9999px",
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 16px rgba(79,70,229,0.45)",
            zIndex: 100,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Ask about accounts
        </button>
      )}

      {/* Chat drawer */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            width: "420px",
            height: "560px",
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            boxShadow:
              "0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.1)",
            display: "flex",
            flexDirection: "column",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div>
              <div
                style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a" }}
              >
                Chat with Accounts
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                {companyName}
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 15 15"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M11.782 4.032a.575.575 0 1 0-.813-.813L7.5 6.687 4.031 3.219a.575.575 0 0 0-.813.813L6.687 7.5l-3.469 3.468a.575.575 0 0 0 .813.813L7.5 8.313l3.469 3.468a.575.575 0 0 0 .813-.813L8.313 7.5l3.469-3.468Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>

          {/* Body — varies by check status */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

            {/* Checking availability */}
            {checkStatus === "checking" && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid #e2e8f0",
                    borderTopColor: "#4f46e5",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "accountsChatSpin 0.7s linear infinite",
                  }}
                />
                Checking analysis…
              </div>
            )}

            {/* No analysis available */}
            {checkStatus === "unavailable" && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "32px 24px",
                  textAlign: "center",
                  gap: "12px",
                }}
              >
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M9 12h6m-3-3v6m9-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a" }}>
                  No analysis available
                </div>
                <div style={{ fontSize: "13px", color: "#64748b", lineHeight: "1.5" }}>
                  No analysis has been run for this company yet. Please run an
                  analysis first.
                </div>
              </div>
            )}

            {/* Chat interface — analysis is available */}
            {checkStatus === "available" && (
              <>
                {/* Messages area */}
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "16px 18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
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
                          maxWidth: "80%",
                          padding: "10px 14px",
                          borderRadius: "12px",
                          fontSize: "13px",
                          lineHeight: "1.55",
                          ...(msg.role === "user"
                            ? {
                                backgroundColor: "#4f46e5",
                                color: "#ffffff",
                                borderBottomRightRadius: "4px",
                              }
                            : {
                                backgroundColor: "#f1f5f9",
                                color: "#0f172a",
                                borderBottomLeftRadius: "4px",
                              }),
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {isLoading && (
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div
                        style={{
                          backgroundColor: "#f1f5f9",
                          borderRadius: "12px",
                          borderBottomLeftRadius: "4px",
                          padding: "12px 16px",
                          display: "flex",
                          gap: "5px",
                          alignItems: "center",
                        }}
                      >
                        {[0, 1, 2].map((dot) => (
                          <span
                            key={dot}
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              backgroundColor: "#94a3b8",
                              display: "inline-block",
                              animation: "accountsChatDot 1.2s infinite",
                              animationDelay: `${dot * 0.2}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div
                  style={{
                    padding: "12px 18px",
                    borderTop: "1px solid #e2e8f0",
                    display: "flex",
                    gap: "8px",
                    flexShrink: 0,
                  }}
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    placeholder="Ask a question about these accounts…"
                    style={{
                      flex: 1,
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "9px 12px",
                      fontSize: "13px",
                      color: "#0f172a",
                      outline: "none",
                      backgroundColor: isLoading ? "#f8fafc" : "#ffffff",
                      cursor: isLoading ? "not-allowed" : "text",
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim()}
                    style={{
                      backgroundColor:
                        isLoading || !input.trim() ? "#e2e8f0" : "#4f46e5",
                      color: isLoading || !input.trim() ? "#94a3b8" : "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "9px 14px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor:
                        isLoading || !input.trim() ? "not-allowed" : "pointer",
                      flexShrink: 0,
                    }}
                  >
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Animation keyframes */}
      <style>{`
        @keyframes accountsChatDot {
          0%, 60%, 100% { opacity: 0.3; transform: scale(1); }
          30% { opacity: 1; transform: scale(1.25); }
        }
        @keyframes accountsChatSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
