"use server";

import { redirect } from "next/navigation";
import { portalSession } from "../../lib/portal-access";
import { readEventResource, uploadEventResource } from "../../lib/event-resources";
import { isUuid } from "../../lib/teacher-event";

export async function postEventMessage(form: FormData) {
  const eventId = form.get("eventId");
  const body = form.get("body");
  if (!isUuid(eventId) || typeof body !== "string" || !body.trim() || body.trim().length > 1000) {
    if (isUuid(eventId)) redirect(`/events/${eventId}?notice=message-failed#message-board`);
    redirect("/account");
  }

  const image = form.get("image");
  const attachment = image instanceof File && image.size > 0 ? image : null;
  const allowedImages = new Map([
    ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/gif", "gif"],
  ]);
  if (attachment && (!allowedImages.has(attachment.type) || attachment.size > 5 * 1024 * 1024)) {
    redirect(`/events/${eventId}?notice=image-invalid#message-board`);
  }

  const { client, user } = await portalSession();
  let imagePath: string | null = null;
  if (attachment) {
    const extension = allowedImages.get(attachment.type);
    imagePath = `${eventId}/${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await client.storage.from("event-message-images").upload(
      imagePath, await attachment.arrayBuffer(), {
        contentType: attachment.type, cacheControl: "3600", upsert: false,
      },
    );
    if (uploadError) redirect(`/events/${eventId}?notice=image-failed#message-board`);
  }

  const { data, error } = await client.rpc("teamup_post_event_message_with_image", {
    p_event_id: eventId,
    p_body: body,
    p_image_path: imagePath,
    p_image_mime: attachment?.type ?? null,
    p_image_size: attachment?.size ?? null,
  });
  if ((error || !data) && imagePath) await client.storage.from("event-message-images").remove([imagePath]);
  redirect(`/events/${eventId}?notice=${!error && data ? "message-posted" : "message-failed"}#message-board`);
}

export async function setEventResource(form: FormData) {
  const eventId = form.get("eventId");
  if (!isUuid(eventId)) redirect("/account");
  const resource = readEventResource(form.get("resource"));
  if ("error" in resource || !resource.file) redirect(`/events/${eventId}?notice=resource-invalid#event-resource`);
  const { client, user } = await portalSession();
  const uploaded = await uploadEventResource(client, user.id, eventId, resource);
  if ("error" in uploaded) redirect(`/events/${eventId}?notice=resource-failed#event-resource`);
  const { data: oldPath, error } = await client.rpc("teamup_set_event_resource", {
    p_event_id: eventId,
    p_storage_path: uploaded.path,
    p_file_name: uploaded.fileName,
    p_mime_type: uploaded.mimeType,
    p_file_size: uploaded.fileSize,
  });
  if (error) {
    await client.storage.from("event-resources").remove([uploaded.path]);
    redirect(`/events/${eventId}?notice=resource-failed#event-resource`);
  }
  if (typeof oldPath === "string" && oldPath && oldPath !== uploaded.path) {
    await client.storage.from("event-resources").remove([oldPath]);
  }
  redirect(`/events/${eventId}?notice=resource-saved#event-resource`);
}

export async function removeEventResource(form: FormData) {
  const eventId = form.get("eventId");
  if (!isUuid(eventId)) redirect("/account");
  const { client } = await portalSession();
  const { data: oldPath, error } = await client.rpc("teamup_remove_event_resource", { p_event_id: eventId });
  if (error) redirect(`/events/${eventId}?notice=resource-remove-failed#event-resource`);
  if (typeof oldPath === "string" && oldPath) await client.storage.from("event-resources").remove([oldPath]);
  redirect(`/events/${eventId}?notice=resource-removed#event-resource`);
}
