import { postJson } from "./api";

/** Deletes enquiries (and their leads) by id. Returns the ids deleted. */
export async function deleteInquiries(ids: string[]): Promise<string[]> {
  const { deleted } = await postJson<{ deleted: string[] }>("/api/inquiries/delete", { ids });
  return deleted ?? [];
}
