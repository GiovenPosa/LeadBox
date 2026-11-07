"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useDashboard } from "../../context/dashboardContext";
import { useBlockIosEdgeSwipe } from "../../hooks/useBlockIosEdgeBackSwipe";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useDelayedFlag } from "../../hooks/useDelayedFlag";
import styles from "../homePage.module.css";
import outreachStyles from "./outreach.module.css";
import { HiMiniBolt, HiMiniPaperAirplane, HiMiniPlus } from "react-icons/hi2";
import OutreachEditor from "../../components/outreachEditor";
import PromoteLeadPanel from "../../components/promoteLeadPanel";
import { useRouter } from "next/navigation";
import { embeddedLead, leadHref, type LeadRef } from "../../../lib/leads";
import ConfirmDialog from "../../components/confirmDialog";
import Button from "../../components/button";
import { StatPill } from "../../components/statPill";
import { TASK_COLUMNS, sortTasks, type Task } from "../../../lib/tasks";
import Toolbar, { type ToolbarFilterGroup } from "../../components/toolbar";
import { ChannelLabel } from "../../components/channelIcon";
import DataTable, {
  DataTableSkeleton,
  CardFooter,
  CardMeta,
  CardTop,
  EmptyCell,
  TitleCell,
  type DataTableColumn,
} from "../../components/dataTable";
import Pill, { type PillTone } from "../../components/pill";
import {
  CHANNELS,
  CLOSED_STAGES,
  INDUSTRIES,
  OUTREACH_COLUMNS,
  STAGES,
  dueState,
  formatAgo,
  formatDue,
  formatShortDate,
  handleUrl,
  industryLabel,
  objectionLabel,
  stageLabel,
  type DueState,
  type OutreachRow,
  type Stage,
} from "../../../lib/outreach";

/* =========================================================
   Helpers
========================================================= */

type Filter = Stage | "all" | "due";

const STAGE_TONE: Record<Stage, PillTone> = {
  messaged: "new",
  replied: "contacted",
  mockup: "qualified",
  chat: "qualified",
  // green: the end of outreach, and distinct from mock-up and chat
  converted: "won",
  no_reply: "bad",
};

const DUE_CLASS: Record<Exclude<DueState, null>, string> = {
  overdue: outreachStyles.dueUrgent,
  today: outreachStyles.dueUrgent,
  soon: outreachStyles.dueSoon,
  later: outreachStyles.dueLater,
};

const DUE_RANK: Record<string, number> = { overdue: 0, today: 1, soon: 2, later: 3, none: 4 };

const SORT_OPTIONS = [
  { value: "due", label: "Follow-up due" },
  { value: "recent", label: "Recently messaged" },
  { value: "oldest", label: "Oldest messaged" },
  { value: "name", label: "Business A–Z" },
  { value: "updated", label: "Recently updated" },
];

const FILTER_GROUPS: ToolbarFilterGroup[] = [
  { key: "industry", label: "Industry", options: INDUSTRIES },
  { key: "channel", label: "Channel", options: CHANNELS },
];

function sortRows(rows: OutreachRow[], sort: string) {
  const list = [...rows];
  switch (sort) {
    case "recent":
      return list.sort((a, b) => b.first_contacted_on.localeCompare(a.first_contacted_on));
    case "oldest":
      return list.sort((a, b) => a.first_contacted_on.localeCompare(b.first_contacted_on));
    case "name":
      return list.sort((a, b) => a.business_name.localeCompare(b.business_name, "en-GB"));
    case "updated":
      return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    default:
      return sortByDue(list);
  }
}

// Most urgent follow-ups first, then the most recently messaged
function sortByDue(rows: OutreachRow[]) {
  return rows.sort((a, b) => {
    const da = dueState(a) ?? "none";
    const db = dueState(b) ?? "none";
    if (DUE_RANK[da] !== DUE_RANK[db]) return DUE_RANK[da] - DUE_RANK[db];
    if (a.next_step_due && b.next_step_due && a.next_step_due !== b.next_step_due) {
      return a.next_step_due.localeCompare(b.next_step_due);
    }
    return b.first_contacted_on.localeCompare(a.first_contacted_on);
  });
}

const isDue = (row: OutreachRow) => {
  const state = dueState(row);
  return state === "overdue" || state === "today";
};

const linkedId = () => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("open"));

// PostgREST says this when the migration hasn't been run yet
const isMissingTable = (message: string) =>
  /could not find the table|relation .* does not exist/i.test(message);

/* =========================================================
   Page
========================================================= */

