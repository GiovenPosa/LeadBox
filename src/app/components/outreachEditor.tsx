"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  HiXMark,
  HiOutlineTrash,
  HiOutlineBuildingOffice2,
  HiOutlineTag,
  HiOutlineChatBubbleLeftRight,
  HiOutlineAtSymbol,
  HiOutlineMapPin,
  HiOutlineCalendarDays,
  HiOutlineFlag,
  HiOutlineHandRaised,
  HiOutlineChatBubbleBottomCenterText,
  HiOutlineArrowRightCircle,
  HiOutlineClock,
  HiOutlinePaperClip,
} from "react-icons/hi2";
import styles from "./component-styles/outreachEditor.module.css";
import { Dropdown, Field, TextArea, TextInput, type DropdownOption } from "./formFields";
import { ChannelIcon } from "./channelIcon";
import Button from "./button";
import { supabase } from "../../lib/supabaseClient";
import {
  CHANNELS,
  INDUSTRIES,
  OBJECTIONS,
  OUTREACH_COLUMNS,
  STAGES,
  todayISO,
  type Channel,
  type Objection,
  type OutreachInput,
  type OutreachRow,
} from "../../lib/outreach";

type OutreachEditorProps = {
  open: boolean;
  /** the row to edit, or null to add a new one */
  row: OutreachRow | null;
  onClose: () => void;
  onSaved: (row: OutreachRow) => void;
  onRequestDelete: (row: OutreachRow) => void;
};

// Channels show their icon in the dropdown
const CHANNEL_OPTIONS: DropdownOption<Channel>[] = CHANNELS.map((c) => ({
  ...c,
  icon: <ChannelIcon channel={c.value} />,
}));

const OBJECTION_OPTIONS: DropdownOption<Objection | "">[] = [{ value: "", label: "None" }, ...OBJECTIONS];

// A new row starts as a DM sent today, with the playbook's follow-up in 5 days
function blankForm(): OutreachInput {
  return {
    business_name: "",
    industry: "salons",
    channel: "instagram",
    handle: "",
    town: "",
    first_contacted_on: todayISO(),
    stage: "messaged",
    objection: null,
    objection_reason: "",
    next_step: "Follow up if no reply",
    next_step_due: todayISO(5),
    notes: "",
  };
}

function formFromRow(row: OutreachRow): OutreachInput {
  return {
    business_name: row.business_name,
    industry: row.industry,
    channel: row.channel,
    handle: row.handle ?? "",
    town: row.town ?? "",
    first_contacted_on: row.first_contacted_on,
    stage: row.stage,
    objection: row.objection,
    objection_reason: row.objection_reason ?? "",
    next_step: row.next_step ?? "",
    next_step_due: row.next_step_due,
    notes: row.notes ?? "",
  };
}

const orNull = (v: string | null) => (v && v.trim() ? v.trim() : null);

const subscribeNoop = () => () => {};

