import { supabase } from './supabaseClient';

/** Deletes enquiries (and their qualifications) by id. Returns the ids deleted. */
export async function deleteInquiries(ids: string[]): Promise<string[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in.');

  const res = await fetch('/api/inquiries/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ids }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Delete failed (${res.status}).`);
  return body.deleted ?? [];
}
