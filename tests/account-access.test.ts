import assert from "node:assert/strict";
import test from "node:test";
import { teacherLanding, volunteerLanding } from "../lib/account-access";
import { readSignupProfile } from "../lib/signup-profile";

test("teachers land on Teacher Portal after sign-in and final onboarding save", () => {
  const teacher = { role: "teacher", teacher_request: null } as const;
  assert.equal(teacherLanding(teacher), "/teacher");
  assert.equal(teacherLanding(teacher, undefined, "seva-saved"), "/teacher?notice=profile-saved");
  assert.equal(teacherLanding(teacher, undefined, "availability-saved"), "/teacher?notice=profile-saved");
  assert.equal(teacherLanding(teacher, "settings"), null);
});

test("volunteers land in their own portal after onboarding", () => {
  const volunteer = { role: "volunteer" as const, teacher_request: null };
  assert.equal(volunteerLanding(volunteer), "/volunteer");
  assert.equal(volunteerLanding(volunteer, undefined, "seva-saved"), "/volunteer?notice=profile-saved");
  assert.equal(volunteerLanding(volunteer, "settings"), null);
  assert.equal(volunteerLanding({ role: "member", teacher_request: null }), null);
  assert.equal(volunteerLanding({ role: "teacher", teacher_request: null }), null);
});

test("pending teacher requests and other roles have distinct destinations", () => {
  assert.equal(teacherLanding({ role: "member", teacher_request: "pending" }), "/teacher");
  assert.equal(teacherLanding({ role: "volunteer", teacher_request: null }), null);
  assert.equal(teacherLanding({ role: "member", teacher_request: "declined" }), null);
  assert.equal(teacherLanding({ role: "teacher", teacher_request: null }, undefined, "signout-failed"), null);
});

test("V1 signup accepts Teacher and Volunteer but hides Member and organizer", () => {
  const form = new FormData();
  form.set("fullName", "Someone New");
  form.set("location", "Vancouver, BC");
  form.set("role", "Teacher");
  assert.deepEqual(readSignupProfile(form), { profile: {
    display_name: "Someone New", signup_intent: "Teacher", location: "Vancouver, BC",
  } });
  form.set("role", "Volunteer");
  assert.deepEqual(readSignupProfile(form), { profile: {
    display_name: "Someone New", signup_intent: "Volunteer", location: "Vancouver, BC",
  } });
  form.set("role", "Member");
  assert.ok("error" in readSignupProfile(form));
  form.set("role", "organizer");
  assert.ok("error" in readSignupProfile(form));
});
