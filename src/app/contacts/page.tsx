"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import Sidebar from "../components/sidebar";
import TopBar from "../components/topbar";
import DockBar from "../components/dockbar";
import styles from "../homePage.module.css";
import contactStyles from "./contacts.module.css";
import { HiMiniUsers, HiXMark, HiPhone } from "react-icons/hi2";
import { useInbox } from "../context/inboxContext";

type Contact = {
  id: string;
  email: string;
  name: string | null;
  phone_numbers: string[]; 
  phone_numbers_display?: string | null;
  created_at: string;
  updated_at: string;
  inquiry_count: number;
  projects_count: number;
  last_inquiry_at: string | null;
  last_inquiry_status: string | null;
};

type ContactStatus = "New" | "Connected" | "Active" | "Completed" | "Lost" | "Bad";

function resolveContactStatus(c: Contact): ContactStatus {
  // TODO: when projects table exists:
  // if (hasActiveProject) return "Active";
  // if (hasCompletedProject) return "Completed";

  const s = (c.last_inquiry_status ?? "").toLowerCase();

  if (s === "contacted") return "Connected";
  if (s === "new") return "New";
  if (s === "lost") return "Lost";
  if (s === "bad") return "Bad";
  if (s === "won") return "Active";

  return "New";
}

// Optional: map status -> a CSS module key (so you can style badges later)
function statusClassKey(status: ContactStatus) {
  // e.g. contactStyles.status_New etc.
  return `status_${status}` as const;
}

