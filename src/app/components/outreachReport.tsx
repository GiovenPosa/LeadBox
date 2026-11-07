"use client";

import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  HiMiniArrowRight,
  HiOutlineLightBulb,
  HiXMark,
} from "react-icons/hi2";
import styles from "./component-styles/outreachReport.module.css";
import { ChannelLabel } from "./channelIcon";
import { useRestoreFocus } from "../hooks/useRestoreFocus";
import {
  FUNNEL_STEPS,
  PERIODS,
  formatRate,
  scorecard,
  weeklyTrend,
  type Breakdown,
  type Period,
  type Scorecard,
  type ScorecardRow,
  type WeekTotals,
} from "../../lib/outreachStats";
import { channelLabel, formatShortDate, type Channel } from "../../lib/outreach";

// How outreach is going, opened from the "Messaged this week" card on the home
// page: the reply rate, the funnel from messaged to lead, which channels and
// industries reply best, the last few weeks, and the objections that come up.
// A centred modal on desktop, a tall bottom sheet on phones.

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

const PERIOD_WORDS: Record<Period, string> = { week: "this week", month: "this month", all: "yet" };

type Tone = "good" | "fair" | "weak" | "neutral";

/** Colour a reply rate by how it's doing: strong, middling or weak */
const rateTone = (r: number | null): Tone => (r === null ? "neutral" : r >= 0.4 ? "good" : r >= 0.2 ? "fair" : "weak");

const TONE_WORDS: Record<Tone, string> = { good: "Strong", fair: "Okay", weak: "Low", neutral: "Too early to tell" };

/** The most useful thing to say about the numbers, in a sentence */
function takeaway(card: Scorecard): string {
  const channels = card.byChannel.filter((c) => c.replyRate !== null);
  if (channels.length >= 2 && channels[0].replyRate! > channels[channels.length - 1].replyRate!) {
    const best = channels[0];
    const worst = channels[channels.length - 1];
    return `${channelLabel(best.key as Channel)} replies best: ${formatRate(best.replyRate)} vs ${formatRate(worst.replyRate)} on ${channelLabel(worst.key as Channel)}.`;
  }
  const industries = card.byIndustry.filter((i) => i.replyRate !== null && i.messaged >= 2);
  if (industries.length >= 2 && industries[0].replyRate! > 0) {
    return `${industries[0].label} are your warmest industry so far (${formatRate(industries[0].replyRate)} reply).`;
  }
  if (card.awaiting > 0) return `${card.awaiting} still to hear back from. If nothing comes by day 5, send a short follow-up.`;
  return "Message a few more businesses and patterns will show here.";
}

const subscribeNoop = () => () => {};

export default function OutreachReport({
  open,
  onClose,
  rows,
  weekStart,
}: {
  open: boolean;
  onClose: () => void;
  rows: ScorecardRow[];
  weekStart: string;
}) {
  // true only in the browser, so the portal never renders on the server
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const titleId = useId();
  const [period, setPeriod] = useState<Period>("all");
  useRestoreFocus(open);

  // Escape closes it, and the page behind doesn't scroll while it's open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const card = scorecard(rows, period, weekStart);
  const trend = weeklyTrend(rows, weekStart);

  return createPortal(
    <>
      <div
        className={cx(styles.backdrop, open && styles.backdropVisible)}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cx(styles.modal, open && styles.modalOpen)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId} className={styles.title}>
              Outreach scorecard
            </h2>
            <p className={styles.subtitle}>How messaging businesses first is going</p>
          </div>
          <div className={styles.headerActions}>
            <Segmented label="Period" value={period} options={PERIODS} onChange={setPeriod} />
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <HiXMark size={22} />
            </button>
          </div>
        </header>

        <div className={styles.body}>
          {card.messaged === 0 ? (
            <div className={styles.empty}>
              <p>No businesses messaged {PERIOD_WORDS[period]}.</p>
              <Link href="/outreach" className={styles.link} onClick={onClose}>
                Log one in Outreach <HiMiniArrowRight size={14} />
              </Link>
            </div>
          ) : (
            // keyed by period (and by opening), so the charts grow in again
            <div key={`${period}-${open}`} className={styles.grid}>
              <Headline card={card} />

              <p className={styles.takeaway}>
                <HiOutlineLightBulb size={18} />
                {takeaway(card)}
              </p>

              <Panel title="How far they get" wide>
                <Funnel card={card} />
              </Panel>

              <Panel title="By channel">
                <Board rows={card.byChannel} kind="channel" />
              </Panel>

              <Panel title="By industry">
                <Board rows={card.byIndustry} kind="industry" />
              </Panel>

              <Panel title="Last 8 weeks" hint="Messaged each week, and how many replied">
                <Trend weeks={trend} />
              </Panel>

              <Panel title="What holds them back" hint="Objections from businesses that replied">
                <Objections card={card} />
              </Panel>
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <Link href="/outreach" className={styles.link} onClick={onClose}>
            Open Outreach <HiMiniArrowRight size={14} />
          </Link>
        </footer>
      </div>
    </>,
    document.body
  );
}

/* ---------------- Pieces ---------------- */

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={cx(styles.segment, value === o.value && styles.segmentOn)}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Panel({
  title,
  hint,
  wide,
  children,
}: {
  title: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cx(styles.panel, wide && styles.panelWide)}>
      <header className={styles.panelHead}>
        <h3 className={styles.panelTitle}>{title}</h3>
        {hint && <span className={styles.panelHint}>{hint}</span>}
      </header>
      {children}
    </section>
  );
}

