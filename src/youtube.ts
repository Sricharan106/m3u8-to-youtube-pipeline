import fs from "node:fs/promises";
import { google, youtube_v3 } from "googleapis";
import {
  LOCAL_TOKEN_FILE,
  OAUTH_CLIENT_FILE
} from "./config.js";

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

export { YOUTUBE_SCOPE };