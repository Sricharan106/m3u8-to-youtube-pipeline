import fs from "node:fs/promises";
import { google, youtube_v3 } from "googleapis";
import {
  LOCAL_TOKEN_FILE,
  OAUTH_CLIENT_FILE
} from "./config.js";
import { PlaylistMapEntry } from "./types.js";

const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube";

async function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    return auth;
  }

  const raw = await fs.readFile(OAUTH_CLIENT_FILE, "utf8");
  const credentials = JSON.parse(raw);

  const installed = credentials.installed ?? credentials.web;

  if (!installed?.client_id || !installed?.client_secret) {
    throw new Error(
      "OAuth client JSON must contain installed or web client credentials."
    );
  }

  const auth = new google.auth.OAuth2(
    installed.client_id,
    installed.client_secret,
    installed.redirect_uris?.[0]
  );

  const tokenRaw = await fs.readFile(LOCAL_TOKEN_FILE, "utf8");
  const tokens = JSON.parse(tokenRaw);

  if (typeof tokens.refresh_token !== "string" || !tokens.refresh_token) {
    throw new Error(
      "Token JSON does not contain a refresh_token. Run `npm run oauth` again."
    );
  }

  auth.setCredentials(tokens);
  return auth;
}

export async function getYouTube(): Promise<youtube_v3.Youtube> {
  const auth = await getOAuthClient();

  return google.youtube({
    version: "v3",
    auth
  });
}

export async function uploadVideo(
  youtube: youtube_v3.Youtube,
  filePath: string,
  title: string,
  sourceId: string
): Promise<{
  videoId: string;
  url: string;
}> {
  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title,
        description:
          `Source ID: ${sourceId}\n\nUploaded by the M3U8 → YouTube worker.`
      },
      status: {
        privacyStatus: "unlisted"
      }
    },
    media: {
      body: await import("node:fs").then((m) => m.createReadStream(filePath))
    }
  });

  const videoId = response.data.id;

  if (!videoId) {
    throw new Error("YouTube upload returned no video ID.");
  }

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`
  };
}

export async function findPlaylist(
  youtube: youtube_v3.Youtube,
  title: string
): Promise<PlaylistMapEntry | null> {
  let pageToken: string | undefined;

  do {
    const response = await youtube.playlists.list({
      part: ["snippet", "status"],
      mine: true,
      maxResults: 50,
      pageToken
    });

    for (const playlist of response.data.items ?? []) {
      if (
        playlist.id &&
        playlist.snippet?.title === title
      ) {
        return {
          id: playlist.id,
          title,
          url: `https://www.youtube.com/playlist?list=${playlist.id}`
        };
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return null;
}

export async function getOrCreatePlaylist(
  youtube: youtube_v3.Youtube,
  title: string
): Promise<PlaylistMapEntry> {
  const existing = await findPlaylist(youtube, title);

  if (existing) {
    return existing;
  }

  const response = await youtube.playlists.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title,
        description: `Course playlist: ${title}`
      },
      status: {
        privacyStatus: "unlisted"
      }
    }
  });

  const id = response.data.id;

  if (!id) {
    throw new Error(`Failed to create playlist "${title}".`);
  }

  return {
    id,
    title,
    url: `https://www.youtube.com/playlist?list=${id}`
  };
}

export async function addVideoToPlaylist(
  youtube: youtube_v3.Youtube,
  playlistId: string,
  videoId: string
): Promise<string> {
  const response = await youtube.playlistItems.insert({
    part: ["snippet"],
    requestBody: {
      snippet: {
        playlistId,
        resourceId: {
          kind: "youtube#video",
          videoId
        }
      }
    }
  });

  const playlistItemId = response.data.id;

  if (!playlistItemId) {
    throw new Error("YouTube returned no playlist item ID.");
  }

  return playlistItemId;
}

export { YOUTUBE_SCOPE };