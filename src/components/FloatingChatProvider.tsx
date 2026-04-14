"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import AccountsChat from "./AccountsChat";

type ChatData = { companyNumber: string; companyName: string } | null;

const ChatContext = createContext<(data: ChatData) => void>(() => {});

export function useSetChatData() {
  return useContext(ChatContext);
}

export default function FloatingChatProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [chatData, setChatData] = useState<ChatData>(null);
  const setData = useCallback((data: ChatData) => setChatData(data), []);

  return (
    <ChatContext.Provider value={setData}>
      {children}
      {chatData && (
        <AccountsChat
          companyNumber={chatData.companyNumber}
          companyName={chatData.companyName}
        />
      )}
    </ChatContext.Provider>
  );
}
