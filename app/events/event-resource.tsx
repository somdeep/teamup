"use client";

import { useState } from "react";
import { Download, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import type { EventResource } from "../../lib/event-resources";
import { readEventResource, uploadEventResource } from "../../lib/event-resources";
import { prepareEventResourceUpload, removeEventResource, setEventResource } from "./actions";
import styles from "./event-circle.module.css";

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export function EventResourcePanel({ eventId, resource, canManage }: {
  eventId: string;
  resource: EventResource | null;
  canManage: boolean;
}) {
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function submit(form: FormData) {
    setError("");
    setUploading(true);
    try {
      const selected = readEventResource(form.get("resource"));
      if ("error" in selected || !selected.file) {
        setError("Choose a PDF, image, text or Word document no larger than 10 MB.");
        return;
      }
      const request = new FormData();
      request.set("eventId", eventId);
      request.set("mimeType", selected.file.type);
      request.set("fileSize", String(selected.file.size));
      const prepared = await prepareEventResourceUpload(request);
      if ("error" in prepared) {
        setError(prepared.error ?? "We couldn’t prepare the event resource upload.");
        return;
      }
      const uploadError = await uploadEventResource(prepared.signedUrl, selected.file);
      if (uploadError) {
        setError(`We couldn’t upload the event resource: ${uploadError}`);
        return;
      }
      const metadata = new FormData();
      metadata.set("eventId", eventId);
      metadata.set("resourcePath", prepared.path);
      metadata.set("resourceName", selected.fileName);
      metadata.set("resourceMime", selected.file.type);
      metadata.set("resourceSize", String(selected.file.size));
      await setEventResource(metadata);
    } finally {
      setUploading(false);
    }
  }

  return <section className={styles.resourcePanel} id="event-resource" aria-labelledby="event-resource-title">
    <div className={styles.resourceHeading}><span><Paperclip aria-hidden="true" /><strong id="event-resource-title">Event resource</strong></span>
      {resource && <small>Updated {new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(resource.updated_at))}</small>}
    </div>
    {resource ? <div className={styles.resourceFile}>
      <FileText aria-hidden="true" />
      <span><strong>{resource.file_name}</strong><small>{fileSize(resource.file_size)}</small></span>
      {resource.url && <a href={resource.url} target="_blank" rel="noreferrer"><Download aria-hidden="true" />Open</a>}
      {canManage && <form action={removeEventResource}><input type="hidden" name="eventId" value={eventId} />
        <button aria-label={`Remove ${resource.file_name}`}><Trash2 aria-hidden="true" />Remove</button></form>}
    </div> : <p className={styles.noResource}>{canManage ? "Add one resource for volunteers confirmed for this event." : "No resource has been shared for this event."}</p>}
    {canManage && <form action={submit} className={styles.resourceForm}>
      <label><Upload aria-hidden="true" />{resource ? "Replace attachment" : "Add attachment"}
        <input name="resource" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp,text/plain,.doc,.docx" />
      </label>
      <small>PDF, image, text or Word document · up to 10 MB</small>
      <button disabled={uploading}>{uploading ? "Uploading…" : resource ? "Replace" : "Upload"}</button>
      {error && <p className={styles.uploadError} role="alert">{error}</p>}
    </form>}
  </section>;
}
