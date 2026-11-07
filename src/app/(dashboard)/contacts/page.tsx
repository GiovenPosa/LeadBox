"use client";

import { useEffect, useMemo, useState, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../../lib/supabaseClient";
import { useDashboard } from "../../context/dashboardContext";
import styles from "../homePage.module.css";
import contactStyles from "./contacts.module.css";
import { HiMiniUsers, HiMiniPlus, HiXMark, HiPhone } from "react-icons/hi2";
import { useBlockIosEdgeSwipe } from "../../hooks/useBlockIosEdgeBackSwipe";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useDelayedFlag } from "../../hooks/useDelayedFlag";
import DataTable, { DataTableSkeleton, CardMeta, CardTop, EmptyCell, TitleCell, type DataTableColumn } from "../../components/dataTable";
import Pill, { type PillTone } from "../../components/pill";
import Avatar from "../../components/avatar";
import { StatPill, StatPillsSkeleton } from "../../components/statPill";
import Toolbar, { type ToolbarFilterGroup } from "../../components/toolbar";
import ContactEditor from "../../components/contactEditor";
import ConfirmDialog from "../../components/confirmDialog";
import { useRouter } from "next/navigation";
import { deleteContact, leadIdForContact } from "../../../lib/contacts";
import { leadHref } from "../../../lib/leads";
import { industrySuggestions } from "../../../lib/leads";
import Button from "../../components/button";
import { formatAgo, formatShortDate } from "../../../lib/outreach";

type Contact = {
  id: string;
  /** contacts need an email or a phone number; this can be empty */
  email: string | null;
  name: string | null;
  phone_numbers: string[];
  phone_numbers_display?: string | null;
  created_at: string;
  updated_at: string;
  inquiry_count: number;
  projects_count: number;
  last_inquiry_at: string | null;
  last_inquiry_status: string | null;
  /** from contacts.business_name; empty until contacts can be added by hand */
  business_name: string | null;
  /** free text; filled from their enquiries or outreach, or typed in */
  industry: string | null;
  /** how many leads they are (from enquiries or outreach) */
  lead_count: number;
};

// From the contact's latest enquiry: New, Connected (contacted), Lead (turned
// into a lead) or Bad. The old qualified/won/lost statuses were folded into
// leads by the 20261108 migration.
type ContactStatus = "New" | "Connected" | "Lead" | "Bad";

/** null for a contact added by hand who hasn't sent an enquiry */
function resolveContactStatus(c: Contact): ContactStatus | null {
  if (!c.last_inquiry_status) return null;
  const s = c.last_inquiry_status.toLowerCase();

  if (s === "contacted") return "Connected";
  if (s === "converted" || s === "qualified" || s === "won" || s === "lost") return "Lead";
  if (s === "bad") return "Bad";

  return "New";
}

const STATUS_TONE: Record<ContactStatus, PillTone> = {
  New: "new",
  Connected: "contacted",
  Lead: "qualified",
  Bad: "bad",
};

const cleanPhones = (arr: unknown): string[] => {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => String(x ?? "").trim()).filter(Boolean);
};

// A timestamp's calendar day in local time, for the date helpers
function localDay(timestamp: string): string {
  const d = new Date(timestamp);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const subscribeNoop = () => () => {};

const linkedId = () => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("open"));

/* ---------------- Industry pills ---------------- */

// the pill for contacts with no industry
const NO_INDUSTRY = "__none";

/**
 * A contact's industries. It's free text; one from an enquiry that ticked
 * several business types reads "Health & Beauty, Retail & E-commerce", and
 * counts under each.
 */
const industriesOf = (c: { industry: string | null }) =>
  (c.industry ?? "").split(",").map((i) => i.trim()).filter(Boolean);

function deleteMessage(contact: Contact | null, hasLead: boolean) {
  const name = contact?.name || contact?.email || "This contact";
  if (hasLead) return `${name} is a lead, and a lead always needs a contact. Remove the lead first, then delete the contact.`;
  const enquiries = contact?.inquiry_count ?? 0;
  const along = enquiries > 0 ? `, along with their ${plural(enquiries, "enquiry", "enquiries")}` : "";
  return `${name} will be removed for good${along}, and all their notes. This can't be undone.`;
}

/* ---------------- Toolbar ---------------- */

const STATUSES: ContactStatus[] = ["New", "Connected", "Lead", "Bad"];

