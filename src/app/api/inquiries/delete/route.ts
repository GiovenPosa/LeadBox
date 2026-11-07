import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

// POST /api/inquiries/delete  { ids: string[] }
// Deletes one or more enquiries and their qualifications. The caller sends
// their Supabase access token as "Authorization: Bearer <token>".

const MAX_IDS = 500;

export async function POST(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SECRET_KEY isn't set on the server." },
      { status: 500 }
    );
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_IDS ||
    !ids.every((id) => typeof id === "string" && id.length > 0 && id.length <= 64)
  ) {
    return NextResponse.json(
      { error: `Send "ids" as a list of 1 to ${MAX_IDS} enquiry ids.` },
      { status: 400 }
    );
  }

  // Qualifications point at the enquiry, so they go first
  const { error: qualError } = await admin
    .from("lead_qualifications")
    .delete()
    .in("inquiry_id", ids);
  if (qualError) {
    return NextResponse.json({ error: qualError.message }, { status: 500 });
  }

  const { data, error } = await admin
    .from("booking_inquiries")
    .delete()
    .in("id", ids)
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: (data ?? []).map((row) => row.id) });
}
