"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  HiMiniBolt,
  HiMiniArrowRight,
  HiOutlineTrash,
  HiOutlineFlag,
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineChatBubbleBottomCenterText,
  HiOutlineCube,
  HiOutlineCurrencyPound,
  HiOutlineTag,
  HiOutlineWindow,
  HiOutlinePencilSquare,
} from "react-icons/hi2";
import styles from "./component-styles/enquiryPanel.module.css";
import SidePanel, { PanelError, PanelFooter, PanelRow, PanelSection } from "./sidePanel";
import { Dropdown, Field, type DropdownOption } from "./formFields";
import Button from "./button";
import Pill from "./pill";
import NotesTimeline from "./notesTimeline";
import type { BookingInquiry, OpportunityStatus } from "./inquiryCard";
import { embeddedLead, leadHref, leadStageLabel, leadStageTone, packageLabel } from "../../lib/leads";

// An enquiry, opened from its Inbox card: everything they sent, its status,
// and the step that turns it into a lead.

type EnquiryPanelProps = {
  /** the enquiry to show, or null when the panel is closed */
  inquiry: BookingInquiry | null;
  onClose: () => void;
  onStatusChange: (id: string, status: OpportunityStatus) => void;
  /** resolves once the lead is saved */
  onConvert: (id: string) => Promise<void>;
  /** asks first, with the confirm dialog */
  onRequestDelete: (id: string) => void;
};

// Converted isn't picked here: Turn into lead sets it
const STATUS_OPTIONS: DropdownOption<OpportunityStatus>[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "bad", label: "Bad" },
];

function formatBudget(budget: number) {
  return budget >= 1000 ? `£${(budget / 1000).toFixed(budget % 1000 === 0 ? 0 : 1)}k` : `£${budget}`;
}

const formatReceived = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function EnquiryPanel({
  inquiry,
  onClose,
  onStatusChange,
  onConvert,
  onRequestDelete,
}: EnquiryPanelProps) {
  const router = useRouter();
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep showing the last enquiry while the panel slides closed
  const [shown, setShown] = useState(inquiry);
  if (inquiry && inquiry !== shown) setShown(inquiry);

  // A different enquiry starts without the last one's error
  const [shownId, setShownId] = useState(inquiry?.id);
  if (inquiry && inquiry.id !== shownId) {
    setShownId(inquiry.id);
    setError(null);
  }

  const open = inquiry !== null;
  const lead = embeddedLead(shown?.leads);

  async function convert() {
    if (!shown) return;
    setConverting(true);
    setError(null);
    try {
      await onConvert(shown.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn this into a lead.");
    } finally {
      setConverting(false);
    }
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      dismissible={!converting}
      title={shown?.name || "Unnamed"}
      subtitle={shown && `Enquiry received ${formatReceived(shown.created_at)}`}
      footer={
        shown && (
          <PanelFooter
            start={
              <>
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
                <Button
                  variant="ghostDanger"
                  icon={<HiOutlineTrash size={18} />}
                  onClick={() => onRequestDelete(shown.id)}
                  disabled={converting}
                >
                  Delete
                </Button>
              </>
            }
          >
            {lead ? (
              <Button
                variant="primary"
                icon={<HiMiniArrowRight size={18} />}
                onClick={() => router.push(leadHref(lead.id))}
              >
                View lead
              </Button>
            ) : (
              <Button variant="primary" icon={<HiMiniBolt size={18} />} busy={converting} onClick={convert}>
                {converting ? "Turning into lead…" : "Turn into lead"}
              </Button>
            )}
          </PanelFooter>
        )
      }
    >
      {shown && (
        <>
          {error && <PanelError>{error}</PanelError>}

          {/* Status: once it's a lead, the lead's stage is what matters */}
          {lead ? (
            <Field icon={<HiMiniBolt size={16} />} label="Lead">
              <div className={styles.leadRow}>
                <Pill tone={leadStageTone(lead.stage)}>{leadStageLabel(lead.stage)}</Pill>
                <span className={styles.leadHint}>Qualify and propose from the lead</span>
              </div>
            </Field>
          ) : (
            <Field icon={<HiOutlineFlag size={16} />} label="Status" htmlFor="enquiry-status">
              <Dropdown
                id="enquiry-status"
                value={shown.opportunity_status}
                options={STATUS_OPTIONS}
                onChange={(status) => onStatusChange(shown.id, status)}
              />
            </Field>
          )}

          {/* full width each: emails are often too long for half the panel */}
          <Detail icon={<HiOutlineEnvelope size={16} />} label="Email">
            {shown.email && <a href={`mailto:${shown.email}`}>{shown.email}</a>}
          </Detail>
          <Detail icon={<HiOutlinePhone size={16} />} label="Phone">
            {shown.phone && <a href={`tel:${shown.phone}`}>{shown.phone}</a>}
          </Detail>

          <Field icon={<HiOutlineChatBubbleBottomCenterText size={16} />} label="Message">
            {shown.message ? (
              <p className={styles.message}>{shown.message}</p>
            ) : (
              <p className={styles.empty}>No message</p>
            )}
          </Field>

          <PanelSection>
            <PanelRow>
              <Detail icon={<HiOutlineCube size={16} />} label="Package">
                {shown.selected_package && packageLabel(shown.selected_package)}
              </Detail>
              <Detail icon={<HiOutlineCurrencyPound size={16} />} label="Budget">
                {shown.budget != null && formatBudget(shown.budget)}
              </Detail>
            </PanelRow>
            <PanelRow>
              <Detail icon={<HiOutlineTag size={16} />} label="Business type">
                {shown.selected_types?.length ? shown.selected_types.join(", ") : null}
              </Detail>
              <Detail icon={<HiOutlineWindow size={16} />} label="Sent from">
                {shown.source_page}
              </Detail>
            </PanelRow>
          </PanelSection>

          {/* Notes stay with this person as the enquiry becomes a lead */}
          <PanelSection>
            <Field icon={<HiOutlinePencilSquare size={16} />} label="Notes">
              <NotesTimeline subject={{ kind: "inquiry", id: shown.id }} />
            </Field>
          </PanelSection>
        </>
      )}
    </SidePanel>
  );
}

/** A read-only field: the form's label, with the value as plain text (or a dash) */
function Detail({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <Field icon={icon} label={label}>
      <span className={children ? styles.value : styles.empty}>{children || "—"}</span>
    </Field>
  );
}
