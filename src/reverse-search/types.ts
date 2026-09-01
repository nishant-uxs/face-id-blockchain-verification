export interface ReverseImageMatch {
  url: string;
  score?: number;
}

export interface ReverseImagePage {
  url: string;
  pageTitle?: string;
}

export interface ReverseImageResult {
  source: string;
  fullMatches: ReverseImageMatch[];
  partialMatches: ReverseImageMatch[];
  matchingPages: ReverseImagePage[];
  visuallySimilar: ReverseImageMatch[];
  searchedAt: string;
  queryImageSha256: string;
}

export interface ReverseImageProvider {
  readonly name: string;
  search(imageBuffer: Buffer, queryImageSha256: string): Promise<ReverseImageResult>;
}
