"use server";

import { redirect } from "next/navigation";
import { portalSession, teacherSession } from "../../lib/portal-access";
import { readEventResourceMetadata, resourceTypes } from "../../lib/event-resources";
import { isUuid } from "../../lib/teacher-event";

const messageImageTypes = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/gif", "gif"],
]);

async function teacherCanChangeEvent(client: Awaited<ReturnType<typeof teacherSession>>["client"], eventId: string) {
  const { data, error } = await client.rpc("can_change_event", { p_event_id: eventId });
  return !error && data === true;
}

export async function prepareEventMessageImageUpload(form: FormData) {
  const eventId = form.get("eventId");
  const mimeType = form.get("mimeType");
  const fileSize = Number(form.get("fileSize"));
  if (!isUuid(eventId) || typeof mimeType !== "string" || !messageImageTypes.has(mimeType)
    || !Number.isInteger(fileSize) || fileSize < 1 || fileSize > 5 * 1024 * 1024) {
    return { error: "Choose a JPG, PNG, WebP or GIF image no larger than 5 MB." } as const;
  }
  const { client, user } = await portalSession();
  const path = `${eventId}/${user.id}/${crypto.randomUUID()}.${messageImageTypes.get(mimeType)}`;
  const { data, error } = await client.storage.from("event-message-images").createSignedUploadUrl(path);
  if (error || !data?.token) return { error: "We couldn’t prepare that image upload." } as const;
  return { path, token: data.token } as const;
}

export async function prepareEventResourceUpload(form: FormData) {
  const eventId = form.get("eventId");
  const mimeType = form.get("mimeType");
  const fileSize = Number(form.get("fileSize"));
  if (!isUuid(eventId) || typeof mimeType !== "string" || !resourceTypes.has(mimeType)
    || !Number.isInteger(fileSize) || fileSize < 1 || fileSize > 10 * 1024 * 1024) {
    return { error: "Choose a PDF, image, text or Word document no larger than 10 MB." } as const;
  }
  const { client, user } = await teacherSession();
  if (!await teacherCanChangeEvent(client, eventId)) {
    return { error: "Past events are read-only." } as const;
  }
  const path = `${eventId}/${user.id}/${crypto.randomUUID()}.${resourceTypes.get(mimeType)}`;
  const { data, error } = await client.storage.from("event-resources").createSignedUploadUrl(path);
  if (error || !data?.token) return { error: "We couldn’t prepare the event resource upload." } as const;
  return { path, token: data.token } as const;
}

export async function postEventMessage(form: FormData) {
  const eventId = form.get("eventId");
  const body = form.get("body");
  if (!isUuid(eventId) || typeof body !== "string" || !body.trim() || body.trim().length > 1000) {
    if (isUuid(eventId)) redirect(`/events/${eventId}?notice=message-failed#message-board`);
    redirect("/account");
  }

  const imagePathValue = form.get("imagePath");
  const imageMimeValue = form.get("imageMime");
  const imageSizeValue = form.get("imageSize");
  const imagePath = typeof imagePathValue === "string" && imagePathValue ? imagePathValue : null;
  const imageMime = typeof imageMimeValue === "string" && imageMimeValue ? imageMimeValue : null;
  const imageSize = typeof imageSizeValue === "string" && imageSizeValue ? Number(imageSizeValue) : null;
  const validImageSize = typeof imageSize === "number" && Number.isInteger(imageSize)
    && imageSize >= 1 && imageSize <= 5 * 1024 * 1024;
  if ((!imagePath && (imageMime !== null || imageSize !== null)) || (imagePath
    && (!imageMime || !messageImageTypes.has(imageMime) || !validImageSize))) {
    redirect(`/events/${eventId}?notice=image-invalid#message-board`);
  }

  const { client, user } = await portalSession();
  if (imagePath && !imagePath.startsWith(`${eventId}/${user.id}/`)) {
    redirect(`/events/${eventId}?notice=image-invalid#message-board`);
  }

  const { data, error } = await client.rpc("teamup_post_event_message_with_image", {
    p_event_id: eventId,
    p_body: body,
    p_image_path: imagePath,
    p_image_mime: imageMime,
    p_image_size: imageSize,
  });
  if ((error || !data) && imagePath) await client.storage.from("event-message-images").remove([imagePath]);
  redirect(`/events/${eventId}?notice=${!error && data ? "message-posted" : "message-failed"}#message-board`);
}

export async function setEventResource(form: FormData) {
  const eventId = form.get("eventId");
  if (!isUuid(eventId)) redirect("/account");
  const resource = readEventResourceMetadata(form);
  if ("error" in resource) redirect(`/events/${eventId}?notice=resource-invalid#event-resource`);
  const { client, user } = await teacherSession();
  if (!await teacherCanChangeEvent(client, eventId)) {
    await client.storage.from("event-resources").remove([resource.path]);
    redirect(`/events/${eventId}?notice=resource-failed#event-resource`);
  }
  if (!resource.path.startsWith(`${eventId}/${user.id}/`)) {
    redirect(`/events/${eventId}?notice=resource-invalid#event-resource`);
  }
  const { data: oldPath, error } = await client.rpc("teamup_set_event_resource", {
    p_event_id: eventId,
    p_storage_path: resource.path,
    p_file_name: resource.fileName,
    p_mime_type: resource.mimeType,
    p_file_size: resource.fileSize,
  });
  if (error) {
    await client.storage.from("event-resources").remove([resource.path]);
    redirect(`/events/${eventId}?notice=resource-failed#event-resource`);
  }
  if (typeof oldPath === "string" && oldPath && oldPath !== resource.path) {
    await client.storage.from("event-resources").remove([oldPath]);
  }
  redirect(`/events/${eventId}?notice=resource-saved#event-resource`);
}

export async function removeEventResource(form: FormData) {
  const eventId = form.get("eventId");
  if (!isUuid(eventId)) redirect("/account");
  const { client } = await teacherSession();
  if (!await teacherCanChangeEvent(client, eventId)) {
    redirect(`/events/${eventId}?notice=resource-remove-failed#event-resource`);
  }
  const { data: oldPath, error } = await client.rpc("teamup_remove_event_resource", { p_event_id: eventId });
  if (error) redirect(`/events/${eventId}?notice=resource-remove-failed#event-resource`);
  if (typeof oldPath === "string" && oldPath) await client.storage.from("event-resources").remove([oldPath]);
  redirect(`/events/${eventId}?notice=resource-removed#event-resource`);
}
