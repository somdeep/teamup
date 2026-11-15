import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays, Camera, Car, ChefHat, ChevronRight, ClipboardCheck, HeartHandshake, Phone,
  Laptop, MapPin, Megaphone, Music2, Palette, UserPlus, UserRound, UsersRound, Wrench,
  type LucideIcon,
} from "lucide-react";
import type { PortalEvent, VolunteerDirectoryProfile } from "../../lib/teacher-data";
import { directoryAvailability, volunteerDirectoryHref, type DirectoryFilter } from "../../lib/volunteer-directory";
import { cancelInvitation, inviteVolunteer } from "./actions";
import { DirectoryFilters } from "./directory-filters";
import styles from "./directory.module.css";

const skillIcons: Record<string, LucideIcon> = {
  "Community Outreach": Megaphone, Decor: Palette, Driving: Car, "Greeting & hospitality": HeartHandshake,
  "Kitchen seva": ChefHat, "Music & bhajans": Music2, Photography: Camera, "Registration desk": ClipboardCheck,
  "Setup & logistics": Wrench, "Social media": Megaphone, "Tech & AV": Laptop,
};

function Avatar({ volunteer, large = false }: { volunteer: VolunteerDirectoryProfile; large?: boolean }) {
  const words = volunteer.full_name.trim().split(/\s+/);
  const initials = [words[0], words.length > 1 ? words.at(-1) : ""]
    .map(word => Array.from(word || "")[0] ?? "").join("").toLocaleUpperCase();
  const tone = (volunteer.full_name.codePointAt(0) ?? 0) % 3;
  return <span className={large ? `${styles.avatar} ${styles.largeAvatar}` : styles.avatar} data-tone={tone} aria-hidden="true">
    {initials || <UserRound size={28} />}
    {volunteer.has_photo && <Image src={`/teacher/volunteers/${volunteer.person_id}/photo`} alt=""
      width={large ? 144 : 112} height={large ? 144 : 112} unoptimized />}
  </span>;
}

function AvailabilityBadge({ volunteer }: { volunteer: VolunteerDirectoryProfile }) {
  return <span className={styles.availability} data-status={volunteer.availability_status}>
    {directoryAvailability[volunteer.availability_status]}
  </span>;
}

function SkillList({ skills }: { skills: string[] }) {
  if (!skills.length) return null;
  return <ul className={styles.skillList} aria-label="Skills">
    {skills.map(skill => {
      const Icon = Object.hasOwn(skillIcons, skill) ? skillIcons[skill] : UsersRound;
      return <li key={skill}><Icon aria-hidden="true" size={19} /> {skill}</li>;
    })}
  </ul>;
}

function InviteButton({ volunteer, event, request = false }: { volunteer: VolunteerDirectoryProfile; event?: PortalEvent; request?: boolean }) {
  if (!event) return null;
  const invitation = event.invitations.find(item => item.person_id === volunteer.person_id);
  if (invitation?.status === "pending") return <form action={cancelInvitation}>
    <input type="hidden" name="eventId" value={event.id} />
    <input type="hidden" name="invitationId" value={invitation.id} />
    <button className={styles.cancelRequest} aria-label={`Cancel request to ${volunteer.full_name}`}>Cancel Request</button>
  </form>;
  if (invitation) return <span className={styles.inviteStatus}>{request ? "Request" : "Invitation"} {invitation.status}</span>;
  return <form action={inviteVolunteer}>
    <input type="hidden" name="eventId" value={event.id} />
    <input type="hidden" name="personId" value={volunteer.person_id} />
    <button className={styles.invite} aria-label={`${request ? "Send event request to" : "Invite"} ${volunteer.full_name}`}>
      <UserPlus size={17} aria-hidden="true" /> {request ? "Send Request" : "Invite"}
    </button>
  </form>;
}

export function VolunteerProfileHero({ volunteer }: { volunteer: VolunteerDirectoryProfile }) {
  return <div className={styles.profileHero}><Avatar volunteer={volunteer} large /></div>;
}

export function VolunteerProfileAvailability({ volunteer }: { volunteer: VolunteerDirectoryProfile }) {
  return <AvailabilityBadge volunteer={volunteer} />;
}

