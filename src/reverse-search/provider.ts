import type { AppConfig } from "../config/env.js";
import { PipelineError } from "../utils/errors.js";
import { GoogleVisionWebDetectionProvider } from "./google-vision.js";
import { SerpApiLensProvider } from "./serpapi.js";
import type { ReverseImageProvider, ReverseImageResult } from "./types.js";

export class CompositeReverseImageProvider implements ReverseImageProvider {
  readonly name: string;
  private providers: ReverseImageProvider[];

  constructor(providers: ReverseImageProvider[]) {
    this.providers = providers;
    this.name = providers.map((p) => p.name).join(" + ");
  }

  async search(imageBuffer: Buffer, queryImageSha256: string): Promise<ReverseImageResult> {
    const results: ReverseImageResult[] = [];
    const errors: string[] = [];

    for (const provider of this.providers) {
      try {
        const result = await provider.search(imageBuffer, queryImageSha256);
        results.push(result);
      } catch (err) {
        errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (results.length === 0) {
      throw new PipelineError(
        `All reverse-image providers failed:\n${errors.join("\n")}`,
        "REVERSE_SEARCH_PROVIDER_FAILED"
      );
    }

    return mergeResults(results, queryImageSha256);
  }
}

function mergeResults(results: ReverseImageResult[], queryImageSha256: string): ReverseImageResult {
  const dedupe = <T extends { url: string }>(items: T[]): T[] => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return {
    source: results.map((r) => r.source).join(" + "),
    fullMatches: dedupe(results.flatMap((r) => r.fullMatches)),
    partialMatches: dedupe(results.flatMap((r) => r.partialMatches)),
    matchingPages: dedupe(results.flatMap((r) => r.matchingPages)),
    visuallySimilar: dedupe(results.flatMap((r) => r.visuallySimilar)),
    searchedAt: new Date().toISOString(),
    queryImageSha256,
  };
}

export function createReverseImageProvider(config: AppConfig): ReverseImageProvider {
  const providers: ReverseImageProvider[] = [];

  // SerpAPI is primary. Skip Vision when SerpAPI is present — Vision without billing only
  // adds latency/noise and does not help the happy path.
  if (config.serpApiKey) {
    return new SerpApiLensProvider(config.serpApiKey, {
      pinataJwt: config.pinataJwt ?? "",
      pinataGateway: config.pinataGateway,
    });
  }
  if (config.googleApplicationCredentials) {
    providers.push(new GoogleVisionWebDetectionProvider(config.googleApplicationCredentials));
  }

  if (providers.length === 0) {
    throw new PipelineError("No reverse-image provider configured", "MISSING_REVERSE_SEARCH_PROVIDER");
  }

  if (providers.length === 1) {
    return providers[0]!;
  }

  return new CompositeReverseImageProvider(providers);
}