/* ---- The headline: reply rate and the four numbers ---- */

function Headline({ card }: { card: Scorecard }) {
  const tone = rateTone(card.replyRate);
  const tiles = [
    { label: "Messaged", value: card.messaged },
    { label: "Replied", value: card.reached[1] },
    { label: "Became leads", value: card.reached[4], extra: formatRate(card.leadRate), good: card.reached[4] > 0 },
    { label: "Awaiting reply", value: card.awaiting, extra: "under 3 days" },
  ];
  return (
    <div className={styles.headline}>
      <div className={styles.rateBlock}>
        <Gauge rate={card.replyRate} />
        <div className={styles.rateText}>
          <span className={styles.rateLabel}>Reply rate</span>
          <span className={cx(styles.toneTag, styles[`pill_${tone}`])}>{TONE_WORDS[tone]}</span>
          <span className={styles.rateNote}>Not counting businesses still inside their first 3 days</span>
        </div>
      </div>
      <dl className={styles.tiles}>
        {tiles.map((t) => (
          <div key={t.label} className={styles.tile}>
            <dt>{t.label}</dt>
            <dd className={t.good ? styles.good : undefined}>{t.value}</dd>
            {t.extra && <span className={styles.tileExtra}>{t.extra}</span>}
          </div>
        ))}
      </dl>
    </div>
  );
}

function Gauge({ rate }: { rate: number | null }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className={styles.gauge} role="img" aria-label={`Reply rate ${formatRate(rate)}`}>
      <svg viewBox="0 0 132 132" aria-hidden="true">
        <circle className={styles.gaugeTrack} cx="66" cy="66" r={radius} />
        <circle
          className={cx(styles.gaugeFill, styles[`stroke_${rateTone(rate)}`])}
          cx="66"
          cy="66"
          r={radius}
          strokeDasharray={`${rate === null ? 0 : circumference * rate} ${circumference}`}
          style={{ ["--gauge-full" as string]: `${circumference}` }}
        />
      </svg>
      <span className={styles.gaugeValue}>{formatRate(rate)}</span>
    </div>
  );
}

/* ---- Funnel: one row per step, bars as a share of everyone messaged ---- */

