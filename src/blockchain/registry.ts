import {
  createPublicClient,
  createWalletClient,
  http,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { VERIFICATION_REGISTRY_ABI } from "./abi.js";
import type { AppConfig } from "../config/env.js";
import { BRAND } from "../config/brand.js";
import { PipelineError } from "../utils/errors.js";

export interface ChainRecordResult {
  transactionHash: Hash;
  blockNumber: bigint;
  recordHash: `0x${string}`;
}

export function recordHashFromCanonical(canonicalSha256Hex: string): `0x${string}` {
  return `0x${canonicalSha256Hex}` as `0x${string}`;
}

async function assertEthereumSepolia(rpcUrl: string): Promise<void> {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });
  const chainId = await publicClient.getChainId();
  if (chainId !== BRAND.chain.chainId) {
    throw new PipelineError(
      `RPC_URL points to chainId ${chainId}, expected Ethereum Sepolia (${BRAND.chain.chainId})`,
      "WRONG_CHAIN"
    );
  }
}

export async function anchorOnChain(params: {
  config: AppConfig;
  canonicalJsonSha256: string;
  ipfsCid: string;
}): Promise<ChainRecordResult> {
  const { config, canonicalJsonSha256, ipfsCid } = params;

  if (!config.contractAddress) {
    throw new PipelineError("CONTRACT_ADDRESS is required", "MISSING_CONTRACT");
  }
  if (!config.privateKey) {
    throw new PipelineError(
      "PRIVATE_KEY is required for blockchain operations",
      "MISSING_PRIVATE_KEY"
    );
  }
  if (!ipfsCid.trim()) {
    throw new PipelineError("ipfsCid must be a non-empty string", "INVALID_IPFS_CID");
  }

  await assertEthereumSepolia(config.rpcUrl);

  const recordHash = recordHashFromCanonical(canonicalJsonSha256);
  const account = privateKeyToAccount(config.privateKey);
  const transport = http(config.rpcUrl);

  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });

  const existing = await publicClient.readContract({
    address: config.contractAddress,
    abi: VERIFICATION_REGISTRY_ABI,
    functionName: "records",
    args: [recordHash],
  });

  if (existing[2] !== 0n) {
    throw new PipelineError(
      `Record already anchored on-chain for hash ${recordHash}`,
      "DUPLICATE_ON_CHAIN"
    );
  }

  const hash = await walletClient.writeContract({
    address: config.contractAddress,
    abi: VERIFICATION_REGISTRY_ABI,
    functionName: "recordVerification",
    args: [recordHash, ipfsCid],
    account,
    chain: sepolia,
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 120_000,
  });

  if (receipt.status !== "success") {
    throw new PipelineError(`Transaction reverted: ${hash}`, "TX_REVERTED");
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
    throw new PipelineError("CONTRACT_ADDRESS is required", "MISSING_CONTRACT");
  }

  const publicClient = createPublicClient({
    chain: sepolia,
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
