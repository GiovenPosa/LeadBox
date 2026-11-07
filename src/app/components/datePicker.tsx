"use client";

import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { HiMiniChevronLeft, HiMiniChevronRight, HiOutlineCalendarDays } from "react-icons/hi2";
import formStyles from "./component-styles/formFields.module.css";
import styles from "./component-styles/datePicker.module.css";
import Popover from "./popover";
import Button from "./button";
import { useMediaQuery } from "../hooks/useMediaQuery";

// A date field that opens a month calendar in the app's popover, in place of
// the browser's own date input. Values are plain "YYYY-MM-DD" strings, the same
// as a native date input and a Postgres date column.
//
// Keyboard (the WAI-ARIA date picker dialog pattern): arrows move a day or a
// week, Home/End go to the start or end of the week, PageUp/PageDown move a
// month (with Shift, a year), Enter or Space picks, Escape closes.

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

/* ---------------- date helpers (local time, no timezone drift) ---------------- */

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const today = () => toISO(new Date());

function addDays(iso: string, days: number): string {
  const d = parse(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

// 31 Jan + 1 month lands on 28/29 Feb, not 3 Mar
function addMonths(iso: string, months: number): string {
  const d = parse(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toISO(d);
}

/** 0 = Monday ... 6 = Sunday; UK weeks start on Monday */
const weekday = (iso: string) => (parse(iso).getDay() + 6) % 7;

const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);

/** Six full weeks from the Monday on or before the 1st, so the height never jumps */
function monthGrid(iso: string): string[] {
  const first = `${iso.slice(0, 7)}-01`;
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

const WEEKDAYS = [
  ["Mo", "Monday"],
  ["Tu", "Tuesday"],
  ["We", "Wednesday"],
  ["Th", "Thursday"],
  ["Fr", "Friday"],
  ["Sa", "Saturday"],
  ["Su", "Sunday"],
];

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Wed 4 Nov", with the year when it isn't this one. Built by hand rather than
// with toLocaleDateString, whose output differs between Node and browsers and
// would break hydration.
const formatValue = (iso: string) => {
  const d = parse(iso);
  const year = d.getFullYear() === new Date().getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}${year}`;
};

const formatMonth = (iso: string) =>
  parse(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

const formatFull = (iso: string) =>
  parse(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/* ---------------- DatePicker ---------------- */

type DatePickerProps = {
  id: string;
  /** "YYYY-MM-DD", or null for no date */
  value: string | null;
  onChange: (value: string | null) => void;
  /** earliest and latest pickable days, "YYYY-MM-DD" */
  min?: string;
  max?: string;
  placeholder?: string;
  /** show a Clear button, for optional dates */
  clearable?: boolean;
  disabled?: boolean;
  /** which edge of the field the calendar lines up with */
  align?: "start" | "end";
};

export default function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = "Pick a date",
  clearable = false,
  disabled,
  align = "start",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  // the day with keyboard focus; its month is the one on show
  const [focused, setFocused] = useState(() => value ?? today());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // move focus onto the focused day only when the keyboard or opening asked
  // for it, so clicking the month arrows leaves focus on the arrow
  const focusDayRef = useRef(false);

  const inRange = (iso: string) => (!min || iso >= min) && (!max || iso <= max);
  const clamp = (iso: string) => (min && iso < min ? min : max && iso > max ? max : iso);

  useEffect(() => {
    if (!open || !focusDayRef.current) return;
    focusDayRef.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [open, focused]);

  function show() {
    setFocused(clamp(value ?? today()));
    focusDayRef.current = true;
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function pick(iso: string | null) {
    onChange(iso);
    close(true);
  }

  function moveTo(iso: string) {
    focusDayRef.current = true;
    setFocused(clamp(iso));
  }

  function onGridKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, (d: string) => string> = {
      ArrowLeft: (d) => addDays(d, -1),
      ArrowRight: (d) => addDays(d, 1),
      ArrowUp: (d) => addDays(d, -7),
      ArrowDown: (d) => addDays(d, 7),
      Home: (d) => addDays(d, -weekday(d)),
      End: (d) => addDays(d, 6 - weekday(d)),
      PageUp: (d) => addMonths(d, e.shiftKey ? -12 : -1),
      PageDown: (d) => addMonths(d, e.shiftKey ? 12 : 1),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    moveTo(move(focused));
  }

  // Escape closes only the calendar, not the panel or sheet it sits in
  function onDialogKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Escape") return;
    e.nativeEvent.stopPropagation();
    close(true);
  }

  // tabbing out of the calendar closes it; outside clicks are the popover's job
  function onDialogBlur(e: FocusEvent<HTMLDivElement>) {
    const next = e.relatedTarget as Node | null;
    if (next && !e.currentTarget.contains(next) && next !== triggerRef.current) close(false);
  }

  const todayISO = today();
  const tomorrowISO = addDays(todayISO, 1);
  const days = monthGrid(focused);
  const titleId = `${id}-title`;

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      id={id}
      className={cx(formStyles.control, styles.trigger)}
      aria-haspopup="dialog"
      aria-expanded={open}
      disabled={disabled}
      onClick={() => (open ? close(false) : show())}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" && !open) {
          e.preventDefault();
          show();
        }
      }}
    >
      <span className={value ? styles.value : styles.placeholder}>
        {value ? formatValue(value) : placeholder}
      </span>
      <HiOutlineCalendarDays size={16} className={styles.triggerIcon} aria-hidden="true" />
    </button>
  );

  const calendar = (
    <div
      className={styles.calendar}
      role="dialog"
      aria-modal={isMobile}
      aria-labelledby={titleId}
      onKeyDown={onDialogKeyDown}
      onBlur={onDialogBlur}
    >
      <div className={styles.header}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => setFocused(clamp(addMonths(focused, -1)))}
          disabled={!!min && addMonths(focused, -1).slice(0, 7) < min.slice(0, 7)}
          aria-label="Previous month"
        >
          <HiMiniChevronLeft size={18} />
        </button>
        <h3 id={titleId} className={styles.title} aria-live="polite">
          {formatMonth(focused)}
        </h3>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => setFocused(clamp(addMonths(focused, 1)))}
          disabled={!!max && addMonths(focused, 1).slice(0, 7) > max.slice(0, 7)}
          aria-label="Next month"
        >
          <HiMiniChevronRight size={18} />
        </button>
      </div>

      <div ref={gridRef} role="grid" aria-labelledby={titleId} className={styles.grid} onKeyDown={onGridKeyDown}>
        <div role="row" className={styles.row}>
          {WEEKDAYS.map(([short, full]) => (
            <span key={full} role="columnheader" aria-label={full} className={styles.weekday}>
              {short}
            </span>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, week) => (
          <div key={week} role="row" className={styles.row}>
            {days.slice(week * 7, week * 7 + 7).map((iso) => {
              const isSelected = iso === value;
              return (
                <span key={iso} role="gridcell" aria-selected={isSelected}>
                  <button
                    type="button"
                    data-date={iso}
                    tabIndex={iso === focused ? 0 : -1}
                    className={cx(
                      styles.day,
                      !sameMonth(iso, focused) && styles.outside,
                      iso === todayISO && styles.today,
                      isSelected && styles.selected
                    )}
                    aria-label={formatFull(iso)}
                    aria-current={iso === todayISO ? "date" : undefined}
                    disabled={!inRange(iso)}
                    onClick={() => pick(iso)}
                    onFocus={() => iso !== focused && setFocused(iso)}
                  >
                    {parse(iso).getDate()}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        {clearable && value ? (
          <Button variant="ghostDanger" size="sm" onClick={() => pick(null)}>
            Clear
          </Button>
        ) : (
          <span />
        )}
        <div className={styles.shortcuts}>
          <Button variant="ghost" size="sm" onClick={() => pick(todayISO)} disabled={!inRange(todayISO)}>
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={() => pick(tomorrowISO)} disabled={!inRange(tomorrowISO)}>
            Tomorrow
          </Button>
        </div>
      </div>
    </div>
  );

  // Phones: a full-width sheet that slides up over the page, like the
  // confirm dialog. It stays mounted so it can slide back down. (isMobile is
  // only ever true in the browser, so the portal never renders on the server.)
  if (isMobile) {
    return (
      <>
        {trigger}
        {createPortal(
          <>
            <div
              className={cx(styles.backdrop, open && styles.backdropVisible)}
              onClick={() => close(false)}
              aria-hidden="true"
            />
            <div className={cx(styles.sheet, open && styles.sheetOpen)} inert={!open}>
              <span className={styles.grabber} aria-hidden="true" />
              {calendar}
            </div>
          </>,
          document.body
        )}
      </>
    );
  }

  return (
    <Popover open={open} onClose={() => setOpen(false)} block align={align} role={null} trigger={trigger}>
      {calendar}
    </Popover>
  );
}
