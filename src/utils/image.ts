import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { PipelineError } from "./errors.js";
import { sha256Hex } from "../hashing/sha256.js";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export interface LoadedImage {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  sha256: string;
  filename: string;
}

export async function loadAndValidateImage(
  filePath: string,
  maxBytes: number
): Promise<LoadedImage> {
  const buffer = await readFile(filePath);
  if (buffer.length === 0) {
    throw new PipelineError("Image file is empty", "EMPTY_IMAGE");
  }
  if (buffer.length > maxBytes) {
    throw new PipelineError(
      `Image exceeds max size (${maxBytes} bytes)`,
      "IMAGE_TOO_LARGE"
    );
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw new PipelineError("Corrupted or unsupported image format", "INVALID_IMAGE");
  }

  const format = meta.format;
  if (!format || !["jpeg", "png", "webp", "gif"].includes(format)) {
    throw new PipelineError(`Unsupported image format: ${format ?? "unknown"}`, "UNSUPPORTED_FORMAT");
  }

  const mimeType = `image/${format === "jpeg" ? "jpeg" : format}`;
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new PipelineError(`MIME type not allowed: ${mimeType}`, "UNSUPPORTED_MIME");
  }

  const filename = filePath.split(/[/\\]/).pop() ?? filePath;

  return {
    buffer,
    mimeType,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    sha256: sha256Hex(buffer),
    filename,
  };
}

export async function cropFaceRegion(
  imageBuffer: Buffer,
  bbox: { x: number; y: number; width: number; height: number }
): Promise<Buffer> {
  const left = Math.max(0, Math.round(bbox.x));
  const top = Math.max(0, Math.round(bbox.y));
  const width = Math.max(1, Math.round(bbox.width));
  const height = Math.max(1, Math.round(bbox.height));

  return sharp(imageBuffer)
    .extract({ left, top, width, height })
    .resize(224, 224, { fit: "cover" })
    .jpeg({ quality: 92 })
    .toBuffer();
}
