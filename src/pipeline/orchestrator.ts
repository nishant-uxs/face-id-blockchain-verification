import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AppConfig } from "../config/env.js";
import { detectAndEncodeFace } from "../face/detector.js";
import {
  assembleFinalRecord,
  buildCommittableRecord,
  computeCommitmentHash,
  type VerificationRecord,
} from "../evidence/builder.js";
import { selectBestEvidence } from "../evidence/scorer.js";
import { anchorOnChain } from "../blockchain/registry.js";
import { uploadVerificationJson } from "../ipfs/pinata.js";
import { createReverseImageProvider } from "../reverse-search/provider.js";
import { loadAndValidateImage } from "../utils/image.js";
import { NoMatchError } from "../utils/errors.js";
import { BRAND } from "../config/brand.js";

export interface PipelineCallbacks {
  onStep?: (step: number, total: number, message: string) => void;
  onDetail?: (message: string) => void;
}

export interface PipelineResult {
  record: VerificationRecord;
  outputPath: string;
}

const TOTAL_STEPS = 8;

export async function runVerificationPipeline(
  imagePath: string,
  config: AppConfig,
  outputPath: string,
  callbacks: PipelineCallbacks = {}
): Promise<PipelineResult> {
  const { onStep, onDetail } = callbacks;
  const resolvedImage = resolve(imagePath);
  const resolvedOutput = resolve(outputPath);

  onStep?.(1, TOTAL_STEPS, "Loading image");
  const image = await loadAndValidateImage(resolvedImage, config.maxImageBytes);
  onDetail?.(`${image.width} × ${image.height}`);
  onDetail?.(`SHA-256 ${image.sha256.slice(0, 16)}…`);

  onStep?.(2, TOTAL_STEPS, "Detecting face");
  const face = await detectAndEncodeFace(image.buffer, config);
  onDetail?.(`${face.facesDetected} face(s) detected`);
  onDetail?.(`confidence ${(face.selectedFace.confidence * 100).toFixed(1)}%`);
  if (face.facesDetected > 1) {
    onDetail?.(`selected face #${face.selectedFace.index} (${config.faceSelection} strategy)`);
  }

  onStep?.(3, TOTAL_STEPS, "Encoding face");
  onDetail?.(`descriptor hash ${face.encoding.descriptorHash.slice(0, 16)}…`);
  onDetail?.(`face crop SHA-256 ${face.faceCropSha256.slice(0, 16)}…`);

  onStep?.(4, TOTAL_STEPS, "Reverse-image search");
  const provider = createReverseImageProvider(config);
  onDetail?.(`provider: ${provider.name}`);
  const reverseSearch = await provider.search(face.faceCropBuffer, face.faceCropSha256);
  onDetail?.(`full matches: ${reverseSearch.fullMatches.length}`);
  onDetail?.(`partial matches: ${reverseSearch.partialMatches.length}`);
  onDetail?.(`matching pages: ${reverseSearch.matchingPages.length}`);

  onStep?.(5, TOTAL_STEPS, "Selecting evidence");
  const selection = selectBestEvidence(reverseSearch, config.requireSocialMatch);
  if (!selection) {
    const reason = config.requireSocialMatch
      ? "no qualifying social POST found (profiles, Wikimedia, CDN, and visually-similar results are rejected)"
      : "no qualifying full/partial/page matches found";
    throw new NoMatchError(`NO VERIFIED MATCH FOUND — ${reason}`);
  }
  onDetail?.(`match type: ${selection.candidate.matchType}`);
  onDetail?.(`classification: ${selection.candidate.pageClassification}`);
  onDetail?.(`platform: ${selection.candidate.platform ?? "none"}`);
  onDetail?.(`domain: ${selection.candidate.domain ?? "unknown"}`);
  onDetail?.(`evidence score: ${selection.score.total}`);

  onStep?.(6, TOTAL_STEPS, "Creating integrity record");
  const committable = buildCommittableRecord({
    image,
    face,
    reverseSearch,
    evidence: selection.candidate,
    score: selection.score,
  });

  const canonicalJsonSha256 = computeCommitmentHash(committable);
  onDetail?.(`canonical SHA-256 ${canonicalJsonSha256.slice(0, 16)}…`);

  onStep?.(7, TOTAL_STEPS, "Uploading evidence to IPFS");
  const ipfsCid = await uploadVerificationJson(
    committable as unknown as Record<string, unknown>,
    config
  );
  onDetail?.(`CID: ${ipfsCid}`);

  onStep?.(8, TOTAL_STEPS, "Anchoring on Base Sepolia");
  const chainResult = await anchorOnChain({
    config,
    canonicalJsonSha256,
    ipfsCid,
  });
  onDetail?.(`transaction confirmed`);
  onDetail?.(`block: ${chainResult.blockNumber}`);
  onDetail?.(`tx: ${chainResult.transactionHash}`);

  const record = assembleFinalRecord(
    committable,
    ipfsCid,
    {
      chain: BRAND.chain.name,
      chainId: BRAND.chain.chainId,
      contractAddress: config.contractAddress!,
      transactionHash: chainResult.transactionHash,
      blockNumber: Number(chainResult.blockNumber),
    }
  );

  await mkdir(dirname(resolvedOutput), { recursive: true });
  await writeFile(resolvedOutput, JSON.stringify(record, null, 2), "utf-8");

  return { record, outputPath: resolvedOutput };
}
