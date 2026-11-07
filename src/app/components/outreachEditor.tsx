"use client";

import { useEffect, useRef, useState } from "react";
import {
  HiMiniBolt,
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
import NotesTimeline from "./notesTimeline";
import { addNote } from "../../lib/notes";
import { addTask, type Task } from "../../lib/tasks";
import TaskList from "./taskList";
import { logActivity } from "../../lib/activity";
import SidePanel, { PanelCallout, PanelError, PanelFooter, PanelRow, PanelSection } from "./sidePanel";
import { useRouter } from "next/navigation";
import { embeddedLead, leadHref, leadStageLabel } from "../../lib/leads";
import { Dropdown, Field, TextArea, TextInput, type DropdownOption } from "./formFields";
import { ChannelIcon } from "./channelIcon";
import Button from "./button";
import DatePicker from "./datePicker";
import { supabase } from "../../lib/supabaseClient";
import {
  CHANNELS,
  INDUSTRIES,
  OBJECTIONS,
  OUTREACH_COLUMNS,
  STAGES,
  stageLabel,
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
  /** open the promote step for this business */
  onRequestPromote: (row: OutreachRow) => void;
  /** after a task changes, so the table's next step can follow */
  onTasksChange?: (outreachId: string, tasks: Task[]) => void;
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
  };
}

const orNull = (v: string | null) => (v && v.trim() ? v.trim() : null);

