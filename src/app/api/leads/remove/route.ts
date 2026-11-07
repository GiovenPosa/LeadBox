import { adminRoute, ApiError, uuidField } from "../../../../lib/server/route";
import { logActivityTx } from "../../../../lib/server/activity";

// POST /api/leads/remove  { leadId }
// Removes a lead; its qualification answers go with it (they cascade). Its
// notes move to the contact, so the history isn't lost. The enquiry it came
// from goes back to contacted, an outreach business back to replied.

export const POST = adminRoute(async ({ sql, userId, body }) => {
  const leadId = uuidField(body, "leadId");

  return sql.begin(async (tx) => {
    const [found] = await tx`
      select l.contact_id, coalesce(nullif(c.name, ''), c.email, 'A lead') as name
      from public.leads l join public.contacts c on c.id = l.contact_id
      where l.id = ${leadId}
      for update of l
    `;
    if (!found) throw new ApiError(404, "That lead no longer exists.");

    // removing a lead undoes a conversion, it isn't a deletion: keep its notes and tasks on the person
    await tx`
      update public.notes set lead_id = null, contact_id = ${found.contact_id}
      where lead_id = ${leadId}
    `;
    await tx`
      update public.tasks set lead_id = null, contact_id = ${found.contact_id}
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
    await logActivityTx(tx, userId, "lead.removed", `${found.name} is no longer a lead`, {
      contact_id: found.contact_id,
      inquiry_id: lead.inquiry_id,
      outreach_id: lead.outreach_id,
    });
    return { removed: leadId };
  });
});
