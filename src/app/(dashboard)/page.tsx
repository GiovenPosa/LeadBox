"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useDashboard } from "../context/dashboardContext";
import { useInbox } from "../context/inboxContext";
import InquiryCard, { BookingInquiry, OpportunityStatus } from "../components/inquiryCard";
import { usePullToRefresh } from "../hooks/pullRefresh";
import { useIntersectionObserver } from "../hooks/useIntersectionObserver";
import styles from "./homePage.module.css";
import { HiInbox, HiArrowPath } from "react-icons/hi2";
import InquiryCardSkeleton from "../components/skeletons/inquiryCardSkeleton";
import { useBlockIosEdgeSwipe } from "../hooks/useBlockIosEdgeBackSwipe";

/* =========================================================
   Constants
========================================================= */

const PAGE_SIZE = 20;

// Columns we select from the database (keeps queries consistent)
const SELECT_COLUMNS =
  "id, created_at, name, email, phone, selected_types, selected_package, budget, message, source_page, user_agent, opportunity_status, seen_at";

/* =========================================================
   Types
========================================================= */

type StatusCounts = {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  won: number;
  lost: number;
  bad: number;
};

type StatusFilter = OpportunityStatus | "all";

/* =========================================================
   Component
========================================================= */

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

  /* ---------------------------------------------------------
     State
  --------------------------------------------------------- */

  // Data state
  const [rows, setRows] = useState<BookingInquiry[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Loading states
  const [loading, setLoading] = useState(true); // Initial load
  const [loadingMore, setLoadingMore] = useState(false); // Subsequent pages
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [hasMore, setHasMore] = useState(true);

  // Counts state (fetched separately for accurate totals)
  const [counts, setCounts] = useState<StatusCounts>({
    total: 0,
    new: 0,
    contacted: 0,
    qualified: 0,
    won: 0,
    lost: 0,
    bad: 0,
  });

  // Realtime state
  const [realtimeState, setRealtimeState] = useState<
    "connecting" | "connected" | "reconnecting"
  >("connecting");
  const [showReconnectUI, setShowReconnectUI] = useState(false);
  const isRealtimeReconnecting =
    realtimeState !== "connected" && rows.length > 0 && showReconnectUI;

  // Track current filter in a ref to avoid stale closures in callbacks
  const currentFilterRef = useRef<StatusFilter>(statusFilter);
  currentFilterRef.current = statusFilter;

  /* ---------------------------------------------------------
     Derived State
  --------------------------------------------------------- */

  const skeletonCount = Math.min(rows.length || 3, 3);

  // Block iOS edge swipe gesture
  useBlockIosEdgeSwipe(true);

  /* ---------------------------------------------------------
     Data Fetching Functions
  --------------------------------------------------------- */

  /**
   * Fetch accurate counts for all statuses.
   * This runs separately from pagination so totals are always correct.
   */
  const fetchCounts = useCallback(async () => {
    // Supabase allows count queries without fetching data
    const { count: total } = await supabase
      .from("booking_inquiries")
      .select("*", { count: "exact", head: true });

    const { count: newCount } = await supabase
      .from("booking_inquiries")
      .select("*", { count: "exact", head: true })
      .eq("opportunity_status", "new");

    const { count: contactedCount } = await supabase
      .from("booking_inquiries")
      .select("*", { count: "exact", head: true })
      .eq("opportunity_status", "contacted");

    const { count: qualifiedCount } = await supabase
      .from("booking_inquiries")
      .select("*", { count: "exact", head: true })
      .eq("opportunity_status", "qualified");

    const { count: wonCount } = await supabase
      .from("booking_inquiries")
      .select("*", { count: "exact", head: true })
      .eq("opportunity_status", "won");

    const { count: lostCount } = await supabase
      .from("booking_inquiries")
      .select("*", { count: "exact", head: true })
      .eq("opportunity_status", "lost");

    const { count: badCount } = await supabase
      .from("booking_inquiries")
      .select("*", { count: "exact", head: true })
      .eq("opportunity_status", "bad");

    setCounts({
      total: total ?? 0,
      new: newCount ?? 0,
      contacted: contactedCount ?? 0,
      qualified: qualifiedCount ?? 0,
      won: wonCount ?? 0,
      lost: lostCount ?? 0,
      bad: badCount ?? 0,
    });
  }, []);

  /**
   * Fetch the first page of inquiries WITH the current filter applied.
   * Called on initial load, pull-to-refresh, and filter change.
   */
  const fetchInitialInquiries = useCallback(
    async (filter: StatusFilter = currentFilterRef.current) => {
      // Build the query
      let query = supabase
        .from("booking_inquiries")
        .select(SELECT_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      // Apply filter at DATABASE level (not client-side)
      if (filter !== "all") {
        query = query.eq("opportunity_status", filter);
      }

      const { data, error } = await query;

      if (error) {
        setError(error.message);
      } else {
        setRows((data ?? []) as BookingInquiry[]);
        // If we got fewer items than PAGE_SIZE, there's no more data
        setHasMore((data?.length ?? 0) === PAGE_SIZE);
        setError(null);
      }
    },
    []
  );

  /**
   * Load the next page of inquiries WITH the current filter applied.
   * Uses cursor-based pagination (created_at of last item).
   */
  const loadMore = useCallback(async () => {
    // Guard clauses prevent duplicate/unnecessary requests
    if (loadingMore) return; // Already loading
    if (!hasMore) return; // No more data to fetch
    if (rows.length === 0) return; // No initial data yet

    setLoadingMore(true);

    // Cursor = timestamp of the last loaded item
    const lastRow = rows[rows.length - 1];
    const cursor = lastRow.created_at;

    // Build the query
    let query = supabase
      .from("booking_inquiries")
      .select(SELECT_COLUMNS)
      .order("created_at", { ascending: false })
      .lt("created_at", cursor) // Items BEFORE the cursor (older)
      .limit(PAGE_SIZE);

    // Apply filter at DATABASE level
    if (currentFilterRef.current !== "all") {
      query = query.eq("opportunity_status", currentFilterRef.current);
    }

    const { data, error } = await query;

    if (error) {
      setError(error.message);
    } else {
      // APPEND new data to existing rows
      setRows((prev) => [...prev, ...(data ?? [])]);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
    }

    setLoadingMore(false);
  }, [loadingMore, hasMore, rows]);

  /**
   * Combined fetch for both counts and initial data.
   * Used for initial load and refresh.
   */
  const fetchAll = useCallback(
    async (filter?: StatusFilter) => {
      await Promise.all([fetchCounts(), fetchInitialInquiries(filter)]);
    },
    [fetchCounts, fetchInitialInquiries]
  );

  /* ---------------------------------------------------------
     Filter Change Handler
  --------------------------------------------------------- */

  /**
   * When filter changes, we need to:
   * 1. Update the filter state
   * 2. Reset pagination
   * 3. Fetch fresh data with the new filter
   */
  const handleFilterChange = useCallback(
    async (newFilter: StatusFilter) => {
      // If clicking the same filter, toggle back to "all"
      const targetFilter =
        newFilter === statusFilter && newFilter !== "all" ? "all" : newFilter;

      // Update state
      setStatusFilter(targetFilter);
      currentFilterRef.current = targetFilter;

      // Reset pagination
      setHasMore(true);
      setRows([]); // Clear current rows to show loading state

      // Show loading briefly
      setLoading(true);

      // Fetch with new filter
      await fetchInitialInquiries(targetFilter);

      setLoading(false);
    },
    [statusFilter, fetchInitialInquiries]
  );

  /* ---------------------------------------------------------
     Intersection Observer for Infinite Scroll
  --------------------------------------------------------- */

  // The sentinel ref - attach to a div at the bottom of the list
  // Only enabled when we're not loading and there's more data
  const sentinelRef = useIntersectionObserver(
    loadMore,
    !loading && !loadingMore && hasMore && rows.length > 0
  );

  /* ---------------------------------------------------------
     Pull to Refresh
  --------------------------------------------------------- */

  const {
    containerRef,
    pullDistance,
    isRefreshing,
    isSettling,
    progress,
    isReady,
  } = usePullToRefresh({
    onRefresh: async () => {
      // Reset pagination state before refreshing
      setHasMore(true);
      await fetchAll();
    },
    threshold: 80,
    maxPull: 100,
  });

  /* ---------------------------------------------------------
     Status & Seen Updates
  --------------------------------------------------------- */

  async function updateStatus(id: string, next: OpportunityStatus) {
    const prev = rows;
    const prevCounts = counts;

    // Find the current status for count adjustment
    const currentRow = rows.find((r) => r.id === id);
    const currentStatus = currentRow?.opportunity_status;

    // Optimistic update for rows
    setRows((prevRows) =>
      prevRows.map((r) =>
        r.id === id ? { ...r, opportunity_status: next } : r
      )
    );

    // Optimistic update for counts
    if (currentStatus && currentStatus !== next) {
      setCounts((prev) => ({
        ...prev,
        [currentStatus]: Math.max(0, prev[currentStatus] - 1),
        [next]: prev[next] + 1,
      }));
    }

    const { error } = await supabase
      .from("booking_inquiries")
      .update({ opportunity_status: next })
      .eq("id", id);

    if (error) {
      // Rollback on error
      setRows(prev);
      setCounts(prevCounts);
      setError(error.message);
    } else {
      // If we're filtering and the item no longer matches, remove it from view
      if (statusFilter !== "all" && next !== statusFilter) {
        setRows((prevRows) => prevRows.filter((r) => r.id !== id));
      }
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

  /* ---------------------------------------------------------
     Initial Fetch Effect
  --------------------------------------------------------- */

  useEffect(() => {
    fetchAll().then(() => setLoading(false));
  }, [fetchAll]);

  /* ---------------------------------------------------------
     Realtime Subscription
  --------------------------------------------------------- */

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

      await fetchAll();

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

              // Update counts
              setCounts((prev) => ({
                ...prev,
                total: prev.total + 1,
                [row.opportunity_status]: prev[row.opportunity_status] + 1,
              }));

              // Only add to view if it matches current filter
              if (
                currentFilterRef.current === "all" ||
                row.opportunity_status === currentFilterRef.current
              ) {
                setRows((prev) =>
                  prev.some((r) => r.id === row.id) ? prev : [row, ...prev]
                );
              }
            } else if (payload.eventType === "UPDATE") {
              const updated = payload.new as BookingInquiry;
              const old = payload.old as Partial<BookingInquiry>;

              // Update counts if status changed
              if (
                old.opportunity_status &&
                old.opportunity_status !== updated.opportunity_status
              ) {
                setCounts((prev) => ({
                  ...prev,
                  [old.opportunity_status!]: Math.max(
                    0,
                    prev[old.opportunity_status!] - 1
                  ),
                  [updated.opportunity_status]:
                    prev[updated.opportunity_status] + 1,
                }));
              }

              // Handle row updates based on filter
              const filter = currentFilterRef.current;
              const matchesFilter =
                filter === "all" || updated.opportunity_status === filter;
              const wasInView = old.opportunity_status
                ? filter === "all" || old.opportunity_status === filter
                : true;

              if (matchesFilter && wasInView) {
                // Update in place
                setRows((prev) =>
                  prev.map((r) => (r.id === updated.id ? updated : r))
                );
              } else if (!matchesFilter && wasInView) {
                // Remove from view (no longer matches filter)
                setRows((prev) => prev.filter((r) => r.id !== updated.id));
              } else if (matchesFilter && !wasInView) {
                // Add to view (now matches filter)
                setRows((prev) =>
                  prev.some((r) => r.id === updated.id)
                    ? prev
                    : [updated, ...prev]
                );
              }
            } else if (payload.eventType === "DELETE") {
              const deleted = payload.old as BookingInquiry;
              setRows((prev) => prev.filter((r) => r.id !== deleted.id));
              // Update counts
              setCounts((prev) => ({
                ...prev,
                total: Math.max(0, prev.total - 1),
                [deleted.opportunity_status]: Math.max(
                  0,
                  prev[deleted.opportunity_status] - 1
                ),
              }));
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
      if (document.visibilityState === "visible") fetchAll();
    };
    window.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.removeEventListener("visibilitychange", onVis);
      cleanup();
    };
  }, [fetchAll]);

  /* ---------------------------------------------------------
     Pull-to-Refresh Visual Calculations
  --------------------------------------------------------- */

  const spinnerY = Math.min(pullDistance * 0.8, 60) - 40;
  const spinnerOpacity = Math.min(progress * 1.5, 1);
  const spinnerScale = 0.5 + progress * 0.5;

  /* ---------------------------------------------------------
     Helper to get count for current filter
  --------------------------------------------------------- */

  const getFilteredCount = (): number => {
    if (statusFilter === "all") return counts.total;
    return counts[statusFilter];
  };

  /* ---------------------------------------------------------
     Render
  --------------------------------------------------------- */

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
          transform:
            pullDistance > 0 ? `translateY(${pullDistance * 0.4}px)` : undefined,
        }}
      >
        {/* Page Header */}
        <div className={styles.pageHeader}>
          <div className={styles.pageIcon}>
            <HiInbox size={30} />
          </div>
          <h1 className={styles.pageTitle}>Inbox</h1>
        </div>

        {/* Stats Row - Now uses accurate counts from database */}
        <div className={styles.statsRow}>
          <div className={styles.statGroup}>
            <StatCard
              label="Total"
              value={counts.total}
              variant="neutral"
              onClick={() => handleFilterChange("all")}
              active={statusFilter === "all"}
            />
            <StatCard
              label="New"
              value={counts.new}
              variant="blue"
              onClick={() => handleFilterChange("new")}
              active={statusFilter === "new"}
            />
            <StatCard
              label="Contacted"
              value={counts.contacted}
              variant="purple"
              onClick={() => handleFilterChange("contacted")}
              active={statusFilter === "contacted"}
            />
            <StatCard
              label="Qualified"
              value={counts.qualified}
              variant="orange"
              onClick={() => handleFilterChange("qualified")}
              active={statusFilter === "qualified"}
            />
            <StatCard
              label="Won"
              value={counts.won}
              variant="green"
              onClick={() => handleFilterChange("won")}
              active={statusFilter === "won"}
            />
            <StatCard
              label="Bad"
              value={counts.bad}
              variant="red"
              onClick={() => handleFilterChange("bad")}
              active={statusFilter === "bad"}
            />
            <StatCard
              label="Lost"
              value={counts.lost}
              variant="neutral"
              onClick={() => handleFilterChange("lost")}
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
          ) : rows.length === 0 && statusFilter === "all" ? (
            <EmptyState
              icon="📭"
              title="No inquiries yet"
              description="When someone submits a booking form, it will appear here."
            />
          ) : rows.length === 0 ? (
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
                : rows.map((inquiry) => (
                    <InquiryCard
                      key={inquiry.id}
                      inquiry={inquiry}
                      onStatusChange={updateStatus}
                      onSeen={markSeen}
                    />
                  ))}

              {/* ═══════════════════════════════════════════════════════
                  SENTINEL ELEMENT - Triggers loadMore when visible
                  ═══════════════════════════════════════════════════════ */}
              <div ref={sentinelRef} className={styles.sentinel}>
                {loadingMore && (
                  <div className={styles.loadingMore}>
                    <div className={styles.spinner} />
                  </div>
                )}
                {!hasMore && rows.length >= PAGE_SIZE && (
                  <p className={styles.endMessage}>
                    You've seen all {getFilteredCount()}{" "}
                    {statusFilter === "all" ? "leads" : `${statusFilter} leads`}
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

/* =========================================================
   Sub-Components
========================================================= */

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