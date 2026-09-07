import sharp from "sharp";
import type { ReverseImageProvider, ReverseImageResult } from "./types.js";
import { uploadPublicFile } from "../ipfs/pinata.js";
import { PipelineError } from "../utils/errors.js";

interface SerpApiLensMatch {
  link?: string;
  source?: string;
  title?: string;
  thumbnail?: string;
  image?: string;
}

interface SerpApiLensResponse {
  visual_matches?: SerpApiLensMatch[];
  exact_matches?: SerpApiLensMatch[];
  organic_results?: Array<{ link?: string; title?: string; source?: string }>;
  image_sources?: Array<{ link?: string; title?: string; source?: string }>;
  image_results?: SerpApiLensMatch[];
  error?: string;
  search_information?: { organic_results_state?: string };
}

export class SerpApiLensProvider implements ReverseImageProvider {
  readonly name = "SerpAPI — Google Lens";

  constructor(
    private apiKey: string,
    private pinata?: { pinataJwt: string; pinataGateway: string }
  ) {}

  async search(imageBuffer: Buffer, queryImageSha256: string): Promise<ReverseImageResult> {
    const imageUrl = await this.resolvePublicImageUrl(imageBuffer);

    // Default Lens + exact_matches + classic reverse image — parallel for coverage
    const [lensDefault, lensExact, reverse] = await Promise.all([
      this.callSerp({ engine: "google_lens", url: imageUrl }),
      this.callSerp({ engine: "google_lens", url: imageUrl, type: "exact_matches" }),
      this.callSerp({ engine: "google_reverse_image", image_url: imageUrl }),
    ]);

    const responses = [
      { label: "google_lens", data: lensDefault },
      { label: "google_lens_exact", data: lensExact },
      { label: "google_reverse_image", data: reverse },
    ];
    if (responses.every((r) => Boolean(r.data.error))) {
      const detail = responses.map((r) => `${r.label}: ${r.data.error}`).join("; ");
      throw new PipelineError(
        `SerpAPI reverse-image search failed on all engines (${detail})`,
        "REVERSE_SEARCH_PROVIDER_FAILED"
      );
    }

    const fullMatches: ReverseImageResult["fullMatches"] = [];
    const partialMatches: ReverseImageResult["partialMatches"] = [];
    const matchingPages: ReverseImageResult["matchingPages"] = [];
    const visuallySimilar: ReverseImageResult["visuallySimilar"] = [];

    // Exact matches only → fullMatches
    for (const m of lensExact.exact_matches ?? lensExact.visual_matches ?? []) {
      if (m.link) {
        fullMatches.push({ url: m.link });
        matchingPages.push({ url: m.link, pageTitle: m.title });
      }
    }

    // Default Lens visual_matches are SIMILAR products/faces — never treat as exact evidence
    for (const m of lensDefault.visual_matches ?? []) {
      if (m.link) visuallySimilar.push({ url: m.link });
      if (m.image) visuallySimilar.push({ url: m.image });
      if (m.thumbnail) visuallySimilar.push({ url: m.thumbnail });
    }

    // Classic reverse-image results → partial (stronger than visual-similar)
    for (const r of reverse.image_results ?? reverse.image_sources ?? []) {
      if (r.link) {
        partialMatches.push({ url: r.link });
        matchingPages.push({ url: r.link, pageTitle: r.title });
      }
    }
    for (const m of reverse.visual_matches ?? []) {
      if (m.link) {
        partialMatches.push({ url: m.link });
        matchingPages.push({ url: m.link, pageTitle: m.title });
      }
    }

    // Organic Lens hits are weak — only keep as pages when stronger match signals already exist
    const hasStrongerMatch = fullMatches.length > 0 || partialMatches.length > 0;
    if (hasStrongerMatch) {
      for (const o of lensDefault.organic_results ?? []) {
        if (o.link) matchingPages.push({ url: o.link, pageTitle: o.title });
      }
    }

    return {
      source: this.name,
      fullMatches: dedupe(fullMatches),
      partialMatches: dedupe(partialMatches),
      matchingPages: dedupe(matchingPages),
      visuallySimilar: dedupe(visuallySimilar),
      searchedAt: new Date().toISOString(),
      queryImageSha256,
    };
  }

  private async callSerp(params: Record<string, string>): Promise<SerpApiLensResponse> {
    const qs = new URLSearchParams({ api_key: this.apiKey, ...params });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(`https://serpapi.com/search.json?${qs}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }
      return (await response.json()) as SerpApiLensResponse;
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async resolvePublicImageUrl(imageBuffer: Buffer): Promise<string> {
    if (!this.pinata?.pinataJwt) {
      throw new PipelineError(
        "SerpAPI Google Lens needs a public image URL. Set PINATA_JWT so the query image can be hosted temporarily on IPFS.",
        "MISSING_PINATA_FOR_SERP"
      );
    }

    const jpeg = await sharp(imageBuffer)
      .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const { url } = await uploadPublicFile(
      jpeg,
      `lens-query-${Date.now()}.jpg`,
      "image/jpeg",
      this.pinata
    );

    return url;
  }
}

function dedupe<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
