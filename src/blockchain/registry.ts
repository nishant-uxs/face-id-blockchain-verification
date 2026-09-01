import {
  createPublicClient,
  createWalletClient,
  http,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { VERIFICATION_REGISTRY_ABI } from "./abi.js";
import type { AppConfig } from "../config/env.js";
import { sha256HexWithPrefix } from "../hashing/sha256.js";

export interface ChainRecordResult {
  transactionHash: Hash;
  blockNumber: bigint;
  recordHash: `0x${string}`;
}

export function recordHashFromCanonical(canonicalSha256Hex: string): `0x${string}` {
  return `0x${canonicalSha256Hex}` as `0x${string}`;
}

export async function anchorOnChain(params: {
  config: AppConfig;
  canonicalJsonSha256: string;
  ipfsCid: string;
}): Promise<ChainRecordResult> {
  const { config, canonicalJsonSha256, ipfsCid } = params;

  if (!config.contractAddress) {
    throw new Error("CONTRACT_ADDRESS is required");
  }
  if (!config.privateKey) {
    throw new Error("PRIVATE_KEY is required for blockchain operations");
  }

  const recordHash = recordHashFromCanonical(canonicalJsonSha256);
  const account = privateKeyToAccount(config.privateKey);
  const transport = http(config.rpcUrl);

  const publicClient = createPublicClient({ chain: baseSepolia, transport });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport });

  const existing = await publicClient.readContract({
    address: config.contractAddress,
    abi: VERIFICATION_REGISTRY_ABI,
    functionName: "records",
    args: [recordHash],
  });

  if (existing[2] !== 0n) {
    throw new Error(`Record already anchored on-chain for hash ${recordHash}`);
  }

  const hash = await walletClient.writeContract({
    address: config.contractAddress,
    abi: VERIFICATION_REGISTRY_ABI,
    functionName: "recordVerification",
    args: [recordHash, ipfsCid],
    account,
    chain: baseSepolia,
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 120_000,
  });

  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted: ${hash}`);
  }

  return {
    transactionHash: hash,
    blockNumber: receipt.blockNumber,
    recordHash,
  };
}

export async function readChainRecord(
  config: Pick<AppConfig, "rpcUrl" | "contractAddress">,
  recordHash: `0x${string}`
): Promise<{ recordHash: `0x${string}`; ipfsCid: string; timestamp: bigint; submitter: string }> {
  if (!config.contractAddress) {
    throw new Error("CONTRACT_ADDRESS is required");
  }

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(config.rpcUrl),
  });

  const result = await publicClient.readContract({
    address: config.contractAddress,
    abi: VERIFICATION_REGISTRY_ABI,
    functionName: "getVerification",
    args: [recordHash],
  });

  return {
    recordHash: result[0],
    ipfsCid: result[1],
    timestamp: result[2],
    submitter: result[3],
  };
}

export function computeRecordHashFromContent(content: string): `0x${string}` {
  return sha256HexWithPrefix(content);
}
