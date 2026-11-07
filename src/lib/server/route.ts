// Server-only: the frame every admin API route shares. It checks the caller's
// Supabase session and that they're in app_admins, parses the JSON body, and
// turns errors into a { error } response with a sensible status.

import { NextResponse } from "next/server";
import type postgres from "postgres";
import { getDb } from "./db";
import { getSupabaseAdmin } from "../supabaseAdmin";

type Sql = ReturnType<typeof postgres>;

/** An error whose message is safe to show the user, with its HTTP status */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Handler<T> = (ctx: { sql: Sql; userId: string; body: Record<string, unknown> }) => Promise<T>;

export function adminRoute<T>(handler: Handler<T>) {
  return async (req: Request) => {
    try {
      // who's asking comes first, so callers who aren't signed in learn nothing about the setup
      const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (!token) throw new ApiError(401, "Not signed in.");

      const supabase = getSupabaseAdmin();
      if (!supabase) throw new ApiError(500, "SUPABASE_SECRET_KEY isn't set on the server.");
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) throw new ApiError(401, "Your session has expired. Sign in again.");

      const sql = getDb();
      if (!sql) {
        throw new ApiError(500, "SUPABASE_DB_URL isn't a Postgres connection string on the server.");
      }

      const [admin] = await sql`select 1 from public.app_admins where user_id = ${data.user.id}`;
      if (!admin) throw new ApiError(403, "Your account isn't allowed to do that.");

      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      return NextResponse.json(await handler({ sql, userId: data.user.id, body }));
    } catch (err) {
      return errorResponse(err);
    }
  };
}

function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  // Postgres errors the user can act on, by the rule that was broken
  const { code, constraint_name: rule } = (err ?? {}) as { code?: string; constraint_name?: string };
  if (code === "23505") {
    const message =
      rule === "contacts_email_key" ? "That email already belongs to a contact." : "That's already saved.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
  if (code === "23514") {
    const message =
      rule === "contacts_email_or_phone"
        ? "A contact needs an email or a phone number."
        : rule === "outreach_stage_check"
          ? "The database doesn't know the Lead stage yet. Run the 20261108_outreach_lead_stage migration."
          : "One of the values isn't allowed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (code === "23503") {
    return NextResponse.json({ error: "Something else still depends on this, so it can't be changed." }, { status: 409 });
  }
  console.error("[api]", err);
  return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A uuid from the request body, or a 400 */
export function uuidField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !UUID.test(value)) throw new ApiError(400, `Send "${key}" as an id.`);
  return value;
}

/** An optional trimmed string from the request body: null when blank */
export function textField(body: Record<string, unknown> | undefined, key: string, max = 500): string | null {
  const value = body?.[key];
  if (value == null) return null;
  if (typeof value !== "string") throw new ApiError(400, `Send "${key}" as text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ApiError(400, `"${key}" is too long.`);
  return trimmed || null;
}
