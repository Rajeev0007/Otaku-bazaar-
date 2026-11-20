"use client";

import { useEffect } from "react";
import { pushRecentSearch } from "@/components/store/search-box";

export function SearchHistoryRecorder({ q }: { q: string }) {
  useEffect(() => pushRecentSearch(q), [q]);
  return null;
}
