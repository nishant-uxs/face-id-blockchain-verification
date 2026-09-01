import { PinataSDK } from "pinata";
import type { AppConfig } from "../config/env.js";

export async function uploadVerificationJson(
  record: Record<string, unknown>,
  config: Pick<AppConfig, "pinataJwt" | "pinataGateway">
): Promise<string> {
  if (!config.pinataJwt) {
    throw new Error("PINATA_JWT is required for IPFS upload");
  }

  const pinata = new PinataSDK({
    pinataJwt: config.pinataJwt,
    pinataGateway: config.pinataGateway,
  });

  const upload = await pinata.upload.public.json(record).name(`verification-${Date.now()}.json`);

  if (!upload.cid) {
    throw new Error("Pinata upload succeeded but no CID returned");
  }

  return upload.cid;
}

export async function fetchVerificationFromIpfs(
  cid: string,
  gateway: string
): Promise<Record<string, unknown>> {
  const url = `https://${gateway}/ipfs/${cid}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`IPFS gateway HTTP ${response.status} for CID ${cid}`);
    }
    return (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}
