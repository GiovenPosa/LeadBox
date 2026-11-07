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
import ConfirmDialog from "../components/confirmDialog";
import EnquiryPanel from "../components/enquiryPanel";
import Button from "../components/button";
import { StatPill } from "../components/statPill";
import { deleteInquiries } from "../../lib/deleteInquiries";
import { BUSINESS_TYPES, PACKAGES, convertInquiryToLead, embeddedLead } from "../../lib/leads";
import { useBlockIosEdgeSwipe } from "../hooks/useBlockIosEdgeBackSwipe";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useDelayedFlag } from "../hooks/useDelayedFlag";
import Toolbar, { type ToolbarFilterGroup } from "../components/toolbar";

/* =========================================================
   Constants
========================================================= */

const PAGE_SIZE = 20;

// How long a swiped-away lead can be brought back before it's really deleted
const UNDO_MS = 5000;

// Columns we select from the database (keeps queries consistent)
const SELECT_COLUMNS =
  "id, created_at, name, email, phone, selected_types, selected_package, budget, message, source_page, user_agent, opportunity_status, seen_at, leads(id, stage)";

/* =========================================================
   Types
========================================================= */

type StatusCounts = Record<OpportunityStatus, number> & { total: number };

const STATUSES: OpportunityStatus[] = ["new", "contacted", "converted", "bad"];

// How a status reads in "No converted enquiries" and the like
const STATUS_WORD: Record<StatusFilter, string> = {
  all: "",
  new: "new",
  contacted: "contacted",
  converted: "converted",
  bad: "bad",
};

type StatusFilter = OpportunityStatus | "all";

type InboxSort = "newest" | "oldest" | "budget";

/** Everything that decides which enquiries show, and in what order */
type InboxView = {
  status: StatusFilter;
  search: string;
  attrs: Record<string, string[]>;
  sort: InboxSort;
};

/* =========================================================
   Toolbar: search, filter and sort
========================================================= */

const SEARCH_DEBOUNCE_MS = 300;

const FILTER_GROUPS: ToolbarFilterGroup[] = [
  {
    key: "read",
    label: "Read",
    options: [
      { value: "unread", label: "Unread" },
      { value: "read", label: "Read" },
    ],
  },
  {
    key: "package",
    label: "Package",
    options: PACKAGES,
  },
  {
    key: "type",
    label: "Business type",
    options: BUSINESS_TYPES.map((t) => ({ value: t, label: t })),
  },
];

const SORT_OPTIONS: { value: InboxSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "budget", label: "Highest budget" },
];