export default function ContactsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { unseenCount } = useInbox();
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [activePhones, setActivePhones] = useState<string[]>([]);
  const [activeContactName, setActiveContactName] = useState<string>("Contact");
  const [activeContactEmail, setActiveContactEmail] = useState<string>("");
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Track mount state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Prevent scrolling when panel is open
  useEffect(() => {
    if (!phoneModalOpen || !isMobile) return;

    const preventScroll = (e: TouchEvent) => {
      // Allow scrolling inside the panel content area
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

  const cleanPhones = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);
  };

  const fetchContacts = useCallback(async () => {
    setError(null);

    const { data, error } = await supabase
      .from("contacts_overview")
      .select(
        "id,email,name,phone_numbers,phone_numbers_display,created_at,updated_at,inquiry_count,projects_count,last_inquiry_at,last_inquiry_status"
      )
      .order("last_inquiry_at", { ascending: false, nullsFirst: false });

    if (error) {
      setError(error.message);
      setContacts([]);
      return;
    }

    setContacts((data ?? []) as Contact[]);
  }, []);

  useEffect(() => {
    async function boot() {
      const { data } = await supabase.auth.getSession();
      const sessionEmail = data.session?.user?.email ?? null;

      if (!sessionEmail) {
        router.replace("/login");
        return;
      }

      setEmail(sessionEmail);

      try {
        await fetchContacts();
      } finally {
        setLoading(false);
      }
    }

    boot();
  }, [router, fetchContacts]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const openPhonePanel = (phones: string[], name: string, email: string) => {
    setActivePhones(phones);
    setActiveContactName(name);
    setActiveContactEmail(email);
    setPhoneModalOpen(true);
  };

  const closePhonePanel = () => {
    setPhoneModalOpen(false);
  };

  if (!email) return null;

  return (
    <div className={styles.workspace}>
      <Sidebar
        email={email}
        onSignOut={signOut}
        inboxUnseenCount={unseenCount}
        activePage="contacts"
      />

      <div className={styles.main}>
        <TopBar
          title="Contacts"
          breadcrumbs={[
            { label: "gios.build", href: "#" },
            { label: "Contacts" },
          ]}
          email={email}
          onSignOut={signOut}
        />

        <div className={styles.canvas}>
          {/* Page Header */}
          <div className={styles.pageHeader}>
            <div className={styles.pageIcon}>
              <HiMiniUsers size={30} />
            </div>
            <h1 className={styles.pageTitle}>Contacts</h1>
          </div>

          <main className={styles.content}>
            {loading ? (
              <div className={styles.loading}>Loading contacts…</div>
            ) : error ? (
              <div className={styles.errorBanner}>
                <span>{error}</span>
              </div>
            ) : contacts.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>👤</div>
                <h3 className={styles.emptyTitle}>No contacts yet</h3>
                <p className={styles.emptyDescription}>
                  Contacts are created automatically from booking inquiries.
                </p>
              </div>
            ) : (
              <div className={contactStyles.list}>
                {contacts.map((c) => {
                  const status = resolveContactStatus(c);

                  return (
                    <article
                      key={c.id}
                      className={contactStyles.card}
                    >
                      <div className={contactStyles.primary}>
                        <span className={contactStyles.name}>
                          {c.name || "Unnamed"}
                        </span>

                        <div className={contactStyles.linkRow}>
                          <a
                            href={`mailto:${c.email}`}
                            className={contactStyles.link}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {c.email}
                          </a>

                          {(() => {
                            const phones = cleanPhones(c.phone_numbers);
                            if (phones.length === 0) return null;

                            // If only one number: show the number itself as tel: link
                            if (phones.length === 1) {
                              return (
                                <a
                                  href={`tel:${phones[0]}`}
                                  className={contactStyles.link}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {phones[0]}
                                </a>
                              );
                            }

                            // If multiple: show "Contacts +n" and open modal/panel
                            return (
                              <button
                                type="button"
                                className={contactStyles.link}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPhonePanel(phones, c.name || c.email || "Contact", c.email);
                                }}
                              >
                                Contact +{phones.length}
                              </button>
                            );
                          })()}
                        </div>
                      </div>

                      <div className={contactStyles.infoRow}>
                        <div className={[
                          contactStyles.infoItem,
                          contactStyles[`status_${status}`],
                              ].join(" ")}>
                         <span className={contactStyles.infoValue}>
                            <span
                              className={[contactStyles.statusBadge, contactStyles[`badge_${status}`]].join(" ")}
                            >
                              {status}
                            </span>
                          </span>
                          <span className={contactStyles.infoLabel}>Status</span>
                        </div>

                        <div className={contactStyles.infoItem}>
                          <span className={contactStyles.infoValue}>
                            {c.inquiry_count ?? 0}
                          </span>
                          <span className={contactStyles.infoLabel}>
                            Inquiries
                          </span>
                        </div>

                        <div className={contactStyles.infoItem}>
                          <span className={contactStyles.infoValue}>
                            {c.projects_count ?? 0}
                          </span>
                          <span className={contactStyles.infoLabel}>
                            Projects
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Desktop Modal (shown on larger screens) */}
      {phoneModalOpen && !isMobile && (
        <>
          <div
            className={contactStyles.modalOverlay}
            onClick={closePhonePanel}
          />
          <div className={contactStyles.modal}>
            <div className={contactStyles.modalHeader}>
              <div>
                <div className={contactStyles.modalTitle}>{activeContactName}</div>
                <div className={contactStyles.modalSubtitle}>
                  {activeContactEmail}
                </div>
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
                  <span className={contactStyles.modalItemLabel}>
                      {p}
                    </span>
                    <HiPhone size={20} className={contactStyles.modalItemIcon} />
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Mobile Bottom Sheet Panel (rendered via Portal) */}
      {mounted && createPortal(
        <>
          {/* Backdrop */}
          <div
            className={`${contactStyles.panelBackdrop} ${phoneModalOpen && isMobile ? contactStyles.panelBackdropVisible : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              closePhonePanel();
            }}
            onTouchMove={(e) => e.preventDefault()}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            className={`${contactStyles.phonePanel} ${phoneModalOpen && isMobile ? contactStyles.phonePanelOpen : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Phone numbers"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className={contactStyles.panelHandle}>
              <div className={contactStyles.panelHandleBar} />
            </div>

            {/* Header */}
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

            {/* Scrollable Content */}
            <div className={contactStyles.panelContent}>
              {/* Contact Info */}
              <div className={contactStyles.panelContactInfo}>
                <span className={contactStyles.panelContactName}>{activeContactName}</span>
                {activeContactEmail && (
                  <span className={contactStyles.panelContactEmail}>{activeContactEmail}</span>
                )}
              </div>

              {/* Phone Options */}
              <div className={contactStyles.panelOptions}>
                {activePhones.map((phone) => (
                  <a
                    key={phone}
                    href={`tel:${phone}`}
                    className={contactStyles.panelOption}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className={contactStyles.panelOptionLabel}>
                      {phone}
                    </span>
                    <HiPhone size={20} className={contactStyles.panelOptionIcon} />
                  </a>
                ))}
              </div>

              {/* Footer spacer for safe area */}
              <div className={contactStyles.panelFooter} />
            </div>
          </div>
        </>,
        document.body
      )}

      <DockBar activePage="contacts" inboxUnseenCount={unseenCount} />
    </div>
  );
}