"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";
import Sidebar from "./components/sidebar";
import TopBar from "./components/topbar";
import DockBar from "./components/dockbar";
import InquiryCard, { BookingInquiry, OpportunityStatus } from "./components/inquiryCard";
import { usePullToRefresh } from "./hooks/pullRefresh";
import styles from "./homePage.module.css";
import { HiInbox, HiArrowPath } from 'react-icons/hi2';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<BookingInquiry[]>([]);
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | "all">("all");

  const unseenCount = rows.filter(
    (r) => r.opportunity_status === "new" && !r.seen_at
  ).length;
  const newCount = rows.filter((r) => r.opportunity_status === "new").length; 
  const contactedCount = rows.filter((r) => r.opportunity_status === "contacted").length;
  const wonCount = rows.filter((r) => r.opportunity_status === "won").length;
  const badCount = rows.filter((r) => r.opportunity_status === "bad").length;
  const lostCount = rows.filter((r) => r.opportunity_status === "lost").length;

  const filteredRows = statusFilter === "all" 
    ? rows 
    : rows.filter((r) => r.opportunity_status === statusFilter);

  // Fetch data function (reusable for initial load and refresh)
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
  const { containerRef, pullDistance, isRefreshing, progress } = usePullToRefresh({
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
      prev.map((r) =>
        r.id === id && !r.seen_at ? { ...r, seen_at: now } : r
      )
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

  useEffect(() => {
    async function boot() {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionEmail = sessionData.session?.user?.email ?? null;

      if (!sessionEmail) {
        router.replace("/login");
        return;
      }

      setEmail(sessionEmail);
      await fetchInquiries();
      setLoading(false);
    }

    boot();
  }, [router, fetchInquiries]);

  useEffect(() => {
    if (!email) return;

    const channel = supabase
      .channel("booking_inquiries_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_inquiries" },
        (payload) => {
          console.log("[realtime payload]", payload);

          if (payload.eventType === "INSERT") {
            const row = payload.new as BookingInquiry;
            setRows((prev) => {
              if (prev.some((r) => r.id === row.id)) return prev;
              return [row, ...prev].slice(0, 50);
            });
          }

          if (payload.eventType === "UPDATE") {
            const updated = payload.new as BookingInquiry;
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          }
        }
      )
      .subscribe((status) => {
        console.log("[realtime status]", status);
        if (status === "CHANNEL_ERROR") setError("Realtime channel error");
        if (status === "TIMED_OUT") setError("Realtime timed out");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [email]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!email) return null;

  return (
    <div className={styles.workspace}>
      {/* Sidebar - Desktop only */}
      <Sidebar email={email} onSignOut={signOut} inboxUnseenCount={unseenCount} />

      {/* Main Area */}
      <div className={styles.main}>
        <TopBar 
          title="Inquiries"
          breadcrumbs={[
            { label: "gios.build", href: "#" },
            { label: "Inbox" }
          ]}
          email={email}
          onSignOut={signOut}
        />

        {/* Pull-to-refresh indicator */}
        <div 
          className={styles.pullIndicator}
          style={{
            height: pullDistance,
            opacity: progress,
          }}
        >
          <div 
            className={`${styles.pullSpinner} ${isRefreshing ? styles.pullSpinnerActive : ""}`}
            style={{
              transform: `rotate(${progress * 360}deg)`,
            }}
          >
            <HiArrowPath size={20} />
          </div>
        </div>

        <div 
          ref={containerRef}
          className={styles.canvas}
          style={{
            transform: `translateY(${pullDistance}px)`,
          }}
        >
          {/* Page Header */}
          <div className={styles.pageHeader}>
            <div className={styles.pageIcon}><HiInbox size={30}/></div>
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
                label="Won" 
                value={wonCount} 
                variant="green"
                onClick={() => setStatusFilter(statusFilter === "won" ? "all" : "won")}
                active={statusFilter === "won"}
              />
              <StatCard 
                label="Bad" 
                value={badCount} 
                variant="neutral"
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
            {loading && (
              <div className={styles.loading}>
                <div className={styles.spinner} />
                <span>Loading…</span>
              </div>
            )}

            {error && (
              <div className={styles.errorBanner}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && (
              <>
                {rows.length === 0 ? (
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
                    {filteredRows.map((inquiry) => (
                      <InquiryCard
                        key={inquiry.id}
                        inquiry={inquiry}
                        onStatusChange={updateStatus}
                        onSeen={markSeen}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Dock Bar */}
      <DockBar activePage="inbox" inboxUnseenCount={unseenCount} />
    </div>
  );
}

/* Stat Card Component */
type StatCardProps = {
  label: string;
  value: number;
  variant: "blue" | "purple" | "green" | "neutral";
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