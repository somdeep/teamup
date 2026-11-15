import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { accountAccess, accountRoleLabels, teacherLanding, volunteerLanding } from "../../lib/account-access";
import {
  accountProfile, editableAccountProfile, needsProfileCompletion, storedAccountProfile,
} from "../../lib/account-profile";
import { sevaAvailabilityProfile } from "../../lib/seva-profile";
import { portalNotifications } from "../../lib/portal-notifications";
import { isLive, supabase } from "../../lib/supabase";
import { signOut } from "../auth/actions";
import { AuthShell } from "../auth/auth-shell";
import { PortalHeaderActions } from "../auth/portal-header-actions";
import styles from "../sign-up/sign-up.module.css";
import { requestTeacherAccess } from "./actions";

export const metadata: Metadata = { title: "Your Account | TeamUp", robots: { index: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ notice?: string; view?: string }> }) {
  if (!isLive) redirect("/login");
  const client = await supabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  if (!data.user.email_confirmed_at) redirect("/login?notice=check-email");
  const { data: storedProfile, error: storedProfileError } = await storedAccountProfile(client, data.user.id);
  if (storedProfileError) throw new Error("Could not check your TeamUp profile.");
  if (needsProfileCompletion(storedProfile)) redirect("/complete-profile");
  const { data: profile, error: profileError } = await accountProfile(client);
  if (profileError) throw new Error("Could not load your TeamUp profile.");
  if (profile) {
    const { data: details } = await sevaAvailabilityProfile(client);
    if (details && !details.complete) redirect("/about-you");
    if (details && !details.skills_reviewed) redirect("/my-skills");
    if (details && !details.availability_reviewed) redirect("/my-availability");
  }

  const { notice, view } = await searchParams;
  const { data: editableProfile } = profile ? await editableAccountProfile(client) : { data: null };
  const { data: access, error: accessError } = profile ? await accountAccess(client) : { data: null, error: null };
  const landingPage = teacherLanding(access, view, notice);
  if (landingPage) redirect(landingPage);
  const volunteerPage = volunteerLanding(access, view, notice);
  if (volunteerPage) redirect(volunteerPage);
  const notifications = await portalNotifications(client, data.user.id, access);
  return (
    <AuthShell title="Your Account" headerActions={<PortalHeaderActions notificationsHref={notifications.href}
      pendingCount={notifications.pending} notificationLabel={notifications.label} />}>
      <section className={styles.confirmation} aria-label="Account details">
        {profile && <h2>{profile.display_name}</h2>}
        <p>{data.user.email}</p>
        {profile ? <>
          {access && <p>Role · {accountRoleLabels[access.role]}</p>}
          {profile.contact_phone && <p>Phone · {profile.contact_phone}</p>}
          {editableProfile?.city && <p>Location · {editableProfile.city}</p>}
          {profile.last_course && <p>Last course · {profile.last_course}</p>}
          {profile.courses.length > 0 && <p>Courses · {profile.courses.join(", ")}</p>}
          {profile.skills.length > 0 && <p>Skills · {profile.skills.join(", ")}</p>}
        </> : <p role="alert">We couldn’t load your profile. Refresh this page to try again.</p>}
        {notice === "signout-failed" && <p role="alert">Couldn’t log out. Please try again.</p>}
        {notice === "seva-saved" && <p role="status">Your seva preferences were saved.</p>}
        {notice === "skills-saved" && <p role="status">Your skills and learning interests were saved.</p>}
        {notice === "availability-saved" && <p role="status">Your profile was saved.</p>}
        {notice === "profile-details-saved" && <p role="status">Your account profile was updated.</p>}
        {notice === "teacher-access" && <p role="status">Request Teacher access to use event and invitation tools.</p>}
        {notice === "teacher-request-failed" && <p role="alert">We couldn’t send your Teacher access request. Please try again.</p>}
        {accessError && <p role="alert">We couldn’t check your account role. Refresh to try again.</p>}
        {access && (access.role === "teacher" || access.teacher_request === "pending") && (
          <Link className="landing-button primary" href="/teacher">Teacher Portal</Link>
        )}
        {access && access.role !== "teacher" && access.teacher_request === "declined" && <p>Your Teacher access request was declined.</p>}
        {access && access.role !== "teacher" && !access.teacher_request && (
          <form action={requestTeacherAccess}><button className="landing-button secondary">Request Teacher Access</button></form>
        )}
        {profile && access?.role === "volunteer" && <Link className="landing-button primary" href="/volunteer">Volunteer Portal</Link>}
        {profile && <Link className="landing-button secondary" href="/account/profile">Edit Profile</Link>}
        {profile && <Link className="landing-button secondary" href="/about-you">Edit Seva Preferences</Link>}
        {profile && <Link className="landing-button secondary" href="/my-skills">Edit My Skills</Link>}
        {profile && <Link className="landing-button secondary" href="/my-availability">Edit Availability</Link>}
        <form action={signOut}>
          <button className="landing-button secondary">Log Out</button>
        </form>
      </section>
    </AuthShell>
  );
}
