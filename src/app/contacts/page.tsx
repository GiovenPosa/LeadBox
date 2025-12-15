"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import Sidebar from "../components/sidebar";
import TopBar from "../components/topbar";
import DockBar from "../components/dockbar";
import styles from "../homePage.module.css";
import contactStyles from "./contacts.module.css";
import { HiMiniUsers } from "react-icons/hi2";
import { useInbox } from "../context/inboxContext";

type Contact = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
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

  const fetchContacts = useCallback(async () => {
    setError(null);

    const { data, error } = await supabase
      .from("contacts_overview")
      .select(
        "id,email,name,phone,created_at,updated_at,inquiry_count,projects_count,last_inquiry_at,last_inquiry_status"
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

                          {c.phone && (
                            <a
                              href={`tel:${c.phone}`}
                              className={contactStyles.link}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {c.phone}
                            </a>
                          )}
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

      <DockBar activePage="contacts" inboxUnseenCount={unseenCount} />
    </div>
  );
}