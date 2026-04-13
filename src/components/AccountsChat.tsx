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

export default function AccountsChat({ companyNumber, companyName }: AccountsChatProps) {
  console.log("AccountsChat rendering");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Ask me anything about ${companyName}'s filed accounts.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or loading state change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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
        body: JSON.stringify({ companyNumber, companyName, messages: updatedMessages }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json();
      setMessages([...updatedMessages, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages([
        ...updatedMessages,
        { role: "assistant", content: "Sorry, I couldn't retrieve an answer. Please try again." },
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
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "15px 18px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            stroke="#4f46e5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
          Ask about these accounts
        </span>
      </div>

      {/* Scrollable message area */}
      <div
        style={{
          maxHeight: "400px",
          overflowY: "auto",
          padding: "14px 16px",
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
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "88%",
                padding: "9px 13px",
                borderRadius: "10px",
                fontSize: "12.5px",
                lineHeight: "1.55",
                ...(msg.role === "user"
                  ? {
                      backgroundColor: "#4f46e5",
                      color: "#ffffff",
                      borderBottomRightRadius: "3px",
                    }
                  : {
                      backgroundColor: "#f1f5f9",
                      color: "#0f172a",
                      borderBottomLeftRadius: "3px",
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
                borderRadius: "10px",
                borderBottomLeftRadius: "3px",
                padding: "11px 14px",
                display: "flex",
                gap: "4px",
                alignItems: "center",
              }}
            >
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  style={{
                    width: "5px",
                    height: "5px",
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
          padding: "12px 16px",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          gap: "7px",
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
            borderRadius: "7px",
            padding: "8px 11px",
            fontSize: "12.5px",
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
            backgroundColor: isLoading || !input.trim() ? "#e2e8f0" : "#4f46e5",
            color: isLoading || !input.trim() ? "#94a3b8" : "#ffffff",
            border: "none",
            borderRadius: "7px",
            padding: "8px 13px",
            fontSize: "12.5px",
            fontWeight: "600",
            cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
            flexShrink: 0,
          }}
        >
          Send
        </button>
      </div>

      <style>{`
        @keyframes accountsChatDot {
          0%, 60%, 100% { opacity: 0.3; transform: scale(1); }
          30% { opacity: 1; transform: scale(1.25); }
        }
      `}</style>
    </div>
  );
}
