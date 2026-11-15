import assert from "node:assert/strict";
import test from "node:test";
import { groupVolunteerInvitations, type VolunteerInvitation } from "../lib/volunteer-data";

const now = Date.parse("2026-11-15T12:00:00Z");

function invitation(id: string, status: VolunteerInvitation["status"], starts: string, eventStatus = "scheduled",
  requestSource: VolunteerInvitation["request_source"] = "teacher_invitation") {
  return {
    id, status, invited_at: "2026-11-01T00:00:00Z", request_source: requestSource, requested_role: null,
    events: {
      id: `event-${id}`, title: id, description: null, city: "Toronto", venue_name: null,
      starts_at: starts, ends_at: new Date(Date.parse(starts) + 3_600_000).toISOString(),
      timezone: "America/Toronto", status: eventStatus, category: null,
    },
  } satisfies VolunteerInvitation;
}

test("groups pending, committed, and completed volunteer invitations", () => {
  const groups = groupVolunteerInvitations([
    invitation("pending", "pending", "2026-11-20T12:00:00Z"),
    invitation("committed", "accepted", "2026-11-21T12:00:00Z"),
    invitation("past", "accepted", "2026-11-01T12:00:00Z", "completed"),
    invitation("declined", "declined", "2026-11-22T12:00:00Z"),
  ], now);

  assert.deepEqual(groups.opportunities.map(item => item.id), ["pending"]);
  assert.deepEqual(groups.commitments.map(item => item.id), ["committed"]);
  assert.deepEqual(groups.history.map(item => item.id), ["past"]);
  assert.deepEqual(groups.upcoming.map(item => item.id), ["pending", "committed"]);
});

test("does not present expired pending invitations as opportunities", () => {
  const groups = groupVolunteerInvitations([
    invitation("expired", "pending", "2026-11-01T12:00:00Z"),
  ], now);
  assert.equal(groups.opportunities.length, 0);
});

test("does not present a volunteer application as a new invitation", () => {
  const groups = groupVolunteerInvitations([
    invitation("application", "pending", "2026-11-20T12:00:00Z", "scheduled", "volunteer_application"),
  ], now);
  assert.equal(groups.opportunities.length, 0);
  assert.equal(groups.upcoming.length, 0);
});
