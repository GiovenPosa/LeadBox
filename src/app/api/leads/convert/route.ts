import { adminRoute, ApiError, uuidField } from "../../../../lib/server/route";
import { findOrCreateContact } from "../../../../lib/server/contacts";
import { logActivityTx } from "../../../../lib/server/activity";

// POST /api/leads/convert  { inquiryId }
// Turns an enquiry into a lead, carrying its contact over, and marks the
// enquiry converted. Converting the same enquiry again returns its lead.

export const POST = adminRoute(async ({ sql, userId, body }) => {
  const inquiryId = uuidField(body, "inquiryId");

  return sql.begin(async (tx) => {
    const [inquiry] = await tx`
      select id, contact_id, name, email, phone, selected_types
      from public.booking_inquiries
      where id = ${inquiryId}
      for update
    `;
    if (!inquiry) throw new ApiError(404, "That enquiry no longer exists.");

    // every lead needs a contact; an enquiry normally has one already
    const contactId =
      inquiry.contact_id ??
      (await findOrCreateContact(tx, {
        name: inquiry.name,
        email: inquiry.email,
        phone: inquiry.phone,
        business: null,
        industry: inquiry.selected_types?.length ? inquiry.selected_types.join(", ") : null,
      }));

    // returns nothing when the enquiry is already a lead
    const created = await tx`
      insert into public.leads (inquiry_id, contact_id)
      values (${inquiryId}, ${contactId})
      on conflict (inquiry_id) do nothing
      returning id
    `;
    await tx`
      update public.booking_inquiries
      set opportunity_status = 'converted', contact_id = ${contactId}
      where id = ${inquiryId}
    `;
    const [lead] = await tx`select id, stage from public.leads where inquiry_id = ${inquiryId}`;
    if (created.length > 0) {
      await logActivityTx(tx, userId, "enquiry.converted", `${inquiry.name || inquiry.email} became a lead`, {
        inquiry_id: inquiryId,
        lead_id: lead.id,
        contact_id: contactId,
      });
    }
    return { lead: { id: lead.id, stage: lead.stage } };
  });
});
