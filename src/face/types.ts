export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedFace {
  bbox: BoundingBox;
  confidence: number;
  index: number;
}

export interface FaceEncoding {
  /** SHA-256 of quantized 128-D descriptor — not the raw embedding */
  descriptorHash: string;
  dimensions: number;
  model: string;
}

export interface FaceDetectionResult {
  facesDetected: number;
  selectedFace: DetectedFace;
  encoding: FaceEncoding;
  faceCropSha256: string;
  faceCropBuffer: Buffer;
}
