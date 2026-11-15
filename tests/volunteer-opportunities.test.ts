import assert from "node:assert/strict";
import test from "node:test";
import { opportunityBrowseHref, readOpportunityFilter } from "../lib/volunteer-opportunities";

test("reads approved opportunity filters and ignores unsupported values", () => {
  assert.deepEqual(readOpportunityFilter({
    q: "  satsang  ", skill: "Music & bhajans", city: "Toronto", date: "7",
    saved: "1",
  }), { q: "satsang", skill: "Music & bhajans", city: "Toronto", date: "7", saved: true });
  assert.deepEqual(readOpportunityFilter({ skill: "Unknown", date: "365" }), {
    q: "", skill: "", city: "", date: "", saved: false,
  });
});

test("opportunity links preserve browse context", () => {
  const filter = { q: "music", skill: "Music & bhajans", city: "Ottawa", date: "30" as const, saved: true };
  const list = new URL(opportunityBrowseHref(filter), "http://localhost");
  assert.equal(list.searchParams.get("view"), "opportunities");
  assert.equal(list.searchParams.get("skill"), "Music & bhajans");
  assert.equal(list.searchParams.get("saved"), "1");

  const detail = new URL(opportunityBrowseHref(filter, "11111111-1111-4111-8111-111111111111"), "http://localhost");
  assert.equal(detail.searchParams.get("view"), "opportunity");
  assert.equal(detail.searchParams.get("event"), "11111111-1111-4111-8111-111111111111");
});
