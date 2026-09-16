import fs from "node:fs/promises";
import http from "node:http";
import { google } from "googleapis";
import { exec } from "node:child_process";
import { OAUTH_CLIENT_FILE, LOCAL_TOKEN_FILE } from "./config.js";
import { YOUTUBE_SCOPE } from "./youtube.js";

function openBrowser(url: string): void {
  const command =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;

  exec(command);
}

async function main() {
  const raw = await fs.readFile(OAUTH_CLIENT_FILE, "utf8");
  const credentials = JSON.parse(raw);
  const installed = credentials.installed ?? credentials.web;

  if (!installed?.client_id || !installed?.client_secret) {
    throw new Error("Invalid OAuth client JSON.");
  }

  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Could not determine OAuth callback port.");
  }

  const redirectUri = `http://127.0.0.1:${address.port}`;

  const auth = new google.auth.OAuth2(
    installed.client_id,
    installed.client_secret,
    redirectUri
  );

  const authUrl = auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [YOUTUBE_SCOPE]
  });

  console.log("\nOpen this URL if the browser does not open automatically:\n");
  console.log(authUrl);
  console.log();

  openBrowser(authUrl);

  const code = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("OAuth timed out."));
      server.close();
    }, 5 * 60 * 1000);

    server.on("request", (req, res) => {
      const url = new URL(req.url ?? "/", redirectUri);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        clearTimeout(timeout);
        res.end("Authorization failed. You can close this tab.");
        server.close();
        reject(new Error(error));
        return;
      }

      if (code) {
        clearTimeout(timeout);
        res.end("Authorization successful. You can close this tab.");
        server.close();
        resolve(code);
      }
    });
  });

  const { tokens } = await auth.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token returned. Remove the app authorization from your Google account and run `npm run oauth` again."
    );
  }

  await fs.mkdir(new URL(".", `file://${LOCAL_TOKEN_FILE}`).pathname, {
    recursive: true
  }).catch(() => {});

  await fs.writeFile(
    LOCAL_TOKEN_FILE,
    JSON.stringify(tokens, null, 2),
    "utf8"
  );

  console.log(`\nRefresh token saved to ${LOCAL_TOKEN_FILE}`);
  console.log("\nFor Render, copy the refresh_token value into:");
  console.log("GOOGLE_REFRESH_TOKEN");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});