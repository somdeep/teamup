import { ImagePlus, Send } from "lucide-react";
import type { EventMessage } from "../../lib/event-circle";
import { postEventMessage } from "./actions";
import styles from "./event-circle.module.css";

function messageTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function MessageBoard({ eventId, messages }: { eventId: string; messages: EventMessage[] }) {
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

    <form action={postEventMessage} className={styles.messageForm}>
      <input type="hidden" name="eventId" value={eventId} />
      <label htmlFor="event-message">Add a message</label>
      <label className={styles.imagePicker} htmlFor="event-message-image"><ImagePlus aria-hidden="true" />Attach an image
        <input id="event-message-image" name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
        <small>JPG, PNG, WebP or GIF · up to 5 MB</small>
      </label>
      <div>
        <textarea id="event-message" name="body" maxLength={1000} required rows={3} placeholder="Share an update, question, or reminder…" />
        <button type="submit"><Send aria-hidden="true" size={19} /> Post</button>
      </div>
    </form>
  </section>;
}
