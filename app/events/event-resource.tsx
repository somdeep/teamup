import { Download, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import type { EventResource } from "../../lib/event-resources";
import { removeEventResource, setEventResource } from "./actions";
import styles from "./event-circle.module.css";

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export function EventResourcePanel({ eventId, resource, canManage }: {
  eventId: string;
  resource: EventResource | null;
  canManage: boolean;
}) {
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
    {canManage && <form action={setEventResource} className={styles.resourceForm}>
      <input type="hidden" name="eventId" value={eventId} />
      <label><Upload aria-hidden="true" />{resource ? "Replace attachment" : "Add attachment"}
        <input name="resource" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp,text/plain,.doc,.docx" />
      </label>
      <small>PDF, image, text or Word document · up to 10 MB</small>
      <button>{resource ? "Replace" : "Upload"}</button>
    </form>}
  </section>;
}
