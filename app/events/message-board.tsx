"use client";

import { useState } from "react";
import { ImagePlus, Send } from "lucide-react";
import type { EventMessage } from "../../lib/event-circle";
import { supabaseBrowser } from "../../lib/supabase-browser";
import { postEventMessage, prepareEventMessageImageUpload } from "./actions";
import styles from "./event-circle.module.css";

const imageExtensions = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/gif", "gif"],
]);

function messageTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function MessageBoard({ eventId, messages }: { eventId: string; messages: EventMessage[] }) {
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function submit(form: FormData) {
    setError("");
    setUploading(true);
    const image = form.get("image");
    try {
      if (image instanceof File && image.size > 0) {
        const extension = imageExtensions.get(image.type);
        if (!extension || image.size > 5 * 1024 * 1024) {
          setError("Choose a JPG, PNG, WebP or GIF image no larger than 5 MB.");
          return;
        }
        const request = new FormData();
        request.set("eventId", eventId);
        request.set("mimeType", image.type);
        request.set("fileSize", String(image.size));
        const prepared = await prepareEventMessageImageUpload(request);
        if ("error" in prepared) {
          setError(prepared.error ?? "We couldn’t prepare that image upload.");
          return;
        }
        const client = supabaseBrowser();
        const { error: uploadError } = await client.storage.from("event-message-images")
          .uploadToSignedUrl(prepared.path, prepared.token, image, { contentType: image.type, cacheControl: "3600" });
        if (uploadError) {
          setError("We couldn’t attach that image. Please try again.");
          return;
        }
        form.set("imagePath", prepared.path);
        form.set("imageMime", image.type);
        form.set("imageSize", String(image.size));
      }
      form.delete("image");
      await postEventMessage(form);
    } finally {
      setUploading(false);
    }
  }

  return <section className={styles.board} id="message-board" aria-labelledby="message-board-heading">
    <div className={styles.boardHeading}>
      <div>
        <h2 id="message-board-heading">Event message board</h2>
        <p>Share updates with everyone in this event circle.</p>
      </div>
      <span>{messages.length} {messages.length === 1 ? "message" : "messages"}</span>
    </div>

    {messages.length ? <ol className={styles.messages}>{messages.map(message => (
      <li key={message.id} className={styles.message} data-mine={message.is_mine}>
        <div><strong>{message.is_mine ? "You" : message.author_name}</strong><time dateTime={message.created_at}>{messageTime(message.created_at)}</time></div>
        <p>{message.body}</p>
        {message.image_url && <>
          {/* Private signed URLs are short-lived and cannot use a stable Next Image host pattern. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.messageImage} src={message.image_url}
            alt={`Event image shared by ${message.is_mine ? "you" : message.author_name}`} loading="lazy" />
        </>}
      </li>
    ))}</ol> : <p className={styles.noMessages}>No messages yet. Start the conversation for this event.</p>}

    <form action={submit} className={styles.messageForm}>
      <input type="hidden" name="eventId" value={eventId} />
      <label htmlFor="event-message">Add a message</label>
      <div className={styles.composer}>
        <textarea id="event-message" name="body" maxLength={1000} required rows={3} placeholder="Share an update, question, or reminder…" />
        <label className={styles.imageIcon} htmlFor="event-message-image" title="Attach an image">
          <ImagePlus aria-hidden="true" />
          <span className="sr-only">Attach an image</span>
          <input id="event-message-image" name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={event => setFileName(event.target.files?.[0]?.name ?? "")} />
        </label>
        <button type="submit" disabled={uploading}><Send aria-hidden="true" size={19} /> {uploading ? "Posting…" : "Post"}</button>
      </div>
      {fileName && <small className={styles.selectedFile}>Attached: {fileName}</small>}
      {error && <p className={styles.uploadError} role="alert">{error}</p>}
    </form>
  </section>;
}
