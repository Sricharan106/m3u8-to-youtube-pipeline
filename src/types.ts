export type AnyRecord = Record<string, unknown>;

export interface YouTubeInfo {
  videoId: string;
  url: string;
  privacyStatus: "unlisted";
  uploadedAt: string;
}

export interface ErrorRecord {
  original: AnyRecord;
  stage: "download" | "upload" | "persist" | "unknown";
  error: string;
  failedAt: string;
}
