/**
 * Prepare a demo-ready cropped face image from a source photo.
 * Usage: npm run prepare-demo -- ./samples/source.jpg ./samples/demo.jpg
 */
import { config } from "dotenv";
config();
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { detectAndEncodeFace } from "../src/face/detector.js";
import { loadAndValidateImage } from "../src/utils/image.js";

async function main(): Promise<void> {
  const [source, output] = process.argv.slice(2);
  if (!source || !output) {
    console.error("Usage: npm run prepare-demo -- <source.jpg> <output.jpg>");
    process.exit(1);
  }

  const image = await loadAndValidateImage(resolve(source), 10 * 1024 * 1024);
  const face = await detectAndEncodeFace(image.buffer, {
    faceSelection: "largest",
    googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });

  const { x, y, width, height } = face.selectedFace.bbox;
  const pad = 0.15;
  const left = Math.max(0, Math.round(x - width * pad));
  const top = Math.max(0, Math.round(y - height * pad));
  const w = Math.round(width * (1 + 2 * pad));
  const h = Math.round(height * (1 + 2 * pad));

  const cropped = await sharp(image.buffer)
    .extract({ left, top, width: w, height: h })
    .resize(640, 640, { fit: "inside" })
    .jpeg({ quality: 85 })
    .toBuffer();

  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(resolve(output), cropped);

  console.log(`✓ Demo image prepared: ${output}`);
  console.log(`  Face confidence: ${(face.selectedFace.confidence * 100).toFixed(1)}%`);
  console.log(`  Tip: Use a photo that already exists publicly online (consenting subject).`);
  console.log(`  The cropped variant should still match via reverse-image search.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
