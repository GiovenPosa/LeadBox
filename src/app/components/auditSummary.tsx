"use client";

import { useEffect, useState } from "react";
import styles from "./component-styles/auditSummary.module.css";
import Pill, { type PillTone } from "./pill";
import { auditInProgress, fetchAuditForInquiry, type Audit, type AuditStatus, type SpeedRun } from "../../lib/audits";

// The website audit behind an enquiry from gios.build/website-audit: where
// it's up to, then the facts gathered about the site, in plain terms, ready
// for writing the report (by hand until the report-writing phase is built).

const STATUS: Record<AuditStatus, { label: string; tone: PillTone }> = {
  queued: { label: "Queued", tone: "neutral" },
  held: { label: "Held: over the daily cap", tone: "contacted" },
  gathering: { label: "Checking the site…", tone: "neutral" },
  writing: { label: "Writing the report…", tone: "neutral" },
  review: { label: "Facts ready", tone: "qualified" },
  ready: { label: "Report ready", tone: "qualified" },
  sent: { label: "Sent", tone: "won" },
  failed: { label: "Failed", tone: "bad" },
  rejected: { label: "Not sent", tone: "lost" },
};

// Google's own bands for the Lighthouse scores
const scoreTone = (score: number | null): PillTone =>
  score === null ? "neutral" : score >= 90 ? "won" : score >= 50 ? "contacted" : "bad";

const seconds = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`);

function Speed({ label, run }: { label: string; run: SpeedRun | null }) {
  if (!run) return <Line label={label}>not measured</Line>;
  return (
    <Line label={label}>
      <Pill tone={scoreTone(run.performance)}>{run.performance ?? "—"}/100</Pill>
      <span className={styles.muted}>
        main content {seconds(run.lcpMs)} · {run.weightKb !== null ? `${(run.weightKb / 1024).toFixed(1)} MB` : "—"}
        {run.seo !== null && ` · SEO ${run.seo}`}
      </span>
    </Line>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.line}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{children}</span>
    </div>
  );
}

const yesNo = (value: boolean | null, yes: string, no: string) => (value === null ? "unknown" : value ? yes : no);

export default function AuditSummary({ inquiryId }: { inquiryId: string }) {
  const [audit, setAudit] = useState<Audit | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none" | "error">("loading");

  // load it, then keep checking every 10 seconds while it's still gathering
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const found = await fetchAuditForInquiry(inquiryId);
        if (cancelled) return;
        setAudit(found);
        setState(found ? "ready" : "none");
        if (found && auditInProgress(found.status)) timer = setTimeout(load, 10_000);
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

  if (state === "loading") return <p className={styles.muted}>Loading the audit…</p>;
  if (state === "error") return <p className={styles.muted}>Couldn’t load the audit.</p>;
  if (state === "none" || !audit) {
    return <p className={styles.muted}>A repeat request: this site was already audited in the last 30 days.</p>;
  }

  const facts = audit.facts;
  const site = facts?.site ?? null;
  const pages = site?.pages ?? [];
  const status = STATUS[audit.status];
  const noDescription = pages.filter((page) => !page.description).length;
  const thin = pages.filter((page) => page.words < 150).length;
  const missingAlt = pages.reduce((sum, page) => sum + page.imagesMissingAlt, 0);
  const places = Object.entries(site?.places ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className={styles.audit}>
      <div className={styles.head}>
        <Pill tone={status.tone}>{status.label}</Pill>
        <a href={audit.url} target="_blank" rel="noopener noreferrer" className={styles.site}>
          {audit.url.replace(/^https?:\/\//, "")}
        </a>
      </div>
      {audit.fail_reason && <p className={styles.fail}>{audit.fail_reason}</p>}

      {facts && (
        <>
          {facts.screenshot && (
            // eslint-disable-next-line @next/next/no-img-element -- a data URL from PageSpeed
            <img className={styles.shot} src={facts.screenshot} alt={`The home page of ${audit.url} on a phone`} />
          )}

          <p className={styles.group}>Speed</p>
          <Speed label="Phone" run={facts.speed.mobile} />
          <Speed label="Computer" run={facts.speed.desktop} />
          {facts.speed.mobile?.field?.overall && <Line label="Real visitors">{facts.speed.mobile.field.overall.toLowerCase()}</Line>}

          {site && (
            <>
              <p className={styles.group}>Google</p>
              <Line label="Built with">{site.platform ?? "not obvious"}</Line>
              <Line label="Pages read">
                {pages.length}
                {site.sitemap.found ? ` (sitemap lists ${site.sitemap.urls})` : " (no sitemap)"}
              </Line>
              <Line label="No description">{noDescription ? `${noDescription} of ${pages.length} pages` : "none"}</Line>
              <Line label="Thin pages">{thin ? `${thin} under 150 words` : "none"}</Line>
              <Line label="Images, no alt">{missingAlt || "none"}</Line>
              <Line label="Redirects">
                http {yesNo(site.redirects.http, "✓", "✗")} · www/bare {yesNo(site.redirects.otherHost, "✓", "✗")}
              </Line>
              <div className={styles.titles}>
                {pages.map((page) => (
                  <p key={page.url} title={page.url}>
                    <span>{page.title || "No title"}</span>
                    {page.noindex && <em> · noindex</em>}
                  </p>
                ))}
              </div>

              <p className={styles.group}>Local</p>
              <Line label="Places named">
                {places.length ? places.slice(0, 6).map(([name, count]) => `${name} ${count}`).join(" · ") : "none"}
              </Line>
              <Line label="Business data">
                {site.businessData ? `${site.businessData.name ?? "unnamed"}${site.businessData.address ? `, ${site.businessData.address}` : ""}` : "none"}
              </Line>
              <Line label="Phone on site">{site.phoneOnSite ?? "none found"}</Line>
              <Line label="Contact form">{site.contactForm ? "yes" : "none found"}</Line>
              {site.bookingLinks.length > 0 && <Line label="Booking">{site.bookingLinks.join(", ")}</Line>}
            </>
          )}

          {facts.profile?.found && (
            <>
              <p className={styles.group}>Google Business Profile</p>
              <Line label="Listing">
                {facts.profile.name} · {facts.profile.rating ?? "—"}★ ({facts.profile.reviews ?? 0})
              </Line>
              <Line label="Matches site">
                name {yesNo(facts.profile.nameMatches, "✓", "✗")} · address {yesNo(facts.profile.addressMatches, "✓", "✗")} · phone{" "}
                {yesNo(facts.profile.phoneMatches, "✓", "✗")}
              </Line>
            </>
          )}

          {facts.gaps.length > 0 && (
            <ul className={styles.gaps}>
              {facts.gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
