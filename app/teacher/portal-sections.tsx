import Link from "next/link";
import { ArrowRight, CalendarDays, CalendarPlus, ChevronRight, Inbox, MapPin, UsersRound, Zap } from "lucide-react";
import { formatEventTime } from "../../lib/teacher-event";
import { eventRoles, type DirectoryVolunteer, type MatchedVolunteer, type PortalEvent, type PortalInvitation } from "../../lib/teacher-data";
import { volunteerProfileHref } from "../../lib/volunteer-directory";
import { cancelInvitation, inviteVolunteer } from "./actions";
import styles from "./teacher.module.css";

export function TeacherTiles({ pending }: { pending: number }) {
  const tiles = [
    { view: "create", name: "Create Event", icon: CalendarPlus },
    { view: "find", name: "Find Volunteers", icon: UsersRound },
    { view: "requests", name: "Requests", icon: Inbox },
    { view: "events", name: "My Events", icon: CalendarDays },
    { view: "circles", name: "Event Circles", icon: UsersRound },
    { view: "priority", name: "Priority Request", icon: Zap },
  ];
  return <nav aria-label="Teacher tools" className={styles.tiles}>
    {tiles.map(({ view, name, icon: Icon }) => (
      <Link key={view} href={`/teacher?view=${view}`} className={`${styles.tile} ${view === "priority" ? styles.priority : ""}`}>
        <Icon aria-hidden="true" size={31} strokeWidth={2.2} />
        <span>{name}</span>
        {view === "requests" && pending > 0 && <span className={styles.badge} aria-label={`${pending} pending`}>{pending}</span>}
      </Link>
    ))}
  </nav>;
}

export function EventList({ events, circle = false }: { events: PortalEvent[]; circle?: boolean }) {
  if (!events.length) return <div className={styles.empty}>
    <p>There are no events to show yet.</p>
    <Link href="/teacher?view=create" className={styles.textLink}>Create an event <ArrowRight aria-hidden="true" size={17} /></Link>
  </div>;

  return <ul className={styles.stack}>
    {events.map(event => <li key={event.id}>
      <Link className={styles.eventRow} href={`/teacher?event=${event.id}`}>
        {event.category === "priority" ? <Zap aria-hidden="true" size={23} /> : <CalendarDays aria-hidden="true" size={23} />}
        <span><strong>{event.title}</strong><small>{formatEventTime(event)}{event.city && ` · ${event.city}`}</small>
          {event.roles.length > 0 && <small>{eventRoles(event)}</small>}
          {circle && <small>{event.invitations.filter(item => item.status === "accepted").length} confirmed · {event.volunteers_needed} needed</small>}
        </span>
        <ChevronRight aria-hidden="true" size={20} />
      </Link>
    </li>)}
  </ul>;
}

export function InvitationList({ requests }: { requests: { event: PortalEvent; invite: PortalInvitation }[] }) {
  if (!requests.length) return <p className={styles.empty}>Volunteer invitations and replies appear here.</p>;
  return <ul className={styles.stack}>{requests.map(({ event, invite }) => (
    <li key={invite.id} className={styles.reply}>
      <span><Link className={styles.volunteerName} href={volunteerProfileHref(invite.person_id, event.id)}>
        {invite.people?.full_name ?? "Volunteer"}
      </Link><small>{event.title}</small></span>
      <span className={styles.status} data-status={invite.status}>{invite.status}</span>
      {invite.status === "pending" && <form action={cancelInvitation}>
        <input type="hidden" name="eventId" value={event.id} />
        <input type="hidden" name="invitationId" value={invite.id} />
        <button className={styles.cancelButton} aria-label={`Cancel request to ${invite.people?.full_name ?? "volunteer"}`}>Cancel</button>
      </form>}
    </li>
  ))}</ul>;
}

export function VolunteerCard({ volunteer, event, match }: { volunteer: DirectoryVolunteer; event?: PortalEvent; match?: MatchedVolunteer }) {
  const invitation = match?.invitation_status ?? event?.invitations.find(item => item.person_id === volunteer.person_id)?.status;
  return <li className={styles.volunteer}>
    <Link className={styles.volunteerProfile} href={volunteerProfileHref(volunteer.person_id, event?.id)}>
      <div><h3>{volunteer.full_name}</h3>
      {volunteer.city && <p><MapPin aria-hidden="true" size={15} /> {volunteer.city}</p>}
      {volunteer.skills.length > 0 && <ul className={styles.tags}>{volunteer.skills.map(skill => <li key={skill}>{skill}</li>)}</ul>}
      {volunteer.skills_simulated && <small>Sample skills</small>}
      {volunteer.emergency_seva && <small>Open to last-minute seva</small>}
      {match && <p className={styles.reason}>{[...new Set(match.reasons)].join(" · ")}</p>}
      </div>
      <ChevronRight aria-hidden="true" size={20} />
    </Link>
    {invitation && <span className={styles.status} data-status={invitation}>{invitation}</span>}
    {event && !invitation && <form action={inviteVolunteer}>
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="personId" value={volunteer.person_id} />
      <button className={styles.smallButton} aria-label={`Invite ${volunteer.full_name}`}>Invite</button>
    </form>}
  </li>;
}