const FILTER_GROUPS: ToolbarFilterGroup[] = [
  { key: "status", label: "Status", options: STATUSES.map((s) => ({ value: s, label: s })) },
  {
    key: "phone",
    label: "Phone",
    options: [
      { value: "yes", label: "Has a number" },
      { value: "no", label: "No number" },
    ],
  },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Latest enquiry" },
  { value: "name", label: "Name A–Z" },
  { value: "enquiries", label: "Most enquiries" },
  { value: "added", label: "Newest contact" },
];

function sortContacts(list: Contact[], sort: string) {
  const sorted = [...list];
  switch (sort) {
    case "name":
      return sorted.sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || "", "en-GB"));
    case "enquiries":
      return sorted.sort((a, b) => (b.inquiry_count ?? 0) - (a.inquiry_count ?? 0));
    case "added":
      return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    default:
      // the database's order: latest enquiry first
      return sorted;
  }
}

export default function ContactsPage() {
  const { setActivePage, setPageTitle, setBreadcrumbs } = useDashboard();

  // Set page config on mount
  useEffect(() => {
    setActivePage("contacts");
    setPageTitle("Contacts");
    setBreadcrumbs([
      { label: "gios.build", href: "#" },
      { label: "Contacts" },
    ]);
  }, [setActivePage, setPageTitle, setBreadcrumbs]);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  // a quick load skips the skeleton; the rows just fade in
  const showSkeleton = useDelayedFlag(loading);
  const [error, setError] = useState<string | null>(null);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [activePhones, setActivePhones] = useState<string[]>([]);
  const [activeContactName, setActiveContactName] = useState<string>("Contact");
  const [activeContactEmail, setActiveContactEmail] = useState<string>("");
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [search, setSearch] = useState("");
  const [attrFilter, setAttrFilter] = useState<Record<string, string[]>>({});
  // the industry pill that's on: "all", an industry, or NO_INDUSTRY
  const [industryFilter, setIndustryFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [editorOpen, setEditorOpen] = useState(false);
  // the contact open in the editor; null when adding a new one
  const [editing, setEditing] = useState<Contact | null>(null);

  // Delete asks first. A contact with a lead can't be deleted, so for them the
  // dialog explains and offers the lead instead.
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<{ contact: Contact; leadId: string | null } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // ?open=<id> (from the dashboard): open that contact once the list has loaded
  const [pendingOpen, setPendingOpen] = useState(linkedId);
  if (pendingOpen && !loading) {
    setPendingOpen(null);
    const contact = contacts.find((c) => c.id === pendingOpen);
    if (contact) {
      setEditing(contact);
      setEditorOpen(true);
    }
  }

  async function requestDelete(contactId: string) {
    const target = contacts.find((c) => c.id === contactId);
    if (!target) return;
    setActionError(null);
    setDeleteTarget({ contact: target, leadId: await leadIdForContact(contactId) });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.leadId) {
      router.push(leadHref(deleteTarget.leadId));
      return;
    }
    setDeleting(true);
    try {
      await deleteContact(deleteTarget.contact.id);
      setContacts((prev) => prev.filter((c) => c.id !== deleteTarget.contact.id));
      setEditorOpen(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't delete that contact.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }
  const closeEditor = useCallback(() => setEditorOpen(false), []);
  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  // true only in the browser, so the sheet's portal never renders on the server
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  // Block iOS edge swipe back gesture
  useBlockIosEdgeSwipe(true);

  // Prevent scrolling when panel is open
  useEffect(() => {
    if (!phoneModalOpen || !isMobile) return;

    const preventScroll = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(`.${contactStyles.panelContent}`)) {
        return;
      }
      e.preventDefault();
    };

    document.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      document.removeEventListener("touchmove", preventScroll);
    };
  }, [phoneModalOpen, isMobile]);

  const fetchContacts = useCallback(async () => {
    setError(null);

    // contacts_overview's SQL isn't in this repo, so business names come
    // straight from contacts and are matched up by id
    const [overview, businesses, leads] = await Promise.all([
      supabase
        .from("contacts_overview")
        .select(
          "id,email,name,phone_numbers,phone_numbers_display,created_at,updated_at,inquiry_count,projects_count,last_inquiry_at,last_inquiry_status"
        )
        .order("last_inquiry_at", { ascending: false, nullsFirst: false }),
      supabase.from("contacts").select("id, business_name, industry"),
      supabase.from("leads").select("contact_id"),
    ]);

    if (overview.error) {
      setError(overview.error.message);
      setContacts([]);
      return;
    }

    // before the business_name migration this lookup fails; the column just stays empty
    const extraById = new Map(
      (businesses.error ? [] : businesses.data ?? []).map((b) => [
        b.id as string,
        { business_name: b.business_name as string | null, industry: b.industry as string | null },
      ])
    );
    const leadCount = new Map<string, number>();
    for (const l of leads.data ?? []) {
      leadCount.set(l.contact_id as string, (leadCount.get(l.contact_id as string) ?? 0) + 1);
    }
    setContacts(
      (overview.data ?? []).map((c) => ({
        ...c,
        lead_count: leadCount.get(c.id) ?? 0,
        business_name: extraById.get(c.id)?.business_name ?? null,
        industry: extraById.get(c.id)?.industry ?? null,
      })) as Contact[]
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const firstLoad = async () => {
      await fetchContacts();
      if (!cancelled) setLoading(false);
    };
    firstLoad();
    return () => {
      cancelled = true;
    };
  }, [fetchContacts]);

  // Everything is loaded at once, so search, filter and sort happen here
  // One pill per industry in use, most common first, matched without caring about case
  const industryPills = useMemo(() => {
    const byKey = new Map<string, { label: string; count: number }>();
    let unset = 0;
    for (const c of contacts) {
      const industries = industriesOf(c);
      if (industries.length === 0) unset += 1;
      for (const label of new Set(industries)) {
        const key = label.toLowerCase();
        const pill = byKey.get(key) ?? { label, count: 0 };
        pill.count += 1;
        byKey.set(key, pill);
      }
    }
    const pills = [...byKey.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "en-GB"));
    return { pills, unset };
  }, [contacts]);

  const toggleIndustry = (next: string) =>
    setIndustryFilter((current) => (current === next && next !== "all" ? "all" : next));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const statuses = attrFilter.status ?? [];
    const industry = industryFilter.toLowerCase();
    const phone = attrFilter.phone ?? [];
    const filtered = contacts.filter((c) => {
      if (industryFilter === NO_INDUSTRY && industriesOf(c).length > 0) return false;
      if (industryFilter !== "all" && industryFilter !== NO_INDUSTRY && !industriesOf(c).some((i) => i.toLowerCase() === industry)) {
        return false;
      }
      const status = resolveContactStatus(c);
      if (statuses.length && (!status || !statuses.includes(status))) return false;
      const hasPhone = cleanPhones(c.phone_numbers).length > 0;
      if (phone.length === 1 && (phone[0] === "yes") !== hasPhone) return false;
      if (!q) return true;
      if ([c.name, c.email, c.business_name, c.industry].some((v) => v?.toLowerCase().includes(q))) return true;
      // match numbers however they're spaced: "07700 900" finds "07700900123"
      return !!digits && cleanPhones(c.phone_numbers).some((p) => p.replace(/\D/g, "").includes(digits));
    });
    return sortContacts(filtered, sort);
  }, [contacts, search, attrFilter, sort, industryFilter]);

  const toolbar = (
    <Toolbar
      search={{ value: search, onChange: setSearch, placeholder: "Search contacts" }}
      filter={{ groups: FILTER_GROUPS, value: attrFilter, onChange: setAttrFilter }}
      sort={{ options: SORT_OPTIONS, value: sort, onChange: setSort, defaultValue: "recent" }}
    />
  );
  // there from the start; hidden only once it's clear there's nothing to search
  const showToolbar = !error && (loading || contacts.length > 0);

  const openPhonePanel = (phones: string[], name: string, email: string) => {
    setActivePhones(phones);
    setActiveContactName(name);
    setActiveContactEmail(email);
    setPhoneModalOpen(true);
  };

  const closePhonePanel = () => {
    setPhoneModalOpen(false);
  };

  // One number is a tel: link; several open the picker
  const phoneLink = (c: Contact) => {
    const phones = cleanPhones(c.phone_numbers);
    if (phones.length === 0) return null;
    if (phones.length === 1) {
      return (
        <a href={`tel:${phones[0]}`} className={contactStyles.link} onClick={(e) => e.stopPropagation()}>
          {phones[0]}
        </a>
      );
    }
    return (
      <button
        type="button"
        className={contactStyles.link}
        onClick={(e) => {
          e.stopPropagation(); // not the row's click, which opens the editor
          openPhonePanel(phones, c.name || c.email || "Contact", c.email ?? "");
        }}
      >
        {phones.length} numbers
      </button>
    );
  };

  const contactCell = (c: Contact) => (
    <TitleCell
      avatar={<Avatar name={c.name} email={c.email} />}
      title={c.name || c.email || cleanPhones(c.phone_numbers)[0] || "Unnamed"}
      sub={
        c.email ? (
          <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}>
            {c.email}
          </a>
        ) : (
          "No email"
        )
      }
    />
  );

  const statusPill = (c: Contact) => {
    const status = resolveContactStatus(c);
    return status ? <Pill tone={STATUS_TONE[status]}>{status}</Pill> : <EmptyCell />;
  };

  const columns: DataTableColumn<Contact>[] = [
    { key: "contact", header: "Contact", skeleton: "avatar", cell: contactCell },
    { key: "business", header: "Business", cell: (c) => c.business_name || <EmptyCell /> },
    { key: "industry", header: "Industry", muted: true, cell: (c) => c.industry || <EmptyCell /> },
    { key: "phone", header: "Phone", muted: true, cell: (c) => phoneLink(c) ?? <EmptyCell /> },
    { key: "status", header: "Status", skeleton: "pill", cell: statusPill },
    { key: "inquiries", header: "Enquiries", align: "end", skeleton: "number", cell: (c) => c.inquiry_count ?? 0 },
    { key: "leads", header: "Leads", align: "end", skeleton: "number", cell: (c) => c.lead_count },
    { key: "projects", header: "Projects", align: "end", skeleton: "number", cell: (c) => c.projects_count ?? 0 },
    {
      key: "last",
      header: "Last enquiry",
      muted: true,
      cell: (c) =>
        c.last_inquiry_at ? (
          <span title={formatShortDate(localDay(c.last_inquiry_at))}>{formatAgo(localDay(c.last_inquiry_at))}</span>
        ) : (
          <EmptyCell />
        ),
    },
  ];

  return (
    <>
      <div className={styles.canvas}>
        {/* Page Header; on desktop the toolbar sits on the right */}
        <div className={styles.headerRow}>
          <div className={styles.pageHeader}>
            <div className={styles.pageIcon}>
              <HiMiniUsers size={30} />
            </div>
            <h1 className={styles.pageTitle}>Contacts</h1>
          </div>
          <div className={styles.headerActions}>
            {showToolbar && !isMobile && toolbar}
            <Button
              variant="primary"
              size="sm"
              icon={<HiMiniPlus size={18} />}
              onClick={openNew}
              disabled={loading || !!error}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Industry pills: the categories are whatever industries contacts have,
            so until they load there are placeholder pills */}
        <div className={styles.statsRow}>
          <div className={styles.statGroup}>
            <StatPill
              label="All"
              value={contacts.length}
              active={industryFilter === "all"}
              onClick={() => toggleIndustry("all")}
            />
            {loading ? (
              showSkeleton && <StatPillsSkeleton count={3} />
            ) : (
              <>
                {industryPills.pills.map((pill) => (
                  <StatPill
                    key={pill.label}
                    label={pill.label}
                    value={pill.count}
                    active={industryFilter.toLowerCase() === pill.label.toLowerCase()}
                    onClick={() => toggleIndustry(pill.label)}
                  />
                ))}
                {industryPills.unset > 0 && (
                  <StatPill
                    label="Not set"
                    value={industryPills.unset}
                    active={industryFilter === NO_INDUSTRY}
                    onClick={() => toggleIndustry(NO_INDUSTRY)}
                  />
                )}
              </>
            )}
          </div>
        </div>

        <main className={styles.content}>
          {showToolbar && isMobile && <div className={styles.toolbarRow}>{toolbar}</div>}

          {actionError && (
            <div className={`${styles.errorBanner} ${styles.actionError}`} role="alert">
              <span>{actionError}</span>
            </div>
          )}

          {loading ? (
            showSkeleton && <DataTableSkeleton columns={columns} minWidth={920} />
          ) : error ? (
            <div className={styles.errorBanner}>
              <span>{error}</span>
            </div>
          ) : contacts.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>👤</div>
              <h3 className={styles.emptyTitle}>No contacts yet</h3>
              <p className={styles.emptyDescription}>
                Everyone who sends an enquiry becomes a contact. You can add people yourself too.
              </p>
              <Button
                variant="primary"
                icon={<HiMiniPlus size={18} />}
                className={styles.emptyAction}
                onClick={openNew}
              >
                Add a contact
              </Button>
            </div>
          ) : visible.length === 0 ? (
            <p className={styles.noMatches}>Nothing matches that search.</p>
          ) : (
            <DataTable
              rows={visible}
              columns={columns}
              rowKey={(c) => c.id}
              onRowClick={(c) => {
                setEditing(c);
                setEditorOpen(true);
              }}
              minWidth={920}
              renderCard={(c) => (
                <>
                  <CardTop>
                    {contactCell(c)}
                    {statusPill(c)}
                  </CardTop>
                  {(c.business_name || c.industry) && (
                    <CardMeta>{[c.business_name, c.industry].filter(Boolean).join(" · ")}</CardMeta>
                  )}
                  <CardMeta>
                    {plural(c.inquiry_count ?? 0, "enquiry", "enquiries")} ·{" "}
                    {plural(c.lead_count, "lead", "leads")} ·{" "}
                    {plural(c.projects_count ?? 0, "project", "projects")}
                    {c.last_inquiry_at && ` · ${formatAgo(localDay(c.last_inquiry_at))}`}
                  </CardMeta>
                  {phoneLink(c) && <CardMeta>{phoneLink(c)}</CardMeta>}
                </>
              )}
            />
          )}
        </main>
      </div>

      <ContactEditor
        open={editorOpen}
        contact={editing}
        industryOptions={industrySuggestions(contacts.map((c) => c.industry))}
        onRequestDelete={(c) => requestDelete(c.id)}
        onClose={closeEditor}
        onSaved={() => {
          setEditorOpen(false);
          // a new contact goes to the top; an edited one stays where it is
          if (!editing) setSort("added");
          fetchContacts();
        }}
      />

      <ConfirmDialog
        variant={deleteTarget?.leadId ? "neutral" : "danger"}
        open={deleteTarget !== null}
        title={deleteTarget?.leadId ? "This contact has a lead" : "Delete this contact?"}
        message={deleteMessage(deleteTarget?.contact ?? null, !!deleteTarget?.leadId)}
        confirmLabel={deleteTarget?.leadId ? "Open lead" : "Delete"}
        busyLabel="Deleting…"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Desktop Modal */}
      {phoneModalOpen && !isMobile && (
        <>
          <div className={contactStyles.modalOverlay} onClick={closePhonePanel} />
          <div className={contactStyles.modal}>
            <div className={contactStyles.modalHeader}>
              <div>
                <div className={contactStyles.modalTitle}>{activeContactName}</div>
                <div className={contactStyles.modalSubtitle}>{activeContactEmail}</div>
              </div>

              <button
                className={contactStyles.modalClose}
                onClick={closePhonePanel}
                aria-label="Close"
              >
                <HiXMark size={24} />
              </button>
            </div>

            <div className={contactStyles.modalList}>
              {activePhones.map((p) => (
                <a
                  key={p}
                  href={`tel:${p}`}
                  className={contactStyles.modalItem}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={contactStyles.modalItemLabel}>{p}</span>
                  <HiPhone size={20} className={contactStyles.modalItemIcon} />
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Mobile Bottom Sheet Panel */}
      {mounted &&
        createPortal(
          <>
            <div
              className={`${contactStyles.panelBackdrop} ${phoneModalOpen && isMobile ? contactStyles.panelBackdropVisible : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                closePhonePanel();
              }}
              onTouchMove={(e) => e.preventDefault()}
              aria-hidden="true"
            />

            <div
              className={`${contactStyles.phonePanel} ${phoneModalOpen && isMobile ? contactStyles.phonePanelOpen : ""}`}
              role="dialog"
              aria-modal="true"
              aria-label="Phone numbers"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={contactStyles.panelHandle}>
                <div className={contactStyles.panelHandleBar} />
              </div>

              <div className={contactStyles.panelHeader}>
                <div>
                  <h2 className={contactStyles.panelTitle}>Phone Numbers</h2>
                  <div className={contactStyles.panelSubtitle}>
                    {activePhones.length} number{activePhones.length !== 1 ? "s" : ""} available
                  </div>
                </div>
                <button
                  className={contactStyles.panelCloseButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    closePhonePanel();
                  }}
                  aria-label="Close"
                >
                  <HiXMark size={24} />
                </button>
              </div>

              <div className={contactStyles.panelContent}>
                <div className={contactStyles.panelContactInfo}>
                  <span className={contactStyles.panelContactName}>{activeContactName}</span>
                  {activeContactEmail && (
                    <span className={contactStyles.panelContactEmail}>{activeContactEmail}</span>
                  )}
                </div>

                <div className={contactStyles.panelOptions}>
                  {activePhones.map((phone) => (
                    <a
                      key={phone}
                      href={`tel:${phone}`}
                      className={contactStyles.panelOption}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className={contactStyles.panelOptionLabel}>{phone}</span>
                      <HiPhone size={20} className={contactStyles.panelOptionIcon} />
                    </a>
                  ))}
                </div>

                <div className={contactStyles.panelFooter} />
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}