"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  HiMiniBolt,
  HiMiniPlus,
  HiOutlineUserCircle,
  HiOutlineUser,
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineBuildingOffice2,
} from "react-icons/hi2";
import SidePanel, { PanelError, PanelFooter, PanelSection } from "./sidePanel";
import { Combobox, Field, TextInput, type DropdownOption } from "./formFields";
import Button from "./button";
import Avatar from "./avatar";
import { supabase } from "../../lib/supabaseClient";
import { promoteOutreachToLead, type LeadRef } from "../../lib/leads";
import type { OutreachRow } from "../../lib/outreach";

// Promote an outreach business to a lead. Every lead needs a contact, so this
// picks an existing one or creates one on the way.

type PromoteLeadPanelProps = {
  /** the business to promote, or null when the panel is closed */
  outreach: OutreachRow | null;
  onClose: () => void;
  onPromoted: (outreachId: string, lead: LeadRef) => void;
};

type ContactOption = { id: string; name: string | null; email: string | null; business_name: string | null };

const NEW_CONTACT = "new";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// What the outreach row already tells us about how to reach them
function prefill(row: OutreachRow) {
  const handle = row.handle?.trim() ?? "";
  return {
    name: "",
    email: row.channel === "email" && EMAIL_PATTERN.test(handle) ? handle : "",
    phone: row.channel === "phone" ? handle : "",
    business: row.business_name,
  };
}

export default function PromoteLeadPanel({ outreach, onClose, onPromoted }: PromoteLeadPanelProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [choice, setChoice] = useState<string>(NEW_CONTACT);
  const [form, setForm] = useState({ name: "", email: "", phone: "", business: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep showing the last business while the panel slides closed
  const [shown, setShown] = useState(outreach);
  if (outreach && outreach !== shown) setShown(outreach);

  // A fresh form each time it opens for a business
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const openKey = outreach?.id ?? null;
  if (openKey !== openedFor) {
    setOpenedFor(openKey);
    if (outreach) {
      setForm(prefill(outreach));
      setChoice(NEW_CONTACT);
      setError(null);
    }
  }

  // The existing contacts to choose from, fetched each time it opens
  useEffect(() => {
    if (!openKey) return;
    let cancelled = false;
    supabase
      .from("contacts")
      .select("id, name, email, business_name")
      .order("name", { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        if (!cancelled) setContacts((data ?? []) as ContactOption[]);
      });
    const timer = window.setTimeout(() => nameRef.current?.focus(), 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [openKey]);

  const options: DropdownOption<string>[] = useMemo(
    () => [
      { value: NEW_CONTACT, label: "New contact", icon: <HiMiniPlus size={16} />, pinned: true },
      ...contacts.map((c) => ({
        value: c.id,
        label: [c.name || c.email || "Unnamed", c.business_name].filter(Boolean).join(" · "),
        icon: <Avatar name={c.name} email={c.email} size="xs" />,
        // find someone by email as well as by name or business
        keywords: c.email ?? "",
      })),
    ],
    [contacts]
  );

  const isNew = choice === NEW_CONTACT;

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function promote(e: React.FormEvent) {
    e.preventDefault();
    if (!shown) return;

    if (isNew) {
      const email = form.email.trim();
      if (email && !EMAIL_PATTERN.test(email)) return setError("That email doesn't look right.");
      if (!email && !form.phone.trim()) return setError("Add an email or a phone number, so there's a way to reach them.");
    }

    setSaving(true);
    setError(null);
    try {
      const lead = await promoteOutreachToLead(shown.id, isNew ? form : { id: choice });
      onPromoted(shown.id, lead);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't promote this business.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      open={outreach !== null}
      onClose={onClose}
      title="Promote to lead"
      subtitle={shown && `${shown.business_name} becomes a lead. Every lead needs a contact: someone to reach.`}
      onSubmit={promote}
      dismissible={!saving}
      footer={
        <PanelFooter
          start={
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          }
        >
          <Button type="submit" variant="primary" icon={<HiMiniBolt size={18} />} busy={saving}>
            {saving ? "Promoting…" : "Promote to lead"}
          </Button>
        </PanelFooter>
      }
    >
      {error && <PanelError>{error}</PanelError>}

      <Field icon={<HiOutlineUserCircle size={16} />} label="Contact" htmlFor="promote-contact">
        <Combobox
          id="promote-contact"
          value={choice}
          options={options}
          onChange={setChoice}
          placeholder="Search contacts"
          emptyText="No contacts match. Choose New contact to add them."
        />
      </Field>

      {isNew && (
        <PanelSection>
          <Field icon={<HiOutlineUser size={16} />} label="Name" htmlFor="promote-name">
            <TextInput
              ref={nameRef}
              id="promote-name"
              placeholder="Who you spoke to, e.g. Sarah"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field icon={<HiOutlineEnvelope size={16} />} label="Email" htmlFor="promote-email">
            <TextInput
              id="promote-email"
              type="email"
              inputMode="email"
              placeholder="hello@business.co.uk"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
            />
          </Field>
          <Field icon={<HiOutlinePhone size={16} />} label="Phone" htmlFor="promote-phone">
            <TextInput
              id="promote-phone"
              type="tel"
              inputMode="tel"
              placeholder="07700 900123"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field icon={<HiOutlineBuildingOffice2 size={16} />} label="Business" htmlFor="promote-business">
            <TextInput
              id="promote-business"
              value={form.business}
              onChange={(e) => update("business", e.target.value)}
              autoComplete="off"
            />
          </Field>
        </PanelSection>
      )}
    </SidePanel>
  );
}
