import type { ExactMatchRow, FetchIntent, FetchMatch, PreferenceMatchRow } from "./types";

function numberScore(value: number | string) {
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
}

function matchesIntent(skills: string[], intent: FetchIntent) {
  return intent.skills.length === 0 || intent.skills.some(skill => skills.includes(skill));
}

function emergencyFromReasons(reasons: string[] | null) {
  return (reasons ?? []).some(reason => /last-minute|urgent|emergency/iu.test(reason));
}

export function combineFetchMatches(
  exactRows: ExactMatchRow[], preferenceRows: PreferenceMatchRow[], intent: FetchIntent,
): FetchMatch[] {
  const merged = new Map<string, FetchMatch>();

  for (const row of exactRows) {
    const skills = row.skills ?? [];
    const emergencySeva = emergencyFromReasons(row.reasons);
    if (!row.available || !matchesIntent(skills, intent) || (intent.urgentOnly && !emergencySeva)) continue;
    const matchedSkills = intent.skills.filter(skill => skills.includes(skill));
    merged.set(row.person_id, {
      personId: row.person_id,
      fullName: row.full_name,
      city: row.city,
      skills,
      matchedSkills,
      availability: "full-event",
      sameCity: row.same_city,
      emergencySeva,
      invitationStatus: row.invitation_status,
      reasons: [
        matchedSkills.length ? `Skills: ${matchedSkills.join(", ")}` : "Skill match",
        "Scheduled availability covers the full event",
        ...(row.same_city && row.city ? [`Based in ${row.city}`] : []),
        ...(emergencySeva ? ["Open to last-minute seva"] : []),
      ],
      score: numberScore(row.score) + 100,
    });
  }

  for (const row of preferenceRows) {
    if (merged.has(row.person_id)) continue;
    const skills = row.skills ?? [];
    if (!matchesIntent(skills, intent) || (intent.urgentOnly && !row.emergency_seva)) continue;
    const matchedSkills = intent.skills.filter(skill => skills.includes(skill));
    merged.set(row.person_id, {
      personId: row.person_id,
      fullName: row.full_name,
      city: row.city,
      skills,
      matchedSkills,
      availability: "general-preference",
      sameCity: row.same_city,
      emergencySeva: row.emergency_seva,
      invitationStatus: row.invitation_status,
      reasons: [
        matchedSkills.length ? `Skills: ${matchedSkills.join(", ")}` : "Skill match",
        "General availability preference — confirm before inviting",
        ...(row.same_city && row.city ? [`Based in ${row.city}`] : []),
        ...(row.emergency_seva ? ["Open to last-minute seva"] : []),
      ],
      score: matchedSkills.length * 20 + (row.same_city ? 10 : 0) + (row.emergency_seva ? 2 : 0),
    });
  }

  return [...merged.values()].sort((a, b) => {
    const invitationOrder = Number(a.invitationStatus !== null) - Number(b.invitationStatus !== null);
    return invitationOrder || b.score - a.score || a.fullName.localeCompare(b.fullName);
  });
}
