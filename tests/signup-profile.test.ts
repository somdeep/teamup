import assert from "node:assert/strict";
import test from "node:test";
import { readSignupProfile } from "../lib/signup-profile";

test("profile completion accepts optional fields and writes a signup preference", () => {
  const form = new FormData();
  form.set("fullName", "  TeamUp User  ");
  assert.deepEqual(readSignupProfile(form), { error: "Enter a valid name and signup preference." });
  form.set("role", "organizer");
  assert.deepEqual(readSignupProfile(form), { error: "Enter a valid name and signup preference." });

  form.set("role", "Teacher");
  assert.deepEqual(readSignupProfile(form), { error: "Enter your city or area." });
  form.set("location", "  Toronto, ON  ");
  form.set("email", "different@example.com");
  form.set("lastCourse", "Sri Sri Yoga");
  form.append("expertise", "Registration desk");
  form.append("expertise", "Registration desk");
  const result = readSignupProfile(form);
  assert.deepEqual(result, {
    profile: {
      display_name: "TeamUp User",
      signup_intent: "Teacher",
      location: "Toronto, ON",
      last_course: "Sri Sri Yoga",
      signup_expertise: ["Registration desk"],
    },
  });
});