export default function OutreachEditor({
  open,
  row,
  onClose,
  onSaved,
  onRequestDelete,
}: OutreachEditorProps) {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<OutreachInput>(blankForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form each time the panel opens
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const openKey = open ? row?.id ?? "new" : null;
  if (openKey !== openedFor) {
    setOpenedFor(openKey);
    if (openKey) {
      setForm(row ? formFromRow(row) : blankForm());
      setError(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    // new rows start typing straight away; edits don't pop the keyboard
    if (!row) window.setTimeout(() => nameRef.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, row, saving, onClose]);

  function update<K extends keyof OutreachInput>(key: K, value: OutreachInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.business_name.trim()) {
      setError("Add the business name.");
      nameRef.current?.focus();
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      ...form,
      business_name: form.business_name.trim(),
      handle: orNull(form.handle),
      town: orNull(form.town),
      objection_reason: form.objection ? orNull(form.objection_reason) : null,
      next_step: orNull(form.next_step),
      next_step_due: form.next_step_due || null,
      notes: orNull(form.notes),
    };

    const query = row
      ? supabase.from("outreach").update(payload).eq("id", row.id)
      : supabase.from("outreach").insert(payload);
    const { data, error } = await query.select(OUTREACH_COLUMNS).single();

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved(data as OutreachRow);
  }

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropVisible : ""}`}
        onClick={() => !saving && onClose()}
        aria-hidden="true"
      />
      <div
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!open}
      >
        <form className={styles.form} onSubmit={save} noValidate>
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {row ? "Edit outreach" : "Add outreach"}
            </h2>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <HiXMark size={22} />
            </button>
          </header>

          <div className={styles.body}>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <Field icon={<HiOutlineBuildingOffice2 size={16} />} label="Business" htmlFor="outreach-name">
              <TextInput
                ref={nameRef}
                id="outreach-name"
                placeholder="e.g. USA Nails"
                value={form.business_name}
                onChange={(e) => update("business_name", e.target.value)}
                autoComplete="off"
                required
              />
            </Field>

            <div className={styles.row}>
              <Field icon={<HiOutlineTag size={16} />} label="Industry" htmlFor="outreach-industry">
                <Dropdown
                  id="outreach-industry"
                  value={form.industry}
                  options={INDUSTRIES}
                  onChange={(v) => update("industry", v)}
                />
              </Field>
              <Field icon={<HiOutlineChatBubbleLeftRight size={16} />} label="Channel" htmlFor="outreach-channel">
                <Dropdown
                  id="outreach-channel"
                  value={form.channel}
                  options={CHANNEL_OPTIONS}
                  onChange={(v) => update("channel", v)}
                />
              </Field>
            </div>

            <div className={styles.row}>
              <Field icon={<HiOutlineAtSymbol size={16} />} label="Handle or link" htmlFor="outreach-handle">
                <TextInput
                  id="outreach-handle"
                  placeholder="@usanails"
                  value={form.handle ?? ""}
                  onChange={(e) => update("handle", e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                />
              </Field>
              <Field icon={<HiOutlineMapPin size={16} />} label="Town" htmlFor="outreach-town">
                <TextInput
                  id="outreach-town"
                  placeholder="Trowbridge"
                  value={form.town ?? ""}
                  onChange={(e) => update("town", e.target.value)}
                />
              </Field>
            </div>

            <div className={styles.row}>
              <Field icon={<HiOutlineCalendarDays size={16} />} label="First messaged" htmlFor="outreach-first">
                <TextInput
                  id="outreach-first"
                  type="date"
                  value={form.first_contacted_on}
                  max={todayISO()}
                  onChange={(e) => update("first_contacted_on", e.target.value || todayISO())}
                />
              </Field>
              <Field icon={<HiOutlineFlag size={16} />} label="Stage" htmlFor="outreach-stage">
                <Dropdown
                  id="outreach-stage"
                  value={form.stage}
                  options={STAGES}
                  onChange={(v) => update("stage", v)}
                />
              </Field>
            </div>

            <div className={styles.section}>
              <Field icon={<HiOutlineHandRaised size={16} />} label="Objection" htmlFor="outreach-objection">
                <Dropdown
                  id="outreach-objection"
                  value={form.objection ?? ""}
                  options={OBJECTION_OPTIONS}
                  onChange={(v) => update("objection", v || null)}
                />
              </Field>
              {form.objection && (
                <Field icon={<HiOutlineChatBubbleBottomCenterText size={16} />} label="What they said" htmlFor="outreach-reason">
                  <TextArea
                    id="outreach-reason"
                    rows={2}
                    placeholder="e.g. Happy with Fresha, gets most clients from Instagram"
                    value={form.objection_reason ?? ""}
                    onChange={(e) => update("objection_reason", e.target.value)}
                  />
                </Field>
              )}
            </div>

            <div className={styles.section}>
              <div className={styles.rowWide}>
                <Field icon={<HiOutlineArrowRightCircle size={16} />} label="Next step" htmlFor="outreach-next">
                  <TextInput
                    id="outreach-next"
                    placeholder="e.g. Send mock-up"
                    value={form.next_step ?? ""}
                    onChange={(e) => update("next_step", e.target.value)}
                  />
                </Field>
                <Field icon={<HiOutlineClock size={16} />} label="Due" htmlFor="outreach-due">
                  <TextInput
                    id="outreach-due"
                    type="date"
                    value={form.next_step_due ?? ""}
                    onChange={(e) => update("next_step_due", e.target.value || null)}
                  />
                </Field>
              </div>
            </div>

            <Field icon={<HiOutlinePaperClip size={16} />} label="Notes" htmlFor="outreach-notes">
              <TextArea
                id="outreach-notes"
                rows={3}
                placeholder="Anything worth remembering"
                value={form.notes ?? ""}
                onChange={(e) => update("notes", e.target.value)}
              />
            </Field>
          </div>

          {/* Cancel on the left; Delete (when editing) and the main action on the right */}
          <footer className={styles.footer}>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <div className={styles.footerActions}>
              {row && (
                <Button
                  variant="ghostDanger"
                  icon={<HiOutlineTrash size={18} />}
                  onClick={() => onRequestDelete(row)}
                  disabled={saving}
                >
                  Delete
                </Button>
              )}
              <Button type="submit" variant="primary" busy={saving}>
                {saving ? "Saving…" : row ? "Save" : "Add"}
              </Button>
            </div>
          </footer>
        </form>
      </div>
    </>,
    document.body
  );
}
