import Link from "next/link";
import {
  Binoculars, BookOpen, CalendarDays, CheckCircle2, ChevronRight, Heart, MapPin, Sparkles, UserRound,
} from "lucide-react";
import { formatEventTime } from "../../lib/teacher-event";
import {
  opportunityBrowseHref, type OpportunityFilter, type VolunteerOpportunity,
} from "../../lib/volunteer-opportunities";
import { applyToOpportunity, favoriteOpportunity } from "./actions";
import { OpportunityFilters } from "./opportunity-filters";
import styles from "./volunteer.module.css";

function FavoriteButton({ opportunity, filter, detail = false }: {
  opportunity: VolunteerOpportunity;
  filter: OpportunityFilter;
  detail?: boolean;
}) {
  return <form action={favoriteOpportunity} className={styles.favoriteForm}>
    <input type="hidden" name="eventId" value={opportunity.id} />
    <input type="hidden" name="favorite" value={String(!opportunity.is_favorite)} />
    <input type="hidden" name="detail" value={String(detail)} />
    <input type="hidden" name="q" value={filter.q} />
    <input type="hidden" name="skill" value={filter.skill} />
    <input type="hidden" name="city" value={filter.city} />
    <input type="hidden" name="date" value={filter.date} />
    <input type="hidden" name="saved" value={filter.saved ? "1" : ""} />
    <button aria-label={`${opportunity.is_favorite ? "Remove" : "Save"} ${opportunity.title}`} data-saved={opportunity.is_favorite}>
      <Heart aria-hidden="true" fill={opportunity.is_favorite ? "currentColor" : "none"} />
    </button>
  </form>;
}

function OpportunityArt({ opportunity }: { opportunity: VolunteerOpportunity }) {
  const music = opportunity.required_skills.some(skill => skill === "Music & bhajans");
  const course = opportunity.category === "course";
  return <span className={styles.opportunityArt} data-kind={course ? "course" : music ? "music" : "seva"} aria-hidden="true">
    {course ? <BookOpen /> : music ? "♫" : <Sparkles />}
  </span>;
}

function StatusLabel({ opportunity }: { opportunity: VolunteerOpportunity }) {
  if (!opportunity.invitation_status) return null;
  const label = opportunity.invitation_status === "accepted" ? "Confirmed"
    : opportunity.invitation_status === "pending" && opportunity.request_source === "volunteer_application" ? "Applied"
    : opportunity.invitation_status === "pending" ? "Invitation" : "Declined";
  return <span className={styles.opportunityStatus} data-status={opportunity.invitation_status}>{label}</span>;
}

export function OpportunityBrowser({ opportunities, filter, unavailable = false }: {
  opportunities: VolunteerOpportunity[];
  filter: OpportunityFilter;
  unavailable?: boolean;
}) {
  return <div className={styles.browserStack}>
    <OpportunityFilters filter={filter} />

    {unavailable && <p className={styles.notice} role="alert">The opportunity browser needs its pending database migration before events can load.</p>}
    {!unavailable && opportunities.length === 0 && <p className={styles.empty}>No open opportunities match these filters.</p>}
    {!unavailable && opportunities.length > 0 && <ul className={styles.browseResults}>{opportunities.map(opportunity => <li key={opportunity.id}>
      <article className={styles.browseCard}>
        <OpportunityArt opportunity={opportunity} />
        <div className={styles.browseCardCopy}>
          <div><h2>{opportunity.title}</h2><StatusLabel opportunity={opportunity} /></div>
          {opportunity.category === "course" && <small className={styles.courseLabel}>Course seva</small>}
          <p><CalendarDays aria-hidden="true" /> {formatEventTime(opportunity)}</p>
          {(opportunity.venue_name || opportunity.city) && <p><MapPin aria-hidden="true" /> {[opportunity.venue_name, opportunity.city].filter(Boolean).join(" · ")}</p>}
          {opportunity.organizer_names.length > 0 && <p><UserRound aria-hidden="true" /> Organized by {opportunity.organizer_names.join(" · ")}</p>}
          {opportunity.required_skills.length > 0 && <ul className={styles.opportunityTags}>
            {opportunity.required_skills.slice(0, 3).map(skill => <li key={skill}>{skill}</li>)}
          </ul>}
        </div>
        <FavoriteButton opportunity={opportunity} filter={filter} />
        <Link className={styles.openOpportunity} href={opportunityBrowseHref(filter, opportunity.id)} aria-label={`View ${opportunity.title}`}>
          <ChevronRight aria-hidden="true" />
        </Link>
      </article>
    </li>)}</ul>}
  </div>;
}

