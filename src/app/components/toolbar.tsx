"use client";

import { useState } from "react";
import { HiOutlineFunnel, HiOutlineBarsArrowDown, HiMiniCheck, HiMiniMagnifyingGlass, HiMiniXMark } from "react-icons/hi2";
import styles from "./component-styles/toolbar.module.css";
import Button, { IconButton } from "./button";
import Popover from "./popover";

// A list page's controls. Pass only the parts the page needs: search, filter
// and sort each render when their prop is given.

export type ToolbarOption = { value: string; label: string };

export type ToolbarSearch = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export type ToolbarSort = {
  options: ToolbarOption[];
  value: string;
  onChange: (value: string) => void;
  /** the option that counts as "not sorted"; any other shows the dot */
  defaultValue?: string;
};

export type ToolbarFilterGroup = {
  key: string;
  label: string;
  options: ToolbarOption[];
};

export type ToolbarFilter = {
  groups: ToolbarFilterGroup[];
  /** selected values per group key; an empty list means "any" */
  value: Record<string, string[]>;
  onChange: (value: Record<string, string[]>) => void;
};

type ToolbarProps = {
  search?: ToolbarSearch;
  filter?: ToolbarFilter;
  sort?: ToolbarSort;
  className?: string;
};

export default function Toolbar({ search, filter, sort, className }: ToolbarProps) {
  const [openMenu, setOpenMenu] = useState<"filter" | "sort" | null>(null);
  const close = () => setOpenMenu(null);
  const toggle = (menu: "filter" | "sort") => setOpenMenu((m) => (m === menu ? null : menu));

  return (
    <div className={[styles.toolbar, className].filter(Boolean).join(" ")}>
      {search && <SearchField {...search} />}
      {filter && (
        <FilterMenu
          {...filter}
          open={openMenu === "filter"}
          onToggle={() => toggle("filter")}
          onClose={close}
        />
      )}
      {sort && (
        <SortMenu {...sort} open={openMenu === "sort"} onToggle={() => toggle("sort")} onClose={close} />
      )}
    </div>
  );
}

/* ---------------- Search ---------------- */

function SearchField({ value, onChange, placeholder = "Search" }: ToolbarSearch) {
  return (
    <label className={styles.search}>
      <HiMiniMagnifyingGlass size={16} aria-hidden="true" />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
      />
      {value && (
        <button type="button" className={styles.clearSearch} onClick={() => onChange("")} aria-label="Clear search">
          <HiMiniXMark size={14} />
        </button>
      )}
    </label>
  );
}

/* ---------------- Filter ---------------- */

type MenuState = { open: boolean; onToggle: () => void; onClose: () => void };

function FilterMenu({ groups, value, onChange, open, onToggle, onClose }: ToolbarFilter & MenuState) {
  const activeCount = Object.values(value).reduce((n, list) => n + list.length, 0);

  function toggleOption(groupKey: string, option: string) {
    const current = value[groupKey] ?? [];
    const next = current.includes(option) ? current.filter((v) => v !== option) : [...current, option];
    onChange({ ...value, [groupKey]: next });
  }

  return (
    <Popover
      open={open}
      onClose={onClose}
      label="Filter"
      trigger={
        <IconButton
          icon={<HiOutlineFunnel size={18} />}
          label={activeCount ? `Filter (${activeCount} on)` : "Filter"}
          indicator={activeCount > 0}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={onToggle}
        />
      }
    >
      <div className={styles.menu}>
        {groups.map((group) => (
          <div key={group.key} className={styles.group}>
            <span className={styles.groupLabel}>{group.label}</span>
            <div className={styles.chips}>
              {group.options.map((o) => {
                const on = (value[group.key] ?? []).includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                    aria-pressed={on}
                    onClick={() => toggleOption(group.key, o.value)}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {activeCount > 0 && (
          <div className={styles.menuFooter}>
            <Button variant="ghost" size="sm" onClick={() => onChange({})}>
              Clear filters
            </Button>
          </div>
        )}
      </div>
    </Popover>
  );
}

/* ---------------- Sort ---------------- */

function SortMenu({ options, value, onChange, defaultValue, open, onToggle, onClose }: ToolbarSort & MenuState) {
  const current = options.find((o) => o.value === value);
  const isDefault = value === (defaultValue ?? options[0]?.value);

  return (
    <Popover
      open={open}
      onClose={onClose}
      label="Sort"
      trigger={
        <IconButton
          icon={<HiOutlineBarsArrowDown size={18} />}
          label={current ? `Sort: ${current.label}` : "Sort"}
          indicator={!isDefault}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={onToggle}
        />
      }
    >
      <div className={styles.menu} role="radiogroup" aria-label="Sort by">
        <span className={styles.groupLabel}>Sort by</span>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`${styles.option} ${selected ? styles.optionOn : ""}`}
              onClick={() => {
                onChange(o.value);
                onClose();
              }}
            >
              {o.label}
              {selected && <HiMiniCheck size={16} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
