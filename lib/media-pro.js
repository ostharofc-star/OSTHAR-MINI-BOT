const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

// ======================================================
// TEMP
// ======================================================

const TEMP_DIR = path.join(
  __dirname,
  "..",
  "temp",
  "media-pro"
);

fs.mkdirSync(
  TEMP_DIR,
  {
    recursive: true
  }
);

// ======================================================
// TEMP FILE
// ======================================================

function tempFile(ext = ".tmp") {
  if (!ext.startsWith(".")) {
    ext = `.${ext}`;
  }

  return path.join(
    TEMP_DIR,
    `media-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}${ext}`
  );
}

// ======================================================
// DELETE
// ======================================================

function safeDelete(file) {
  try {
    if (
      file &&
      fs.existsSync(file)
    ) {
      fs.unlinkSync(file);
    }
  } catch {}
}

// ======================================================
// FFMPEG
// ======================================================

function runFFmpeg(args = []) {
  return new Promise(
    (resolve, reject) => {
      if (!ffmpegPath) {
        return reject(
          new Error(
            "FFmpeg binary was not found."
          )
        );
      }

      const processFF =
        spawn(
          ffmpegPath,
          args,
          {
            windowsHide: true
          }
        );

      let stderr = "";

      processFF.stderr.on(
        "data",
        data => {
          stderr +=
            data.toString();
        }
      );

      processFF.on(
        "error",
        reject
      );

      processFF.on(
        "close",
        code => {
          if (code === 0) {
            return resolve(true);
          }

          reject(
            new Error(
              stderr.trim() ||
              `FFmpeg exited with code ${code}`
            )
          );
        }
      );
    }
  );
}

// ======================================================
// COMPRESS VIDEO
// ======================================================

async function compressVideo(
  input,
  output
) {
  await runFFmpeg([
    "-y",

    "-i",
    input,

    "-vf",
    "scale='min(720,iw)':-2",

    "-c:v",
    "libx264",

    "-preset",
    "veryfast",

    "-crf",
    "29",

    "-c:a",
    "aac",

    "-b:a",
    "96k",

    "-movflags",
    "+faststart",

    output
  ]);

  return output;
}

// ======================================================
// RESIZE IMAGE
// ======================================================

async function resizeImage(
  input,
  output,
  width,
  height
) {
  await runFFmpeg([
    "-y",

    "-i",
    input,

    "-vf",
    `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,

    "-frames:v",
    "1",

    output
  ]);

  return output;
}

// ======================================================
// VIDEO TO GIF
// ======================================================

async function videoToGif(
  input,
  output
) {
  await runFFmpeg([
    "-y",

    "-i",
    input,

    "-t",
    "10",

    "-vf",
    "fps=12,scale=480:-1:flags=lanczos",

    "-loop",
    "0",

    output
  ]);

  return output;
}

// ======================================================
// AUDIO TO OPUS VOICE NOTE
// ======================================================

async function audioToVoice(
  input,
  output
) {
  await runFFmpeg([
    "-y",

    "-i",
    input,

    "-vn",

    "-c:a",
    "libopus",

    "-b:a",
    "48k",

    "-ac",
    "1",

    "-ar",
    "48000",

    output
  ]);

  return output;
}

// ======================================================
// MEDIA TO MP3
// ======================================================

async function mediaToMp3(
  input,
  output
) {
  await runFFmpeg([
    "-y",

    "-i",
    input,

    "-vn",

    "-c:a",
    "libmp3lame",

    "-b:a",
    "160k",

    "-ar",
    "44100",

    "-ac",
    "2",

    output
  ]);

  return output;
}

// ======================================================
// IMAGE NORMALIZE
// ======================================================

async function normalizePhoto(
  input,
  output
) {
  await runFFmpeg([
    "-y",

    "-i",
    input,

    "-frames:v",
    "1",

    "-q:v",
    "2",

    output
  ]);

  return output;
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  tempFile,
  safeDelete,
  runFFmpeg,
  compressVideo,
  resizeImage,
  videoToGif,
  audioToVoice,
  mediaToMp3,
  normalizePhoto
};