export default function OutreachEditor({
  open,
  row,
  onClose,
  onSaved,
  onRequestDelete,
  onRequestPromote,
  onTasksChange,
}: OutreachEditorProps) {
  const router = useRouter();
  const lead = embeddedLead(row?.leads);
  const nameRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<OutreachInput>(blankForm);
  const [saving, setSaving] = useState(false);
  // a new business's optional first note, saved to the notes timeline with it
  const [firstNote, setFirstNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset the form each time the panel opens
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const openKey = open ? row?.id ?? "new" : null;
  if (openKey !== openedFor) {
    setOpenedFor(openKey);
    if (openKey) {
      setForm(row ? formFromRow(row) : blankForm());
      setFirstNote("");
      setError(null);
    }
  }

  // new rows start typing straight away; edits don't pop the keyboard
  useEffect(() => {
    if (!open || row) return;
    const timer = window.setTimeout(() => nameRef.current?.focus(), 250);
    return () => window.clearTimeout(timer);
  }, [open, row]);

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

    // the next step isn't a column any more: a new business's becomes its first task
    const { next_step: firstTask, next_step_due: firstTaskDue, ...fields } = form;
    const payload = {
      ...fields,
      business_name: form.business_name.trim(),
      handle: orNull(form.handle),
      town: orNull(form.town),
      objection_reason: form.objection ? orNull(form.objection_reason) : null,
    };

    const query = row
      ? supabase.from("outreach").update(payload).eq("id", row.id)
      : supabase.from("outreach").insert(payload);
    const { data, error } = await query.select(OUTREACH_COLUMNS).single();

    if (error) {
      setSaving(false);
      setError(error.message);
      return;
    }
    const saved = data as OutreachRow;
    if (!row) {
      logActivity("outreach.added", `Messaged ${saved.business_name}`, { outreach_id: saved.id });
    } else if (row.stage !== saved.stage) {
      logActivity("outreach.stage", `${saved.business_name} moved to ${stageLabel(saved.stage)}`, {
        outreach_id: saved.id,
      });
    }

    if (!row) {
      // the business is saved either way; a task or note that fails can be added again from its panel
      const subject = { kind: "outreach" as const, id: saved.id };
      if (firstTask?.trim()) await addTask(subject, firstTask, firstTaskDue || null).catch(() => {});
      if (firstNote.trim()) await addNote(subject, firstNote).catch(() => {});
    }
    setSaving(false);
    onSaved(data as OutreachRow);
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={row ? "Edit outreach" : "Add outreach"}
      onSubmit={save}
      dismissible={!saving}
      footer={
        <PanelFooter
          start={
            <>
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
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
            </>
          }
        >
          <Button type="submit" variant="primary" busy={saving}>
            {saving ? "Saving…" : row ? "Save" : "Add"}
          </Button>
        </PanelFooter>
      }
    >
      {error && <PanelError>{error}</PanelError>}

      {/* An existing business can become a lead once they're interested */}
      {row &&
        (lead ? (
          <PanelCallout
            icon={<HiMiniBolt size={20} />}
            title={`A lead · ${leadStageLabel(lead.stage)}`}
            action={
              <Button size="sm" variant="primary" onClick={() => router.push(leadHref(lead.id))}>
                View lead
              </Button>
            }
          >
            Qualify and propose from the lead.
          </PanelCallout>
        ) : (
          <PanelCallout
            icon={<HiMiniBolt size={20} />}
            title="Interested?"
            action={
              <Button size="sm" variant="primary" onClick={() => onRequestPromote(row)} disabled={saving}>
                Promote to lead
              </Button>
            }
          >
            Make them a lead to qualify and send a proposal.
          </PanelCallout>
        ))}

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

      <PanelRow>
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
      </PanelRow>

      <PanelRow>
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
      </PanelRow>

      <PanelRow>
        <Field icon={<HiOutlineCalendarDays size={16} />} label="First messaged" htmlFor="outreach-first">
          <DatePicker
            id="outreach-first"
            value={form.first_contacted_on}
            max={todayISO()}
            onChange={(v) => update("first_contacted_on", v ?? todayISO())}
          />
        </Field>
        <Field icon={<HiOutlineFlag size={16} />} label="Stage" htmlFor="outreach-stage">
          <Dropdown
            id="outreach-stage"
            value={form.stage}
            // "Lead" is set by promoting, so it's only listed when the business already is one
            options={STAGES.filter((s) => s.value !== "converted" || form.stage === "converted")}
            onChange={(v) => update("stage", v)}
          />
        </Field>
      </PanelRow>

      <PanelSection>
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
      </PanelSection>

      {/* An existing business has its task list; a new one starts it with a next step */}
      {row ? (
        <PanelSection>
          <Field icon={<HiOutlineArrowRightCircle size={16} />} label="Tasks">
            <TaskList
              subject={{ kind: "outreach", id: row.id }}
              onChange={(tasks) => onTasksChange?.(row.id, tasks)}
            />
          </Field>
        </PanelSection>
      ) : (
      <PanelSection>
        <PanelRow wide>
          <Field icon={<HiOutlineArrowRightCircle size={16} />} label="Next step" htmlFor="outreach-next">
            <TextInput
              id="outreach-next"
              placeholder="e.g. Send mock-up"
              value={form.next_step ?? ""}
              onChange={(e) => update("next_step", e.target.value)}
            />
          </Field>
          <Field icon={<HiOutlineClock size={16} />} label="Due" htmlFor="outreach-due">
            <DatePicker
              id="outreach-due"
              value={form.next_step_due}
              onChange={(v) => update("next_step_due", v)}
              placeholder="No date"
              clearable
              align="end"
            />
          </Field>
        </PanelRow>
      </PanelSection>
      )}

      {/* An existing business has the notes timeline; a new one can start it with a first note */}
      {row ? (
        <PanelSection>
          <Field icon={<HiOutlinePaperClip size={16} />} label="Notes">
            <NotesTimeline subject={{ kind: "outreach", id: row.id }} />
          </Field>
        </PanelSection>
      ) : (
        <Field icon={<HiOutlinePaperClip size={16} />} label="First note" htmlFor="outreach-first-note">
          <TextArea
            id="outreach-first-note"
            rows={3}
            placeholder="Anything worth remembering (optional)"
            value={firstNote}
            onChange={(e) => setFirstNote(e.target.value)}
          />
        </Field>
      )}
    </SidePanel>
  );
}
