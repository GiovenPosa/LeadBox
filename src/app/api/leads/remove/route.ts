import { adminRoute, ApiError, uuidField } from "../../../../lib/server/route";

// POST /api/leads/remove  { leadId }
// Removes a lead; its qualification answers go with it (they cascade). Its
// notes move to the contact, so the history isn't lost. The enquiry it came
// from goes back to contacted, an outreach business back to replied.

export const POST = adminRoute(async ({ sql, body }) => {
  const leadId = uuidField(body, "leadId");

  return sql.begin(async (tx) => {
    const [found] = await tx`select contact_id from public.leads where id = ${leadId} for update`;
    if (!found) throw new ApiError(404, "That lead no longer exists.");

    // removing a lead undoes a conversion, it isn't a deletion: keep its notes on the person
    await tx`
      update public.notes set lead_id = null, contact_id = ${found.contact_id}
      where lead_id = ${leadId}
    `;

    const [lead] = await tx`
      delete from public.leads where id = ${leadId}
      returning inquiry_id, outreach_id
    `;

    if (lead.inquiry_id) {
      await tx`
        update public.booking_inquiries set opportunity_status = 'contacted'
        where id = ${lead.inquiry_id}
      `;
    }
    if (lead.outreach_id) {
      await tx`
        update public.outreach set stage = 'replied'
        where id = ${lead.outreach_id} and stage = 'converted'
      `;
    }
    return { removed: leadId };
  });
});
