"use client";

import { useEffect, useRef, useState } from "react";
import {
  HiOutlineUser,
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineBuildingOffice2,
  HiOutlineTag,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiMiniPlus,
  HiMiniXMark,
} from "react-icons/hi2";
import styles from "./component-styles/contactEditor.module.css";
import SidePanel, { PanelError, PanelFooter, PanelSection } from "./sidePanel";
import NotesTimeline from "./notesTimeline";
import { Field, TextInput } from "./formFields";
import Button, { IconButton } from "./button";
import { supabase } from "../../lib/supabaseClient";

// Add a contact by hand, or edit one: name, email, phone numbers and business

/** The contact being edited: what the editor reads and writes */
export type EditableContact = {
  id: string;
  name: string | null;
  email: string | null;
  phone_numbers: string[] | null;
  business_name: string | null;
  industry: string | null;
};

type ContactEditorProps = {
  open: boolean;
  /** the contact to edit, or null to add a new one */
  contact: EditableContact | null;
  onClose: () => void;
  onSaved: () => void;
  /** asks first, with the confirm dialog; only offered when editing */
  onRequestDelete?: (contact: EditableContact) => void;
  /** suggestions for the industry field (free text, so anything can be typed) */
  industryOptions?: string[];
};

type ContactForm = { name: string; email: string; phones: string[]; business: string; industry: string };

const blankForm = (): ContactForm => ({ name: "", email: "", phones: [""], business: "", industry: "" });

const formFrom = (c: EditableContact): ContactForm => ({
  name: c.name ?? "",
  email: c.email ?? "",
  phones: c.phone_numbers?.length ? [...c.phone_numbers] : [""],
  business: c.business_name ?? "",
  industry: c.industry ?? "",
});

/** Plain words for why a contact didn't save */
export function contactSaveError(error: { code?: string; message: string } | null, email?: string) {
  // contacts_email_key: one contact per email
  if (error?.code === "23505") return `${email || "That email"} is already a contact.`;
  // row level security: blocked outright (insert) or matched nothing (update)
  if (!error || error.code === "42501") {
    return "Your account isn't allowed to change contacts. Run the contacts_admin_write migration in Supabase.";
  }
  return error.message;
}

