const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ffmpegPath = require("ffmpeg-static");

// ======================================================
// TEMP DIRECTORY
// ======================================================

const TEMP_DIR = path.join(
  __dirname,
  "..",
  "temp",
  "media"
);

fs.mkdirSync(
  TEMP_DIR,
  {
    recursive: true
  }
);

// ======================================================
// CHECK FFMPEG
// ======================================================

function getFFmpegPath() {
  if (!ffmpegPath) {
    throw new Error(
      "FFmpeg binary was not found."
    );
  }

  return ffmpegPath;
}

// ======================================================
// RUN FFMPEG
// ======================================================

function runFFmpeg(args = []) {
  return new Promise(
    (resolve, reject) => {
      const executable =
        getFFmpegPath();

      const child =
        spawn(
          executable,
          args,
          {
            windowsHide: true
          }
        );

      let stderr = "";

      child.stderr?.on(
        "data",
        (data) => {
          stderr +=
            data.toString();
        }
      );

      child.on(
        "error",
        (error) => {
          reject(error);
        }
      );

      child.on(
        "close",
        (code) => {
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
// CREATE TEMP PATH
// ======================================================

function createMediaTempPath(
  extension = ".tmp"
) {
  if (
    !String(extension).startsWith(".")
  ) {
    extension =
      `.${extension}`;
  }

  return path.join(
    TEMP_DIR,
    `media-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}${extension}`
  );
}

// ======================================================
// SAFE DELETE
// ======================================================

function removeMediaFile(file) {
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
// IMAGE / VIDEO TO STICKER
// ======================================================

async function mediaToSticker(
  inputFile,
  outputFile
) {
  if (
    !fs.existsSync(inputFile)
  ) {
    throw new Error(
      "Sticker input file was not found."
    );
  }

  const filter =
    "scale=512:512:force_original_aspect_ratio=decrease," +
    "format=rgba," +
    "pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000";

  await runFFmpeg([
    "-y",

    "-i",
    inputFile,

    "-vf",
    filter,

    "-vcodec",
    "libwebp",

    "-lossless",
    "0",

    "-compression_level",
    "6",

    "-q:v",
    "70",

    "-loop",
    "0",

    "-an",

    "-vsync",
    "0",

    outputFile
  ]);

  if (
    !fs.existsSync(outputFile)
  ) {
    throw new Error(
      "Sticker output file was not created."
    );
  }

  return outputFile;
}

// ======================================================
// STICKER TO IMAGE
// ======================================================

async function stickerToImage(
  inputFile,
  outputFile
) {
  if (
    !fs.existsSync(inputFile)
  ) {
    throw new Error(
      "Sticker file was not found."
    );
  }

  await runFFmpeg([
    "-y",

    "-i",
    inputFile,

    "-frames:v",
    "1",

    outputFile
  ]);

  if (
    !fs.existsSync(outputFile)
  ) {
    throw new Error(
      "Image output was not created."
    );
  }

  return outputFile;
}

// ======================================================
// VIDEO TO MP3
// ======================================================

async function videoToMp3(
  inputFile,
  outputFile
) {
  if (
    !fs.existsSync(inputFile)
  ) {
    throw new Error(
      "Video file was not found."
    );
  }

  await runFFmpeg([
    "-y",

    "-i",
    inputFile,

    "-vn",

    "-acodec",
    "libmp3lame",

    "-b:a",
    "192k",

    "-ar",
    "44100",

    "-ac",
    "2",

    outputFile
  ]);

  if (
    !fs.existsSync(outputFile)
  ) {
    throw new Error(
      "MP3 output was not created."
    );
  }

  return outputFile;
}

// ======================================================
// NORMALIZE AUDIO
// ======================================================

async function normalizeAudio(
  inputFile,
  outputFile
) {
  await runFFmpeg([
    "-y",

    "-i",
    inputFile,

    "-vn",

    "-acodec",
    "libmp3lame",

    "-b:a",
    "128k",

    outputFile
  ]);

  return outputFile;
}

// ======================================================
// COMPRESS VIDEO
// ======================================================

async function compressVideo(
  inputFile,
  outputFile
) {
  await runFFmpeg([
    "-y",

    "-i",
    inputFile,

    "-vf",
    "scale='min(720,iw)':-2",

    "-c:v",
    "libx264",

    "-preset",
    "veryfast",

    "-crf",
    "28",

    "-c:a",
    "aac",

    "-b:a",
    "128k",

    "-movflags",
    "+faststart",

    outputFile
  ]);

  return outputFile;
}

// ======================================================
// BASIC MEDIA INFO
// ======================================================

function getMediaInfo(file) {
  if (
    !fs.existsSync(file)
  ) {
    return null;
  }

  const stat =
    fs.statSync(file);

  return {
    path: file,

    size:
      stat.size,

    extension:
      path
        .extname(file)
        .toLowerCase()
  };
}

// ======================================================
// SETUP TEMP
// ======================================================

function setupTempDirectory() {
  fs.mkdirSync(
    TEMP_DIR,
    {
      recursive: true
    }
  );

  return TEMP_DIR;
}

// ======================================================
// CLEAN OLD TEMP FILES
// ======================================================

function cleanTempDirectory(
  maxAgeMs =
    60 * 60 * 1000
) {
  try {
    if (
      !fs.existsSync(
        TEMP_DIR
      )
    ) {
      return;
    }

    const now =
      Date.now();

    const files =
      fs.readdirSync(
        TEMP_DIR
      );

    for (
      const file of files
    ) {
      const target =
        path.join(
          TEMP_DIR,
          file
        );

      try {
        const stat =
          fs.statSync(
            target
          );

        if (
          now -
            stat.mtimeMs >
          maxAgeMs
        ) {
          fs.rmSync(
            target,
            {
              recursive: true,
              force: true
            }
          );
        }
      } catch {}
    }
  } catch {}
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  runFFmpeg,

  createMediaTempPath,

  removeMediaFile,

  mediaToSticker,

  stickerToImage,

  videoToMp3,

  normalizeAudio,

  compressVideo,

  getMediaInfo,

  setupTempDirectory,

  cleanTempDirectory
};