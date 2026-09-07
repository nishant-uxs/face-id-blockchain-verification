/**
 * Aggressive multi-engine reverse search — dump any social appearances found.
 * Usage: npx tsx scripts/hunt-social.ts ./IMG_20260405_124242.jpg
 */
import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import sharp from "sharp";
import { uploadPublicFile } from "../src/ipfs/pinata.js";
import { classifyUrl } from "../src/utils/social-classifier.js";
import { detectAndEncodeFace } from "../src/face/detector.js";

const SOCIAL_HINT = /linkedin|instagram|facebook|twitter|x\.com|threads|tiktok|youtube|reddit|github|behance|dribbble|medium|substack/i;

async function host(buffer: Buffer, name: string): Promise<string> {
  const jpeg = await sharp(buffer)
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
  const { url } = await uploadPublicFile(jpeg, name, "image/jpeg", {
    pinataJwt: process.env.PINATA_JWT!,
    pinataGateway: process.env.PINATA_GATEWAY || "gateway.pinata.cloud",
  });
  return url;
}

async function serp(params: Record<string, string>): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ api_key: process.env.SERPAPI_KEY!, ...params });
  const res = await fetch(`https://serpapi.com/search.json?${qs}`);
  const json = (await res.json()) as Record<string, unknown>;
  return { _http: res.status, ...json };
}

function collectUrls(obj: unknown, out: Set<string>): void {
  if (!obj) return;
  if (typeof obj === "string") {
    if (/^https?:\/\//i.test(obj)) out.add(obj);
    return;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) collectUrls(v, out);
    return;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === "favicon" || k === "source_icon" || k === "thumbnail" || k === "serpapi_link") continue;
      collectUrls(v, out);
    }
  }
}

async function huntVariant(label: string, buffer: Buffer): Promise<void> {
  console.log(`\n######## ${label} (${buffer.length} bytes) ########`);
  const url = await host(buffer, `hunt-${label}-${Date.now()}.jpg`);
  console.log("hosted:", url);

  const queries = [
    { name: "google_lens", params: { engine: "google_lens", url } },
    { name: "google_lens_exact", params: { engine: "google_lens", url, type: "exact_matches" } },
    { name: "google_reverse", params: { engine: "google_reverse_image", image_url: url } },
    { name: "yandex_images", params: { engine: "yandex_images", url } },
    { name: "bing_images", params: { engine: "bing_images", q: url } },
  ];

  const all = new Set<string>();
  await mkdir("artifacts", { recursive: true });

  for (const q of queries) {
    process.stdout.write(`  → ${q.name}… `);
    try {
      const data = await serp({ ...q.params } as unknown as Record<string, string>);
      await writeFile(`artifacts/hunt-${label}-${q.name}.json`, JSON.stringify(data, null, 2));
      if (typeof data.error === "string") {
        console.log("ERR:", String(data.error).slice(0, 120));
        continue;
      }
      const urls = new Set<string>();
      collectUrls(data, urls);
      console.log(`${urls.size} urls`);
      for (const u of urls) all.add(u);
    } catch (e) {
      console.log("FAIL", e instanceof Error ? e.message : e);
    }
  }

  const socialPosts: string[] = [];
  const socialPages: string[] = [];
  const socialish: string[] = [];

  for (const u of all) {
    if (!SOCIAL_HINT.test(u)) continue;
    socialish.push(u);
    const c = classifyUrl(u);
    if (c.classification === "SOCIAL_POST") socialPosts.push(u);
    else if (c.classification === "PUBLIC_SOCIAL_PAGE") socialPages.push(u);
  }

  console.log(`\n  TOTAL unique URLs: ${all.size}`);
  console.log(`  Social-ish URLs:  ${socialish.length}`);
  console.log(`  SOCIAL_POST:      ${socialPosts.length}`);
  console.log(`  SOCIAL_PAGE:      ${socialPages.length}`);

  if (socialPosts.length) {
    console.log("\n  ★ SOCIAL POSTS:");
    for (const u of socialPosts.slice(0, 20)) console.log("   ", u);
  }
  if (socialPages.length) {
    console.log("\n  ○ SOCIAL PAGES/PROFILES:");
    for (const u of socialPages.slice(0, 20)) console.log("   ", u);
  }
  if (socialish.length && !socialPosts.length && !socialPages.length) {
    console.log("\n  ~ other social-ish:");
    for (const u of socialish.slice(0, 20)) console.log("   ", u);
  }
  if (!socialish.length) {
    console.log("\n  (no linkedin/instagram/x/facebook/etc URLs found in any engine)");
  }
}

async function main() {
  const path = resolve(process.argv[2] || "./IMG_20260405_124242.jpg");
  const full = await readFile(path);
  console.log("Hunting social appearances for", basename(path));

  await huntVariant("full", full);

  try {
    const face = await detectAndEncodeFace(full, { faceSelection: "largest" });
    await huntVariant("face-crop", face.faceCropBuffer);
  } catch (e) {
    console.log("face crop skip:", e instanceof Error ? e.message : e);
  }

  // Upper body crop (more context than face only)
  const meta = await sharp(full).metadata();
  const w = meta.width ?? 1000;
  const h = meta.height ?? 1000;
  const upper = await sharp(full)
    .extract({
      left: Math.floor(w * 0.15),
      top: Math.floor(h * 0.05),
      width: Math.floor(w * 0.7),
      height: Math.floor(h * 0.55),
    })
    .jpeg({ quality: 88 })
    .toBuffer();
  await huntVariant("upper-body", upper);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
