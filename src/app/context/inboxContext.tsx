// app/context/InboxContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "../../lib/supabaseClient";

type InboxContextType = {
  unseenCount: number;
  refreshCount: () => Promise<void>;
};

const InboxContext = createContext<InboxContextType>({ 
  unseenCount: 0, 
  refreshCount: async () => {} 
});

// ============================================
// APP BADGE HELPER
// ============================================

async function updateAppBadge(count: number) {
  // Method 1: Direct API (works when app is in foreground)
  if ('setAppBadge' in navigator) {
    try {
      if (count > 0) {
        await (navigator as Navigator & { setAppBadge: (count: number) => Promise<void> }).setAppBadge(count);
      } else {
        await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
      }
      console.log('[Badge] Set to:', count);
    } catch (err) {
      console.error('[Badge] Error:', err);
    }
  }

  // Method 2: Message service worker (works as backup)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: count > 0 ? 'SET_BADGE' : 'CLEAR_BADGE',
      count: count,
    });
  }
}

// ============================================
// INBOX PROVIDER
// ============================================

export function InboxProvider({ children }: { children: ReactNode }) {
  const [unseenCount, setUnseenCount] = useState(0);

  const refreshCount = useCallback(async () => {
    const { count, error } = await supabase
      .from("booking_inquiries")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_status", "new")
      .is("seen_at", null);

    if (!error && count !== null) {
      setUnseenCount(count);
      // Sync app badge with unseen count
      updateAppBadge(count);
    }
  }, []);

  useEffect(() => {
    refreshCount();

    // Subscribe to realtime changes for count updates
    const channel = supabase
      .channel("unseen_count_global")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_inquiries" },
        () => refreshCount()
      )
      .subscribe();

    // Refresh on visibility change (also clears badge when app is opened)
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshCount();
    };
    window.addEventListener("visibilitychange", onVisibility);

    return () => {
      channel.unsubscribe();
      window.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshCount]);

  return (
    <InboxContext.Provider value={{ unseenCount, refreshCount }}>
      {children}
    </InboxContext.Provider>
  );
}

export const useInbox = () => useContext(InboxContext);