// The numbers sit in their own right-aligned columns, so they line up whatever
// the bar length: how many got this far, and the share of the step before.
function Funnel({ card }: { card: Scorecard }) {
  return (
    <div className={styles.funnel}>
      <div className={styles.funnelHead} aria-hidden="true">
        <span />
        <span />
        <span>Businesses</span>
        <span>From step before</span>
      </div>
      <ol className={styles.funnelRows}>
        {FUNNEL_STEPS.map((step, i) => {
          const count = card.reached[i];
          const share = card.messaged ? count / card.messaged : 0;
          const prev = i > 0 ? card.reached[i - 1] : 0;
          // nothing to carry on from: a dash, not "0%"
          const fromPrev = prev ? count / prev : null;
          return (
            <li
              key={step.label}
              className={styles.step}
              style={{ ["--i" as string]: i }}
              aria-label={`${step.label}: ${count}${i > 0 && fromPrev !== null ? `, ${formatRate(fromPrev)} of ${FUNNEL_STEPS[i - 1].label.toLowerCase()}` : ""}`}
            >
              <span className={styles.stepLabel}>{step.label}</span>
              <span className={styles.stepTrack} title={`${count} of ${card.messaged} messaged (${formatRate(share)})`}>
                <span
                  className={cx(styles.stepFill, styles[`fill${i}`])}
                  style={{ width: `${count ? Math.max(share * 100, 2) : 0}%` }}
                />
              </span>
              <span className={cx(styles.stepCount, count === 0 && styles.muted)}>{count}</span>
              <span className={cx(styles.stepShare, fromPrev === null && styles.muted)}>
                {i === 0 ? "" : formatRate(fromPrev)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---- Who replies best ---- */

function Board({ rows, kind }: { rows: Breakdown[]; kind: "channel" | "industry" }) {
  if (rows.length === 0) return <p className={styles.none}>Nothing to compare yet.</p>;
  return (
    <ul className={styles.board}>
      {rows.map((row) => {
        const tone = rateTone(row.replyRate);
        return (
          <li key={row.key} className={styles.leader}>
            <span className={styles.leaderName}>
              {kind === "channel" ? <ChannelLabel channel={row.key as Channel} size={15} /> : row.label}
            </span>
            <span className={styles.leaderBar} aria-hidden="true">
              <span
                className={cx(styles.leaderFill, styles[`bg_${tone}`])}
                // the same figure as the pill (still-awaiting businesses aren't counted)
                style={{ width: `${(row.replyRate ?? 0) * 100}%` }}
              />
            </span>
            <span className={styles.leaderCounts}>
              {row.replied}/{row.messaged}
              {row.leads > 0 && (
                <span className={styles.leaderLeads}>
                  {" "}· {row.leads} {row.leads === 1 ? "lead" : "leads"}
                </span>
              )}
            </span>
            <span className={cx(styles.ratePill, styles[`pill_${tone}`])}>{formatRate(row.replyRate)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* ---- The last few weeks: messaged, split into replied and not (yet) ---- */

function Trend({ weeks }: { weeks: WeekTotals[] }) {
  const max = Math.max(...weeks.map((w) => w.messaged), 1);
  const total = weeks.reduce((sum, w) => sum + w.messaged, 0);
  if (total === 0) return <p className={styles.none}>Nothing messaged in the last 8 weeks.</p>;
  return (
    <div className={styles.trend}>
      <ul className={styles.legend}>
        <li>
          <span className={cx(styles.legendSwatch, styles.trendReplied)} /> Replied
        </li>
        <li>
          <span className={cx(styles.legendSwatch, styles.trendRest)} /> No reply yet
        </li>
      </ul>
      <ol className={styles.trendChart}>
        {weeks.map((w, i) => {
          const last = i === weeks.length - 1;
          const label = `Week of ${formatShortDate(w.start)}: ${w.messaged} messaged, ${w.replied} replied${w.awaiting ? `, ${w.awaiting} awaiting` : ""}`;
          return (
            <li key={w.start} className={styles.trendWeek} title={label} aria-label={label} style={{ ["--i" as string]: i }}>
              <span className={styles.trendValue}>{w.messaged || ""}</span>
              <span className={styles.trendColumn}>
                {w.messaged > 0 && (
                  <span className={styles.trendStack} style={{ height: `${(w.messaged / max) * 100}%` }}>
                    {w.messaged > w.replied && <span className={styles.trendRest} style={{ flexGrow: w.messaged - w.replied }} />}
                    {w.replied > 0 && <span className={styles.trendReplied} style={{ flexGrow: w.replied }} />}
                  </span>
                )}
              </span>
              <span className={cx(styles.trendLabel, last && styles.trendNow)}>
                {last ? (
                  <>
                    <span className={styles.wide}>This wk</span>
                    <span className={styles.narrow}>Now</span>
                  </>
                ) : (
                  <>
                    {Number(w.start.slice(8))}
                    <span className={styles.wide}> {formatShortDate(w.start).split(" ")[1]}</span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---- Objections ---- */

function Objections({ card }: { card: Scorecard }) {
  if (card.objections.length === 0) {
    return <p className={styles.none}>No objections logged {card.messaged ? "for this period" : "yet"}. Record one on a business in Outreach when it comes up.</p>;
  }
  const max = card.objections[0].count;
  return (
    <ul className={styles.objections}>
      {card.objections.map((o, i) => (
        <li key={o.key} className={styles.objection}>
          <span className={styles.objectionName}>{o.label}</span>
          <span className={styles.objectionBar} aria-hidden="true">
            <span
              className={cx(styles.objectionFill, i === 0 && styles.objectionTop)}
              style={{ width: `${(o.count / max) * 100}%` }}
            />
          </span>
          <span className={styles.objectionCount}>{o.count}</span>
        </li>
      ))}
    </ul>
  );
}
