// Contacts: the people behind enquiries and leads.
// Deleting runs as a transaction in the app's API route (src/app/api/contacts).

import { supabase } from "./supabaseClient";
import { postJson } from "./api";

/** The contact's lead, if they have one (a contact with a lead can't be deleted) */
export async function leadIdForContact(contactId: string): Promise<string | null> {
  const { data } = await supabase.from("leads").select("id").eq("contact_id", contactId).limit(1);
  return data?.[0]?.id ?? null;
}

/** Delete a contact and their enquiries; resolves with how many enquiries went too */
export async function deleteContact(contactId: string): Promise<number> {
  const { deletedEnquiries } = await postJson<{ deletedEnquiries: number }>("/api/contacts/delete", { contactId });
  return deletedEnquiries;
}
