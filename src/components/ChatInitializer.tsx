"use client";

import { useEffect } from "react";
import { useSetChatData } from "./FloatingChatProvider";

export default function ChatInitializer({
  companyNumber,
  companyName,
}: {
  companyNumber: string;
  companyName: string;
}) {
  const setChatData = useSetChatData();

  useEffect(() => {
    setChatData({ companyNumber, companyName });
    return () => setChatData(null);
  }, [companyNumber, companyName, setChatData]);

  return null;
}