export function OpportunityDetail({ opportunity, filter }: {
  opportunity: VolunteerOpportunity;
  filter: OpportunityFilter;
}) {
  return <article className={styles.opportunityDetail}>
    <div className={styles.detailArt}><Binoculars aria-hidden="true" /></div>
    <div className={styles.detailHeading}>
      <h2>{opportunity.title}</h2>
      <FavoriteButton opportunity={opportunity} filter={filter} detail />
      <StatusLabel opportunity={opportunity} />
    </div>
    <div className={styles.detailFacts}>
      <p><CalendarDays aria-hidden="true" /><span><strong>When</strong>{formatEventTime(opportunity)}</span></p>
      <p><MapPin aria-hidden="true" /><span><strong>Where</strong>{[opportunity.venue_name, opportunity.city].filter(Boolean).join(" · ") || "Location to be confirmed"}</span></p>
      <p><Sparkles aria-hidden="true" /><span><strong>Open spots</strong>{opportunity.spots_left}</span></p>
    </div>
    {opportunity.organizer_names.length > 0 && <p className={styles.organizerLine}><UserRound aria-hidden="true" />
      <span><strong>Organized by</strong>{opportunity.organizer_names.join(" · ")}</span></p>}
    {opportunity.required_skills.length > 0 && <div className={styles.detailSection}>
      <h3>Skills needed</h3><ul className={styles.opportunityTags}>{opportunity.required_skills.map(skill => <li key={skill}>{skill}</li>)}</ul>
    </div>}
    {opportunity.description && <div className={styles.detailSection}><h3>About this seva</h3><p>{opportunity.description}</p></div>}
    {opportunity.invitation_status === "pending" && opportunity.request_source === "teacher_invitation"
      && <Link className="landing-button primary" href="/volunteer?view=requests&tab=invitations">Respond to invitation</Link>}
    {opportunity.invitation_status === "pending" && opportunity.request_source === "volunteer_application"
      && <div className={styles.applicationPending}><CheckCircle2 aria-hidden="true" /><span><strong>Application submitted</strong>Pending teacher approval</span>
        <Link href="/volunteer?view=requests&tab=pending">View My Requests</Link></div>}
    {opportunity.invitation_status === "accepted" && <Link className="landing-button primary" href={`/events/${opportunity.id}`}>Open Event Circle</Link>}
    {(!opportunity.invitation_status || opportunity.invitation_status === "declined") && <form action={applyToOpportunity} className={styles.applicationForm}>
      <input type="hidden" name="eventId" value={opportunity.id} />
      <label><span>Select how you’d like to help</span>
        <select name="requestedRole" required>
          <option value="">Choose a role</option>
          {(opportunity.required_skills.length ? opportunity.required_skills : ["General support"])
            .map(skill => <option key={skill} value={skill}>{skill}</option>)}
        </select>
      </label>
      <button className="landing-button primary">Apply for this seva</button>
      <p>Submitting sends a request to the teacher. You are not confirmed until they accept.</p>
    </form>}
  </article>;
}

export function ApplicationSubmitted({ opportunity }: { opportunity: VolunteerOpportunity }) {
  return <section className={styles.applicationSuccess} aria-labelledby="application-success-title">
    <video autoPlay muted playsInline loop poster="/fetch/fetch-avatar.jpg" aria-label="Fetch celebrating your application">
      <source src="/fetch/dog-zen.mp4" type="video/mp4" />
    </video>
    <div className={styles.successHeading}><CheckCircle2 aria-hidden="true" /><h2 id="application-success-title">Application Submitted!</h2></div>
    <div className={styles.successEvent}>
      <span className={styles.successLotus} aria-hidden="true">✦</span>
      <div><strong>{opportunity.title}</strong><p><CalendarDays aria-hidden="true" /> {formatEventTime(opportunity)}</p>
        {(opportunity.city || opportunity.venue_name) && <p><MapPin aria-hidden="true" /> {[opportunity.venue_name, opportunity.city].filter(Boolean).join(" · ")}</p>}</div>
    </div>
    <p className={styles.successRole}><Sparkles aria-hidden="true" /> Selected role: <strong>{opportunity.requested_role ?? "General support"}</strong></p>
    <p className={styles.successStatus}><CheckCircle2 aria-hidden="true" /> Status: <strong>Pending Teacher Approval</strong></p>
    <p className={styles.successNote}>You’ll see the result in My Requests when your application is reviewed.</p>
    <div className={styles.successActions}>
      <Link href="/volunteer?view=requests&tab=pending">View My Requests</Link>
      <Link href="/volunteer?view=opportunities">Explore More Seva</Link>
    </div>
  </section>;
}
