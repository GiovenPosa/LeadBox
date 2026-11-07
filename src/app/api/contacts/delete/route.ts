import { adminRoute, ApiError, uuidField } from "../../../../lib/server/route";

// POST /api/contacts/delete  { contactId }
// Deletes a contact and their enquiries (every enquiry belongs to a contact).
// A contact with a lead can't be deleted: the lead has to be removed first.

export const POST = adminRoute(async ({ sql, body }) => {
  const contactId = uuidField(body, "contactId");

  return sql.begin(async (tx) => {
    const [lead] = await tx`select id from public.leads where contact_id = ${contactId} limit 1`;
    if (lead) {
      throw new ApiError(409, "This contact has a lead. Remove the lead first, then delete the contact.");
    }

    // answers left over from before qualifications belonged to leads
    await tx`
      delete from public.lead_qualifications
      where inquiry_id in (select id from public.booking_inquiries where contact_id = ${contactId})
    `;
    const enquiries = await tx`
      delete from public.booking_inquiries where contact_id = ${contactId} returning id
    `;
    const [contact] = await tx`delete from public.contacts where id = ${contactId} returning id`;
    if (!contact) throw new ApiError(404, "That contact no longer exists.");

    return { deletedEnquiries: enquiries.length };
  });
});
