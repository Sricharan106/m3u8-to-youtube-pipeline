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
            `FFmpeg exited with code ${code}.\n${stderr.trim()}`
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

  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel", "warning",
    "-y",
    "-i", m3u8Url,
    "-map", "0:v:0?",
    "-map", "0:a:0?",
    "-c", "copy",
    "-movflags", "+faststart",
    outputFile
  ]);

  const stat = await fs.stat(outputFile);

  if (stat.size === 0) {
    throw new Error("FFmpeg produced an empty file.");
  }
}