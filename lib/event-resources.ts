import type { SupabaseClient } from "@supabase/supabase-js";
import type { portalSession, volunteerSession } from "./portal-access";

type PortalSession = Awaited<ReturnType<typeof portalSession>>;
type VolunteerSession = Awaited<ReturnType<typeof volunteerSession>>;

export const resourceTypes = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["text/plain", "txt"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
]);

export type EventResource = {
  event_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  updated_at: string;
  url: string | null;
};

export type VolunteerEventResource = {
  event_id: string;
  event_title: string;
  starts_at: string;
  timezone: string;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  updated_at: string | null;
  url: string | null;
};

export function readEventResource(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) return { file: null } as const;
  const extension = resourceTypes.get(value.type);
  if (!extension || value.size > 10 * 1024 * 1024) {
    return { error: "Choose a PDF, image, text or Word document no larger than 10 MB." } as const;
  }
  const fileName = value.name.split(/[\\/]/).pop()?.trim().slice(0, 200) || `Event resource.${extension}`;
  return { file: value, extension, fileName } as const;
}

export function readEventResourceMetadata(form: FormData) {
  const path = form.get("resourcePath");
  const fileName = form.get("resourceName");
  const mimeType = form.get("resourceMime");
  const sizeValue = form.get("resourceSize");
  const fileSize = typeof sizeValue === "string" ? Number(sizeValue) : Number.NaN;
  if (typeof path !== "string" || !path || path.length > 500
    || typeof fileName !== "string" || !fileName.trim() || fileName.length > 200
    || typeof mimeType !== "string" || !resourceTypes.has(mimeType)
    || !Number.isInteger(fileSize) || fileSize < 1 || fileSize > 10 * 1024 * 1024) {
    return { error: "Invalid event resource metadata." } as const;
  }
  return { path, fileName: fileName.trim(), mimeType, fileSize } as const;
}

export async function uploadEventResource(
  client: SupabaseClient, accountId: string, eventId: string,
  resource: Exclude<ReturnType<typeof readEventResource>, { error: string }> & { file: File },
) {
  const path = `${eventId}/${accountId}/${crypto.randomUUID()}.${resource.extension}`;
  const { error } = await client.storage.from("event-resources").upload(path, await resource.file.arrayBuffer(), {
    contentType: resource.file.type, cacheControl: "3600", upsert: false,
  });
  if (error) return { error: "We couldn’t upload the event resource." } as const;
  return {
    path, fileName: resource.fileName, mimeType: resource.file.type, fileSize: resource.file.size,
  } as const;
}

async function withSignedUrl<T extends { storage_path: string | null }>(client: SupabaseClient, resource: T) {
  if (!resource.storage_path) return { ...resource, url: null };
  const { data } = await client.storage.from("event-resources").createSignedUrl(resource.storage_path, 60 * 60);
  return { ...resource, url: data?.signedUrl ?? null };
}

export async function eventResource({ client }: PortalSession, eventId: string) {
  const { data, error } = await client.rpc("teamup_event_resource", { p_event_id: eventId });
  if (error?.code === "PGRST202" || !data) return null;
  if (error) throw new Error("Could not load the event resource.");
  return withSignedUrl(client, data as Omit<EventResource, "url">);
}

export async function volunteerEventResources({ client }: VolunteerSession) {
  const { data, error } = await client.rpc("teamup_volunteer_resources", { p_limit: 5 });
  if (error?.code === "PGRST202") return [];
  if (error) throw new Error("Could not load learning resources.");
  return Promise.all(((data ?? []) as Omit<VolunteerEventResource, "url">[])
    .map(resource => withSignedUrl(client, resource)));
}
