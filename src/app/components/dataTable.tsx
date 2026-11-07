import type { KeyboardEvent, ReactNode } from "react";
import styles from "./component-styles/dataTable.module.css";

// The app's list view: a table on desktop and, when renderCard is given, a
// stack of cards on phones. The switch is pure CSS, so it renders the same on
// the server. Rows are clickable when onRowClick is given.

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** secondary text that doesn't wrap, for short labels like an industry */
  muted?: boolean;
  /** numbers line up on the right */
  align?: "start" | "end";
  className?: string;
  /** what DataTableSkeleton draws in this column while loading (default: a line of text) */
  skeleton?: SkeletonCell;
};

/** avatar: an avatar and two lines · title: two lines · pill: a status pill · number: a short value */
export type SkeletonCell = "avatar" | "title" | "pill" | "number" | "text";

type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** the phone layout; without it the table scrolls sideways on phones */
  renderCard?: (row: T) => ReactNode;
  /** below this width the table scrolls sideways instead of squashing */
  minWidth?: number;
  className?: string;
};

export default function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  renderCard,
  minWidth = 860,
  className,
}: DataTableProps<T>) {
  // Clickable rows act like buttons for the keyboard too
  const rowProps = (row: T) =>
    onRowClick
      ? {
          tabIndex: 0,
          onClick: () => onRowClick(row),
          onKeyDown: (e: KeyboardEvent) => {
            // a link inside the row handles its own keys
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onRowClick(row);
            }
          },
        }
      : {};

  return (
    // fades in softly when it replaces its skeleton (globals.css)
    <div className={cx("blur-in-soft", className)}>
      <div className={cx(styles.tableWrap, renderCard && styles.desktopOnly)}>
        <table className={styles.table} style={{ minWidth }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={cx(col.align === "end" && styles.alignEnd)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className={cx(onRowClick && styles.clickable)} {...rowProps(row)}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cx(col.muted && styles.muted, col.align === "end" && styles.alignEnd, col.className)}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {renderCard && (
        <div className={styles.cardList}>
          {rows.map((row) => (
            <article
              key={rowKey(row)}
              className={cx(styles.card, onRowClick && styles.clickable)}
              role={onRowClick ? "button" : undefined}
              {...rowProps(row)}
            >
              {renderCard(row)}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/** An empty cell: a quiet dash, so gaps read as "nothing" rather than "broken" */
export function EmptyCell() {
  return <span className={styles.empty}>—</span>;
}

/** A bold title with a quieter line under it, e.g. a name and an email, with an optional avatar in front */
export function TitleCell({ title, sub, avatar }: { title: ReactNode; sub?: ReactNode; avatar?: ReactNode }) {
  const text = (
    <div className={styles.titleCell}>
      <span className={styles.title}>{title}</span>
      {sub && <span className={styles.sub}>{sub}</span>}
    </div>
  );
  if (!avatar) return text;
  return (
    <div className={styles.withAvatar}>
      {avatar}
      {text}
    </div>
  );
}

/** The top row of a phone card: the title on the left, a pill or action on the right */
export function CardTop({ children }: { children: ReactNode }) {
  return <div className={styles.cardTop}>{children}</div>;
}

/** A line of secondary details on a phone card */
export function CardMeta({ children }: { children: ReactNode }) {
  return <p className={styles.cardMeta}>{children}</p>;
}

/** A divided footer section on a phone card */
export function CardFooter({ children }: { children: ReactNode }) {
  return <div className={styles.cardFooter}>{children}</div>;
}

/* ---------------- Loading skeleton ---------------- */

// varied widths, the same every render, so the rows look like real data
const WIDTHS = [72, 54, 86, 63, 78, 48, 68, 58];

/**
 * The table's shape while it loads: the real column headers over shimmering
 * rows (cards on phones), so nothing jumps when the data arrives.
 */
export function DataTableSkeleton<T>({
  columns,
  rows = 6,
  minWidth = 860,
  cards = true,
}: {
  columns: DataTableColumn<T>[];
  rows?: number;
  minWidth?: number;
  /** show skeleton cards on phones, for a table that has renderCard */
  cards?: boolean;
}) {
  const hasAvatar = columns.some((c) => c.skeleton === "avatar");

  return (
    // fades in, as it only appears once a load is slow (useDelayedFlag)
    <div className="fade-in" aria-busy="true" aria-label="Loading">
      <div className={cx(styles.tableWrap, styles.skeleton, cards && styles.desktopOnly)} aria-hidden="true">
        <table className={styles.table} style={{ minWidth }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={cx(col.align === "end" && styles.alignEnd)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, row) => (
              <tr key={row}>
                {columns.map((col, i) => (
                  <td key={col.key} className={cx(col.align === "end" && styles.alignEnd)}>
                    <SkeletonBars kind={col.skeleton ?? "text"} width={WIDTHS[(row + i * 3) % WIDTHS.length]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cards && (
        <div className={cx(styles.cardList, styles.skeleton)} aria-hidden="true">
          {Array.from({ length: Math.min(rows, 4) }, (_, row) => (
            <div key={row} className={styles.card}>
              <div className={styles.cardTop}>
                <SkeletonBars kind={hasAvatar ? "avatar" : "title"} width={WIDTHS[row % WIDTHS.length]} />
                <span className={cx(styles.bar, styles.pillBar)} />
              </div>
              <span className={styles.bar} style={{ width: WIDTHS[(row + 3) % WIDTHS.length] * 2.4 }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonBars({ kind, width }: { kind: SkeletonCell; width: number }) {
  if (kind === "pill") return <span className={cx(styles.bar, styles.pillBar)} />;
  if (kind === "number") return <span className={cx(styles.bar, styles.numberBar)} />;
  const lines = (
    <span className={styles.barStack}>
      {/* pixel widths: an empty cell is narrow, so a percentage would be tiny */}
      <span className={cx(styles.bar, kind !== "text" && styles.titleBar)} style={{ width: width * 1.6 }} />
      {kind !== "text" && <span className={cx(styles.bar, styles.subBar)} style={{ width: (width - 12) * 1.6 }} />}
    </span>
  );
  if (kind !== "avatar") return lines;
  return (
    <span className={styles.withAvatar}>
      <span className={styles.avatarBar} />
      {lines}
    </span>
  );
}
