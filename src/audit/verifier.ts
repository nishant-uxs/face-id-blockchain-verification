import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPublicClient, decodeEventLog, http } from "viem";
import { sepolia } from "viem/chains";
import type { AppConfig } from "../config/env.js";
import { AuditError } from "../utils/errors.js";
import { computeCommitmentHash, type VerificationRecord } from "../evidence/builder.js";
import { sha256File } from "../hashing/sha256.js";
import { fetchVerificationFromIpfs } from "../ipfs/pinata.js";
import { readChainRecord, recordHashFromCanonical } from "../blockchain/registry.js";
import { VERIFICATION_REGISTRY_ABI } from "../blockchain/abi.js";
import { BRAND } from "../config/brand.js";
import { classifyUrl } from "../utils/social-classifier.js";

export type AuditSection = "INPUT IMAGE" | "EVIDENCE" | "BLOCKCHAIN" | "RESULT";

export interface AuditCheck {
  section: AuditSection;
  name: string;
  passed: boolean;
  detail: string;
  /** Neutral checks (e.g. skipped) do not fail the audit but are not counted as passes. */
  skipped?: boolean;
}

export interface AuditResult {
  valid: boolean;
  checks: AuditCheck[];
  failureReason?: string;
}

export async function auditVerification(
  recordPath: string,
  config: AppConfig,
  inputImagePath?: string
): Promise<AuditResult> {
  const checks: AuditCheck[] = [];
  const resolved = resolve(recordPath);
  const raw = await readFile(resolved, "utf-8");
  const record = JSON.parse(raw) as VerificationRecord;

  const fail = (section: AuditSection, name: string, detail: string): never => {
    checks.push({ section, name, passed: false, detail });
    throw new AuditError("VERIFICATION FAILED", `${name}: ${detail}`);
  };

  const pass = (section: AuditSection, name: string, detail: string) => {
    checks.push({ section, name, passed: true, detail });
  };

  const skip = (section: AuditSection, name: string, detail: string) => {
    checks.push({ section, name, passed: true, detail, skipped: true });
  };

  try {
    // ── INPUT IMAGE ──
    if (inputImagePath) {
      const imageHash = await sha256File(resolve(inputImagePath));
      if (imageHash !== record.input.sha256) {
        fail("INPUT IMAGE", "SHA-256", `expected ${record.input.sha256}, got ${imageHash}`);
      }
      pass("INPUT IMAGE", "SHA-256", `${imageHash.slice(0, 16)}… matches artifact`);
    } else {
      skip("INPUT IMAGE", "SHA-256", "skipped (pass --image to verify)");
    }

    // ── EVIDENCE ──
    const { integrity, blockchain, storage: _storage, ...committable } = record;
    const recomputed = computeCommitmentHash(committable);

    if (recomputed !== integrity.canonicalJsonSha256) {
      fail("EVIDENCE", "Canonical JSON hash", "recomputed hash does not match integrity field");
    }
    pass("EVIDENCE", "Canonical JSON", `${recomputed.slice(0, 16)}… valid`);

    const ipfsData = await fetchVerificationFromIpfs(record.storage.ipfsCid, config.pinataGateway);
    const ipfsHash = computeCommitmentHash(ipfsData as Parameters<typeof computeCommitmentHash>[0]);

    if (ipfsHash !== integrity.canonicalJsonSha256) {
      fail("EVIDENCE", "IPFS content", "gateway JSON does not match canonical commitment");
    }
    pass("EVIDENCE", "IPFS CID", `${record.storage.ipfsCid} resolves and matches`);

    const liveClass = classifyUrl(record.evidence.selectedMatchUrl);
    if (liveClass.classification !== record.evidence.pageClassification) {
      fail(
        "EVIDENCE",
        "URL classification",
        `reclassified as ${liveClass.classification}, record claims ${record.evidence.pageClassification}`
      );
    }
    pass(
      "EVIDENCE",
      "URL classification",
      `${liveClass.classification} on ${liveClass.platform ?? liveClass.domain ?? "unknown"}`
    );

    if (config.requireSocialMatch && liveClass.classification !== "SOCIAL_POST") {
      fail(
        "EVIDENCE",
        "Social post evidence",
        `REQUIRE_SOCIAL_MATCH=true but selected URL is ${liveClass.classification}`
      );
    }
    if (liveClass.classification === "SOCIAL_POST") {
      pass(
        "EVIDENCE",
        "Social post evidence",
        `${liveClass.classification} on ${liveClass.platform ?? liveClass.domain}`
      );
    } else {
      pass(
        "EVIDENCE",
        "Social post evidence",
        `classification: ${liveClass.classification} (non-strict record)`
      );
    }

    // ── BLOCKCHAIN ──
    if (record.blockchain.chainId !== BRAND.chain.chainId) {
      fail(
        "BLOCKCHAIN",
        "Chain ID",
        `expected ${BRAND.chain.chainId}, got ${record.blockchain.chainId}`
      );
    }
    pass("BLOCKCHAIN", "Ethereum Sepolia", `chainId ${record.blockchain.chainId}`);

    if (record.blockchain.contractAddress.toLowerCase() !== config.contractAddress?.toLowerCase()) {
      fail("BLOCKCHAIN", "Contract address", "does not match configured CONTRACT_ADDRESS");
    }
    pass("BLOCKCHAIN", "Contract address", record.blockchain.contractAddress);

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(config.rpcUrl),
    });

    const liveChainId = await publicClient.getChainId();
    if (liveChainId !== BRAND.chain.chainId) {
      fail(
        "BLOCKCHAIN",
        "RPC chain",
        `RPC_URL is chainId ${liveChainId}, expected ${BRAND.chain.chainId}`
      );
    }
    pass("BLOCKCHAIN", "RPC chain", `chainId ${liveChainId}`);

    const bytecode = await publicClient.getBytecode({
      address: record.blockchain.contractAddress as `0x${string}`,
    });
    if (!bytecode || bytecode === "0x") {
      fail("BLOCKCHAIN", "Contract exists", "no bytecode at contract address");
    }
    pass("BLOCKCHAIN", "Contract exists", "bytecode present on-chain");

    const recordHash = recordHashFromCanonical(integrity.canonicalJsonSha256);
    const onChain = await readChainRecord(config, recordHash);

    if (onChain.ipfsCid !== record.storage.ipfsCid) {
      fail("BLOCKCHAIN", "On-chain IPFS CID", `expected ${record.storage.ipfsCid}, got ${onChain.ipfsCid}`);
    }
    pass("BLOCKCHAIN", "IPFS CID on-chain", onChain.ipfsCid);

    if (onChain.recordHash !== recordHash) {
      fail("BLOCKCHAIN", "recordHash", `expected ${recordHash}, got ${onChain.recordHash}`);
    }
    pass("BLOCKCHAIN", "recordHash", `${recordHash.slice(0, 18)}… matches`);

    const receipt = await publicClient.getTransactionReceipt({
      hash: record.blockchain.transactionHash as `0x${string}`,
    });

    if (!receipt) {
      fail("BLOCKCHAIN", "Transaction receipt", "not found on Ethereum Sepolia");
    }
    if (receipt.status !== "success") {
      fail("BLOCKCHAIN", "Transaction receipt", "transaction did not succeed");
    }

    const expectedTo = record.blockchain.contractAddress.toLowerCase();
    const receiptTo = receipt.to?.toLowerCase();
    if (!receiptTo || receiptTo !== expectedTo) {
      fail(
        "BLOCKCHAIN",
        "Transaction target",
        `receipt.to is ${receipt.to ?? "null"}, expected ${record.blockchain.contractAddress}`
      );
    }
    pass("BLOCKCHAIN", "Transaction target", receipt.to!);

    if (Number(receipt.blockNumber) !== record.blockchain.blockNumber) {
      fail(
        "BLOCKCHAIN",
        "Block number",
        `expected ${record.blockchain.blockNumber}, got ${receipt.blockNumber}`
      );
    }
    pass(
      "BLOCKCHAIN",
      "Transaction confirmed",
      `block ${receipt.blockNumber}, status success`
    );

    const contractLogs = receipt.logs.filter(
      (log) => log.address.toLowerCase() === expectedTo
    );
    const event = contractLogs
      .map((log) => {
        try {
          return decodeEventLog({
            abi: VERIFICATION_REGISTRY_ABI,
            data: log.data,
            topics: log.topics,
          });
        } catch {
          return null;
        }
      })
      .find((e) => e?.eventName === "VerificationRecorded");

    if (!event || event.args.recordHash !== recordHash) {
      fail("BLOCKCHAIN", "VerificationRecorded event", "event not found or recordHash mismatch");
    }
    pass("BLOCKCHAIN", "VerificationRecorded event", "emitted with matching recordHash");

    checks.push({
      section: "RESULT",
      name: "Verification status",
      passed: true,
      detail: "All integrity checks passed",
    });

    return { valid: true, checks };
  } catch (err) {
    if (err instanceof AuditError) {
      return { valid: false, checks, failureReason: err.reason };
    }
    checks.push({
      section: "RESULT",
      name: "Unexpected error",
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
    return { valid: false, checks, failureReason: checks.at(-1)?.detail };
  }
}
