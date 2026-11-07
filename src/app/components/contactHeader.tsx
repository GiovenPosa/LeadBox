"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineDocumentDuplicate,
  HiMiniCheck,
} from "react-icons/hi2";
import styles from "./component-styles/contactHeader.module.css";
import { IconButton, LinkButton } from "./button";
import Avatar from "./avatar";

// The person behind a lead, at the top of the lead page: who they are, how
// long they've been a contact, and one tap to email or call them.

export type ContactSummary = {
  id: string;
  name: string | null;
  /** an email or a phone number, or both */
  email: string | null;
  phone_numbers: string[] | null;
  business_name: string | null;
  /** free text, e.g. "Health & Beauty"; leave out if unknown */
  industry?: string | null;
  created_at: string;
  /** from contacts_overview; leave out if unknown */
  inquiry_count?: number;
};

type ContactHeaderProps = {
  contact: ContactSummary;
  /** next to the name: the lead's stage badge */
  badge?: ReactNode;
  /** top right: e.g. when the enquiry came in */
  aside?: ReactNode;
};

const MAX_PHONES = 3;

export default function ContactHeader({ contact, badge, aside }: ContactHeaderProps) {
  const [copied, setCopied] = useState(false);
  const phones = (contact.phone_numbers ?? []).map((p) => p.trim()).filter(Boolean).slice(0, MAX_PHONES);
  const label = contact.name || contact.email || phones[0] || "Unnamed";
  const since = new Date(contact.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const enquiries = contact.inquiry_count;

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyEmail() {
    if (!contact.email) return;
    try {
      await navigator.clipboard.writeText(contact.email);
      setCopied(true);
    } catch {
      // clipboard blocked (e.g. not https): the address is still selectable on the button
    }
  }

  const facts = [
    contact.business_name,
    contact.industry,
    `Contact since ${since}`,
    enquiries != null && `${enquiries} ${enquiries === 1 ? "enquiry" : "enquiries"}`,
  ].filter(Boolean);

  return (
    <section className={styles.header} aria-label="Contact">
      <div className={styles.identity}>
        <Avatar name={contact.name} email={contact.email} size="lg" />

        <div className={styles.who}>
          <div className={styles.nameRow}>
            <h1 className={styles.name} title={label}>
              {label}
            </h1>
            {badge}
          </div>
          <p className={styles.facts}>
            {facts.map((fact, i) => (
              <span key={i} className={i === 0 && contact.business_name ? styles.business : undefined}>
                {fact}
              </span>
            ))}
          </p>
        </div>

        {aside && <div className={styles.aside}>{aside}</div>}
      </div>

      <div className={styles.actions}>
        {contact.email && (
          <>
            <LinkButton size="sm" href={`mailto:${contact.email}`} icon={<HiOutlineEnvelope size={16} />}>
              {contact.email}
            </LinkButton>
            <IconButton
              size="sm"
              icon={copied ? <HiMiniCheck size={16} /> : <HiOutlineDocumentDuplicate size={16} />}
              label={copied ? "Email copied" : "Copy email"}
              onClick={copyEmail}
            />
          </>
        )}
        {phones.map((phone) => (
          <LinkButton key={phone} size="sm" href={`tel:${phone}`} icon={<HiOutlinePhone size={16} />}>
            {phone}
          </LinkButton>
        ))}
      </div>
    </section>
  );
}
