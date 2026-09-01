import type { ReverseImageProvider, ReverseImageResult } from "./types.js";

interface SerpApiLensResponse {
  visual_matches?: Array<{
    link?: string;
    source?: string;
    title?: string;
    thumbnail?: string;
  }>;
  error?: string;
}

export class SerpApiLensProvider implements ReverseImageProvider {
  readonly name = "SerpAPI — Google Lens";

  constructor(private apiKey: string) {}

  async search(imageBuffer: Buffer, queryImageSha256: string): Promise<ReverseImageResult> {
    const base64 = imageBuffer.toString("base64");
    const params = new URLSearchParams({
      engine: "google_lens",
      api_key: this.apiKey,
      url: `data:image/jpeg;base64,${base64}`,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(`https://serpapi.com/search.json?${params}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`SerpAPI HTTP ${response.status}: ${await response.text()}`);
      }

      const data = (await response.json()) as SerpApiLensResponse;
      if (data.error) {
        throw new Error(`SerpAPI error: ${data.error}`);
      }

      const matches = data.visual_matches ?? [];
      const fullMatches: ReverseImageResult["fullMatches"] = [];
      const matchingPages: ReverseImageResult["matchingPages"] = [];

      for (const m of matches) {
        if (m.link) {
          fullMatches.push({ url: m.link });
        }
        if (m.source && m.source.startsWith("http")) {
          matchingPages.push({ url: m.source, pageTitle: m.title });
        }
      }

      return {
        source: this.name,
        fullMatches,
        partialMatches: [],
        matchingPages,
        visuallySimilar: matches
          .filter((m) => m.thumbnail)
          .map((m) => ({ url: m.thumbnail! })),
        searchedAt: new Date().toISOString(),
        queryImageSha256,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
