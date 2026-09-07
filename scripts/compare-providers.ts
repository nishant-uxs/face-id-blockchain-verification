/**
 * Compare Google Vision Web Detection vs SerpAPI Google Lens on the same image.
 * Usage: npx tsx scripts/compare-providers.ts ./samples/demo.jpg
 */
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sha256Hex } from "../src/hashing/sha256.js";
import { GoogleVisionWebDetectionProvider } from "../src/reverse-search/google-vision.js";
import { SerpApiLensProvider } from "../src/reverse-search/serpapi.js";
import { selectBestEvidence } from "../src/evidence/scorer.js";
import { classifyUrl } from "../src/utils/social-classifier.js";
import type { ReverseImageResult } from "../src/reverse-search/types.js";

config();

function summarize(label: string, result: ReverseImageResult, elapsedMs: number) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  Latency:         ${elapsedMs}ms`);
  console.log(`  Full matches:    ${result.fullMatches.length}`);
  console.log(`  Partial matches: ${result.partialMatches.length}`);
  console.log(`  Matching pages:  ${result.matchingPages.length}`);
  console.log(`  Visually similar:${result.visuallySimilar.length} (never used as evidence)`);

  const allUrls = [
    ...result.fullMatches.map((m) => m.url),
    ...result.partialMatches.map((m) => m.url),
    ...result.matchingPages.map((p) => p.url),
  ];

  const socialPosts = allUrls.filter((u) => classifyUrl(u).classification === "SOCIAL_POST");
  const socialPages = allUrls.filter((u) => classifyUrl(u).classification === "PUBLIC_SOCIAL_PAGE");
  const general = allUrls.filter((u) => classifyUrl(u).classification === "GENERAL_WEB_PAGE");

  console.log(`  Social posts:    ${socialPosts.length}`);
  console.log(`  Social profiles: ${socialPages.length}`);
  console.log(`  General web:     ${general.length}`);

  if (socialPosts.length > 0) {
    console.log(`\n  Top social posts:`);
    for (const url of socialPosts.slice(0, 5)) {
      console.log(`    • ${url}`);
    }
  }

  const strict = selectBestEvidence(result, true);
  const loose = selectBestEvidence(result, false);
  console.log(`\n  Strict selection (REQUIRE_SOCIAL_MATCH=true):  ${strict ? strict.candidate.selectedMatchUrl : "NONE"}`);
  console.log(`  Loose selection:                             ${loose ? loose.candidate.selectedMatchUrl : "NONE"}`);
}

async function main(): Promise<void> {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error("Usage: npx tsx scripts/compare-providers.ts <image>");
    process.exit(1);
  }

  const buffer = await readFile(resolve(imagePath));
  const hash = sha256Hex(buffer);
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const serpKey = process.env.SERPAPI_KEY;

  if (!creds && !serpKey) {
    console.error("Set GOOGLE_APPLICATION_CREDENTIALS and/or SERPAPI_KEY in .env");
    process.exit(1);
  }

  console.log(`Image: ${imagePath} (${buffer.length} bytes, SHA-256 ${hash.slice(0, 16)}…)`);

  if (creds) {
    const provider = new GoogleVisionWebDetectionProvider(creds);
    const start = Date.now();
    try {
      const result = await provider.search(buffer, hash);
      summarize("Google Vision — Web Detection", result, Date.now() - start);
    } catch (err) {
      console.error(`\nGoogle Vision FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (serpKey) {
    const provider = new SerpApiLensProvider(serpKey, {
      pinataJwt: process.env.PINATA_JWT ?? "",
      pinataGateway: process.env.PINATA_GATEWAY ?? "gateway.pinata.cloud",
    });
    const start = Date.now();
    try {
      const result = await provider.search(buffer, hash);
      summarize("SerpAPI — Google Lens", result, Date.now() - start);
    } catch (err) {
      console.error(`\nSerpAPI FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
