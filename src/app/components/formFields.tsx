"use client";

import { useState, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
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