// Commas, brackets and quotes would break PostgREST's or() syntax, and * is its wildcard
const searchTerm = (search: string) => search.replace(/[,()*"\\]/g, " ").trim();

const isNarrowed = (view: InboxView) =>
  !!searchTerm(view.search) || Object.values(view.attrs).some((v) => v.length > 0);

/** One page of enquiries for a view, filtered and sorted in the database */
function inquiriesQuery(view: InboxView, from: number) {
  let query = supabase.from("booking_inquiries").select(SELECT_COLUMNS);

  if (view.status !== "all") query = query.eq("opportunity_status", view.status);

  const term = searchTerm(view.search);
  if (term) {
    const like = `*${term}*`;
    query = query.or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like},message.ilike.${like}`);
  }

  // Both or neither of read/unread means no filter
  const read = view.attrs.read ?? [];
  if (read.length === 1) {
    query = read[0] === "unread" ? query.is("seen_at", null) : query.not("seen_at", "is", null);
  }
  if (view.attrs.package?.length) query = query.in("selected_package", view.attrs.package);
  if (view.attrs.type?.length) query = query.overlaps("selected_types", view.attrs.type);

  query =
    view.sort === "budget"
      ? query.order("budget", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })
      : query.order("created_at", { ascending: view.sort === "oldest" });

  return query.range(from, from + PAGE_SIZE - 1);
}

/** The same rules as inquiriesQuery, for realtime rows that arrive on their own */
function matchesView(row: BookingInquiry, view: InboxView) {
  if (view.status !== "all" && row.opportunity_status !== view.status) return false;

  const term = searchTerm(view.search).toLowerCase();
  if (term && ![row.name, row.email, row.phone, row.message].some((v) => v?.toLowerCase().includes(term))) {
    return false;
  }

  const read = view.attrs.read ?? [];
  if (read.length === 1 && (read[0] === "unread") !== !row.seen_at) return false;

  const packages = view.attrs.package ?? [];
  if (packages.length && !packages.includes(row.selected_package ?? "")) return false;

  const types = view.attrs.type ?? [];
  if (types.length && !row.selected_types?.some((t) => types.includes(t))) return false;

  return true;
}

function compareRows(sort: InboxSort) {
  const newest = (a: BookingInquiry, b: BookingInquiry) => b.created_at.localeCompare(a.created_at);
  if (sort === "oldest") return (a: BookingInquiry, b: BookingInquiry) => -newest(a, b);
  if (sort === "budget") {
    return (a: BookingInquiry, b: BookingInquiry) =>
      (b.budget ?? -1) - (a.budget ?? -1) || newest(a, b);
  }
  return newest;
}

/**
 * Put a row where the current sort says it goes. If it would land after the
 * last loaded row while more pages are still to come, leave it out: it'll
 * arrive with those pages instead.
 */
function insertSorted(rows: BookingInquiry[], row: BookingInquiry, sort: InboxSort, moreToLoad: boolean) {
  if (rows.some((r) => r.id === row.id)) return rows;
  const compare = compareRows(sort);
  const last = rows[rows.length - 1];
  if (moreToLoad && last && compare(row, last) > 0) return rows;
  return [...rows, row].sort(compare);
}

/* =========================================================
   Component
========================================================= */

export default function InboxPage() {
  const { setActivePage, setPageTitle, setBreadcrumbs } = useDashboard();
  const { refreshCount } = useInbox();

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
  // a quick load skips the skeleton; the cards just fade in
  const showSkeleton = useDelayedFlag(loading);
  const [loadingMore, setLoadingMore] = useState(false); // Subsequent pages
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [hasMore, setHasMore] = useState(true);

  // Delete: the desktop button asks first; a swipe deletes after an undo window
  const [confirmTarget, setConfirmTarget] = useState<BookingInquiry | null>(null);
  // The enquiry open in the side panel; it reads the live row, so status and lead changes show straight away
  const [openId, setOpenId] = useState<string | null>(null);
  const openInquiry = rows.find((r) => r.id === openId) ?? null;
  const closePanel = useCallback(() => setOpenId(null), []);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [undoRow, setUndoRow] = useState<BookingInquiry | null>(null);
  const pendingDeleteRef = useRef<BookingInquiry | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Counts state (fetched separately for accurate totals)
  // the toolbar shows until the first counts say there's nothing to search
  const [countsLoaded, setCountsLoaded] = useState(false);
  const [counts, setCounts] = useState<StatusCounts>({
    total: 0,
    new: 0,
    contacted: 0,
    converted: 0,
    bad: 0,
  });

  // Realtime state
  const [realtimeState, setRealtimeState] = useState<
    "connecting" | "connected" | "reconnecting"
  >("connecting");
  const [showReconnectUI, setShowReconnectUI] = useState(false);
  const isRealtimeReconnecting =
    realtimeState !== "connected" && rows.length > 0 && showReconnectUI;

  // Toolbar: the search box updates straight away; the query waits for a pause in typing
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [attrFilter, setAttrFilter] = useState<Record<string, string[]>>({});
  const [sort, setSort] = useState<InboxSort>("newest");
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Track the current view in a ref to avoid stale closures in callbacks
  const viewRef = useRef<InboxView>({ status: statusFilter, search: debouncedSearch, attrs: attrFilter, sort });
  viewRef.current = { status: statusFilter, search: debouncedSearch, attrs: attrFilter, sort };
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  // Only the newest request may update the list, so a slow search can't overwrite a newer one
  const requestIdRef = useRef(0);

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
    const countOf = async (status?: OpportunityStatus) => {
      let query = supabase.from("booking_inquiries").select("*", { count: "exact", head: true });
      if (status) query = query.eq("opportunity_status", status);
      const { count } = await query;
      return count ?? 0;
    };

    const [total, ...byStatus] = await Promise.all([countOf(), ...STATUSES.map((s) => countOf(s))]);
    setCountsLoaded(true);
    setCounts({
      total,
      ...(Object.fromEntries(STATUSES.map((s, i) => [s, byStatus[i]])) as Record<OpportunityStatus, number>),
    });
  }, []);

  /**
   * Fetch the first page of inquiries WITH the current filter applied.
   * Called on initial load, pull-to-refresh, and filter change.
   */
  const fetchInitialInquiries = useCallback(
    async (view: InboxView = viewRef.current) => {
      const requestId = ++requestIdRef.current;
      const { data, error } = await inquiriesQuery(view, 0);
      if (requestId !== requestIdRef.current) return;

      if (error) {
        setError(error.message);
      } else {
        const pendingId = pendingDeleteRef.current?.id;
        setRows(((data ?? []) as BookingInquiry[]).filter((r) => r.id !== pendingId));
        // If we got fewer items than PAGE_SIZE, there's no more data
        setHasMore((data?.length ?? 0) === PAGE_SIZE);
        setError(null);
      }
      // Only the request whose rows are used ends the loading state. An
      // earlier one that lost the race returns above, so it can't switch
      // loading off while the list is still empty (which flashed the empty state).
      setLoading(false);
    },
    []
  );

  /**
   * Load the next page of inquiries for the current view.
   * Offset-based, so it works for every sort; rows already shown are skipped
   * in case a realtime insert shifted the pages.
   */
  const loadMore = useCallback(async () => {
    // Guard clauses prevent duplicate/unnecessary requests
    if (loadingMore) return; // Already loading
    if (!hasMore) return; // No more data to fetch
    if (rows.length === 0) return; // No initial data yet

    setLoadingMore(true);

    const requestId = requestIdRef.current;
    const { data, error } = await inquiriesQuery(viewRef.current, rows.length);

    // the view changed while this page was loading; its rows belong to the old one
    if (requestId !== requestIdRef.current) {
      setLoadingMore(false);
      return;
    }

    if (error) {
      setError(error.message);
    } else {
      // APPEND new data to existing rows
      const page = (data ?? []) as BookingInquiry[];
      setRows((prev) => [...prev, ...page.filter((r) => !prev.some((p) => p.id === r.id))]);
      setHasMore(page.length === PAGE_SIZE);
    }

    setLoadingMore(false);
  }, [loadingMore, hasMore, rows]);

  /**
   * Combined fetch for both counts and initial data.
   * Used for initial load and refresh.
   */
  const fetchAll = useCallback(
    async () => {
      await Promise.all([fetchCounts(), fetchInitialInquiries()]);
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
      viewRef.current = { ...viewRef.current, status: targetFilter };

      // Reset pagination
      setHasMore(true);
      setRows([]); // Clear current rows to show loading state

      // Show loading briefly
      setLoading(true);

      // Fetch with new filter; it ends the loading state itself
      await fetchInitialInquiries();
    },
    [statusFilter, fetchInitialInquiries]
  );

  /**
   * Search, filter or sort changed: refetch the first page. The current
   * cards stay up until the new ones arrive, so typing doesn't flash.
   */
  const toolbarKey = JSON.stringify([debouncedSearch.trim(), attrFilter, sort]);
  const lastToolbarKeyRef = useRef(toolbarKey);
  useEffect(() => {
    if (toolbarKey === lastToolbarKeyRef.current) return;
    lastToolbarKeyRef.current = toolbarKey;
    fetchInitialInquiries();
  }, [toolbarKey, fetchInitialInquiries]);

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
     Turn into lead
  --------------------------------------------------------- */

  // The card stays where it is (even under a status filter) so its
  // View lead button is right there afterwards
  async function convertToLead(id: string) {
    const lead = await convertInquiryToLead(id);
    const previous = rows.find((r) => r.id === id)?.opportunity_status;

    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, opportunity_status: "converted", leads: lead } : r))
    );
    if (previous && previous !== "converted") {
      setCounts((prev) => ({
        ...prev,
        [previous]: Math.max(0, prev[previous] - 1),
        converted: prev.converted + 1,
      }));
    }
    refreshCount();
  }

  /* ---------------------------------------------------------
     Delete
  --------------------------------------------------------- */

  function requestDelete(id: string, via: "button" | "swipe") {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (via === "button") setConfirmTarget(row);
    else swipeDelete(row);
  }

  // Desktop: after the confirm dialog
  async function confirmDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    setActionError(null);

    try {
      await deleteInquiries([confirmTarget.id]);
      setRows((prev) => prev.filter((r) => r.id !== confirmTarget.id));
      fetchCounts();
      refreshCount();
      setConfirmTarget(null);
    } catch (e) {
      setConfirmTarget(null);
      setActionError(e instanceof Error ? e.message : "Couldn't delete that enquiry.");
    } finally {
      setDeleting(false);
    }
  }

  // Mobile: the row is gone straight away; the real delete waits for the undo window
  function swipeDelete(row: BookingInquiry) {
    flushPendingDelete(); // only one undo at a time
    setActionError(null);

    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setCounts((prev) => ({
      ...prev,
      total: Math.max(0, prev.total - 1),
      [row.opportunity_status]: Math.max(0, prev[row.opportunity_status] - 1),
    }));

    pendingDeleteRef.current = row;
    setUndoRow(row);
    undoTimerRef.current = setTimeout(flushPendingDelete, UNDO_MS);
  }

  function flushPendingDelete() {
    const row = pendingDeleteRef.current;
    if (!row) return;
    pendingDeleteRef.current = null;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoRow(null);

    deleteInquiries([row.id])
      .then(() => {
        fetchCounts();
        refreshCount();
      })
      .catch((e) => {
        setRows((prev) => insertSorted(prev, row, viewRef.current.sort, false));
        fetchCounts();
        setActionError(e instanceof Error ? e.message : "Couldn't delete that enquiry.");
      });
  }

  function undoDelete() {
    const row = pendingDeleteRef.current;
    if (!row) return;
    pendingDeleteRef.current = null;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoRow(null);

    if (matchesView(row, viewRef.current)) {
      setRows((prev) => insertSorted(prev, row, viewRef.current.sort, false));
    }
    fetchCounts();
  }

  // Leaving the inbox mid-undo still deletes it
  useEffect(() => {
    return () => {
      const row = pendingDeleteRef.current;
      if (!row) return;
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      deleteInquiries([row.id]).catch(() => {});
    };
  }, []);

  /* ---------------------------------------------------------
     Initial Fetch Effect
  --------------------------------------------------------- */

  // fetchInitialInquiries ends the loading state once the newest request lands
  useEffect(() => {
    fetchAll();
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

              // Only add to view if it matches the current filters and search
              if (matchesView(row, viewRef.current)) {
                setRows((prev) =>
                  insertSorted(prev, row, viewRef.current.sort, hasMoreRef.current)
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

              // Update in place, drop it if it no longer matches the
              // filters and search, or add it if it now does
              const view = viewRef.current;
              setRows((prev) => {
                const inView = prev.some((r) => r.id === updated.id);
                if (!matchesView(updated, view)) {
                  return inView ? prev.filter((r) => r.id !== updated.id) : prev;
                }
                // the realtime row has no embedded lead; keep the one we have
                return inView
                  ? prev.map((r) => (r.id === updated.id ? { ...updated, leads: r.leads } : r))
                  : insertSorted(prev, updated, view.sort, hasMoreRef.current);
              });
            } else if (payload.eventType === "DELETE") {
              const deleted = payload.old as Partial<BookingInquiry>;
              setRows((prev) => prev.filter((r) => r.id !== deleted.id));
              // A delete event only carries the id, not the status, so
              // re-count instead of adjusting
              fetchCounts();
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
  }, [fetchAll, fetchCounts]);

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

  const narrowed = isNarrowed({ status: statusFilter, search: debouncedSearch, attrs: attrFilter, sort });

  // There from the start; hidden only if there are no enquiries at all (kept while narrowed, so it can be cleared)
  const showToolbar = !countsLoaded || counts.total > 0 || narrowed;

  const toolbar = (
    <Toolbar
      search={{ value: search, onChange: setSearch, placeholder: "Search leads" }}
      filter={{ groups: FILTER_GROUPS, value: attrFilter, onChange: setAttrFilter }}
      sort={{
        options: SORT_OPTIONS,
        value: sort,
        onChange: (v) => setSort(v as InboxSort),
        defaultValue: "newest",
      }}
    />
  );

  function clearToolbar() {
    setSearch("");
    setDebouncedSearch("");
    setAttrFilter({});
  }

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
        {/* Page Header; on desktop the toolbar sits on the right */}
        <div className={styles.headerRow}>
          <div className={styles.pageHeader}>
            <div className={styles.pageIcon}>
              <HiInbox size={30} />
            </div>
            <h1 className={styles.pageTitle}>Inbox</h1>
          </div>
          {showToolbar && !isMobile && <div className={styles.headerActions}>{toolbar}</div>}
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
              label="Leads"
              value={counts.converted}
              variant="orange"
              onClick={() => handleFilterChange("converted")}
              active={statusFilter === "converted"}
            />
            <StatCard
              label="Bad"
              value={counts.bad}
              variant="red"
              onClick={() => handleFilterChange("bad")}
              active={statusFilter === "bad"}
            />
          </div>
        </div>

        {/* Content */}
        <main className={styles.content}>
          {showToolbar && isMobile && <div className={styles.toolbarRow}>{toolbar}</div>}

          {actionError && (
            <div className={`${styles.errorBanner} ${styles.actionError}`} role="alert">
              <span>{actionError}</span>
            </div>
          )}

          {loading ? (
            showSkeleton && (
              <div className={`${styles.cardList} fade-in`}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <InquiryCardSkeleton key={i} />
                ))}
              </div>
            )
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
          ) : rows.length === 0 && narrowed ? (
            <EmptyState
              icon="🔍"
              title="Nothing matches"
              description="Try a different search, or clear the filters."
              action={{ label: "Clear search and filters", onClick: clearToolbar }}
            />
          ) : rows.length === 0 && statusFilter === "all" ? (
            <EmptyState
              icon="📭"
              title="No inquiries yet"
              description="When someone submits a booking form, it will appear here."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon="🔍"
              title={`No ${STATUS_WORD[statusFilter]} enquiries`}
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
                      onDelete={requestDelete}
                      onOpen={setOpenId}
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
                    {narrowed
                      ? `That's all ${rows.length} matching enquiries`
                      : `You've seen all ${getFilteredCount()} ${statusFilter === "all" ? "enquiries" : `${STATUS_WORD[statusFilter]} enquiries`}`}
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {undoRow && (
        <div className={styles.undoToast} role="status">
          <span className={styles.undoText}>
            Deleted {undoRow.name || "enquiry"}
          </span>
          <button type="button" className={styles.undoBtn} onClick={undoDelete}>
            Undo
          </button>
        </div>
      )}

      <EnquiryPanel
        inquiry={openInquiry}
        onClose={closePanel}
        onStatusChange={updateStatus}
        onConvert={convertToLead}
        onRequestDelete={(id) => requestDelete(id, "button")}
      />

      <ConfirmDialog
        variant="danger"
        open={confirmTarget !== null}
        title="Delete this enquiry?"
        message={`${confirmTarget?.name || "This enquiry"} will be removed for good${embeddedLead(confirmTarget?.leads) ? ", along with its lead, qualification answers and notes" : ", along with its notes"}. This can't be undone.`}
        confirmLabel="Delete"
        busyLabel="Deleting…"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
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
    <StatPill
      label={label}
      value={value}
      active={active}
      onClick={onClick}
      className={styles[`statCard${variant.charAt(0).toUpperCase() + variant.slice(1)}`]}
    />
  );
}

type EmptyStateProps = {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
};

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>{icon}</div>
      <h3 className={styles.emptyTitle}>{title}</h3>
      <p className={styles.emptyDescription}>{description}</p>
      {action && (
        <Button className={styles.emptyAction} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}