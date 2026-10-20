import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import {
  BANNER_SLOTS,
  bannersResponse,
  isManagedBannerPath,
  isValidSlot,
  normalizeAlt,
  toStoredImagePath,
  updateHomepageBanner,
} from "../controllers/homepageBannerController.js";
import { homepageBannerUpload, homepageBannersDir } from "../middleware/homepageBannerUpload.js";

// No MongoDB needed: these cover the pure helpers and the request paths that are
// rejected before the database is touched.

test("only the three homepage slots are valid", () => {
  assert.deepEqual(BANNER_SLOTS, ["hero", "makeItYours", "betterTogether"]);
  for (const slot of BANNER_SLOTS) assert.equal(isValidSlot(slot), true);
  for (const slot of ["", "Hero", "footer", "../hero", undefined, null]) assert.equal(isValidSlot(slot), false);
});

test("alt text is trimmed, collapsed and capped at 160 chars", () => {
  assert.equal(normalizeAlt("  Black   hoodie \n flat lay "), "Black hoodie flat lay");
  assert.equal(normalizeAlt(undefined), "");
  assert.equal(normalizeAlt("x".repeat(500)).length, 160);
});

test("stored image path is relative to outputs/ with forward slashes", () => {
  const file = { path: path.join(homepageBannersDir, "hero-123.jpg") };
  assert.equal(toStoredImagePath(file), "outputs/homepage-banners/hero-123.jpg");
  assert.equal(toStoredImagePath(null), "");
});

test("only files inside homepage-banners may be deleted", () => {
  assert.equal(isManagedBannerPath("outputs/homepage-banners/hero-1.jpg"), true);
  assert.equal(isManagedBannerPath("outputs/blog-covers/x.jpg"), false);
  assert.equal(isManagedBannerPath("outputs/homepage-banners/../../server.js"), false);
  assert.equal(isManagedBannerPath(""), false);
});

test("response always contains every slot", () => {
  const body = bannersResponse({ hero: { image: "outputs/homepage-banners/h.jpg", alt: "Hero" } });
  assert.deepEqual(Object.keys(body).sort(), ["betterTogether", "hero", "makeItYours", "updatedAt"]);
  assert.deepEqual(body.hero, { image: "outputs/homepage-banners/h.jpg", alt: "Hero" });
  assert.deepEqual(body.makeItYours, { image: "", alt: "" });
  assert.deepEqual(bannersResponse(null).betterTogether, { image: "", alt: "" });
});

const startApp = async () => {
  const app = express();
  // Same chain as the real route, minus auth (protect needs a DB user).
  app.put("/admin/:slot", (req, res, next) => {
    homepageBannerUpload.single("image")(req, res, (error) => {
      if (error) return res.status(400).json({ message: error.message });
      next();
    });
  }, updateHomepageBanner);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("non-image uploads are rejected with 400", async () => {
  const { server, url } = await startApp();
  try {
    const form = new FormData();
    form.append("image", new Blob(["not an image"], { type: "text/plain" }), "notes.txt");
    const res = await fetch(`${url}/admin/hero`, { method: "PUT", body: form });
    assert.equal(res.status, 400);
    assert.match((await res.json()).message, /Only png, jpg/);
  } finally {
    server.close();
  }
});

test("unknown slot is rejected with 400 and the uploaded file is discarded", async () => {
  const { server, url } = await startApp();
  const before = new Set(fs.readdirSync(homepageBannersDir));
  try {
    const form = new FormData();
    form.append("image", new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }), "x.jpg");
    const res = await fetch(`${url}/admin/footer`, { method: "PUT", body: form });
    assert.equal(res.status, 400);
    const leftover = fs.readdirSync(homepageBannersDir).filter((name) => !before.has(name));
    assert.deepEqual(leftover, []);
  } finally {
    server.close();
  }
});
