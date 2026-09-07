import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createCanvas, loadImage, type Image } from "canvas";
import "@tensorflow/tfjs";
import { cropFaceRegion } from "../utils/image.js";
import { PipelineError } from "../utils/errors.js";
import { sha256Hex } from "../hashing/sha256.js";
import type { AppConfig } from "../config/env.js";
import type { DetectedFace, FaceDetectionResult, FaceEncoding } from "./types.js";

const require = createRequire(import.meta.url);
const faceapi = require("@vladmandic/face-api/dist/face-api.node.js") as typeof import("@vladmandic/face-api");
const canvasPkg = require("canvas") as typeof import("canvas");

faceapi.env.monkeyPatch({
  Canvas: canvasPkg.Canvas,
  Image: canvasPkg.Image,
  ImageData: canvasPkg.ImageData,
});

let modelsLoaded = false;

async function ensureModels(): Promise<void> {
  if (modelsLoaded) return;
  const pkgDir = dirname(require.resolve("@vladmandic/face-api/package.json"));
  const modelPath = join(pkgDir, "model");
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
  modelsLoaded = true;
}

function selectFace(
  faces: Array<{ detection: { box: { x: number; y: number; width: number; height: number }; score: number } }>,
  mode: AppConfig["faceSelection"]
): DetectedFace {
  if (faces.length === 0) {
    throw new PipelineError("No face detected in image", "NO_FACE");
  }

  if (faces.length === 1 || mode === "first") {
    const f = faces[0]!;
    return {
      bbox: {
        x: f.detection.box.x,
        y: f.detection.box.y,
        width: f.detection.box.width,
        height: f.detection.box.height,
      },
      confidence: f.detection.score,
      index: 0,
    };
  }

  let bestIndex = 0;
  let bestArea = 0;
  for (let i = 0; i < faces.length; i++) {
    const f = faces[i]!;
    const area = f.detection.box.width * f.detection.box.height;
    if (area > bestArea) {
      bestArea = area;
      bestIndex = i;
    }
  }
  const best = faces[bestIndex]!;
  return {
    bbox: {
      x: best.detection.box.x,
      y: best.detection.box.y,
      width: best.detection.box.width,
      height: best.detection.box.height,
    },
    confidence: best.detection.score,
    index: bestIndex,
  };
}

function hashDescriptor(descriptor: Float32Array): string {
  const quantized = Array.from(descriptor).map((v) => Math.round(v * 10000) / 10000);
  return sha256Hex(JSON.stringify(quantized));
}

/**
 * Local face detection — no Google Cloud / no billing required.
 * Uses SSD MobileNet + face recognition net via @vladmandic/face-api + tfjs.
 */
export async function detectAndEncodeFace(
  imageBuffer: Buffer,
  config: Pick<AppConfig, "faceSelection">
): Promise<FaceDetectionResult> {
  await ensureModels();

  const image = (await loadImage(imageBuffer)) as Image;
  // Draw onto canvas so face-api has consistent ImageData in Node
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);

  const detections = await faceapi
    .detectAllFaces(canvas as unknown as Parameters<typeof faceapi.detectAllFaces>[0], new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections.length === 0) {
    throw new PipelineError("No face detected in image", "NO_FACE");
  }

  const selected = selectFace(detections, config.faceSelection);
  const match = detections[selected.index];
  if (!match?.descriptor) {
    throw new PipelineError("Failed to generate face descriptor", "FACE_ENCODE_FAILED");
  }

  const faceCropBuffer = await cropFaceRegion(imageBuffer, selected.bbox);
  const encoding: FaceEncoding = {
    descriptorHash: hashDescriptor(match.descriptor),
    dimensions: match.descriptor.length,
    model: "ssdMobilenetv1+faceRecognitionNet (local/tfjs)",
  };

  return {
    facesDetected: detections.length,
    selectedFace: selected,
    encoding,
    faceCropSha256: sha256Hex(faceCropBuffer),
    faceCropBuffer,
  };
}
