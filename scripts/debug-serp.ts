import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { uploadPublicFile } from "../src/ipfs/pinata.js";

async function main() {
  await mkdir("artifacts", { recursive: true });
  const buf = await readFile("./IMG_20260405_124242.jpg");
  const jpeg = await sharp(buf)
    .resize(900, 900, { fit: "inside" })
    .jpeg({ quality: 85 })
    .toBuffer();

  const { url } = await uploadPublicFile(jpeg, `lens-debug-${Date.now()}.jpg`, "image/jpeg", {
    pinataJwt: process.env.PINATA_JWT!,
    pinataGateway: process.env.PINATA_GATEWAY || "gateway.pinata.cloud",
  });
  console.log("publicUrl=", url);

  const engines: Array<{ engine: string; extra?: Record<string, string> }> = [
    { engine: "google_lens" },
    { engine: "google_reverse_image" },
    { engine: "google_lens", extra: { type: "exact_matches" } },
    { engine: "google_lens", extra: { type: "products" } },
    { engine: "google_lens", extra: { type: "about_this_image" } },
  ];

  for (const e of engines) {
    const params = new URLSearchParams({
      engine: e.engine,
      api_key: process.env.SERPAPI_KEY!,
      url,
      ...(e.extra ?? {}),
    });
    const label = e.engine + (e.extra ? "_" + Object.values(e.extra).join("_") : "");
    console.log("\n---", label, "---");
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    const text = await res.text();
    await writeFile(`artifacts/serp-${label}.json`, text);
    console.log("status", res.status, "bytes", text.length);
    const j = JSON.parse(text) as Record<string, unknown>;
    console.log("keys", Object.keys(j).join(", "));
    if (typeof j.error === "string") console.log("error", j.error);
    for (const k of [
      "visual_matches",
      "image_sources",
      "image_results",
      "exact_matches",
      "products",
      "about_this_image",
      "knowledge_graph",
    ]) {
      const v = j[k];
      if (Array.isArray(v)) console.log(k, v.length, JSON.stringify(v[0] ?? null).slice(0, 250));
      else if (v) console.log(k, typeof v, JSON.stringify(v).slice(0, 250));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
