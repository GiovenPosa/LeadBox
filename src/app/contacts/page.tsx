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
};

export default function ContactsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { unseenCount } = useInbox();

  const fetchContacts = useCallback(async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("id,email,name,phone,created_at")
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setContacts((data ?? []) as Contact[]);
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
      await fetchContacts();
      setLoading(false);
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
      <Sidebar email={email} onSignOut={signOut} inboxUnseenCount={unseenCount} activePage="contacts" />

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
                {contacts.map((c) => (
                  <article key={c.id} className={contactStyles.card}>
                    <div className={contactStyles.primary}>
                      <span className={contactStyles.name}>
                        {c.name || "Unnamed"}
                      </span>

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

                    <span className={contactStyles.date}>
                      {new Date(c.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      <DockBar activePage="contacts" inboxUnseenCount={unseenCount} />
    </div>
  );
}