export default function OutreachPage() {
  const { setActivePage, setPageTitle, setBreadcrumbs } = useDashboard();

  useEffect(() => {
    setActivePage("outreach");
    setPageTitle("Outreach");
    setBreadcrumbs([{ label: "gios.build", href: "#" }, { label: "Outreach" }]);
  }, [setActivePage, setPageTitle, setBreadcrumbs]);

  useBlockIosEdgeSwipe(true);

  const [rows, setRows] = useState<OutreachRow[]>([]);
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  // a quick load skips the skeleton; the rows just fade in
  const showSkeleton = useDelayedFlag(loading);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("due");
  const [attrFilter, setAttrFilter] = useState<Record<string, string[]>>({});

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<OutreachRow | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<OutreachRow | null>(null);
  // the business being promoted to a lead (the promote panel is open while set)
  const [promoting, setPromoting] = useState<OutreachRow | null>(null);
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  /* ---------------- Data ---------------- */

  const fetchRows = useCallback(async () => {
    // the businesses, and their open tasks (each row's "next step" is its soonest one)
    const [{ data, error }, { data: tasks }] = await Promise.all([
      supabase
        .from("outreach")
        .select(OUTREACH_COLUMNS)
        .order("first_contacted_on", { ascending: false })
        .limit(1000),
      supabase.from("tasks").select(TASK_COLUMNS).not("outreach_id", "is", null).is("done_at", null),
    ]);

    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setOpenTasks((tasks ?? []) as Task[]);
    setRows((data ?? []) as OutreachRow[]);
  }, []);

  // ?open=<id> (from the dashboard): open that business once the rows have loaded
  const [pendingOpen, setPendingOpen] = useState(linkedId);
  if (pendingOpen && !loading) {
    setPendingOpen(null);
    const row = rows.find((r) => r.id === pendingOpen);
    if (row) {
      setEditing(row);
      setEditorOpen(true);
    }
  }

  // A task changed in the editor: swap in that business's open tasks
  const handleTasksChange = useCallback((outreachId: string, tasks: Task[]) => {
    setOpenTasks((prev) => [
      ...prev.filter((t) => t.outreach_id !== outreachId),
      ...tasks.filter((t) => t.outreach_id === outreachId && !t.done_at),
    ]);
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

  // Each business with its next step: the soonest open task (undated ones last)
  const withNext = useMemo(() => {
    const next = new Map<string, Task>();
    for (const task of sortTasks(openTasks)) {
      if (task.outreach_id && !next.has(task.outreach_id)) next.set(task.outreach_id, task);
    }
    return rows.map((r) => ({
      ...r,
      next_step: next.get(r.id)?.title ?? null,
      next_step_due: next.get(r.id)?.due_on ?? null,
    }));
  }, [rows, openTasks]);

  const counts = useMemo(() => {
    const byStage = Object.fromEntries(STAGES.map((s) => [s.value, 0])) as Record<Stage, number>;
    for (const r of withNext) byStage[r.stage] += 1;
    return { all: withNext.length, due: withNext.filter(isDue).length, byStage };
  }, [withNext]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const industries = attrFilter.industry ?? [];
    const channels = attrFilter.channel ?? [];
    const filtered = withNext.filter((r) => {
      if (filter === "due" && !isDue(r)) return false;
      if (filter !== "all" && filter !== "due" && r.stage !== filter) return false;
      if (industries.length && !industries.includes(r.industry)) return false;
      if (channels.length && !channels.includes(r.channel)) return false;
      if (!q) return true;
      return [r.business_name, r.town, r.handle, r.next_step]
        .some((v) => v?.toLowerCase().includes(q));
    });
    return sortRows(filtered, sort);
  }, [withNext, filter, search, sort, attrFilter]);

  /* ---------------- Actions ---------------- */

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openRow(row: OutreachRow) {
    setEditing(row);
    setEditorOpen(true);
  }

  const closeEditor = useCallback(() => setEditorOpen(false), []);

  function handleSaved(saved: OutreachRow) {
    setRows((prev) =>
      prev.some((r) => r.id === saved.id)
        ? prev.map((r) => (r.id === saved.id ? saved : r))
        : [saved, ...prev]
    );
    setEditorOpen(false);
    // a new business may have its first task: pick it up
    fetchRows();
  }

  async function confirmDelete() {
    if (!confirmTarget) return;
    setDeleting(true);

    // a promoted business's notes move to its lead first, so the lead keeps the history
    const lead = embeddedLead(confirmTarget.leads);
    if (lead) {
      const { error: moveError } = await supabase
        .from("notes")
        .update({ outreach_id: null, lead_id: lead.id })
        .eq("outreach_id", confirmTarget.id);
      if (moveError) {
        setDeleting(false);
        setConfirmTarget(null);
        setError(moveError.message);
        return;
      }
    }

    const { error } = await supabase.from("outreach").delete().eq("id", confirmTarget.id);

    setDeleting(false);
    if (error) {
      setConfirmTarget(null);
      setError(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== confirmTarget.id));
    setConfirmTarget(null);
    setEditorOpen(false);
  }

  function toggleFilter(next: Filter) {
    setFilter((current) => (current === next && next !== "all" ? "all" : next));
  }

  /* ---------------- Render ---------------- */

  const missingTable = !!error && isMissingTable(error);
  // there from the start; hidden only once it's clear there's nothing to search
  const showToolbar = !error && (loading || rows.length > 0);

  const toolbar = (
    <Toolbar
      search={{ value: search, onChange: setSearch, placeholder: "Search businesses" }}
      filter={{ groups: FILTER_GROUPS, value: attrFilter, onChange: setAttrFilter }}
      sort={{ options: SORT_OPTIONS, value: sort, onChange: setSort, defaultValue: "due" }}
    />
  );

  return (
    <>
      <div className={`${styles.canvas} ${styles.fillCanvas}`}>
        <div className={styles.headerRow}>
          <div className={styles.pageHeader}>
            <div className={styles.pageIcon}>
              <HiMiniPaperAirplane size={30} />
            </div>
            <h1 className={styles.pageTitle}>Outreach</h1>
          </div>

          {/* Desktop: search, filter and sort sit with Add; phones keep them under the chips */}
          <div className={styles.headerActions}>
            {showToolbar && !isMobile && toolbar}
            <Button
              variant="primary"
              size="sm"
              icon={<HiMiniPlus size={18} />}
              onClick={openNew}
              disabled={missingTable}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Filters: the counts are placeholders until the rows load */}
        <div className={styles.statsRow}>
          <div className={styles.statGroup}>
            <StatPill
              label="Due"
              value={counts.due}
              active={filter === "due"}
              onClick={() => toggleFilter("due")}
              valueClassName={counts.due > 0 ? outreachStyles.dueCount : undefined}
            />
            <StatPill label="All" value={counts.all} active={filter === "all"} onClick={() => toggleFilter("all")} />
            {STAGES.map((s) => (
              <StatPill
                key={s.value}
                label={s.label}
                value={counts.byStage[s.value]}
                active={filter === s.value}
                onClick={() => toggleFilter(s.value)}
              />
            ))}
          </div>
        </div>

        <main className={`${styles.content} ${styles.fillContent}`}>
          {loading ? (
            showSkeleton && <DataTableSkeleton columns={COLUMNS} />
          ) : missingTable ? (
            <div className={`${styles.emptyState} ${styles.fillCenter}`}>
              <h3 className={styles.emptyTitle}>The outreach table isn&apos;t set up yet</h3>
              <p className={styles.emptyDescription}>
                Run supabase/migrations/20261107_outreach.sql in the Supabase SQL Editor, then reload.
              </p>
            </div>
          ) : error ? (
            <div className={styles.errorBanner} role="alert">
              <span>{error}</span>
            </div>
          ) : rows.length === 0 ? (
            <div className={`${styles.emptyState} ${styles.fillCenter}`}>
              <h3 className={styles.emptyTitle}>No outreach yet</h3>
              <p className={styles.emptyDescription}>
                Log a business each time you message one, and follow-ups will show up here when they&apos;re due.
              </p>
              <Button
                variant="primary"
                icon={<HiMiniPlus size={18} />}
                className={outreachStyles.emptyAdd}
                onClick={openNew}
              >
                Add your first
              </Button>
            </div>
          ) : (
            <>
              {isMobile && <div className={styles.toolbarRow}>{toolbar}</div>}

              {visible.length === 0 ? (
                <p className={styles.noMatches}>Nothing matches that filter.</p>
              ) : (
                <DataTable
                  rows={visible}
                  columns={COLUMNS}
                  rowKey={(row) => row.id}
                  onRowClick={openRow}
                  renderCard={(row) => (
                    <>
                      <CardTop>
                        <BusinessCell row={row} />
                        <StageCell row={row} />
                      </CardTop>
                      <CardMeta>
                        {industryLabel(row.industry)} ·{" "}
                        <ChannelLabel channel={row.channel} size={14} />{" "}
                        · {formatAgo(row.first_contacted_on)}
                      </CardMeta>
                      {row.objection && (
                        <div className={outreachStyles.cardObjection}>
                          <ObjectionCell row={row} />
                        </div>
                      )}
                      {(row.next_step || row.next_step_due) && (
                        <CardFooter>
                          <div className={outreachStyles.cardNext}>
                            <NextStepCell row={row} />
                          </div>
                        </CardFooter>
                      )}
                    </>
                  )}
                />
              )}
            </>
          )}
        </main>
      </div>

      <OutreachEditor
        open={editorOpen}
        row={editing}
        onClose={closeEditor}
        onSaved={handleSaved}
        onRequestDelete={setConfirmTarget}
        onTasksChange={handleTasksChange}
        onRequestPromote={(row) => {
          // one panel at a time: the promote step replaces the editor
          setEditorOpen(false);
          setPromoting(row);
        }}
      />

      <PromoteLeadPanel
        outreach={promoting}
        onClose={() => setPromoting(null)}
        onPromoted={(outreachId: string, lead: LeadRef) => {
          // the database moves the business to the Lead stage; match it here
          setRows((prev) =>
            prev.map((r) => (r.id === outreachId ? { ...r, leads: lead, stage: "converted" as const } : r))
          );
          setPromoting(null);
          router.push(leadHref(lead.id));
        }}
      />

      <ConfirmDialog
        variant="danger"
        open={confirmTarget !== null}
        title="Delete this business?"
        message={
          embeddedLead(confirmTarget?.leads)
            ? `${confirmTarget?.business_name ?? "This business"} will be removed from Outreach for good. Its lead stays, and its notes move to the lead.`
            : `${confirmTarget?.business_name ?? "This business"} and its notes will be removed for good. This can't be undone.`
        }
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
   Table
========================================================= */

const COLUMNS: DataTableColumn<OutreachRow>[] = [
  { key: "business", header: "Business", skeleton: "title", cell: (row) => <BusinessCell row={row} /> },
  { key: "industry", header: "Industry", muted: true, cell: (row) => industryLabel(row.industry) },
  {
    key: "channel",
    header: "Channel",
    muted: true,
    cell: (row) => (
      <ChannelLabel channel={row.channel} />
    ),
  },
  {
    key: "first",
    header: "First messaged",
    cell: (row) => <span title={formatShortDate(row.first_contacted_on)}>{formatAgo(row.first_contacted_on)}</span>,
  },
  { key: "stage", header: "Stage", skeleton: "pill", cell: (row) => <StageCell row={row} /> },
  { key: "objection", header: "Objection", cell: (row) => <ObjectionCell row={row} /> },
  { key: "next", header: "Next step", skeleton: "title", cell: (row) => <NextStepCell row={row} /> },
];

/* =========================================================
   Cells
========================================================= */

function BusinessCell({ row }: { row: OutreachRow }) {
  const url = row.handle ? handleUrl(row.handle, row.channel) : null;
  const sub = [row.handle, row.town].filter(Boolean);

  return (
    <TitleCell
      title={row.business_name}
      sub={
        sub.length > 0 && (
          <>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                {row.handle}
              </a>
            ) : (
              row.handle
            )}
            {row.handle && row.town ? " · " : ""}
            {row.town}
          </>
        )
      }
    />
  );
}

