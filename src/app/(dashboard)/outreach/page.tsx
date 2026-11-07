"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useDashboard } from "../../context/dashboardContext";
import { useBlockIosEdgeSwipe } from "../../hooks/useBlockIosEdgeBackSwipe";
import styles from "../homePage.module.css";
import outreachStyles from "./outreach.module.css";
import { HiMiniPaperAirplane, HiMiniPlus } from "react-icons/hi2";
import OutreachEditor from "../../components/outreachEditor";
import ConfirmDialog from "../../components/confirmDialog";
import Button from "../../components/button";
import Toolbar, { type ToolbarFilterGroup } from "../../components/toolbar";
import { ChannelIcon } from "../../components/channelIcon";
import {
  CHANNELS,
  CLOSED_STAGES,
  INDUSTRIES,
  OUTREACH_COLUMNS,
  STAGES,
  channelLabel,
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

const STAGE_CLASS: Record<Stage, string> = {
  messaged: outreachStyles.stageMessaged,
  replied: outreachStyles.stageReplied,
  mockup: outreachStyles.stageProgress,
  chat: outreachStyles.stageProgress,
  quoted: outreachStyles.stageProgress,
  won: outreachStyles.stageWon,
  lost: outreachStyles.stageLost,
  no_reply: outreachStyles.stageQuiet,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("due");
  const [attrFilter, setAttrFilter] = useState<Record<string, string[]>>({});

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<OutreachRow | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<OutreachRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ---------------- Data ---------------- */

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from("outreach")
      .select(OUTREACH_COLUMNS)
      .order("first_contacted_on", { ascending: false })
      .limit(1000);

    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setRows((data ?? []) as OutreachRow[]);
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
    const byStage = Object.fromEntries(STAGES.map((s) => [s.value, 0])) as Record<Stage, number>;
    for (const r of rows) byStage[r.stage] += 1;
    return { all: rows.length, due: rows.filter(isDue).length, byStage };
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const industries = attrFilter.industry ?? [];
    const channels = attrFilter.channel ?? [];
    const filtered = rows.filter((r) => {
      if (filter === "due" && !isDue(r)) return false;
      if (filter !== "all" && filter !== "due" && r.stage !== filter) return false;
      if (industries.length && !industries.includes(r.industry)) return false;
      if (channels.length && !channels.includes(r.channel)) return false;
      if (!q) return true;
      return [r.business_name, r.town, r.handle, r.next_step, r.notes]
        .some((v) => v?.toLowerCase().includes(q));
    });
    return sortRows(filtered, sort);
  }, [rows, filter, search, sort, attrFilter]);

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
  }

  async function confirmDelete() {
    if (!confirmTarget) return;
    setDeleting(true);

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

  return (
    <>
      <div className={`${styles.canvas} ${outreachStyles.fillCanvas}`}>
        <div className={outreachStyles.headerRow}>
          <div className={styles.pageHeader}>
            <div className={styles.pageIcon}>
              <HiMiniPaperAirplane size={30} />
            </div>
            <h1 className={styles.pageTitle}>Outreach</h1>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={<HiMiniPlus size={18} />}
            className={outreachStyles.headerAction}
            onClick={openNew}
            disabled={missingTable}
          >
            Add
          </Button>
        </div>

        {/* Filters */}
        <div className={styles.statsRow}>
          <div className={styles.statGroup}>
            <button
              type="button"
              className={`${styles.statCard} ${filter === "due" ? styles.statCardActive : ""}`}
              onClick={() => toggleFilter("due")}
            >
              <span className={`${styles.statValue} ${counts.due > 0 ? outreachStyles.dueCount : ""}`}>
                {counts.due}
              </span>
              <span className={styles.statLabel}>Due</span>
            </button>
            <button
              type="button"
              className={`${styles.statCard} ${filter === "all" ? styles.statCardActive : ""}`}
              onClick={() => toggleFilter("all")}
            >
              <span className={styles.statValue}>{counts.all}</span>
              <span className={styles.statLabel}>All</span>
            </button>
            {STAGES.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`${styles.statCard} ${filter === s.value ? styles.statCardActive : ""}`}
                onClick={() => toggleFilter(s.value)}
              >
                <span className={styles.statValue}>{counts.byStage[s.value]}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <main className={`${styles.content} ${outreachStyles.fillContent}`}>
          {loading ? (
            <div className={`${styles.loading} ${outreachStyles.fillCenter}`}>Loading outreach…</div>
          ) : missingTable ? (
            <div className={`${styles.emptyState} ${outreachStyles.fillCenter}`}>
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
            <div className={`${styles.emptyState} ${outreachStyles.fillCenter}`}>
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
              <Toolbar
                className={outreachStyles.toolbar}
                search={{ value: search, onChange: setSearch, placeholder: "Search businesses" }}
                filter={{ groups: FILTER_GROUPS, value: attrFilter, onChange: setAttrFilter }}
                sort={{ options: SORT_OPTIONS, value: sort, onChange: setSort, defaultValue: "due" }}
              />

              {visible.length === 0 ? (
                <p className={outreachStyles.noMatches}>Nothing matches that filter.</p>
              ) : (
                <>
                  {/* Desktop: table */}
                  <div className={outreachStyles.tableWrap}>
                    <table className={outreachStyles.table}>
                      <thead>
                        <tr>
                          <th>Business</th>
                          <th>Industry</th>
                          <th>Channel</th>
                          <th>First messaged</th>
                          <th>Stage</th>
                          <th>Objection</th>
                          <th>Next step</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((row) => (
                          <tr
                            key={row.id}
                            onClick={() => openRow(row)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") openRow(row);
                            }}
                            tabIndex={0}
                          >
                            <td>
                              <BusinessCell row={row} />
                            </td>
                            <td className={outreachStyles.muted}>{industryLabel(row.industry)}</td>
                            <td className={outreachStyles.muted}>
                              <span className={outreachStyles.channel}>
                                <ChannelIcon channel={row.channel} />
                                {channelLabel(row.channel)}
                              </span>
                            </td>
                            <td>
                              <span title={formatShortDate(row.first_contacted_on)}>
                                {formatAgo(row.first_contacted_on)}
                              </span>
                            </td>
                            <td>
                              <StagePill stage={row.stage} />
                            </td>
                            <td>
                              <ObjectionCell row={row} />
                            </td>
                            <td>
                              <NextStepCell row={row} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: cards */}
                  <div className={outreachStyles.cardList}>
                    {visible.map((row) => (
                      <article
                        key={row.id}
                        className={outreachStyles.card}
                        onClick={() => openRow(row)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openRow(row);
                        }}
                      >
                        <div className={outreachStyles.cardTop}>
                          <BusinessCell row={row} />
                          <StagePill stage={row.stage} />
                        </div>
                        <p className={outreachStyles.cardMeta}>
                          {industryLabel(row.industry)} ·{" "}
                          <span className={outreachStyles.channel}>
                            <ChannelIcon channel={row.channel} size={14} />
                            {channelLabel(row.channel)}
                          </span>{" "}
                          · {formatAgo(row.first_contacted_on)}
                        </p>
                        {row.objection && <ObjectionCell row={row} />}
                        {(row.next_step || row.next_step_due) && (
                          <div className={outreachStyles.cardNext}>
                            <NextStepCell row={row} />
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </>
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
      />

      <ConfirmDialog
        variant="danger"
        open={confirmTarget !== null}
        title="Delete this business?"
        message={`${confirmTarget?.business_name ?? "This business"} and its notes will be removed for good. This can't be undone.`}
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
   Cells
========================================================= */

function BusinessCell({ row }: { row: OutreachRow }) {
  const url = row.handle ? handleUrl(row.handle, row.channel) : null;
  const sub = [row.handle, row.town].filter(Boolean);

  return (
    <div className={outreachStyles.business}>
      <span className={outreachStyles.businessName}>{row.business_name}</span>
      {sub.length > 0 && (
        <span className={outreachStyles.businessSub}>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              {row.handle}
            </a>
          ) : (
            row.handle
          )}
          {row.handle && row.town ? " · " : ""}
          {row.town}
        </span>
      )}
    </div>
  );
}

function StagePill({ stage }: { stage: Stage }) {
  return <span className={`${outreachStyles.stage} ${STAGE_CLASS[stage]}`}>{stageLabel(stage)}</span>;
}

function ObjectionCell({ row }: { row: OutreachRow }) {
  if (!row.objection) return <span className={outreachStyles.empty}>—</span>;
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
  if (!row.next_step && !row.next_step_due) return <span className={outreachStyles.empty}>—</span>;

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
