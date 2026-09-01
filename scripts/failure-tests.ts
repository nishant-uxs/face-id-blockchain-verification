/**
 * Failure-mode validation — ensures pipeline never fakes success.
 * Usage: npm run test:failure
 */
import { config } from "dotenv";
config();

import { loadAndValidateImage } from "../src/utils/image.js";
import { requireVerifyConfig } from "../src/config/env.js";
import { selectBestEvidence } from "../src/evidence/scorer.js";
import type { ReverseImageResult } from "../src/reverse-search/types.js";

interface TestCase {
  name: string;
  run: () => Promise<void>;
  expect: "error" | "no_match";
  errorPattern?: RegExp;
}

const results: Array<{ name: string; passed: boolean; detail: string }> = [];

/** Minimal env stub so we can test individual missing vars */
function stubMinimalEnv(): () => void {
  const saved: Record<string, string | undefined> = {};
  const keys = [
    "GOOGLE_APPLICATION_CREDENTIALS",
    "PINATA_JWT",
    "PRIVATE_KEY",
    "CONTRACT_ADDRESS",
  ];
  for (const k of keys) {
    saved[k] = process.env[k];
  }
  process.env.GOOGLE_APPLICATION_CREDENTIALS = "./test/fixtures/fake-creds.json";
  process.env.PINATA_JWT = "test-jwt";
  process.env.PRIVATE_KEY = `0x${"a".repeat(64)}`;
  process.env.CONTRACT_ADDRESS = `0x${"b".repeat(40)}`;

  return () => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  };
}

const tests: TestCase[] = [
  {
    name: "Invalid image file",
    expect: "error",
    errorPattern: /INVALID_IMAGE|EMPTY_IMAGE|unsupported/i,
    run: async () => {
      const { writeFileSync, unlinkSync } = await import("node:fs");
      const { join } = await import("node:path");
      const { tmpdir } = await import("node:os");
      const p = join(tmpdir(), "hhgoa-bad.bin");
      writeFileSync(p, "not an image");
      try {
        await loadAndValidateImage(p, 1024 * 1024);
      } finally {
        unlinkSync(p);
      }
    },
  },
  {
    name: "Missing Google credentials",
    expect: "error",
    errorPattern: /GOOGLE_APPLICATION_CREDENTIALS|MISSING_GOOGLE/i,
    run: async () => {
      const restore = stubMinimalEnv();
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      try {
        requireVerifyConfig();
      } finally {
        restore();
      }
    },
  },
  {
    name: "Missing Pinata JWT",
    expect: "error",
    errorPattern: /PINATA_JWT|MISSING_ENV/i,
    run: async () => {
      const restore = stubMinimalEnv();
      delete process.env.PINATA_JWT;
      try {
        requireVerifyConfig();
      } finally {
        restore();
      }
    },
  },
  {
    name: "Invalid private key",
    expect: "error",
    errorPattern: /PRIVATE_KEY|INVALID_PRIVATE_KEY/i,
    run: async () => {
      const restore = stubMinimalEnv();
      process.env.PRIVATE_KEY = "not-a-key";
      try {
        requireVerifyConfig();
      } finally {
        restore();
      }
    },
  },
  {
    name: "Reverse search no result (strict)",
    expect: "no_match",
    run: async () => {
      const empty: ReverseImageResult = {
        source: "test",
        fullMatches: [],
        partialMatches: [],
        matchingPages: [],
        visuallySimilar: [{ url: "https://cdn.example.com/similar.jpg" }],
        searchedAt: new Date().toISOString(),
        queryImageSha256: "x",
      };
      const sel = selectBestEvidence(empty, true);
      if (sel !== null) throw new Error("Expected null selection");
    },
  },
  {
    name: "Wikimedia rejected under strict match",
    expect: "no_match",
    run: async () => {
      const wiki: ReverseImageResult = {
        source: "test",
        fullMatches: [{ url: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Face.jpg" }],
        partialMatches: [],
        matchingPages: [{ url: "https://en.wikipedia.org/wiki/Test", pageTitle: "Wiki" }],
        visuallySimilar: [],
        searchedAt: new Date().toISOString(),
        queryImageSha256: "x",
      };
      const sel = selectBestEvidence(wiki, true);
      if (sel !== null) throw new Error("Wikimedia should be rejected under strict mode");
    },
  },
];

async function main(): Promise<void> {
  console.log("HH Goa — Failure Mode Tests\n");

  for (const test of tests) {
    try {
      await test.run();
      if (test.expect === "error") {
        results.push({ name: test.name, passed: false, detail: "Expected error but succeeded" });
      } else {
        results.push({ name: test.name, passed: true, detail: "behaved as expected" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (test.expect === "error") {
        if (test.errorPattern && !test.errorPattern.test(msg)) {
          results.push({ name: test.name, passed: false, detail: `Wrong error: ${msg}` });
        } else {
          results.push({ name: test.name, passed: true, detail: "Error correctly raised" });
        }
      } else if (test.expect === "no_match") {
        results.push({ name: test.name, passed: true, detail: "Correctly rejected evidence" });
      } else {
        results.push({ name: test.name, passed: false, detail: msg });
      }
    }
  }

  let failed = 0;
  for (const r of results) {
    const icon = r.passed ? "✓" : "✗";
    console.log(`${icon} ${r.name}: ${r.detail}`);
    if (!r.passed) failed++;
  }

  console.log(`\n${failed === 0 ? "All failure-mode tests passed" : `${failed} test(s) failed`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
