import assert from "node:assert/strict";
import test from "node:test";
import { teacherLanding } from "../lib/account-access";
import { readSignupProfile } from "../lib/signup-profile";

test("teachers land on Teacher Portal after sign-in and final onboarding save", () => {
  const teacher = { role: "teacher", teacher_request: null } as const;
  assert.equal(teacherLanding(teacher), "/teacher");
  assert.equal(teacherLanding(teacher, undefined, "availability-saved"), "/teacher?notice=profile-saved");
  assert.equal(teacherLanding(teacher, "settings"), null);
});

test("pending teacher requests and other roles have distinct destinations", () => {
  assert.equal(teacherLanding({ role: "member", teacher_request: "pending" }), "/teacher");
  assert.equal(teacherLanding({ role: "volunteer", teacher_request: null }), null);
  assert.equal(teacherLanding({ role: "member", teacher_request: "declined" }), null);
  assert.equal(teacherLanding({ role: "teacher", teacher_request: null }, undefined, "signout-failed"), null);
});

test("Member is a valid profile choice while organizer is unavailable at signup", () => {
  const form = new FormData();
  form.set("fullName", "Someone New");
  form.set("role", "Member");
  assert.deepEqual(readSignupProfile(form), { profile: { display_name: "Someone New", signup_intent: "Member" } });
  form.set("role", "organizer");
  assert.ok("error" in readSignupProfile(form));
});
