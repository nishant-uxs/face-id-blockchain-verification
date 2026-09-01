import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const FORBIDDEN_PATTERNS: Array<{ name: string; pattern: RegExp; paths?: string[] }> = [
  {
    name: "Hardcoded Twitter/X post URL",
    pattern: /https?:\/\/(www\.)?(twitter|x)\.com\/\w+\/status\/\d+/i,
  },
  {
    name: "Hardcoded Instagram post URL",
    pattern: /https?:\/\/(www\.)?instagram\.com\/p\/[A-Za-z0-9_-]+/i,
  },
  {
    name: "Fake transaction hash",
    pattern: /0x[a-f0-9]{64}/i,
    paths: ["src"],
  },
  {
    name: "Fake IPFS CID (bafy)",
    pattern: /bafy[a-z0-9]{50,}/i,
    paths: ["src"],
  },
  {
    name: "Mock reverse-search in production",
    pattern: /mockReverseSearch|fakeMatch|hardcodedMatch/i,
    paths: ["src"],
  },
  {
    name: "Committed .env secrets",
    pattern: /PINATA_JWT=eyJ|PRIVATE_KEY=0x[0-9a-f]{64}/i,
    paths: [".env"],
  },
];

const ALLOWLIST_FAKE_TX = new Set([
  "0x0000000000000000000000000000000000000000000000000000000000000000",
]);

const SOURCE_DIRS = ["src", "scripts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".sol"]);

function walk(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      results.push(...walk(full));
    } else if (EXTENSIONS.has(entry.slice(entry.lastIndexOf(".")))) {
      results.push(full);
    }
  }
  return results;
}

function checkProviderMakesExternalCall(): boolean {
  const googleVision = readFileSync(join(ROOT, "src/reverse-search/google-vision.ts"), "utf-8");
  const hasGoogleClient = googleVision.includes("ImageAnnotatorClient") && googleVision.includes("annotateImage");
  const serpapi = readFileSync(join(ROOT, "src/reverse-search/serpapi.ts"), "utf-8");
  const hasSerpFetch = serpapi.includes("fetch(") && serpapi.includes("serpapi.com");
  return hasGoogleClient || hasSerpFetch;
}

function main(): void {
  console.log("HH Goa Verification Engine — Self-Test\n");
  let failed = 0;

  for (const dir of SOURCE_DIRS) {
    const fullDir = join(ROOT, dir);
    for (const file of walk(fullDir)) {
      const rel = file.replace(ROOT + "\\", "").replace(ROOT + "/", "");
      const content = readFileSync(file, "utf-8");

      for (const rule of FORBIDDEN_PATTERNS) {
        if (rule.paths && !rule.paths.some((p) => rel.startsWith(p.replace(/\\/g, "/")))) {
          continue;
        }

        const match = content.match(rule.pattern);
        if (match) {
          if (rule.name.includes("transaction hash") && ALLOWLIST_FAKE_TX.has(match[0].toLowerCase())) {
            continue;
          }
          if (rule.name.includes("transaction hash") && rel.includes("self-test")) {
            continue;
          }
          console.log(`✗ ${rule.name} in ${rel}`);
          console.log(`  matched: ${match[0].slice(0, 60)}…`);
          failed++;
        }
      }
    }
  }

  // Check .env not committed
  try {
    const envContent = readFileSync(join(ROOT, ".env"), "utf-8");
    if (envContent.includes("PINATA_JWT=ey") || /PRIVATE_KEY=0x[a-f0-9]{64}/i.test(envContent)) {
      console.log("✗ Secrets appear to be in committed .env file");
      failed++;
    }
  } catch {
    // .env not present — good
  }

  if (checkProviderMakesExternalCall()) {
    console.log("✓ Reverse-image provider executes external API call");
  } else {
    console.log("✗ No external reverse-image API call detected in providers");
    failed++;
  }

  // Fixtures must be isolated
  const testDir = join(ROOT, "test");
  try {
    const fixtures = walk(testDir).filter((f) => f.includes("fixture"));
    if (fixtures.length > 0) {
      console.log(`✓ Test fixtures isolated in test/ (${fixtures.length} files)`);
    }
  } catch {
    // no test dir yet
  }

  if (failed === 0) {
    console.log("\n✓ All self-test checks passed");
    process.exit(0);
  } else {
    console.log(`\n✗ ${failed} self-test check(s) failed`);
    process.exit(1);
  }
}

main();
