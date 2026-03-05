import { execFile } from "node:child_process";
import { readdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DownloadType = "video" | "audio";
export type DownloadQuality = "worst" | "normal" | "best";

function getVideoFormat(quality: DownloadQuality) {
  switch (quality) {
    case "best":
      return "bestvideo+bestaudio/best";
    case "normal":
      return "bestvideo[height<=720]+bestaudio/best[height<=720]/best";
    default:
      return "worst";
  }
}

function getAudioQuality(quality: DownloadQuality) {
  switch (quality) {
    case "best":
      return "0";
    case "normal":
      return "5";
    default:
      return "9";
  }
}

export async function download(
  type: DownloadType,
  url: string,
  quality: DownloadQuality,
) {
  const downloadDir = join(tmpdir(), "whatsapp-browser-downloads");
  await mkdir(downloadDir, { recursive: true });

  const files = readdirSync(downloadDir);
  const args = ["-P", downloadDir, "-o", `video(${files.length}).%(ext)s`];

  if (type === "audio") {
    args.push(
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      getAudioQuality(quality),
    );
  } else {
    args.push("-f", getVideoFormat(quality));
  }

  args.push("--print", "after_move:filepath", url);

  const { stdout, stderr } = await execFileAsync("yt-dlp", args);

  if (stderr.trim()) {
    throw new Error(stderr.trim());
  }

  const downloadLocation = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);

  if (downloadLocation === undefined) {
    throw new Error("yt-dlp no pudo descargar el video");
  }

  return downloadLocation;
}
