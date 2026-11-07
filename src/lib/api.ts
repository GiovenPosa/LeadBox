// Calls the lead app's own API routes (src/app/api), sending the signed-in
// user's Supabase token so the route can check who's asking.

import { supabase } from "./supabaseClient";

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));

  // the session was signed out or revoked elsewhere: sign in again
  if (res.status === 401) {
    await supabase.auth.signOut({ scope: "local" });
    window.location.assign("/login");
    throw new Error(json.error ?? "Your session has expired. Sign in again.");
  }
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`);
  return json as T;
}
