"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HiMiniBolt } from "react-icons/hi2";
import { supabase } from "../../../lib/supabaseClient";
import { useDashboard } from "../../context/dashboardContext";
import { useBlockIosEdgeSwipe } from "../../hooks/useBlockIosEdgeBackSwipe";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useDelayedFlag } from "../../hooks/useDelayedFlag";
import styles from "../homePage.module.css";
import Toolbar, { type ToolbarFilterGroup } from "../../components/toolbar";
import DataTable, { DataTableSkeleton, CardMeta, CardTop, EmptyCell, TitleCell, type DataTableColumn } from "../../components/dataTable";
import Pill from "../../components/pill";
import { StatPill } from "../../components/statPill";
import Avatar from "../../components/avatar";
import { ChannelLabel, type LeadChannel } from "../../components/channelIcon";
import { CHANNELS, formatAgo, formatShortDate, type Channel } from "../../../lib/outreach";
import {
  LEAD_STAGES,
  PACKAGES,
  leadHref,
  leadStageLabel,
  leadStageTone,
  packageLabel,
  type LeadStage,
} from "../../../lib/leads";

/* =========================================================
   Data
========================================================= */

type LeadRow = {
  id: string;
  created_at: string;
  updated_at: string;
  stage: LeadStage;
  inquiry: {
    name: string | null;
    email: string | null;
    phone: string | null;
    budget: number | null;
    selected_package: string | null;
  } | null;
  /** every lead has a contact: who they are and the business name */
  contact: { name: string | null; email: string | null; phone_numbers: string[] | null; business_name: string | null } | null;
  /** set when the lead came from outreach rather than an enquiry */
  outreach_id: string | null;
  outreach: { channel: Channel } | null;
};

const LEAD_COLUMNS =
  "id, created_at, updated_at, stage, outreach_id, outreach:outreach(channel), inquiry:booking_inquiries(name, email, phone, budget, selected_package), contact:contacts(name, email, phone_numbers, business_name)";

type StageFilter = LeadStage | "all";

const FILTER_GROUPS: ToolbarFilterGroup[] = [
  {
    key: "channel",
    label: "Channel",
    options: [{ value: "website", label: "Website" }, ...CHANNELS],
  },
  { key: "package", label: "Package", options: PACKAGES },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Newest lead" },
  { value: "updated", label: "Recently updated" },
  { value: "budget", label: "Highest budget" },
  { value: "name", label: "Name A–Z" },
];

const nameOf = (row: LeadRow) =>
  row.contact?.name || row.inquiry?.name || row.contact?.email || row.contact?.phone_numbers?.[0] || "Unnamed";

const emailOf = (row: LeadRow) => row.contact?.email ?? row.inquiry?.email ?? null;

// Where the lead came from: the website (an enquiry) or its outreach channel
const channelOf = (row: LeadRow): LeadChannel => row.outreach?.channel ?? (row.outreach_id ? "other" : "website");

