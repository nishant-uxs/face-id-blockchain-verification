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

export function loadConfig(partial?: Partial<AppConfig>): AppConfig {
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (creds && !existsSync(resolve(creds))) {
    throw new ConfigError(
      `GOOGLE_APPLICATION_CREDENTIALS file not found: ${creds}`,
      "INVALID_CREDENTIALS_PATH"
    );
  }

  return {
    googleApplicationCredentials: creds,
    serpApiKey: process.env.SERPAPI_KEY,
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: process.env.PINATA_GATEWAY ?? "gateway.pinata.cloud",
    rpcUrl: process.env.RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
    privateKey: process.env.PRIVATE_KEY as `0x${string}` | undefined,
    contractAddress: process.env.CONTRACT_ADDRESS as `0x${string}` | undefined,
    maxImageBytes: Number(process.env.MAX_IMAGE_BYTES ?? 10 * 1024 * 1024),
    faceSelection: (process.env.FACE_SELECTION as "largest" | "first") ?? "largest",
    requireSocialMatch: parseRequireSocialMatch(),
    ...partial,
  };
}

export function requireVerifyConfig(): AppConfig {
  const cfg = loadConfig();

  // Face detection is local — Google is optional.
  // Reverse-image search requires SerpAPI and/or Google Vision Web Detection.
  if (!cfg.serpApiKey && !cfg.googleApplicationCredentials) {
    throw new ConfigError(
      "At least one reverse-image provider is required: SERPAPI_KEY (recommended) or GOOGLE_APPLICATION_CREDENTIALS",
      "MISSING_REVERSE_SEARCH_PROVIDER"
    );
  }

  requireEnv("PINATA_JWT");
  requireEnv("PRIVATE_KEY");
  requireEnv("CONTRACT_ADDRESS");

  if (!cfg.privateKey?.startsWith("0x") || cfg.privateKey.length < 66) {
    throw new ConfigError("PRIVATE_KEY must be a valid 0x-prefixed hex string", "INVALID_PRIVATE_KEY");
  }

  return {
    ...cfg,
    pinataJwt: requireEnv("PINATA_JWT"),
    privateKey: requireEnv("PRIVATE_KEY") as `0x${string}`,
    contractAddress: requireEnv("CONTRACT_ADDRESS") as `0x${string}`,
  };
}

export function requireAuditConfig(): AppConfig {
  const cfg = loadConfig();
  requireEnv("CONTRACT_ADDRESS");
  return {
    ...cfg,
    contractAddress: requireEnv("CONTRACT_ADDRESS") as `0x${string}`,
  };
}
