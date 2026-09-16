import fs from "node:fs/promises";
import path from "node:path";
import {
  ERROR_FILE,
  INPUT_FILE,
  OUTPUT_FILE,
  PLAYLIST_FILE,
  SUCCESS_FILE,
  TEMP_DIR
} from "./config.js";
import { downloadM3U8 } from "./downloader.js";
import {
  addVideoToPlaylist,
  getOrCreatePlaylist,
  getYouTube,
  uploadVideo
} from "./youtube.js";
import {
  appendError,
  appendToLearningPath,
  readJson,
  writeJsonAtomic,
  writePlaylistFile
} from "./storage.js";
import {
  AnyRecord,
  ErrorRecord,
  PlaylistFile
} from "./types.js";

function getString(
  record: AnyRecord,
  key: string
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function getVideoRecords(
  value: unknown,
  currentCategory?: string
): Array<{ record: AnyRecord; category: string }> {
  const result: Array<{ record: AnyRecord; category: string }> = [];

  function walk(node: unknown, category?: string): void {
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, category);
      }
      return;
    }

    if (!node || typeof node !== "object") {
      return;
    }

    const obj = node as AnyRecord;

    const ownCategory =
      getString(obj, "category") ??
      getString(obj, "playlist") ??
      category;

    if (
      getString(obj, "type") === "ivideo" &&
      getString(obj, "m3u8_url")
    ) {
      result.push({
        record: obj,
        category: ownCategory ?? "Uncategorized"
      });
      return;
    }

    for (const [key, child] of Object.entries(obj)) {
      if (key === "learningPath") {
        walk(child, ownCategory ?? category);
      } else if (typeof child === "object") {
        walk(child, ownCategory ?? category);
      }
    }
  }

  walk(value, currentCategory);
  return result;
}

async function isAlreadyProcessed(
  record: AnyRecord
): Promise<boolean> {
  const id = getString(record, "id");
  const sourceId = getString(record, "sourceId");

  const output = await readJson<AnyRecord>(OUTPUT_FILE, {
    learningPath: []
  });

  const items = Array.isArray(output.learningPath)
    ? output.learningPath as AnyRecord[]
    : [];

  return items.some((item) => {
    const sameId =
      id !== undefined &&
      getString(item, "id") === id;

    const sameSource =
      sourceId !== undefined &&
      getString(item, "sourceId") === sourceId;

    return sameId || sameSource;
  });
}

function tempFileName(record: AnyRecord): string {
  const sourceId =
    getString(record, "sourceId") ??
    getString(record, "id") ??
    `video-${Date.now()}`;

  const safe = sourceId.replace(/[^a-zA-Z0-9_-]/g, "_");

  return path.join(TEMP_DIR, `${safe}.mp4`);
}

async function processOne(
  youtube: Awaited<ReturnType<typeof getYouTube>>,
  item: { record: AnyRecord; category: string },
  playlists: PlaylistFile
): Promise<void> {
  const record = item.record;

  const sourceId = getString(record, "sourceId");
  const m3u8Url = getString(record, "m3u8_url");
  const title =
    getString(record, "name") ??
    sourceId ??
    "Untitled video";

  if (!m3u8Url) {
    throw new Error("Record has no m3u8_url.");
  }

  if (!sourceId) {
    throw new Error("Record has no sourceId.");
  }

  const tempFile = tempFileName(record);

  try {
    console.log(`\n=== ${title} ===`);
    console.log(`Source ID: ${sourceId}`);
    console.log(`Category: ${item.category}`);

    console.log("1/4 Downloading M3U8...");
    await downloadM3U8(m3u8Url, tempFile);
    console.log("Download complete.");

    console.log("2/4 Uploading to YouTube as UNLISTED...");
    const uploaded = await uploadVideo(
      youtube,
      tempFile,
      title,
      sourceId
    );
    console.log(`Uploaded: ${uploaded.url}`);

    console.log("3/4 Getting/creating playlist...");
    let playlist = playlists.playlists[item.category];

    if (!playlist) {
      playlist = await getOrCreatePlaylist(
        youtube,
        item.category
      );

      playlists.playlists[item.category] = playlist;
      await writePlaylistFile(PLAYLIST_FILE, playlists);
    }

    const playlistItemId = await addVideoToPlaylist(
      youtube,
      playlist.id,
      uploaded.videoId
    );

    console.log(`Added to playlist: ${playlist.title}`);

    const outputRecord: AnyRecord = {
      ...record,
      youtube: {
        videoId: uploaded.videoId,
        url: uploaded.url,
        privacyStatus: "unlisted",
        playlist: {
          ...playlist,
          playlistItemId
        },
        uploadedAt: new Date().toISOString()
      }
    };

    console.log("4/4 Saving JSON...");
    await appendToLearningPath(
      OUTPUT_FILE,
      outputRecord
    );

    await appendToLearningPath(
      SUCCESS_FILE,
      outputRecord
    );

    console.log("SUCCESS.");
  } finally {
    await fs.rm(tempFile, { force: true }).catch(() => {});
  }
}

async function main() {
  await fs.mkdir(TEMP_DIR, { recursive: true });

  const input = await readJson<AnyRecord>(
    INPUT_FILE,
    { learningPath: [] }
  );

  const playlists = await readJson<PlaylistFile>(
    PLAYLIST_FILE,
    { playlists: {} }
  );

  const youtube = await getYouTube();

  const videos = getVideoRecords(input);

  console.log(`Found ${videos.length} video records.`);

  let skipped = 0;
  let failed = 0;

  for (const item of videos) {
    if (await isAlreadyProcessed(item.record)) {
      skipped++;
      console.log(
        `SKIP already processed: ${getString(item.record, "sourceId") ?? getString(item.record, "id")}`
      );
      continue;
    }

    try {
      await processOne(youtube, item, playlists);
    } catch (error: unknown) {
      failed++;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      const errorRecord: ErrorRecord = {
        original: item.record,
        stage: "unknown",
        error: message,
        failedAt: new Date().toISOString()
      };

      await appendError(ERROR_FILE, errorRecord);

      console.error(
        `FAILED: ${getString(item.record, "sourceId") ?? getString(item.record, "id")}`
      );
      console.error(message);
    }
  }

  console.log("\n==============================");
  console.log(`Finished.`);
  console.log(`Videos found : ${videos.length}`);
  console.log(`Skipped      : ${skipped}`);
  console.log(`Failed       : ${failed}`);
  console.log(`Success file : ${SUCCESS_FILE}`);
  console.log(`Error file   : ${ERROR_FILE}`);
  console.log(`YT JSON      : ${OUTPUT_FILE}`);
  console.log("==============================");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});