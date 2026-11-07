"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  HiMiniHome,
  HiMiniCheck,
  HiMiniArrowRight,
  HiOutlineInboxArrowDown,
  HiOutlineBolt,
  HiOutlineCheckCircle,
  HiOutlinePaperAirplane,
} from "react-icons/hi2";
import styles from "./homePage.module.css";
import dash from "./dashboard.module.css";
import taskStyles from "../components/component-styles/taskList.module.css";
import { useDashboard } from "../context/dashboardContext";
import { useBlockIosEdgeSwipe } from "../hooks/useBlockIosEdgeBackSwipe";
import { useDelayedFlag } from "../hooks/useDelayedFlag";
import { useAnimatedList } from "../hooks/useAnimatedList";
import OutreachReport from "../components/outreachReport";
import { fetchDashboard, fetchFeed, startOfWeekISO, taskAbout, type DashboardData, type DashboardTask, type FeedItem } from "../../lib/dashboard";
import { setTaskDone, taskDue } from "../../lib/tasks";
import { subjectHref, subjectOf } from "../../lib/subjects";
import { LEAD_STAGES, leadStageTone } from "../../lib/leads";
import { formatDue } from "../../lib/outreach";

// The home page: what to do this week, what's happened, and where things stand.

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

const formatMoney = (value: number) =>
  value >= 1000 ? `£${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : `£${value}`;

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const formatDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short" });

// in local time, so an evening item isn't filed under tomorrow
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export default function HomePage() {
  const { setActivePage, setPageTitle, setBreadcrumbs } = useDashboard();
  useEffect(() => {
    setActivePage("home");
    setPageTitle("Home");
    setBreadcrumbs([{ label: "gios.build", href: "#" }, { label: "Home" }]);
  }, [setActivePage, setPageTitle, setBreadcrumbs]);

  useBlockIosEdgeSwipe(true);

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = data === null && !error;
  const showSkeleton = useDelayedFlag(loading);
  const [reportOpen, setReportOpen] = useState(false);
  const closeReport = useCallback(() => setReportOpen(false), []);

  const load = useCallback(async () => {
    try {
      setData(await fetchDashboard());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the dashboard.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchDashboard()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load the dashboard."));
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Ticking a task off keeps it in place, struck through, so a mis-click is one
  // click to undo. Done tasks drop off the next time the dashboard loads.
  async function toggle(task: DashboardTask) {
    const done = !task.done_at;
    const mark = (doneAt: string | null) =>
      setData((d) => d && { ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, done_at: doneAt } : t)) });
    mark(done ? new Date().toISOString() : null);
    try {
      await setTaskDone(task, done);
      // the "Done" line was added or taken back out: refresh just the feed
      const feed = await fetchFeed();
      setData((d) => d && { ...d, feed });
    } catch (e) {
      mark(task.done_at);
      setError(e instanceof Error ? e.message : "Couldn't update that task.");
    }
  }

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className={styles.canvas}>
      <div className={styles.headerRow}>
        <div className={styles.pageHeader}>
          <div className={styles.pageIcon}>
            <HiMiniHome size={30} />
          </div>
          <div className={dash.titleBlock}>
            <h1 className={styles.pageTitle}>{greeting()}</h1>
            <span className={dash.date}>{today}</span>
          </div>
        </div>
      </div>

      <main className={styles.content}>
        {error && (
          <div className={`${styles.errorBanner} ${styles.actionError}`} role="alert">
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          showSkeleton && <DashboardSkeleton />
        ) : data ? (
          <div className={`${dash.layout} blur-in-soft`}>
            <Summary data={data} onOpenOutreach={() => setReportOpen(true)} />

            <div className={dash.columns}>
              <section className={dash.card} aria-labelledby="dash-tasks">
                <header className={dash.cardHeader}>
                  <h2 id="dash-tasks" className={dash.cardTitle}>
                    <HiOutlineCheckCircle size={18} /> This week&apos;s tasks
                  </h2>
                </header>
                <TaskGroups tasks={data.tasks} onToggle={toggle} />
              </section>

              <section className={dash.card} aria-labelledby="dash-activity">
                <header className={dash.cardHeader}>
                  <h2 id="dash-activity" className={dash.cardTitle}>
                    Activity
                  </h2>
                </header>
                <Feed items={data.feed} />
              </section>
            </div>

            <Pipeline data={data} />
          </div>
        ) : null}
      </main>

      {/* outreach is the main source of work: how it's going, where replies come from */}
      {data && (
        <OutreachReport open={reportOpen} onClose={closeReport} rows={data.outreach} weekStart={startOfWeekISO()} />
      )}
    </div>
  );
}

/* ---------------- Summary cards ---------------- */

function Summary({ data, onOpenOutreach }: { data: DashboardData; onOpenOutreach: () => void }) {
  const dueNow = data.tasks.filter((t) => {
    const s = taskDue(t);
    return s === "overdue" || s === "today";
  }).length;

  const cards = [
    {
      href: "/inbox",
      icon: <HiOutlineInboxArrowDown size={18} />,
      label: "New enquiries",
      value: data.newEnquiries,
      sub: `${data.enquiriesThisWeek} this week`,
      alert: data.newEnquiries > 0,
    },
    {
      href: "/leads",
      icon: <HiOutlineBolt size={18} />,
      label: "Open leads",
      value: data.openLeads,
      sub: `${formatMoney(data.pipelineValue)} in the pipeline`,
    },
    {
      href: "#dash-tasks",
      icon: <HiOutlineCheckCircle size={18} />,
      label: "Due today",
      value: dueNow,
      sub: `${data.tasks.filter((t) => !t.done_at).length} due this week`,
      alert: dueNow > 0,
    },
    {
      // opens the outreach scorecard rather than going anywhere
      onClick: onOpenOutreach,
      icon: <HiOutlinePaperAirplane size={18} />,
      label: "Messaged this week",
      value: data.messagedThisWeek,
      sub: `${data.outreachLeadsThisWeek} promoted to ${data.outreachLeadsThisWeek === 1 ? "a lead" : "leads"}`,
    },
  ];

  return (
    <div className={dash.summary}>
      {cards.map((card) => {
        const body = (
          <>
            <span className={dash.statLabel}>
              {card.icon}
              {card.label}
            </span>
            <span className={cx(dash.statValue, card.alert && dash.statAlert)}>{card.value}</span>
            <span className={dash.statSub}>{card.sub}</span>
          </>
        );
        return card.href ? (
          <Link key={card.label} href={card.href} className={dash.stat}>
            {body}
          </Link>
        ) : (
          <button key={card.label} type="button" className={cx(dash.stat, dash.statButton)} onClick={card.onClick} aria-haspopup="dialog">
            {body}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Tasks ---------------- */

function TaskGroups({ tasks, onToggle }: { tasks: DashboardTask[]; onToggle: (t: DashboardTask) => void }) {
  if (tasks.length === 0) {
    return <p className={dash.empty}>Nothing due this week. Add tasks on a lead, an enquiry or in Outreach.</p>;
  }
  // grouped by due date as if still open, so a ticked task stays where it was
  const dueOf = (t: DashboardTask) => taskDue({ due_on: t.due_on, done_at: null });
  const groups: { label: string; tasks: DashboardTask[] }[] = [
    { label: "Overdue", tasks: tasks.filter((t) => dueOf(t) === "overdue") },
    { label: "Today", tasks: tasks.filter((t) => dueOf(t) === "today") },
    { label: "Later this week", tasks: tasks.filter((t) => ["soon", "later"].includes(dueOf(t) ?? "")) },
  ].filter((g) => g.tasks.length > 0);

  return (
    <div className={dash.groups}>
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className={cx(dash.groupLabel, group.label === "Overdue" && dash.groupAlert)}>{group.label}</h3>
          <ul className={dash.list}>
            {group.tasks.map((task) => {
              const subject = subjectOf(task);
              const state = taskDue(task);
              const done = !!task.done_at;
              return (
                <li key={task.id} className={cx(dash.taskRow, done && dash.taskDone)}>
                  <button
                    type="button"
                    className={cx(taskStyles.check, done && taskStyles.checkOn, done && dash.checkPop)}
                    onClick={() => onToggle(task)}
                    aria-pressed={done}
                    aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
                  >
                    <HiMiniCheck size={14} className={done ? undefined : dash.checkHint} />
                  </button>
                  <div className={dash.taskMain}>
                    <span className={dash.taskTitle}>{task.title}</span>
                    {subject && (
                      <Link href={subjectHref(subject)} className={dash.about}>
                        {taskAbout(task)}
                      </Link>
                    )}
                  </div>
                  {task.due_on && (
                    <span className={cx(taskStyles.due, state && taskStyles[state])}>{formatDue(task.due_on)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Activity feed ---------------- */

const newestFirst = (a: FeedItem, b: FeedItem) => b.at.localeCompare(a.at);

function Feed({ items }: { items: FeedItem[] }) {
  // lines slide in when they're added and fold away when they're taken back out
  const shown = useAnimatedList(items, newestFirst);
  if (shown.length === 0) {
    return <p className={dash.empty}>Nothing yet this week. New enquiries, leads and changes show up here.</p>;
  }
  const todayItems = shown.filter((s) => isToday(s.item.at));
  const earlier = shown.filter((s) => !isToday(s.item.at));
  return (
    <div className={dash.groups}>
      {[
        { label: "Today", items: todayItems },
        { label: "Earlier this week", items: earlier },
      ]
        .filter((g) => g.items.length > 0)
        .map((group) => (
          <div key={group.label}>
            <h3 className={dash.groupLabel}>{group.label}</h3>
            <ol className={dash.feed}>
              {group.items.map(({ item, state }) => {
                const subject = subjectOf(item);
                const body = (
                  <>
                    <span className={cx(dash.feedDot, dash[`dot_${item.kind.split(".")[0]}`])} aria-hidden="true" />
                    <span className={dash.feedText}>
                      {item.summary}
                      {item.about && <span className={dash.feedAbout}> · {item.about}</span>}
                    </span>
                    <time className={dash.feedTime} dateTime={item.at}>
                      {group.label === "Today" ? formatTime(item.at) : formatDay(item.at)}
                    </time>
                  </>
                );
                return (
                  <li
                    key={item.id}
                    className={cx(dash.feedRow, state === "entering" && dash.feedEnter, state === "leaving" && dash.feedLeave)}
                    aria-hidden={state === "leaving" || undefined}
                  >
                    <div className={dash.feedRowInner}>
                      {subject && state !== "leaving" ? (
                        <Link href={subjectHref(subject)} className={dash.feedItem}>
                          {body}
                          <HiMiniArrowRight size={14} className={dash.feedArrow} />
                        </Link>
                      ) : (
                        <div className={dash.feedItem}>{body}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
    </div>
  );
}

/* ---------------- Pipeline ---------------- */

function Pipeline({ data }: { data: DashboardData }) {
  const total = LEAD_STAGES.reduce((sum, s) => sum + data.leadsByStage[s.value], 0);
  return (
    <section className={dash.card} aria-labelledby="dash-pipeline">
      <header className={dash.cardHeader}>
        <h2 id="dash-pipeline" className={dash.cardTitle}>
          Lead pipeline
        </h2>
        <Link href="/leads" className={dash.cardLink}>
          All leads <HiMiniArrowRight size={14} />
        </Link>
      </header>
      {total === 0 ? (
        <p className={dash.empty}>No leads yet.</p>
      ) : (
        <>
          <div className={dash.bar} role="img" aria-label={`${total} leads by stage`}>
            {LEAD_STAGES.filter((s) => data.leadsByStage[s.value] > 0).map((s) => (
              <span
                key={s.value}
                className={cx(dash.barPart, dash[`tone_${leadStageTone(s.value)}`])}
                style={{ flexGrow: data.leadsByStage[s.value] }}
              />
            ))}
          </div>
          <ul className={dash.legend}>
            {LEAD_STAGES.map((s) => (
              <li key={s.value}>
                <span className={cx(dash.legendDot, dash[`tone_${leadStageTone(s.value)}`])} />
                {s.label} <strong>{data.leadsByStage[s.value]}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* ---------------- Loading ---------------- */

function DashboardSkeleton() {
  return (
    <div className={`${dash.layout} fade-in`} aria-busy="true" aria-label="Loading">
      <div className={dash.summary}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cx(dash.stat, dash.skeletonBlock)} />
        ))}
      </div>
      <div className={dash.columns}>
        <div className={cx(dash.card, dash.skeletonBlock, dash.skeletonTall)} />
        <div className={cx(dash.card, dash.skeletonBlock, dash.skeletonTall)} />
      </div>
    </div>
  );
}
