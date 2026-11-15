import assert from "node:assert/strict";
import test from "node:test";
import { readEventResource, readEventResourceMetadata } from "../lib/event-resources";

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

test("accepts uploaded resource metadata without transferring the file through a server action", () => {
  const form = new FormData();
  form.set("resourcePath", "event-id/account-id/resource.pdf");
  form.set("resourceName", "Volunteer guide.pdf");
  form.set("resourceMime", "application/pdf");
  form.set("resourceSize", "1024");
  const result = readEventResourceMetadata(form);
  assert.deepEqual(result, {
    path: "event-id/account-id/resource.pdf",
    fileName: "Volunteer guide.pdf",
    mimeType: "application/pdf",
    fileSize: 1024,
  });
});

test("rejects oversized or unsupported uploaded resource metadata", () => {
  const form = new FormData();
  form.set("resourcePath", "event-id/account-id/resource.exe");
  form.set("resourceName", "resource.exe");
  form.set("resourceMime", "application/x-msdownload");
  form.set("resourceSize", String(11 * 1024 * 1024));
  assert.ok("error" in readEventResourceMetadata(form));
});