function sortLeads(rows: LeadRow[], sort: string) {
  const list = [...rows];
  switch (sort) {
    case "updated":
      return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    case "budget":
      return list.sort((a, b) => (b.inquiry?.budget ?? -1) - (a.inquiry?.budget ?? -1));
    case "name":
      return list.sort((a, b) => nameOf(a).localeCompare(nameOf(b), "en-GB"));
    default:
      return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

// A timestamp's calendar day in local time, for the date helpers
function localDay(timestamp: string): string {
  const d = new Date(timestamp);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatBudget(budget: number) {
  return budget >= 1000 ? `£${(budget / 1000).toFixed(budget % 1000 === 0 ? 0 : 1)}k` : `£${budget}`;
}

/* =========================================================
   Page
========================================================= */

export default function LeadsPage() {
  const { setActivePage, setPageTitle, setBreadcrumbs } = useDashboard();
  const router = useRouter();

  useEffect(() => {
    setActivePage("leads");
    setPageTitle("Leads");
    setBreadcrumbs([{ label: "gios.build", href: "#" }, { label: "Leads" }]);
  }, [setActivePage, setPageTitle, setBreadcrumbs]);

  useBlockIosEdgeSwipe(true);

  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  // a quick load skips the skeleton; the rows just fade in
  const showSkeleton = useDelayedFlag(loading);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [search, setSearch] = useState("");
  const [attrFilter, setAttrFilter] = useState<Record<string, string[]>>({});
  const [sort, setSort] = useState("recent");
  const isMobile = useMediaQuery("(max-width: 768px)");

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setRows((data ?? []) as unknown as LeadRow[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const firstLoad = async () => {
      await fetchRows();
      if (!cancelled) setLoading(false);
    };
    firstLoad();

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchRows();
    };
    window.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchRows]);

  /* ---------------- Derived ---------------- */

  const counts = useMemo(() => {
    const byStage = Object.fromEntries(LEAD_STAGES.map((s) => [s.value, 0])) as Record<LeadStage, number>;
    for (const r of rows) byStage[r.stage] += 1;
    return { all: rows.length, byStage };
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const packages = attrFilter.package ?? [];
    const channels = attrFilter.channel ?? [];
    const filtered = rows.filter((r) => {
      if (stageFilter !== "all" && r.stage !== stageFilter) return false;
      if (packages.length && !packages.includes(r.inquiry?.selected_package ?? "")) return false;
      if (channels.length && !channels.includes(channelOf(r))) return false;
      if (!q) return true;
      return [nameOf(r), emailOf(r), r.inquiry?.phone, ...(r.contact?.phone_numbers ?? []), r.contact?.business_name].some((v) =>
        v?.toLowerCase().includes(q)
      );
    });
    return sortLeads(filtered, sort);
  }, [rows, stageFilter, search, attrFilter, sort]);

  const toggleStage = (next: StageFilter) =>
    setStageFilter((current) => (current === next && next !== "all" ? "all" : next));

  const openLead = (row: LeadRow) => router.push(leadHref(row.id));

  /* ---------------- Render ---------------- */

  // there from the start; hidden only once it's clear there's nothing to search
  const showToolbar = !error && (loading || rows.length > 0);

  const toolbar = (
    <Toolbar
      search={{ value: search, onChange: setSearch, placeholder: "Search leads" }}
      filter={{ groups: FILTER_GROUPS, value: attrFilter, onChange: setAttrFilter }}
      sort={{ options: SORT_OPTIONS, value: sort, onChange: setSort, defaultValue: "recent" }}
    />
  );

  return (
    <div className={`${styles.canvas} ${styles.fillCanvas}`}>
      <div className={styles.headerRow}>
        <div className={styles.pageHeader}>
          <div className={styles.pageIcon}>
            <HiMiniBolt size={30} />
          </div>
          <h1 className={styles.pageTitle}>Leads</h1>
        </div>
        {showToolbar && !isMobile && <div className={styles.headerActions}>{toolbar}</div>}
      </div>

      {/* Stage filters: the counts are placeholders until the leads load */}
      <div className={styles.statsRow}>
        <div className={styles.statGroup}>
          <StatPill label="All" value={counts.all} active={stageFilter === "all"} onClick={() => toggleStage("all")} />
          {LEAD_STAGES.map((s) => (
            <StatPill
              key={s.value}
              label={s.label}
              value={counts.byStage[s.value]}
              active={stageFilter === s.value}
              onClick={() => toggleStage(s.value)}
            />
          ))}
        </div>
      </div>

      <main className={`${styles.content} ${styles.fillContent}`}>
        {loading ? (
          showSkeleton && <DataTableSkeleton columns={COLUMNS} minWidth={900} />
        ) : error ? (
          <div className={styles.errorBanner} role="alert">
            <span>{error}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className={`${styles.emptyState} ${styles.fillCenter}`}>
            <h3 className={styles.emptyTitle}>No leads yet</h3>
            <p className={styles.emptyDescription}>
              Turn an enquiry into a lead from the Inbox, or promote a business from Outreach when theyOpen an enquiry in the Inbox and choose Turn into lead when it&apos;s worth pursuing.apos;re interested.
            </p>
          </div>
        ) : (
          <>
            {showToolbar && isMobile && <div className={styles.toolbarRow}>{toolbar}</div>}

            {visible.length === 0 ? (
              <p className={styles.noMatches}>Nothing matches that filter.</p>
            ) : (
              <DataTable
                rows={visible}
                columns={COLUMNS}
                rowKey={(row) => row.id}
                onRowClick={openLead}
                minWidth={900}
                renderCard={(row) => (
                  <>
                    <CardTop>
                      <LeadCell row={row} />
                      <Pill tone={leadStageTone(row.stage)}>{leadStageLabel(row.stage)}</Pill>
                    </CardTop>
                    <CardMeta>
                      {[
                        row.contact?.business_name,
                        row.inquiry?.selected_package && packageLabel(row.inquiry.selected_package),
                        row.inquiry?.budget != null && formatBudget(row.inquiry.budget),
                        formatAgo(localDay(row.created_at)),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </CardMeta>
                  </>
                )}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* =========================================================
   Table
========================================================= */

function LeadCell({ row }: { row: LeadRow }) {
  const email = emailOf(row);
  return (
    <TitleCell
      avatar={<Avatar name={row.contact?.name ?? row.inquiry?.name ?? null} email={email} />}
      title={nameOf(row)}
      sub={email && email !== nameOf(row) ? email : undefined}
    />
  );
}

const COLUMNS: DataTableColumn<LeadRow>[] = [
  { key: "lead", header: "Lead", skeleton: "avatar", cell: (row) => <LeadCell row={row} /> },
  { key: "business", header: "Business", cell: (row) => row.contact?.business_name || <EmptyCell /> },
  { key: "channel", header: "Channel", muted: true, cell: (row) => <ChannelLabel channel={channelOf(row)} /> },
  {
    key: "stage",
    header: "Stage",
    skeleton: "pill",
    cell: (row) => <Pill tone={leadStageTone(row.stage)}>{leadStageLabel(row.stage)}</Pill>,
  },
  {
    key: "package",
    header: "Package",
    muted: true,
    cell: (row) => (row.inquiry?.selected_package ? packageLabel(row.inquiry.selected_package) : <EmptyCell />),
  },
  {
    key: "budget",
    header: "Budget",
    skeleton: "number",
    align: "end",
    cell: (row) => (row.inquiry?.budget != null ? formatBudget(row.inquiry.budget) : <EmptyCell />),
  },
  {
    key: "created",
    header: "Became a lead",
    muted: true,
    cell: (row) => (
      <span title={formatShortDate(localDay(row.created_at))}>{formatAgo(localDay(row.created_at))}</span>
    ),
  },
  {
    key: "updated",
    header: "Last update",
    muted: true,
    cell: (row) => formatAgo(localDay(row.updated_at)),
  },
];
