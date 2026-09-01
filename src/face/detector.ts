import { ImageAnnotatorClient, type protos } from "@google-cloud/vision";
import { cropFaceRegion } from "../utils/image.js";
import { PipelineError } from "../utils/errors.js";
import { sha256Hex } from "../hashing/sha256.js";
import type { AppConfig } from "../config/env.js";
import type { DetectedFace, FaceDetectionResult, FaceEncoding } from "./types.js";

type FaceAnnotation = protos.google.cloud.vision.v1.IFaceAnnotation;

function verticesToBbox(vertices: protos.google.cloud.vision.v1.IVertex[] | null | undefined): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const pts = vertices ?? [];
  if (pts.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const xs = pts.map((p) => p.x ?? 0);
  const ys = pts.map((p) => p.y ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function selectFace(faces: FaceAnnotation[], mode: AppConfig["faceSelection"]): {
  face: FaceAnnotation;
  index: number;
} {
  if (faces.length === 0) {
    throw new PipelineError("No face detected in image", "NO_FACE");
  }

  if (faces.length === 1 || mode === "first") {
    return { face: faces[0]!, index: 0 };
  }

  let bestIndex = 0;
  let bestArea = 0;
  for (let i = 0; i < faces.length; i++) {
    const bbox = verticesToBbox(faces[i]?.boundingPoly?.vertices);
    const area = bbox.width * bbox.height;
    if (area > bestArea) {
      bestArea = area;
      bestIndex = i;
    }
  }
  return { face: faces[bestIndex]!, index: bestIndex };
}

function encodeFaceFromVision(face: FaceAnnotation): FaceEncoding {
  const bbox = verticesToBbox(face.boundingPoly?.vertices);
  const landmarks = (face.landmarks ?? []).map((l) => ({
    type: l.type,
    x: Math.round((l.position?.x ?? 0) * 100) / 100,
    y: Math.round((l.position?.y ?? 0) * 100) / 100,
  }));

  const payload = {
    bbox: {
      x: Math.round(bbox.x),
      y: Math.round(bbox.y),
      width: Math.round(bbox.width),
      height: Math.round(bbox.height),
    },
    landmarks,
    confidence: Math.round((face.detectionConfidence ?? 0) * 10000) / 10000,
    roll: face.rollAngle,
    pan: face.panAngle,
    tilt: face.tiltAngle,
  };

  return {
    descriptorHash: sha256Hex(JSON.stringify(payload)),
    dimensions: landmarks.length,
    model: "google-cloud-vision-face-detection",
  };
}

export class VisionFaceDetector {
  private client: ImageAnnotatorClient;

  constructor(credentialsPath?: string) {
    this.client = new ImageAnnotatorClient(
      credentialsPath ? { keyFilename: credentialsPath } : undefined
    );
  }

  async detectAndEncode(
    imageBuffer: Buffer,
    config: Pick<AppConfig, "faceSelection">
  ): Promise<FaceDetectionResult> {
    const [result] = await this.client.faceDetection({ image: { content: imageBuffer } });

    if (result.error?.message) {
      throw new Error(`Google Vision face detection error: ${result.error.message}`);
    }

    const faces = result.faceAnnotations ?? [];
    const { face, index } = selectFace(faces, config.faceSelection);
    const bbox = verticesToBbox(face.boundingPoly?.vertices);

    if (bbox.width <= 0 || bbox.height <= 0) {
      throw new PipelineError("Invalid face bounding box from detector", "FACE_BBOX_INVALID");
    }

    const selectedFace: DetectedFace = {
      bbox,
      confidence: face.detectionConfidence ?? 0,
      index,
    };

    const faceCropBuffer = await cropFaceRegion(imageBuffer, bbox);
    const encoding = encodeFaceFromVision(face);

    return {
      facesDetected: faces.length,
      selectedFace,
      encoding,
      faceCropSha256: sha256Hex(faceCropBuffer),
      faceCropBuffer,
    };
  }
}

export async function detectAndEncodeFace(
  imageBuffer: Buffer,
  config: Pick<AppConfig, "faceSelection" | "googleApplicationCredentials">
): Promise<FaceDetectionResult> {
  if (!config.googleApplicationCredentials) {
    throw new PipelineError(
      "Face detection requires GOOGLE_APPLICATION_CREDENTIALS (Google Cloud Vision)",
      "MISSING_FACE_PROVIDER"
    );
  }
  const detector = new VisionFaceDetector(config.googleApplicationCredentials);
  return detector.detectAndEncode(imageBuffer, config);
}