export function VolunteerDirectory({ filter, events, event, volunteers, hasNext }: {
  filter: DirectoryFilter; events: PortalEvent[]; event?: PortalEvent;
  volunteers: VolunteerDirectoryProfile[]; hasNext: boolean;
}) {
  const hasFilters = Boolean(filter.q || filter.city || filter.skill || filter.availability);
  const clear = volunteerDirectoryHref({ ...filter, q: "", city: "", skill: "", availability: "", page: 1 });
  return <div className={styles.directory}>
    <DirectoryFilters key={volunteerDirectoryHref({ ...filter, page: 1 })}
      filter={filter} events={events.map(({ id, title }) => ({ id, title }))} />
    {(event || hasFilters) && <div className={styles.context}>
      {event && <p><CalendarDays size={17} aria-hidden="true" /> Inviting for <strong>{event.title}</strong></p>}
      {hasFilters && <Link href={clear} className={styles.textLink}>Clear filters</Link>}
    </div>}
    {volunteers.length ? <ul className={styles.results}>
      {volunteers.map(volunteer => <li className={styles.card} key={volunteer.person_id}>
        <Avatar volunteer={volunteer} />
        <div className={styles.cardContent}>
          <div className={styles.cardHeading}>
            <h2>{volunteer.full_name}</h2>
            <AvailabilityBadge volunteer={volunteer} />
          </div>
          <SkillList skills={volunteer.skills} />
          {volunteer.city && <p className={styles.city}><MapPin size={15} aria-hidden="true" /> {volunteer.city}</p>}
          <div className={styles.cardActions}>
            <InviteButton volunteer={volunteer} event={event} />
            <Link className={styles.profileLink} href={volunteerDirectoryHref(filter, volunteer.person_id)}
              aria-label={`View profile for ${volunteer.full_name}`}>
              View Profile <ChevronRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </li>)}
    </ul> : <p className={styles.empty}>No volunteers match these filters.</p>}
    {(filter.page > 1 || hasNext) && <nav className={styles.pagination} aria-label="Volunteer results pages">
      {filter.page > 1 && <Link className={styles.textLink} href={volunteerDirectoryHref({ ...filter, page: filter.page - 1 })}>Previous</Link>}
      <span>Page {filter.page}</span>
      {hasNext && <Link className={styles.textLink} href={volunteerDirectoryHref({ ...filter, page: filter.page + 1 })}>Next</Link>}
    </nav>}
  </div>;
}

export function VolunteerDirectoryDetails({ volunteer, event, events, phone }: {
  volunteer: VolunteerDirectoryProfile;
  event?: PortalEvent;
  events: PortalEvent[];
  phone: string | null;
}) {
  const phoneHref = phone?.replace(/[^\d+*#;,]/g, "");
  const availability = volunteer.availability_patterns.length
    ? volunteer.availability_patterns.join(", ")
    : directoryAvailability[volunteer.availability_status];
  return <section className={styles.details} aria-label="Volunteer details">
    {volunteer.skills.length > 0 && <div className={styles.profileSkills}>
      <SkillList skills={volunteer.skills} />
    </div>}
    <div className={styles.profileStats}>
      <div><CalendarDays aria-hidden="true" size={28} /><span><strong>Availability</strong><small>{availability}</small></span></div>
      <div><MapPin aria-hidden="true" size={28} /><span><strong>Location</strong><small>{volunteer.city || "Not provided"}</small></span></div>
      <div><HeartHandshake aria-hidden="true" size={28} /><span><strong>Past Seva</strong><small>{volunteer.past_seva_count} {volunteer.past_seva_count === 1 ? "event" : "events"}</small></span></div>
    </div>
    {volunteer.emergency_seva && <p className={styles.emergency}><strong>Open to last-minute seva</strong></p>}
    {volunteer.interests.length > 0 && <div className={styles.profilePanel}>
      <h2>Interested in learning</h2>
      <p>{volunteer.interests.join(" · ")}</p>
    </div>}
    {event && <p className={styles.eventContext}><CalendarDays size={17} aria-hidden="true" /> Request for <strong>{event.title}</strong></p>}
    <div className={styles.detailsActions}>
      {event ? <InviteButton volunteer={volunteer} event={event} request /> : events.length > 0 ? (
        <details className={styles.requestChooser}>
          <summary><UserPlus size={20} aria-hidden="true" /> Send Request</summary>
          <form action={inviteVolunteer} className={styles.requestForm}>
            <input type="hidden" name="personId" value={volunteer.person_id} />
            <label>Choose an event
              <select name="eventId" required defaultValue="">
                <option value="" disabled>Select event</option>
                {events.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <button className={styles.invite}>Send Request</button>
          </form>
        </details>
      ) : <Link className={styles.invite} href="/teacher?view=create"><UserPlus size={20} aria-hidden="true" /> Create Event First</Link>}
      {phoneHref && <a className={styles.callButton} href={`tel:${phoneHref}`} aria-label={`Call ${volunteer.full_name}`}>
        <Phone size={19} aria-hidden="true" /> Call
      </a>}
    </div>
  </section>;
}