function StagePill({ stage }: { stage: Stage }) {
  return <Pill tone={STAGE_TONE[stage]}>{stageLabel(stage)}</Pill>;
}

// The stage, plus a Lead marker once the business has been promoted
function StageCell({ row }: { row: OutreachRow }) {
  const lead = embeddedLead(row.leads);
  return (
    <span className={outreachStyles.stageCell}>
      <StagePill stage={row.stage} />
      {/* the stage already says Lead; the mark is for a lead whose stage was changed by hand */}
      {lead && row.stage !== "converted" && (
        <span className={outreachStyles.leadMark} title="Promoted to a lead">
          <HiMiniBolt size={12} />
          Lead
        </span>
      )}
    </span>
  );
}

function ObjectionCell({ row }: { row: OutreachRow }) {
  if (!row.objection) return <EmptyCell />;
  return (
    <div className={outreachStyles.objection}>
      <span className={outreachStyles.objectionLabel}>{objectionLabel(row.objection)}</span>
      {row.objection_reason && (
        <span className={outreachStyles.objectionReason} title={row.objection_reason}>
          {row.objection_reason}
        </span>
      )}
    </div>
  );
}

function NextStepCell({ row }: { row: OutreachRow }) {
  const state = dueState(row);
  const closed = CLOSED_STAGES.includes(row.stage);
  if (!row.next_step && !row.next_step_due) return <EmptyCell />;

  return (
    <div className={`${outreachStyles.next} ${closed ? outreachStyles.nextClosed : ""}`}>
      {row.next_step && <span className={outreachStyles.nextText}>{row.next_step}</span>}
      {row.next_step_due && (
        <span className={`${outreachStyles.due} ${state ? DUE_CLASS[state] : outreachStyles.dueLater}`}>
          {formatDue(row.next_step_due)}
        </span>
      )}
    </div>
  );
}