// the same check the website's enquiry form uses
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactEditor({
  open,
  contact,
  onClose,
  onSaved,
  onRequestDelete,
  industryOptions = [],
}: ContactEditorProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phonesRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<ContactForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh form each time the panel opens, for a new contact or the one being edited
  const openKey = open ? contact?.id ?? "new" : null;
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (openKey !== openedFor) {
    setOpenedFor(openKey);
    if (openKey) {
      setForm(contact ? formFrom(contact) : blankForm());
      setError(null);
    }
  }

  // new contacts start typing straight away; edits don't pop the keyboard
  useEffect(() => {
    if (!open || contact) return;
    const timer = window.setTimeout(() => nameRef.current?.focus(), 250);
    return () => window.clearTimeout(timer);
  }, [open, contact]);

  function update<K extends "name" | "email" | "business" | "industry">(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updatePhone(index: number, value: string) {
    setForm((prev) => ({ ...prev, phones: prev.phones.map((p, i) => (i === index ? value : p)) }));
  }

  function addPhone() {
    setForm((prev) => ({ ...prev, phones: [...prev.phones, ""] }));
    // focus the new field once it's rendered
    window.setTimeout(() => {
      const inputs = phonesRef.current?.querySelectorAll("input");
      inputs?.[inputs.length - 1]?.focus();
    }, 0);
  }

  function removePhone(index: number) {
    setForm((prev) => {
      const phones = prev.phones.filter((_, i) => i !== index);
      return { ...prev, phones: phones.length ? phones : [""] };
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const email = form.email.trim();
    // blanks dropped, duplicates merged
    const phones = [...new Set(form.phones.map((p) => p.trim()).filter(Boolean))];

    // a contact needs a way to reach them: an email, a phone number, or both
    if (email && !EMAIL_PATTERN.test(email)) {
      setError("That email doesn't look right.");
      emailRef.current?.focus();
      return;
    }
    if (!email && phones.length === 0) {
      setError("Add an email or a phone number, so there's a way to reach them.");
      emailRef.current?.focus();
      return;
    }

    setSaving(true);
    setError(null);

    const business = form.business.trim() || null;
    const fields = {
      email: email || null,
      name: form.name.trim() || null,
      phone_numbers: phones,
      business_name: business,
      industry: form.industry.trim() || null,
    };

    // .select() returns the saved row: an update that row security blocks
    // doesn't error, it just changes nothing, so no row back means not saved
    const { data, error } = contact
      ? await supabase.from("contacts").update(fields).eq("id", contact.id).select("id")
      : await supabase.from("contacts").insert(fields).select("id");

    setSaving(false);
    if (error || !data?.length) {
      setError(contactSaveError(error, email));
      return;
    }
    onSaved();
  }

  const emailChanged =
    !!contact?.email && form.email.trim().toLowerCase() !== contact.email.toLowerCase();

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={contact ? "Edit contact" : "Add contact"}
      subtitle={
        contact
          ? "Changes show everywhere this person appears, including their leads."
          : "If they send an enquiry later with this email, it joins this contact."
      }
      onSubmit={save}
      dismissible={!saving}
      footer={
        <PanelFooter
          start={
            <>
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              {contact && onRequestDelete && (
                <Button
                  variant="ghostDanger"
                  icon={<HiOutlineTrash size={18} />}
                  onClick={() => onRequestDelete(contact)}
                  disabled={saving}
                >
                  Delete
                </Button>
              )}
            </>
          }
        >
          <Button type="submit" variant="primary" busy={saving}>
            {saving ? "Saving…" : contact ? "Save" : "Add"}
          </Button>
        </PanelFooter>
      }
    >
      {error && <PanelError>{error}</PanelError>}

      <Field icon={<HiOutlineUser size={16} />} label="Name" htmlFor="contact-name">
        <TextInput
          ref={nameRef}
          id="contact-name"
          placeholder="e.g. Sarah Mitchell"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          autoComplete="off"
        />
      </Field>

      <Field icon={<HiOutlineEnvelope size={16} />} label="Email" htmlFor="contact-email">
        <TextInput
          ref={emailRef}
          id="contact-email"
          type="email"
          inputMode="email"
          placeholder="sarah@bloomandstem.co.uk"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
        />
        {emailChanged && (
          <p className={styles.hint}>
            Future enquiries are matched by email, so ones from the old address will start a new contact.
          </p>
        )}
      </Field>

      <Field icon={<HiOutlinePhone size={16} />} label="Phone" htmlFor="contact-phone-0">
        <div ref={phonesRef} className={styles.phones}>
          {form.phones.map((phone, i) => (
            <div key={i} className={styles.phoneRow}>
              <TextInput
                id={`contact-phone-${i}`}
                type="tel"
                inputMode="tel"
                placeholder="07700 900123"
                value={phone}
                onChange={(e) => updatePhone(i, e.target.value)}
                autoComplete="off"
                aria-label={i === 0 ? undefined : `Phone ${i + 1}`}
              />
              {(form.phones.length > 1 || phone) && (
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<HiMiniXMark size={18} />}
                  label="Remove number"
                  className={styles.removePhone}
                  onClick={() => removePhone(i)}
                />
              )}
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            icon={<HiMiniPlus size={16} />}
            className={styles.addPhone}
            onClick={addPhone}
          >
            Add another number
          </Button>
        </div>
      </Field>

      <Field icon={<HiOutlineBuildingOffice2 size={16} />} label="Business" htmlFor="contact-business">
        <TextInput
          id="contact-business"
          placeholder="e.g. Bloom & Stem"
          value={form.business}
          onChange={(e) => update("business", e.target.value)}
          autoComplete="off"
        />
      </Field>

      <Field icon={<HiOutlineTag size={16} />} label="Industry" htmlFor="contact-industry">
        <TextInput
          id="contact-industry"
          list="contact-industry-options"
          placeholder="e.g. Health & Beauty"
          value={form.industry}
          onChange={(e) => update("industry", e.target.value)}
          autoComplete="off"
        />
        {/* suggestions only: it's free text, so new industries can be typed */}
        <datalist id="contact-industry-options">
          {industryOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </Field>

      {/* Everything noted about this person: on the contact, their enquiries, leads and outreach */}
      {contact && (
        <PanelSection>
          <Field icon={<HiOutlinePencilSquare size={16} />} label="Notes">
            <NotesTimeline subject={{ kind: "contact", id: contact.id }} />
          </Field>
        </PanelSection>
      )}
    </SidePanel>
  );
}
