import { spawn } from "node:child_process";
import fs from "node:fs/promises";

function run(
  command: string,
  args: string[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 12000) {
        stderr = stderr.slice(-12000);
      }
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `yt-dlp exited with code ${code}.\n${stderr.trim()}`
          )
        );
      }
    });
  });
}

export async function downloadM3U8(
  m3u8Url: string,
  outputFile: string
): Promise<void> {
  await fs.rm(outputFile, { force: true });

  const concurrentFragments = process.env.YTDLP_CONCURRENT_FRAGMENTS ?? "8";

  await run("yt-dlp", [
    "--downloader", "native",
    "--concurrent-fragments", concurrentFragments,
    "--no-playlist",
    "--no-part",
    "--force-overwrites",
    "--format", "best[ext=mp4]/best",
    "--output", outputFile,
    m3u8Url
  ]);

  const stat = await fs.stat(outputFile);

  if (stat.size === 0) {
    throw new Error("yt-dlp produced an empty file.");
  }
}