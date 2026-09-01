import { ImageAnnotatorClient } from "@google-cloud/vision";
import type { ReverseImageProvider, ReverseImageResult } from "./types.js";

export class GoogleVisionWebDetectionProvider implements ReverseImageProvider {
  readonly name = "Google Cloud Vision — Web Detection";
  private client: ImageAnnotatorClient;

  constructor(credentialsPath?: string) {
    this.client = new ImageAnnotatorClient(
      credentialsPath ? { keyFilename: credentialsPath } : undefined
    );
  }

  async search(imageBuffer: Buffer, queryImageSha256: string): Promise<ReverseImageResult> {
    const [result] = await this.client.annotateImage({
      image: { content: imageBuffer },
      features: [{ type: "WEB_DETECTION" }],
      imageContext: {
        webDetectionParams: { includeGeoResults: false },
      },
    });

    if (result.error?.message) {
      throw new Error(`Google Vision API error: ${result.error.message}`);
    }

    const web = result.webDetection;
    const searchedAt = new Date().toISOString();

    return {
      source: this.name,
      fullMatches: (web?.fullMatchingImages ?? [])
        .filter((m) => m.url)
        .map((m) => ({ url: m.url! })),
      partialMatches: (web?.partialMatchingImages ?? [])
        .filter((m) => m.url)
        .map((m) => ({ url: m.url! })),
      matchingPages: (web?.pagesWithMatchingImages ?? [])
        .filter((p) => p.url)
        .map((p) => ({ url: p.url!, pageTitle: p.pageTitle ?? undefined })),
      visuallySimilar: (web?.visuallySimilarImages ?? [])
        .filter((m) => m.url)
        .map((m) => ({ url: m.url! })),
      searchedAt,
      queryImageSha256,
    };
  }
}
