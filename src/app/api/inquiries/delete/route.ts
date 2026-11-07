import { adminRoute, ApiError } from "../../../../lib/server/route";

// POST /api/inquiries/delete  { ids: string[] }
// Deletes one or more enquiries. Their leads go with them (they cascade), and
// so do the leads' qualification answers.

const MAX_IDS = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = adminRoute(async ({ sql, body }) => {
  const ids = body.ids;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_IDS ||
    !ids.every((id) => typeof id === "string" && UUID.test(id))
  ) {
    throw new ApiError(400, `Send "ids" as a list of 1 to ${MAX_IDS} enquiry ids.`);
  }

  return sql.begin(async (tx) => {
    // answers left over from before qualifications belonged to leads
    await tx`delete from public.lead_qualifications where inquiry_id = any(${ids}::uuid[])`;
    const deleted = await tx`
      delete from public.booking_inquiries where id = any(${ids}::uuid[]) returning id
    `;
    return { deleted: deleted.map((row) => row.id as string) };
  });
});
