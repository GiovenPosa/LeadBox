import styles from "../(dashboard)/homePage.module.css";

// The filter pills under a page header: a count and a label, one of them on.
// They render straight away; counts show 0 until the data arrives.

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

type StatPillProps = {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  /** extra class for the pill, e.g. a status colour */
  className?: string;
  /** extra class for the count, e.g. red when something's due */
  valueClassName?: string;
};

export function StatPill({ label, value, active, onClick, className, valueClassName }: StatPillProps) {
  return (
    <button
      type="button"
      className={cx(styles.statCard, active && styles.statCardActive, className)}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className={cx(styles.statValue, valueClassName)}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </button>
  );
}

// varied widths, so the placeholders read like real labels
const WIDTHS = [96, 72, 120, 84];

/** Placeholder pills, for pills whose labels come from the data (e.g. industries) */
export function StatPillsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cx(styles.statCard, styles.statCardSkeleton, "fade-in")}
          style={{ width: WIDTHS[i % WIDTHS.length] }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
