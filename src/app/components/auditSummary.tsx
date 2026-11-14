"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { HiMiniCheck } from "react-icons/hi2";
import styles from "./component-styles/auditProgress.module.css";
import Pill from "./pill";
import AuditModal from "./auditModal";
import AuditDetails, { STATUS, scoreTone } from "./auditDetails";
import { auditInProgress, fetchAuditForInquiry, type Audit } from "../../lib/audits";
import { clock, progressOf, STEPS } from "../../lib/auditProgress";
import { packageLabel } from "../../lib/leads";

// The website audit behind an enquiry from gios.build/website-audit, in the
// enquiry's side panel. While it runs: a playful progress bar, and a click
// opens the audit window with every step as it happens. Once it's done: a
// short summary (status, verdict, scores, the package it recommends), and a
// click opens the full results in the same window (auditDetails.tsx).

export default function AuditSummary({ inquiryId }: { inquiryId: string }) {
  const [audit, setAudit] = useState<Audit | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const running = audit ? auditInProgress(audit.status) : false;

  // load it, then check again every 5 seconds while it's still running
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const found = await fetchAuditForInquiry(inquiryId);
        if (cancelled) return;
        setAudit(found);
        setState(found ? "ready" : "none");
        if (found && auditInProgress(found.status)) timer = setTimeout(load, 5_000);
      } catch {
        if (!cancelled) setState("error");
      }
    };
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [inquiryId]);

  // the bar and the clock move every second while it runs
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [running]);

  if (state === "loading") return <p className={styles.muted}>Loading the audit…</p>;
  if (state === "error") return <p className={styles.muted}>Couldn’t load the audit.</p>;
  if (state === "none" || !audit) {
    return <p className={styles.muted}>A repeat request: this site was already audited in the last 30 days.</p>;
  }

  const site = audit.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const progress = progressOf(audit, now);
  const status = STATUS[audit.status];

  return (
    <>
      {running ? (
        // the whole bar opens the window
        <button type="button" className={styles.bar} onClick={() => setOpen(true)} aria-label={`Audit of ${site}: ${progress.percent}%. Show progress`}>
          <span className={styles.barTop}>
            <span className={styles.stage}>
              {STEPS[progress.current]?.label}
              <span className={styles.dots} aria-hidden>
                <i />
                <i />
                <i />
              </span>
            </span>
            <span className={styles.percent}>{progress.percent}%</span>
          </span>
          <span className={styles.track} aria-hidden>
            <span className={styles.fill} style={{ "--p": `${progress.percent}%` } as CSSProperties} />
          </span>
          <span className={styles.barFoot}>
            <span>{site}</span>
            <span>{clock(progress.elapsed)} · tap for details</span>
          </span>
        </button>
      ) : (
        <div className={styles.summary}>
          <div className={styles.summaryHead}>
            <Pill tone={status.tone}>{status.label}</Pill>
            <span className={styles.muted}>{site}</span>
          </div>
          {audit.report?.verdict && <p className={styles.verdict}>{audit.report.verdict}</p>}
          {audit.fail_reason && <p className={styles.fail}>{audit.fail_reason}</p>}
          <div className={styles.chips}>
            {audit.facts?.speed.mobile && (
              <Pill tone={scoreTone(audit.facts.speed.mobile.performance)}>Phone {audit.facts.speed.mobile.performance}/100</Pill>
            )}
            {audit.facts?.speed.desktop && (
              <Pill tone={scoreTone(audit.facts.speed.desktop.performance)}>Computer {audit.facts.speed.desktop.performance}/100</Pill>
            )}
            {audit.facts?.profile?.found && (
              <Pill tone="neutral">
                {audit.facts.profile.rating ?? "—"}★ · {audit.facts.profile.reviews ?? 0} reviews
              </Pill>
            )}
            {audit.report && <Pill tone="qualified">{packageLabel(audit.report.recommendation.package)}</Pill>}
          </div>
          {audit.facts && (
            <button type="button" className={styles.view} onClick={() => setOpen(true)}>
              View results
            </button>
          )}
        </div>
      )}

      <AuditModal
        open={open}
        onClose={() => setOpen(false)}
        title={running ? "Auditing the site" : "Website audit"}
        subtitle={site}
      >
        {running ? <ProgressSteps current={progress.current} percent={progress.percent} elapsed={progress.elapsed} /> : <AuditDetails audit={audit} />}
      </AuditModal>
    </>
  );
}

/** every step, ticked off as it goes, the current one with its line */
function ProgressSteps({ current, percent, elapsed }: { current: number; percent: number; elapsed: number }) {
  return (
    <div className={styles.steps}>
      <span className={styles.track} aria-hidden>
        <span className={styles.fill} style={{ "--p": `${percent}%` } as CSSProperties} />
      </span>
      <p className={styles.muted}>
        {percent}% · {clock(elapsed)} so far · usually about two minutes
      </p>
      <ol>
        {STEPS.map((step, index) => {
          const state = index < current ? "done" : index === current ? "now" : "next";
          return (
            <li key={step.key} className={styles[state]}>
              <span className={styles.mark} aria-hidden>
                {state === "done" ? <HiMiniCheck size={14} /> : state === "now" ? <span className={styles.spinner} /> : null}
              </span>
              <span>
                <strong>{step.label}</strong>
                {state === "now" && <span className={styles.detail}>{step.detail}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
