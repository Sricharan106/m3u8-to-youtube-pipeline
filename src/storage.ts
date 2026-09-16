import fs from "node:fs/promises";
import path from "node:path";
import {
  AnyRecord,
  ErrorRecord,
  PlaylistFile
} from "./types.js";

export async function ensureDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text) as T;
  } catch (error: unknown) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error
        ? (error as { code?: string }).code
        : undefined;

    if (code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

export async function writeJsonAtomic(
  filePath: string,
  data: unknown
): Promise<void> {
  await ensureDir(filePath);

  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(
    tempPath,
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  );

  await fs.rename(tempPath, filePath);
}

export async function appendToLearningPath(
  filePath: string,
  record: AnyRecord
): Promise<void> {
  const data = await readJson<AnyRecord>(filePath, { learningPath: [] });

  if (!Array.isArray(data.learningPath)) {
    data.learningPath = [];
  }

  const items = data.learningPath as AnyRecord[];

  const recordId = record.id;
  const existingIndex =
    recordId === undefined
      ? -1
      : items.findIndex((item) => item.id === recordId);

  if (existingIndex >= 0) {
    items[existingIndex] = record;
  } else {
    items.push(record);
  }

  await writeJsonAtomic(filePath, data);
}

export async function appendError(
  filePath: string,
  errorRecord: ErrorRecord
): Promise<void> {
  const data = await readJson<AnyRecord>(filePath, { learningPath: [] });

  if (!Array.isArray(data.learningPath)) {
    data.learningPath = [];
  }

  (data.learningPath as AnyRecord[]).push(errorRecord as unknown as AnyRecord);

  await writeJsonAtomic(filePath, data);
}

export async function writePlaylistFile(
  filePath: string,
  data: PlaylistFile
): Promise<void> {
  await writeJsonAtomic(filePath, data);
}