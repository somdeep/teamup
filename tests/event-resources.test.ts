import assert from "node:assert/strict";
import test from "node:test";
import { readEventResource } from "../lib/event-resources";

test("accepts one supported event resource and preserves its display name", () => {
  const file = new File(["guide"], "Volunteer guide.pdf", { type: "application/pdf" });
  const result = readEventResource(file);
  assert.ok("file" in result && result.file);
  if ("file" in result && result.file) {
    assert.equal(result.fileName, "Volunteer guide.pdf");
    assert.equal(result.extension, "pdf");
  }
});

test("rejects unsafe event resource types", () => {
  const file = new File(["binary"], "program.exe", { type: "application/x-msdownload" });
  assert.ok("error" in readEventResource(file));
});
