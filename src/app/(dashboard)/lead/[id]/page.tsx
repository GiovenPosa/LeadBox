"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { leadHref } from "../../../../lib/leads";
import styles from "../../homePage.module.css";

// Old links went to /lead/<enquiry id>. Leads now have their own ids, so send
// those links to the enquiry's lead, or to the Inbox if it was never converted.
export default function OldLeadRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("leads")
      .select("id")
      .eq("inquiry_id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) router.replace(data ? leadHref(data.id) : "/inbox");
      });
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  return <div className={styles.canvas} />;
}
