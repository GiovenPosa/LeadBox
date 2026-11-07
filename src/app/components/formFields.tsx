"use client";

import { useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
import { HiMiniCheck } from "react-icons/hi2";
import styles from "./component-styles/formFields.module.css";
import Popover from "./popover";

// The app's form controls: a labelled field (with an optional icon) and the
// inputs that go in it. Used by the lead qualification form and the outreach
// editor, so both look and focus the same way.

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

type FieldProps = {
  label: string;
  icon?: ReactNode;
  /** the control's id; leave it out for a group of buttons, like chips */
  htmlFor?: string;
  className?: string;
  children: ReactNode;
};

export function Field({ label, icon, htmlFor, className, children }: FieldProps) {
  const LabelTag = htmlFor ? "label" : "span";
  return (
    <div className={cx(styles.field, className)}>
      <LabelTag className={styles.label} htmlFor={htmlFor}>
        {icon}
        {label}
      </LabelTag>
      {children}
    </div>
  );
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cx(styles.control, className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cx(styles.control, styles.select, className)} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(styles.control, styles.textarea, className)} />;
}

/* ---------------- Dropdown ---------------- */

export type DropdownOption<T extends string = string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Combobox: extra text the search matches, e.g. an email */
  keywords?: string;
  /** Combobox: always listed, whatever the search (e.g. "New contact") */
  pinned?: boolean;
};

type DropdownProps<T extends string> = {
  id: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
};

/** A select that opens the app's popover, so options can carry icons */
export function Dropdown<T extends string>({
  id,
  value,
  options,
  onChange,
  placeholder = "Select",
  disabled,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];
  const optionId = (i: number) => `${id}-option-${i}`;

  function show() {
    setActive(Math.max(selectedIndex, 0));
    setOpen(true);
  }

  function choose(i: number) {
    onChange(options[i].value);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
    } else if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      if (active >= 0) choose(active);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      block
      matchWidth
      role={null}
      trigger={
        <button
          type="button"
          id={id}
          className={cx(styles.control, styles.select, styles.dropdown)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : show())}
          onKeyDown={onKeyDown}
        >
          {selected?.icon && <span className={styles.optionIcon}>{selected.icon}</span>}
          <span className={selected ? styles.dropdownValue : styles.dropdownPlaceholder}>
            {selected?.label ?? placeholder}
          </span>
        </button>
      }
    >
      <ul id={`${id}-listbox`} role="listbox" className={styles.listbox} aria-labelledby={id}>
        {options.map((o, i) => {
          const isSelected = i === selectedIndex;
          return (
            <li
              key={o.value}
              id={optionId(i)}
              role="option"
              aria-selected={isSelected}
              className={cx(styles.option, i === active && styles.optionActive, isSelected && styles.optionSelected)}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(i)}
            >
              {o.icon && <span className={styles.optionIcon}>{o.icon}</span>}
              <span className={styles.optionLabel}>{o.label}</span>
              {isSelected && <HiMiniCheck size={16} className={styles.optionCheck} aria-hidden="true" />}
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}

/* ---------------- Combobox ---------------- */

type ComboboxProps<T extends string> = DropdownProps<T> & {
  /** shown in the list when the search matches nothing */
  emptyText?: string;
};

/**
 * A Dropdown you can type into to search its options (the WAI-ARIA combobox
 * pattern). The field shows the chosen option; focusing it lets you search.
 */
export function Combobox<T extends string>({
  id,
  value,
  options,
  onChange,
  placeholder = "Search",
  emptyText = "No matches",
  disabled,
}: ComboboxProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = options.find((o) => o.value === value);
  const optionId = (i: number) => `${id}-option-${i}`;

  const q = query.trim().toLowerCase();
  const shown = q
    ? options.filter((o) => o.pinned || `${o.label} ${o.keywords ?? ""}`.toLowerCase().includes(q))
    : options;

  function show() {
    if (open) return;
    setQuery("");
    setActive(Math.max(options.findIndex((o) => o.value === value), 0));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  function choose(option: DropdownOption<T>) {
    onChange(option.value);
    close();
  }

  function search(text: string) {
    setQuery(text);
    setOpen(true);
    // land on the first real match, not a pinned option
    const next = text.trim().toLowerCase();
    const list = next
      ? options.filter((o) => o.pinned || `${o.label} ${o.keywords ?? ""}`.toLowerCase().includes(next))
      : options;
    const firstMatch = list.findIndex((o) => !o.pinned);
    setActive(next && firstMatch >= 0 ? firstMatch : 0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      if (!shown.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + shown.length) % shown.length);
    } else if (e.key === "Enter") {
      // never submit the form from here
      e.preventDefault();
      if (open && shown[active]) choose(shown[active]);
      else show();
    } else if (e.key === "Escape" && open) {
      // closes the list only, not the panel it sits in
      e.nativeEvent.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      close();
    }
  }

  return (
    <Popover
      open={open}
      onClose={close}
      block
      matchWidth
      role={null}
      trigger={
        <div
          className={cx(styles.control, styles.select, styles.combobox, disabled && styles.comboboxDisabled)}
          onClick={() => {
            inputRef.current?.focus();
            show();
          }}
        >
          {!open && selected?.icon && <span className={styles.optionIcon}>{selected.icon}</span>}
          <input
            ref={inputRef}
            id={id}
            className={styles.comboboxInput}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-listbox`}
            aria-autocomplete="list"
            aria-activedescendant={open && shown[active] ? optionId(active) : undefined}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            value={open ? query : selected?.label ?? ""}
            placeholder={open ? selected?.label ?? placeholder : placeholder}
            onFocus={show}
            onChange={(e) => search(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
      }
    >
      <ul id={`${id}-listbox`} role="listbox" className={styles.listbox} aria-labelledby={id}>
        {shown.map((o, i) => {
          const isSelected = o.value === value;
          return (
            <li
              key={o.value}
              id={optionId(i)}
              role="option"
              aria-selected={isSelected}
              className={cx(styles.option, i === active && styles.optionActive, isSelected && styles.optionSelected)}
              onPointerEnter={() => setActive(i)}
              // keep focus in the field, so the list doesn't close before the click lands
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
            >
              {o.icon && <span className={styles.optionIcon}>{o.icon}</span>}
              <span className={styles.optionLabel}>{o.label}</span>
              {isSelected && <HiMiniCheck size={16} className={styles.optionCheck} aria-hidden="true" />}
            </li>
          );
        })}
        {!shown.some((o) => !o.pinned) && q && <li className={styles.comboboxEmpty}>{emptyText}</li>}
      </ul>
    </Popover>
  );
}
