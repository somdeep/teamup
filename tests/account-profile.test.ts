import assert from "node:assert/strict";
import test from "node:test";
import { needsProfileCompletion, readAccountProfileEdit } from "../lib/account-profile";

function profileForm() {
  const form = new FormData();
  form.set("fullName", "  Avery Singh  ");
  form.set("phone", "  +1 416 555 0100  ");
  form.set("city", "  Toronto  ");
  form.set("timezone", "America/Toronto");
  form.set("lastCourse", "  SKY Happiness Retreat  ");
  return form;
}

test("reads editable profile contact details and location", () => {
  assert.deepEqual(readAccountProfileEdit(profileForm()), { profile: {
    display_name: "Avery Singh",
    contact_phone: "+1 416 555 0100",
    city: "Toronto",
    timezone: "America/Toronto",
    last_course: "SKY Happiness Retreat",
  } });
});

test("requires a location and a supported Canadian time zone", () => {
  const noCity = profileForm();
  noCity.set("city", "");
  assert.ok("error" in readAccountProfileEdit(noCity));
  const wrongZone = profileForm();
  wrongZone.set("timezone", "America/New_York");
  assert.ok("error" in readAccountProfileEdit(wrongZone));
});

test("routes first-time OAuth accounts to profile completion", () => {
  assert.equal(needsProfileCompletion(null), true);
  assert.equal(needsProfileCompletion({ signup_intent: null }), true);
  assert.equal(needsProfileCompletion({ signup_intent: "Volunteer" }), false);
  assert.equal(needsProfileCompletion({ signup_intent: "Teacher" }), false);
});
