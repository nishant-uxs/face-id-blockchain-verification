import { randomUUID } from "node:crypto";
import { canonicalize } from "../hashing/canonical.js";
import { sha256Hex } from "../hashing/sha256.js";
import type { LoadedImage } from "../utils/image.js";
import type { FaceDetectionResult } from "../face/types.js";
import type { ReverseImageResult } from "../reverse-search/types.js";
import type { EvidenceCandidate, EvidenceScore } from "./scorer.js";

export const SCHEMA_VERSION = "1.0.0";

export interface VerificationRecord {
  schemaVersion: string;
  verificationId: string;
  createdAt: string;
  claim: string;
  input: {
    filename: string;
    mimeType: string;
    sha256: string;
    width: number;
    height: number;
  };
  faceDetection: {
    facesDetected: number;
    selectedFace: {
      bbox: { x: number; y: number; width: number; height: number };
      confidence: number;
      index: number;
    };
    encoding: {
      descriptorHash: string;
      dimensions: number;
      model: string;
    };
    faceCropSha256: string;
  };
  reverseImageSearch: ReverseImageResult;
  evidence: {
    selectedMatchUrl: string;
    selectedImageUrl: string;
    matchType: string;
    domain: string | null;
    platform: string | null;
    pageClassification: string;
    classificationReason: string;
    pageTitle?: string;
    evidenceScore: number;
    scoreBreakdown: EvidenceScore["components"];
    isSocialPost: boolean;
  };
  integrity: {
    canonicalJsonSha256: string;
  };
  storage: {
    ipfsCid: string;
  };
  blockchain: {
    chain: string;
    chainId: number;
    contractAddress: string;
    transactionHash: string;
    blockNumber: number;
  };
}

/** Evidence payload stored on IPFS and committed on-chain (excludes storage/integrity/blockchain) */
export type CommittableRecord = Omit<VerificationRecord, "integrity" | "blockchain" | "storage">;

export function buildCommittableRecord(params: {
  image: LoadedImage;
  face: FaceDetectionResult;
  reverseSearch: ReverseImageResult;
  evidence: EvidenceCandidate;
  score: EvidenceScore;
  verificationId?: string;
}): CommittableRecord {
  return {
    schemaVersion: SCHEMA_VERSION,
    verificationId: params.verificationId ?? randomUUID(),
    createdAt: new Date().toISOString(),
    claim: "Evidence found for a matching image/page — not proof of personal identity",
    input: {
      filename: params.image.filename,
      mimeType: params.image.mimeType,
      sha256: params.image.sha256,
      width: params.image.width,
      height: params.image.height,
    },
    faceDetection: {
      facesDetected: params.face.facesDetected,
      selectedFace: {
        bbox: params.face.selectedFace.bbox,
        confidence: params.face.selectedFace.confidence,
        index: params.face.selectedFace.index,
      },
      encoding: params.face.encoding,
      faceCropSha256: params.face.faceCropSha256,
    },
    reverseImageSearch: params.reverseSearch,
    evidence: {
      selectedMatchUrl: params.evidence.selectedMatchUrl,
      selectedImageUrl: params.evidence.selectedImageUrl,
      matchType: params.evidence.matchType,
      domain: params.evidence.domain,
      platform: params.evidence.platform,
      pageClassification: params.evidence.pageClassification,
      classificationReason: params.evidence.classificationReason,
      pageTitle: params.evidence.pageTitle,
      evidenceScore: params.score.total,
      scoreBreakdown: params.score.components,
      isSocialPost: params.evidence.isSocialPost,
    },
  };
}

export function computeCommitmentHash(committable: CommittableRecord): string {
  return sha256Hex(canonicalize(committable));
}

export function assembleFinalRecord(
  committable: CommittableRecord,
  ipfsCid: string,
  blockchain: VerificationRecord["blockchain"]
): VerificationRecord {
  const canonicalJsonSha256 = computeCommitmentHash(committable);
  return {
    ...committable,
    storage: { ipfsCid },
    integrity: { canonicalJsonSha256 },
    blockchain,
  };
}
