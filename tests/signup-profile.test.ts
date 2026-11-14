import assert from "node:assert/strict";
import test from "node:test";
import { hasCompletedSignupProfile, readSignupProfile } from "../lib/signup-profile";

test("Google identity details still require TeamUp onboarding", () => {
  assert.equal(hasCompletedSignupProfile({ full_name: "Google User", email: "user@example.com" }), false);
  assert.equal(hasCompletedSignupProfile({ display_name: "Google User" }), false);
  assert.equal(hasCompletedSignupProfile({ display_name: "Google User", signup_intent: "organizer" }), false);
});

test("profiles saved by the existing email signup can go straight to the account", () => {
  assert.equal(hasCompletedSignupProfile({ display_name: "Email User", signup_intent: "Volunteer" }), true);
  assert.equal(hasCompletedSignupProfile({ display_name: " ", signup_intent: "Teacher" }), false);
});

test("profile completion accepts optional fields and writes a signup preference", () => {
  const form = new FormData();
  form.set("fullName", "  TeamUp User  ");
  assert.deepEqual(readSignupProfile(form), { error: "Enter a valid name and signup preference." });

  form.set("role", "Teacher");
  form.set("email", "different@example.com");
  form.set("lastCourse", "Sri Sri Yoga");
  form.append("expertise", "Registration");
  form.append("expertise", "Registration");
  const result = readSignupProfile(form);
  assert.deepEqual(result, {
    profile: {
      display_name: "TeamUp User",
      signup_intent: "Teacher",
      last_course: "Sri Sri Yoga",
      signup_expertise: ["Registration"],
    },
  });
  assert.ok("profile" in result && hasCompletedSignupProfile(result.profile));
});
