import path from "node:path";

export const ROOT = process.cwd();

export const INPUT_FILE =
  process.env.INPUT_FILE ?? path.join(ROOT, "data/video-prime.json");

export const OUTPUT_FILE =
  process.env.OUTPUT_FILE ?? path.join(ROOT, "data/video-prime-yt.json");

export const SUCCESS_FILE =
  process.env.SUCCESS_FILE ?? path.join(ROOT, "data/success.json");

export const ERROR_FILE =
  process.env.ERROR_FILE ?? path.join(ROOT, "data/error.json");

export const TEMP_DIR =
  process.env.TEMP_DIR ?? path.join(ROOT, "temp");

export const OAUTH_CLIENT_FILE =
  process.env.OAUTH_CLIENT_FILE ??
  path.join(ROOT, "credentials/client_secret.json");

export const LOCAL_TOKEN_FILE =
  process.env.LOCAL_TOKEN_FILE ??
  path.join(ROOT, "credentials/token.json");