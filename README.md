# M3U8 → YouTube Uploader

Node.js + TypeScript worker that:

1. Reads `data/video-prime.json`.
2. Processes only records whose `type` is `ivideo`.
3. Downloads each `m3u8_url` to a temporary MP4 using FFmpeg.
4. Uploads the MP4 to YouTube.
5. Uploads with `privacyStatus: unlisted`.
6. Adds the uploaded video to the playlist for its category.
7. Saves the complete original record plus YouTube metadata to `data/video-prime-yt.json`.
8. Adds the completed record to `data/success.json`.
9. Adds failures to `data/error.json` with the processing stage.
10. Deletes the temporary video after processing.

## Requirements

- Node.js 20+
- FFmpeg installed and available as `ffmpeg`
- A Google Cloud project with YouTube Data API v3 enabled
- OAuth 2.0 Desktop application credentials

## Input

Put your existing JSON at:

```text
data/video-prime.json
```

The script expects the existing hierarchy to contain records similar to:

```json
{
  "id": "...",
  "name": "Some video",
  "type": "ivideo",
  "sourceId": "...",
  "m3u8_url": "https://..."
}
```

Non-video records such as PDFs are skipped.

The script does not replace your original fields. It copies the complete record and adds:

```json
"youtube": {
  "videoId": "...",
  "url": "https://www.youtube.com/watch?v=...",
  "privacyStatus": "unlisted",
  "playlist": {
    "id": "...",
    "title": "...",
    "url": "...",
    "playlistItemId": "..."
  },
  "uploadedAt": "..."
}
```

## 1. Install

```bash
npm install
```

Check FFmpeg:

```bash
ffmpeg -version
```

## 2. Google OAuth

Create OAuth 2.0 credentials for a Desktop app in Google Cloud.

Download the OAuth client JSON and save it as:

```text
credentials/client_secret.json
```

Then run:

```bash
npm run oauth
```

A browser will open for Google authorization. The script saves the refresh token to:

```text
credentials/token.json
```

Do not commit either credential file.

## 3. Test locally

Put your source JSON in:

```text
data/video-prime.json
```

Then:

```bash
npm run dev
```

The worker processes one video at a time, so it does not download your whole library to disk.

## 4. Render

For Render, do not put `client_secret.json` or `token.json` in Git.

Use the three environment variables:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN
```

The OAuth helper is intended to be run locally once. Copy the generated refresh token into Render.

Set the Render worker start command to:

```bash
npm install && npm run build && npm start
```

FFmpeg must also be available in the Render environment. The included `render.yaml` uses a Docker image and installs FFmpeg.

## Important persistence note

Render worker disk is not your permanent database. The generated JSON files should be copied to durable storage or committed/pushed to your repository if you want them to survive worker replacement.

For a first local test, this project keeps everything under `data/`.

## Recovery / duplicate uploads

There is no transaction spanning YouTube and local JSON files.

For example, if YouTube upload succeeds but the process crashes before `video-prime-yt.json` is written, rerunning can potentially upload the same source again.

The records contain `sourceId` and the YouTube description includes it to make later recovery easier.

For a large production run, use durable state/database storage and an idempotency/recovery step.

## Rights

Only upload content you have permission to copy and upload. `unlisted` controls discoverability; it does not remove copyright or other platform restrictions.
