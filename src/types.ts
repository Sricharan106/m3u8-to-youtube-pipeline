export type AnyRecord = Record<string, unknown>;

export interface YouTubePlaylistInfo {
  id: string;
  title: string;
  url: string;
  playlistItemId: string;
}

export interface YouTubeInfo {
  videoId: string;
  url: string;
  privacyStatus: "unlisted";
  playlist: YouTubePlaylistInfo;
  uploadedAt: string;
}

export interface ErrorRecord {
  original: AnyRecord;
  stage: "download" | "upload" | "playlist" | "persist" | "unknown";
  error: string;
  failedAt: string;
}

export interface PlaylistMapEntry {
  id: string;
  title: string;
  url: string;
}

export interface PlaylistFile {
  playlists: Record<string, PlaylistMapEntry>;
}