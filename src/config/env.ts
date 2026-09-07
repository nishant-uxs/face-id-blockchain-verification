import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ConfigError } from "../utils/errors.js";

config();

export interface AppConfig {
  googleApplicationCredentials?: string;
  serpApiKey?: string;
  pinataJwt?: string;
  pinataGateway: string;
  rpcUrl: string;
  privateKey?: `0x${string}`;
  contractAddress?: `0x${string}`;
  maxImageBytes: number;
  faceSelection: "largest" | "first";
  requireSocialMatch: boolean;
}

const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const HEX_PRIVATE_KEY = /^0x[a-fA-F0-9]{64}$/;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${name}`, "MISSING_ENV");
  }
  return value;
}

function parseRequireSocialMatch(): boolean {
  const raw = process.env.REQUIRE_SOCIAL_MATCH;
  if (raw === undefined || raw === "") return true;
  return raw === "true";
}

function parseMaxImageBytes(): number {
  const raw = process.env.MAX_IMAGE_BYTES ?? String(10 * 1024 * 1024);
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ConfigError(
      `MAX_IMAGE_BYTES must be a positive number, got: ${raw}`,
      "INVALID_MAX_IMAGE_BYTES"
    );
  }
  return value;
}

function parseFaceSelection(): "largest" | "first" {
  const raw = process.env.FACE_SELECTION ?? "largest";
  if (raw !== "largest" && raw !== "first") {
    throw new ConfigError(
      `FACE_SELECTION must be "largest" or "first", got: ${raw}`,
      "INVALID_FACE_SELECTION"
    );
  }
  return raw;
}

export function loadConfig(partial?: Partial<AppConfig>): AppConfig {
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (creds && !existsSync(resolve(creds))) {
    throw new ConfigError(
      `GOOGLE_APPLICATION_CREDENTIALS file not found: ${creds}`,
      "INVALID_CREDENTIALS_PATH"
    );
  }

  return {
    googleApplicationCredentials: creds || undefined,
    serpApiKey: process.env.SERPAPI_KEY || undefined,
    pinataJwt: process.env.PINATA_JWT || undefined,
    pinataGateway: process.env.PINATA_GATEWAY ?? "gateway.pinata.cloud",
    rpcUrl: process.env.RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
    privateKey: process.env.PRIVATE_KEY as `0x${string}` | undefined,
    contractAddress: process.env.CONTRACT_ADDRESS as `0x${string}` | undefined,
    maxImageBytes: parseMaxImageBytes(),
    faceSelection: parseFaceSelection(),
    requireSocialMatch: parseRequireSocialMatch(),
    ...partial,
  };
}

export function requireVerifyConfig(): AppConfig {
  const cfg = loadConfig();

  // Face detection is local — Google is optional (Vision Web Detection only).
  if (!cfg.serpApiKey && !cfg.googleApplicationCredentials) {
    throw new ConfigError(
      "At least one reverse-image provider is required: SERPAPI_KEY (recommended) or GOOGLE_APPLICATION_CREDENTIALS",
      "MISSING_REVERSE_SEARCH_PROVIDER"
    );
  }

  const pinataJwt = requireEnv("PINATA_JWT");
  const privateKey = requireEnv("PRIVATE_KEY");
  const contractAddress = requireEnv("CONTRACT_ADDRESS");

  if (!HEX_PRIVATE_KEY.test(privateKey)) {
    throw new ConfigError(
      "PRIVATE_KEY must be a 0x-prefixed 64-hex-character string",
      "INVALID_PRIVATE_KEY"
    );
  }
  if (!HEX_ADDRESS.test(contractAddress)) {
    throw new ConfigError(
      "CONTRACT_ADDRESS must be a 0x-prefixed 40-hex-character address",
      "INVALID_CONTRACT_ADDRESS"
    );
  }

  return {
    ...cfg,
    pinataJwt,
    privateKey: privateKey as `0x${string}`,
    contractAddress: contractAddress as `0x${string}`,
  };
}

export function requireAuditConfig(): AppConfig {
  const cfg = loadConfig();
  const contractAddress = requireEnv("CONTRACT_ADDRESS");
  if (!HEX_ADDRESS.test(contractAddress)) {
    throw new ConfigError(
      "CONTRACT_ADDRESS must be a 0x-prefixed 40-hex-character address",
      "INVALID_CONTRACT_ADDRESS"
    );
  }
  return {
    ...cfg,
    contractAddress: contractAddress as `0x${string}`,
  };
}
