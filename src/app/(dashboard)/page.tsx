"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useDashboard } from "../context/dashboardContext";
import { useInbox } from "../context/inboxContext";
import InquiryCard, { BookingInquiry, OpportunityStatus } from "../components/inquiryCard";
import { usePullToRefresh } from "../hooks/pullRefresh";
import styles from "./homePage.module.css";
import { HiInbox, HiArrowPath } from "react-icons/hi2";
import InquiryCardSkeleton from "../components/skeletons/inquiryCardSkeleton";
import { useBlockIosEdgeSwipe } from "../hooks/useBlockIosEdgeBackSwipe";


export default function InboxPage() {
  const { setActivePage, setPageTitle, setBreadcrumbs } = useDashboard();

  // Set page config on mount
  useEffect(() => {
    setActivePage("inbox");
    setPageTitle("Inbox");
    setBreadcrumbs([
      { label: "gios.build", href: "#" },
      { label: "Inbox" },
    ]);
  }, [setActivePage, setPageTitle, setBreadcrumbs]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<BookingInquiry[]>([]);
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | "all">("all");
  const [realtimeState, setRealtimeState] = useState<"connecting" | "connected" | "reconnecting">("connecting");
  const [showReconnectUI, setShowReconnectUI] = useState(false);
  const isRealtimeReconnecting = realtimeState !== "connected" && rows.length > 0 && showReconnectUI;

  const newCount = rows.filter((r) => r.opportunity_status === "new").length;
  const contactedCount = rows.filter((r) => r.opportunity_status === "contacted").length;
  const qualifiedCount = rows.filter((r) => r.opportunity_status === "qualified").length;
  const wonCount = rows.filter((r) => r.opportunity_status === "won").length;
  const badCount = rows.filter((r) => r.opportunity_status === "bad").length;
  const lostCount = rows.filter((r) => r.opportunity_status === "lost").length;

  const filteredRows =
    statusFilter === "all" ? rows : rows.filter((r) => r.opportunity_status === statusFilter);

  const skeletonCount = Math.min(filteredRows.length || 3, 3);

  // Block Ios edge swipe gesture:
  useBlockIosEdgeSwipe(true);

  // Fetch data function
  const fetchInquiries = useCallback(async () => {
    const { data, error } = await supabase
      .from("booking_inquiries")
      .select(
        "id, created_at, name, email, phone, selected_types, selected_package, budget, message, source_page, user_agent, opportunity_status, seen_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setError(error.message);
    } else {
      setRows((data ?? []) as BookingInquiry[]);
      setError(null);
    }
  }, []);

  // Pull-to-refresh hook
  const {
    containerRef,
    pullDistance,
    isRefreshing,
    isSettling,
    progress,
    isReady,
  } = usePullToRefresh({
    onRefresh: async () => {
      await fetchInquiries();
    },
    threshold: 80,
    maxPull: 100,
  });

  async function updateStatus(id: string, next: OpportunityStatus) {
    const prev = rows;
    setRows((prevRows) =>
      prevRows.map((r) => (r.id === id ? { ...r, opportunity_status: next } : r))
    );

    const { error } = await supabase
      .from("booking_inquiries")
      .update({ opportunity_status: next })
      .eq("id", id);

    if (error) {
      setRows(prev);
      setError(error.message);
    }
  }

  async function markSeen(id: string) {
    const now = new Date().toISOString();

    setRows((prev) =>
      prev.map((r) => (r.id === id && !r.seen_at ? { ...r, seen_at: now } : r))
    );

    const { error } = await supabase
      .from("booking_inquiries")
      .update({ seen_at: now })
      .eq("id", id)
      .is("seen_at", null);

    if (error) {
      setError(error.message);
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchInquiries().then(() => setLoading(false));
  }, [fetchInquiries]);

  // Realtime subscription
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let uiTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let cancelled = false;

    const cleanup = async () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (uiTimer) clearTimeout(uiTimer);

      if (channel) {
        try {
          await channel.unsubscribe();
        } catch {}
        try {
          supabase.removeChannel(channel);
        } catch {}
        channel = null;
      }
    };

    const scheduleReconnect = async () => {
      if (cancelled) return;

      setRealtimeState("reconnecting");

      uiTimer = setTimeout(() => {
        if (!cancelled) setShowReconnectUI(true);
      }, 450);

      await fetchInquiries();

      const delay = Math.min(1000 * 2 ** attempt, 15000);
      attempt = Math.min(attempt + 1, 4);

      retryTimer = setTimeout(() => {
        if (!cancelled) subscribe();
      }, delay);
    };

    const subscribe = () => {
      if (cancelled) return;

      setRealtimeState(attempt === 0 ? "connecting" : "reconnecting");

      channel = supabase
        .channel("booking_inquiries_live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "booking_inquiries" },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as BookingInquiry;
              setRows((prev) =>
                prev.some((r) => r.id === row.id) ? prev : [row, ...prev].slice(0, 50)
              );
            } else if (payload.eventType === "UPDATE") {
              const updated = payload.new as BookingInquiry;
              setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            }
          }
        )
        .subscribe(async (status) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
            attempt = 0;
            setRealtimeState("connected");
            setShowReconnectUI(false);
            if (uiTimer) clearTimeout(uiTimer);
            return;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            await cleanup();
            await scheduleReconnect();
          }
        });
    };

    subscribe();

    const onVis = () => {
      if (document.visibilityState === "visible") fetchInquiries();
    };
    window.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.removeEventListener("visibilitychange", onVis);
      cleanup();
    };
  }, [fetchInquiries]);

  // Calculate spinner position
  const spinnerY = Math.min(pullDistance * 0.8, 60) - 40;
  const spinnerOpacity = Math.min(progress * 1.5, 1);
  const spinnerScale = 0.5 + progress * 0.5;

  return (
    <>
      {/* Pull-to-refresh indicator */}
      <div className={styles.pullIndicator}>
        <div
          className={`
            ${styles.pullSpinner} 
            ${isSettling ? styles.pullSpinnerSettling : ""} 
            ${isReady ? styles.pullSpinnerReady : ""}
            ${isRefreshing ? styles.pullSpinnerRefreshing : ""}
          `}
          style={{
            transform: isRefreshing
              ? "translateY(20px) scale(1)"
              : `translateY(${spinnerY}px) scale(${spinnerScale}) rotate(${progress * 270}deg)`,
            opacity: isRefreshing ? 1 : spinnerOpacity,
          }}
        >
          <HiArrowPath size={18} />
        </div>
      </div>

      <div
        ref={containerRef}
        className={`${styles.canvas} ${isSettling ? styles.canvasSettling : ""}`}
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.4}px)` : undefined,
        }}
      >
        {/* Page Header */}
        <div className={styles.pageHeader}>
          <div className={styles.pageIcon}>
            <HiInbox size={30} />
          </div>
          <h1 className={styles.pageTitle}>Inbox</h1>
        </div>

        {/* Stats Row */}
        <div className={styles.statsRow}>
          <div className={styles.statGroup}>
            <StatCard
              label="Total"
              value={rows.length}
              variant="neutral"
              onClick={() => setStatusFilter("all")}
              active={statusFilter === "all"}
            />
            <StatCard
              label="New"
              value={newCount}
              variant="blue"
              onClick={() => setStatusFilter(statusFilter === "new" ? "all" : "new")}
              active={statusFilter === "new"}
            />
            <StatCard
              label="Contacted"
              value={contactedCount}
              variant="purple"
              onClick={() => setStatusFilter(statusFilter === "contacted" ? "all" : "contacted")}
              active={statusFilter === "contacted"}
            />
            <StatCard
              label="Qualified"
              value={qualifiedCount}
              variant="orange"
              onClick={() => setStatusFilter(statusFilter === "qualified" ? "all" : "qualified")}
              active={statusFilter === "qualified"}
            />
            <StatCard
              label="Won"
              value={wonCount}
              variant="green"
              onClick={() => setStatusFilter(statusFilter === "won" ? "all" : "won")}
              active={statusFilter === "won"}
            />
            <StatCard
              label="Bad"
              value={badCount}
              variant="red"
              onClick={() => setStatusFilter("bad")}
              active={statusFilter === "bad"}
            />
            <StatCard
              label="Lost"
              value={lostCount}
              variant="neutral"
              onClick={() => setStatusFilter("lost")}
              active={statusFilter === "lost"}
            />
          </div>
        </div>

        {/* Content */}
        <main className={styles.content}>
          {loading ? (
            <div className={styles.cardList}>
              {Array.from({ length: 3 }).map((_, i) => (
                <InquiryCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className={styles.errorBanner}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon="📭"
              title="No inquiries yet"
              description="When someone submits a booking form, it will appear here."
            />
          ) : filteredRows.length === 0 ? (
            <EmptyState
              icon="🔍"
              title={`No ${statusFilter} inquiries`}
              description="Try changing your filter to see more results."
            />
          ) : (
            <div className={styles.cardList}>
              {isRealtimeReconnecting
                ? Array.from({ length: skeletonCount }).map((_, i) => (
                    <InquiryCardSkeleton key={`skel-${i}`} />
                  ))
                : filteredRows.map((inquiry) => (
                    <InquiryCard
                      key={inquiry.id}
                      inquiry={inquiry}
                      onStatusChange={updateStatus}
                      onSeen={markSeen}
                    />
                  ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

/* Stat Card Component */
type StatCardProps = {
  label: string;
  value: number;
  variant: "blue" | "purple" | "orange" | "green" | "red" | "neutral";
  onClick: () => void;
  active: boolean;
};

function StatCard({ label, value, variant, onClick, active }: StatCardProps) {
  return (
    <button
      className={`${styles.statCard} ${styles[`statCard${variant.charAt(0).toUpperCase() + variant.slice(1)}`]} ${active ? styles.statCardActive : ""}`}
      onClick={onClick}
    >
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </button>
  );
}

/* Empty State Component */
type EmptyStateProps = {
  icon: string;
  title: string;
  description: string;
};

function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>{icon}</div>
      <h3 className={styles.emptyTitle}>{title}</h3>
      <p className={styles.emptyDescription}>{description}</p>
    </div>
  );
}