import assert from "node:assert/strict";
import test from "node:test";
import { readSevaAvailability, readSevaPreferences, readSevaSkills } from "../lib/seva-preferences";

test("availability can save or clear dates independently of role and skills", () => {
  const form = new FormData();
  form.append("availability", "Evenings");
  form.append("availability", "Specific Dates");
  form.set("dates", "2027-05-22");
  form.set("emergency", "on");
  assert.deepEqual(readSevaAvailability(form), {
    preferences: { availability: ["Evenings", "Specific Dates"], dates: ["2027-05-22"], emergency: true },
  });
  assert.deepEqual(readSevaAvailability(new FormData()), {
    preferences: { availability: [], dates: [], emergency: false },
  });
  form.set("availability", "Every hour");
  assert.ok("error" in readSevaAvailability(form));
});

test("reads skill and learning selections separately and rejects unknown values", () => {
  const form = new FormData();
  form.append("skills", "Kitchen seva");
  form.append("skills", "Kitchen seva");
  form.append("interests", "Tech & AV");
  assert.deepEqual(readSevaSkills(form), { skills: ["Kitchen seva"], interests: ["Tech & AV"] });
  form.append("skills", "Cooking");
  assert.equal(readSevaSkills(form), null);
  assert.deepEqual(readSevaSkills(new FormData()), { skills: [], interests: [] });
});

test("reads a signup preference independently from skills and organizer access", () => {
  const form = new FormData();
  form.set("role", "Teacher");
  form.append("skills", "Photography");
  form.append("interests", "Kitchen seva");
  form.append("availability", "Weekends");
  form.set("emergency", "on");
  assert.deepEqual(readSevaPreferences(form), {
    preferences: { intent: "Teacher", skills: ["Photography"], interests: ["Kitchen seva"], availability: ["Weekends"], dates: [], emergency: true },
  });
  form.set("role", "organizer");
  assert.ok("error" in readSevaPreferences(form));
});

test("specific dates require valid calendar dates and are deduplicated", () => {
  const form = new FormData();
  form.set("role", "Volunteer");
  form.append("availability", "Specific Dates");
  assert.ok("error" in readSevaPreferences(form));
  form.set("dates", "2027-02-29");
  assert.ok("error" in readSevaPreferences(form));
  form.set("dates", "2028-02-29");
  form.append("dates", "2028-02-29");
  const result = readSevaPreferences(form);
  assert.ok("preferences" in result);
  assert.deepEqual(result.preferences.dates, ["2028-02-29"]);
  form.delete("availability");
  const withoutDates = readSevaPreferences(form);
  assert.ok("preferences" in withoutDates);
  assert.deepEqual(withoutDates.preferences.dates, []);
});
