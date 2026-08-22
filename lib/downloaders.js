const fs = require("fs");
const path = require("path");
const https = require("https");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

const ytSearch = require("yt-search");
const ffmpegPath = require("ffmpeg-static");

// ======================================================
// DIRECTORIES
// ======================================================

const BIN_DIR = path.join(__dirname, "..", "bin");
const TEMP_DIR = path.join(__dirname, "..", "temp");

fs.mkdirSync(BIN_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

// ======================================================
// COMMON HELPERS
// ======================================================

function readableError(error) {
  return String(error?.message || error || "Unknown error");
}

function createTempBase(type = "media") {
  return path.join(
    TEMP_DIR,
    `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

function safeDelete(file) {
  try {
    if (file && fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch {}
}

function getMimeType(file) {
  const ext = path.extname(String(file || "")).toLowerCase();

  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".webm") return "video/webm";

  return "video/mp4";
}

function extensionFromContentType(contentType = "") {
  const value = String(contentType).toLowerCase();

  if (value.includes("audio/mpeg")) return ".mp3";
  if (value.includes("audio/mp4")) return ".m4a";
  if (value.includes("audio/ogg")) return ".ogg";
  if (value.includes("video/webm")) return ".webm";
  if (value.includes("image/jpeg")) return ".jpg";
  if (value.includes("image/png")) return ".png";
  if (value.includes("image/webp")) return ".webp";

  return ".mp4";
}

function runProcess(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", data => {
      stdout += data.toString();
    });

    child.stderr?.on("data", data => {
      stderr += data.toString();
    });

    child.on("error", reject);

    child.on("close", code => {
      if (code === 0) {
        return resolve({
          stdout,
          stderr
        });
      }

      reject(
        new Error(
          stderr.trim() ||
          stdout.trim() ||
          `Process exited with code ${code}`
        )
      );
    });
  });
}

function findDownloadedFiles(basePath) {
  const directory = path.dirname(basePath);
  const base = path.basename(basePath);

  try {
    return fs
      .readdirSync(directory)
      .filter(file => file.startsWith(base))
      .map(file => path.join(directory, file))
      .filter(file => {
        try {
          return fs.statSync(file).size > 0;
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

// ======================================================
// HTTP FILE DOWNLOAD
// ======================================================

async function downloadHttpFile(
  url,
  outputBase,
  preferredFileName = ""
) {
  const response = await fetch(url, {
    redirect: "follow",

    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",

      "Accept": "*/*",
      "Accept-Encoding": "identity"
    },

    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    throw new Error(
      `Media request failed: HTTP ${response.status}`
    );
  }

  if (!response.body) {
    throw new Error(
      "Media response body is empty."
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  const preferredExt =
    path.extname(
      String(preferredFileName || "")
    ).toLowerCase();

  const ext =
    preferredExt &&
    preferredExt.length <= 8
      ? preferredExt
      : extensionFromContentType(contentType);

  const outputPath =
    `${outputBase}${ext}`;

  await pipeline(
    Readable.fromWeb(response.body),
    fs.createWriteStream(outputPath)
  );

  if (
    !fs.existsSync(outputPath) ||
    fs.statSync(outputPath).size <= 0
  ) {
    throw new Error(
      "Media file was not created."
    );
  }

  return outputPath;
}

// ======================================================
// YOUTUBE URL / SEARCH
// ======================================================

function isYouTubeUrl(value = "") {
  return /(?:youtube\.com|youtu\.be)/i.test(
    String(value || "")
  );
}

function getYouTubeVideoId(value = "") {
  const raw =
    String(value || "").trim();

  if (
    /^[A-Za-z0-9_-]{11}$/.test(raw)
  ) {
    return raw;
  }

  try {
    const parsed =
      new URL(raw);

    const host =
      parsed.hostname.replace(
        /^www\./i,
        ""
      );

    if (host === "youtu.be") {
      const id =
        parsed.pathname
          .split("/")
          .filter(Boolean)[0] || "";

      return /^[A-Za-z0-9_-]{11}$/.test(id)
        ? id
        : "";
    }

    if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com")
    ) {
      const normal =
        parsed.searchParams.get("v") || "";

      if (
        /^[A-Za-z0-9_-]{11}$/.test(normal)
      ) {
        return normal;
      }

      const parts =
        parsed.pathname
          .split("/")
          .filter(Boolean);

      const first =
        String(
          parts[0] || ""
        ).toLowerCase();

      if (
        [
          "shorts",
          "embed",
          "live"
        ].includes(first)
      ) {
        const id =
          parts[1] || "";

        return /^[A-Za-z0-9_-]{11}$/.test(id)
          ? id
          : "";
      }
    }
  } catch {}

  const match =
    raw.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/i
    );

  return match?.[1] || "";
}

async function searchYouTube(query) {
  const result =
    await ytSearch(
      String(query || "").trim()
    );

  return (
    result?.videos || []
  )
    .slice(0, 10)
    .map(video => ({
      title:
        video.title,

      url:
        video.url,

      videoId:
        video.videoId,

      timestamp:
        video.timestamp,

      seconds:
        video.seconds,

      views:
        video.views,

      thumbnail:
        video.thumbnail,

      author:
        video.author?.name ||
        "YouTube"
    }));
}

async function resolveYouTubeInput(input) {
  const value =
    String(input || "").trim();

  if (!value) {
    throw new Error(
      "YouTube URL or search query is required."
    );
  }

  if (isYouTubeUrl(value)) {
    return value;
  }

  const results =
    await searchYouTube(value);

  if (!results.length) {
    throw new Error(
      "No YouTube results were found."
    );
  }

  return results[0].url;
}

async function getYouTubeInfo(input) {
  if (isYouTubeUrl(input)) {
    const id =
      getYouTubeVideoId(input);

    if (id) {
      try {
        const result =
          await ytSearch({
            videoId: id
          });

        if (result) {
          return {
            title:
              result.title ||
              "YouTube Media",

            url:
              result.url ||
              String(input),

            videoId:
              id,

            timestamp:
              result.timestamp,

            seconds:
              result.seconds,

            views:
              result.views,

            thumbnail:
              result.thumbnail,

            author:
              result.author?.name ||
              "YouTube"
          };
        }
      } catch {}
    }
  }

  const results =
    await searchYouTube(input);

  return results[0] || null;
}

// ======================================================
// RAPIDAPI YTSTREAM - TWO API KEYS
// ======================================================

function getYtStreamRapidApiKeys() {
  const keys = [
    process.env.RAPIDAPI_KEY_1,
    process.env.RAPIDAPI_KEY_2,
    process.env.YTSTREAM_RAPIDAPI_KEY,
    process.env.RAPIDAPI_KEY
  ]
    .map(value =>
      String(value || "").trim()
    )
    .filter(Boolean);

  return [...new Set(keys)];
}

function getYtStreamRapidApiHost() {
  return String(
    process.env.YTSTREAM_RAPIDAPI_HOST ||
    "ytstream-download-youtube-videos.p.rapidapi.com"
  ).trim();
}

function ytStreamNumber(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function ytStreamMime(item = {}) {
  return String(
    item?.mimeType ||
    item?.mime ||
    item?.contentType ||
    item?.type ||
    ""
  ).toLowerCase();
}

function ytStreamQuality(item = {}) {
  const label =
    String(
      item?.qualityLabel ||
      item?.quality ||
      item?.resolution ||
      ""
    );

  const match =
    label.match(
      /(\d{3,4})p/i
    );

  return match
    ? Number(match[1])
    : 0;
}

function ytStreamLength(item = {}) {
  return ytStreamNumber(
    item?.contentLength ||
    item?.clen ||
    item?.size ||
    item?.filesize ||
    0
  );
}

function ytStreamBitrate(item = {}) {
  return ytStreamNumber(
    item?.audioBitrate ||
    item?.bitrate ||
    item?.averageBitrate ||
    0
  );
}

function collectYtStreamCandidates(
  value,
  pathName = "root",
  out = []
) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach(
      (item, index) => {
        collectYtStreamCandidates(
          item,
          `${pathName}[${index}]`,
          out
        );
      }
    );

    return out;
  }

  const url =
    String(
      value?.url ||
      value?.downloadUrl ||
      value?.download_url ||
      value?.streamUrl ||
      value?.stream_url ||
      value?.link ||
      ""
    ).trim();

  if (
    /^https?:\/\//i.test(url)
  ) {
    const mime =
      ytStreamMime(value);

    const lowerPath =
      pathName.toLowerCase();

    const looksImage =
      /^image\//i.test(mime) ||
      /thumbnail|avatar|channel.*image/.test(
        lowerPath
      );

    const looksMedia =
      mime.startsWith("audio/") ||
      mime.startsWith("video/") ||
      value?.itag != null ||
      value?.qualityLabel != null ||
      value?.audioQuality != null ||
      /format|adaptive|audio|video|stream/.test(
        lowerPath
      );

    if (
      looksMedia &&
      !looksImage
    ) {
      const isAudio =
        mime.startsWith("audio/") ||
        value?.audioQuality != null ||
        value?.audioSampleRate != null ||
        /audio/.test(lowerPath);

      const isVideo =
        mime.startsWith("video/") ||
        value?.qualityLabel != null ||
        /video/.test(lowerPath);

      out.push({
        ...value,

        url,

        _path:
          pathName,

        _mime:
          mime,

        _isAudio:
          Boolean(isAudio),

        _isVideo:
          Boolean(isVideo),

        _quality:
          ytStreamQuality(value),

        _bitrate:
          ytStreamBitrate(value),

        _length:
          ytStreamLength(value)
      });
    }
  }

  for (
    const [key, child]
    of Object.entries(value)
  ) {
    if (
      child &&
      typeof child === "object"
    ) {
      collectYtStreamCandidates(
        child,
        `${pathName}.${key}`,
        out
      );
    }
  }

  return out;
}

function getYtStreamTitle(
  data,
  fallback = "YouTube Media"
) {
  const direct = [
    data?.title,
    data?.videoDetails?.title,
    data?.details?.title,
    data?.data?.title,
    data?.data?.videoDetails?.title,
    data?.meta?.title,
    data?.metadata?.title
  ].find(Boolean);

  if (direct) {
    return String(direct);
  }

  let found = "";

  function walk(
    value,
    depth = 0
  ) {
    if (
      found ||
      !value ||
      typeof value !== "object" ||
      depth > 4
    ) {
      return;
    }

    if (
      typeof value.title === "string" &&
      value.title.trim()
    ) {
      found =
        value.title.trim();

      return;
    }

    for (
      const child
      of Object.values(value)
    ) {
      if (
        child &&
        typeof child === "object"
      ) {
        walk(
          child,
          depth + 1
        );

        if (found) {
          return;
        }
      }
    }
  }

  walk(data);

  return found || fallback;
}

async function requestYtStreamRapidApi(
  videoId
) {
  const apiKeys =
    getYtStreamRapidApiKeys();

  if (!apiKeys.length) {
    throw new Error(
      "RAPIDAPI_KEY_1 / RAPIDAPI_KEY_2 is not configured."
    );
  }

  const host =
    getYtStreamRapidApiHost();

  const params =
    new URLSearchParams({
      id: videoId
    });

  const cgeo =
    String(
      process.env.YTSTREAM_CGEO ||
      ""
    ).trim();

  const lang =
    String(
      process.env.YTSTREAM_LANG ||
      ""
    ).trim();

  if (cgeo) {
    params.set(
      "cgeo",
      cgeo
    );
  }

  if (lang) {
    params.set(
      "lang",
      lang
    );
  }

  const endpoint =
    `https://${host}/dl?${params.toString()}`;

  const errors = [];

  for (
    let i = 0;
    i < apiKeys.length;
    i++
  ) {
    const apiKey =
      apiKeys[i];

    try {
      console.log(
        `[YTSTREAM] Trying API key ${i + 1}/${apiKeys.length}...`
      );

      const response =
        await fetch(
          endpoint,
          {
            method:
              "GET",

            headers: {
              "x-rapidapi-key":
                apiKey,

              "x-rapidapi-host":
                host,

              "Accept":
                "application/json"
            },

            signal:
              AbortSignal.timeout(
                45000
              )
          }
        );

      const raw =
        await response.text();

      let data;

      try {
        data =
          JSON.parse(raw);
      } catch {
        throw new Error(
          `Invalid JSON (HTTP ${response.status})`
        );
      }

      const apiFailed =
        !response.ok ||

        String(
          data?.status ||
          ""
        ).toLowerCase() ===
          "fail" ||

        Number(
          data?.code ||
          0
        ) >= 400;

      if (apiFailed) {
        throw new Error(
          String(
            data?.message ||
            data?.error ||
            `HTTP ${response.status}`
          )
        );
      }

      const candidates =
        collectYtStreamCandidates(
          data
        );

      if (!candidates.length) {
        throw new Error(
          "No downloadable media URLs returned."
        );
      }

      console.log(
        `[YTSTREAM] API key ${i + 1} success.`
      );

      return {
        data,

        candidates,

        title:
          getYtStreamTitle(
            data,
            "YouTube Media"
          )
      };

    } catch (error) {
      const message =
        readableError(error);

      errors.push(
        `KEY ${i + 1}: ${message}`
      );

      console.log(
        `[YTSTREAM] API key ${i + 1} failed: ${message}`
      );
    }
  }

  throw new Error(
    "All RapidAPI keys failed. " +
    errors.join(" | ")
  );
}

function ytStreamCandidateScore(
  item,
  kind
) {
  const length =
    item?._length || 0;

  if (
    kind === "video" &&
    length >
      90 * 1024 * 1024
  ) {
    return -1000000;
  }

  if (
    kind === "audio" &&
    length >
      35 * 1024 * 1024
  ) {
    return -1000000;
  }

  let score = 0;

  if (kind === "audio") {
    if (item?._isAudio) {
      score += 10000;
    }

    if (
      item?._mime.startsWith(
        "audio/mp4"
      )
    ) {
      score += 1200;
    }

    if (
      item?._mime.startsWith(
        "audio/mpeg"
      )
    ) {
      score += 1100;
    }

    if (
      item?._mime.startsWith(
        "audio/webm"
      )
    ) {
      score += 900;
    }

    score +=
      Math.min(
        item?._bitrate || 0,
        512000
      ) / 100;

    return score;
  }

  const quality =
    item?._quality || 0;

  if (item?._isVideo) {
    score += 10000;
  }

  if (
    /\.formats(?:\[|\.|$)/i.test(
      String(
        item?._path ||
        ""
      )
    ) &&
    !/adaptive/i.test(
      String(
        item?._path ||
        ""
      )
    )
  ) {
    score += 5000;
  }

  if (
    item?._mime.startsWith(
      "video/mp4"
    )
  ) {
    score += 1800;
  }

  if (
    item?._mime.startsWith(
      "video/webm"
    )
  ) {
    score += 900;
  }

  if (
    quality > 0 &&
    quality <= 720
  ) {
    score +=
      3000 +
      quality * 4;

  } else if (
    quality > 720
  ) {
    score +=
      1000 -
      (quality - 720);

  } else {
    score += 500;
  }

  return score;
}

function pickYtStreamAudio(
  candidates = []
) {
  return (
    candidates
      .filter(
        item =>
          item?._isAudio
      )
      .sort(
        (a, b) =>
          ytStreamCandidateScore(
            b,
            "audio"
          ) -
          ytStreamCandidateScore(
            a,
            "audio"
          )
      )[0] ||
    null
  );
}

function pickYtStreamProgressiveVideo(
  candidates = []
) {
  return (
    candidates
      .filter(item => {
        if (!item?._isVideo) {
          return false;
        }

        const pathName =
          String(
            item?._path ||
            ""
          );

        const likelyProgressive =
          /\.formats(?:\[|\.|$)/i.test(
            pathName
          ) &&
          !/adaptive/i.test(
            pathName
          );

        const hasAudioHints =
          item?._isAudio ||
          item?.audioQuality != null ||
          item?.audioSampleRate != null ||
          item?.audioChannels != null;

        return (
          likelyProgressive ||
          hasAudioHints
        );
      })
      .sort(
        (a, b) =>
          ytStreamCandidateScore(
            b,
            "video"
          ) -
          ytStreamCandidateScore(
            a,
            "video"
          )
      )[0] ||
    null
  );
}

function pickYtStreamVideo(
  candidates = []
) {
  return (
    candidates
      .filter(
        item =>
          item?._isVideo
      )
      .sort(
        (a, b) =>
          ytStreamCandidateScore(
            b,
            "video"
          ) -
          ytStreamCandidateScore(
            a,
            "video"
          )
      )[0] ||
    null
  );
}

function extensionForCandidate(
  item,
  fallback
) {
  const mime =
    String(
      item?._mime ||
      ""
    ).toLowerCase();

  if (
    mime.includes(
      "audio/mp4"
    )
  ) {
    return ".m4a";
  }

  if (
    mime.includes(
      "audio/mpeg"
    )
  ) {
    return ".mp3";
  }

  if (
    mime.includes(
      "audio/webm"
    )
  ) {
    return ".webm";
  }

  if (
    mime.includes(
      "video/mp4"
    )
  ) {
    return ".mp4";
  }

  if (
    mime.includes(
      "video/webm"
    )
  ) {
    return ".webm";
  }

  return fallback;
}

async function convertAudioToMp3(
  inputPath,
  outputPath
) {
  await runProcess(
    ffmpegPath,
    [
      "-y",
      "-i",
      inputPath,

      "-vn",

      "-codec:a",
      "libmp3lame",

      "-q:a",
      "4",

      outputPath
    ]
  );

  return outputPath;
}

async function convertVideoToMp4(
  inputPath,
  outputPath
) {
  if (
    path
      .extname(inputPath)
      .toLowerCase() ===
    ".mp4"
  ) {
    if (
      inputPath !== outputPath
    ) {
      fs.copyFileSync(
        inputPath,
        outputPath
      );
    }

    return outputPath;
  }

  try {
    await runProcess(
      ffmpegPath,
      [
        "-y",

        "-i",
        inputPath,

        "-c:v",
        "copy",

        "-c:a",
        "aac",

        "-movflags",
        "+faststart",

        outputPath
      ]
    );

  } catch {
    await runProcess(
      ffmpegPath,
      [
        "-y",

        "-i",
        inputPath,

        "-c:v",
        "libx264",

        "-preset",
        "veryfast",

        "-crf",
        "25",

        "-c:a",
        "aac",

        "-b:a",
        "128k",

        "-movflags",
        "+faststart",

        outputPath
      ]
    );
  }

  return outputPath;
}

async function downloadYouTubeAudioViaRapidApi(
  url,
  fallbackTitle
) {
  const videoId =
    getYouTubeVideoId(url);

  if (!videoId) {
    throw new Error(
      "Could not read the YouTube video ID."
    );
  }

  const result =
    await requestYtStreamRapidApi(
      videoId
    );

  const audio =
    pickYtStreamAudio(
      result.candidates
    );

  if (!audio) {
    throw new Error(
      "YTStream returned no audio stream."
    );
  }

  const base =
    createTempBase(
      "youtube-rapidapi-audio"
    );

  const sourceName =
    `audio${extensionForCandidate(
      audio,
      ".m4a"
    )}`;

  const output =
    `${base}.mp3`;

  let downloaded = null;

  try {
    downloaded =
      await downloadHttpFile(
        audio.url,
        `${base}-source`,
        sourceName
      );

    if (
      path
        .extname(downloaded)
        .toLowerCase() ===
      ".mp3"
    ) {
      fs.renameSync(
        downloaded,
        output
      );

    } else {
      await convertAudioToMp3(
        downloaded,
        output
      );

      safeDelete(downloaded);
    }

    return {
      path:
        output,

      title:
        result.title ||
        fallbackTitle ||
        "YouTube Audio",

      author:
        "YouTube",

      mimetype:
        "audio/mpeg",

      provider:
        "RapidAPI YTStream"
    };

  } catch (error) {
    safeDelete(downloaded);
    safeDelete(output);

    throw error;
  }
}

async function downloadYouTubeVideoViaRapidApi(
  url,
  fallbackTitle
) {
  const videoId =
    getYouTubeVideoId(url);

  if (!videoId) {
    throw new Error(
      "Could not read the YouTube video ID."
    );
  }

  const result =
    await requestYtStreamRapidApi(
      videoId
    );

  const progressive =
    pickYtStreamProgressiveVideo(
      result.candidates
    );

  const base =
    createTempBase(
      "youtube-rapidapi-video"
    );

  const output =
    `${base}.mp4`;

  if (progressive) {
    let source = null;

    try {
      source =
        await downloadHttpFile(
          progressive.url,
          `${base}-progressive`,
          `video${extensionForCandidate(
            progressive,
            ".mp4"
          )}`
        );

      await convertVideoToMp4(
        source,
        output
      );

      safeDelete(source);

      return {
        path:
          output,

        title:
          result.title ||
          fallbackTitle ||
          "YouTube Video",

        author:
          "YouTube",

        mimetype:
          "video/mp4",

        provider:
          "RapidAPI YTStream"
      };

    } catch (error) {
      safeDelete(source);
      safeDelete(output);

      console.log(
        "[YTSTREAM] Progressive video failed; trying separate streams:",
        readableError(error)
      );
    }
  }

  const video =
    pickYtStreamVideo(
      result.candidates
    );

  const audio =
    pickYtStreamAudio(
      result.candidates
    );

  if (!video) {
    throw new Error(
      "YTStream returned no video stream."
    );
  }

  if (!audio) {
    throw new Error(
      "YTStream returned video but no audio stream."
    );
  }

  let videoPath = null;
  let audioPath = null;

  try {
    videoPath =
      await downloadHttpFile(
        video.url,
        `${base}-video`,
        `video${extensionForCandidate(
          video,
          ".mp4"
        )}`
      );

    audioPath =
      await downloadHttpFile(
        audio.url,
        `${base}-audio`,
        `audio${extensionForCandidate(
          audio,
          ".m4a"
        )}`
      );

    await runProcess(
      ffmpegPath,
      [
        "-y",

        "-i",
        videoPath,

        "-i",
        audioPath,

        "-map",
        "0:v:0",

        "-map",
        "1:a:0",

        "-c:v",
        "copy",

        "-c:a",
        "aac",

        "-b:a",
        "128k",

        "-shortest",

        "-movflags",
        "+faststart",

        output
      ]
    );

    return {
      path:
        output,

      title:
        result.title ||
        fallbackTitle ||
        "YouTube Video",

      author:
        "YouTube",

      mimetype:
        "video/mp4",

      provider:
        "RapidAPI YTStream"
    };

  } finally {
    safeDelete(videoPath);
    safeDelete(audioPath);
  }
}

// ======================================================
// YT-DLP FALLBACK
// ======================================================

function getYtDlpPath() {
  if (
    process.platform === "win32"
  ) {
    return path.join(
      BIN_DIR,
      "yt-dlp.exe"
    );
  }

  return path.join(
    BIN_DIR,
    "yt-dlp"
  );
}

function getYtDlpDownloadUrl() {
  if (
    process.platform === "win32"
  ) {
    return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
  }

  if (
    process.platform === "linux" &&
    process.arch === "x64"
  ) {
    return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
  }

  return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
}

function downloadBinary(
  url,
  destination
) {
  return new Promise(
    (resolve, reject) => {
      const request =
        https.get(
          url,

          {
            headers: {
              "User-Agent":
                "Mozilla/5.0"
            }
          },

          response => {
            if (
              response.statusCode >= 300 &&
              response.statusCode < 400 &&
              response.headers.location
            ) {
              response.resume();

              return downloadBinary(
                response.headers.location,
                destination
              )
                .then(resolve)
                .catch(reject);
            }

            if (
              response.statusCode !== 200
            ) {
              response.resume();

              return reject(
                new Error(
                  `yt-dlp binary download failed: HTTP ${response.statusCode}`
                )
              );
            }

            const file =
              fs.createWriteStream(
                destination
              );

            response.pipe(file);

            file.on(
              "finish",
              () => {
                file.close(
                  () =>
                    resolve(
                      destination
                    )
                );
              }
            );

            file.on(
              "error",
              reject
            );
          }
        );

      request.on(
        "error",
        reject
      );
    }
  );
}

async function ensureYtDlp() {
  const binary =
    getYtDlpPath();

  if (
    fs.existsSync(binary)
  ) {
    return binary;
  }

  const tempBinary =
    `${binary}.new-${Date.now()}`;

  console.log(
    "[YT-DLP] Downloading latest binary..."
  );

  try {
    await downloadBinary(
      getYtDlpDownloadUrl(),
      tempBinary
    );

    if (
      process.platform !==
      "win32"
    ) {
      fs.chmodSync(
        tempBinary,
        0o755
      );
    }

    fs.renameSync(
      tempBinary,
      binary
    );

    console.log(
      "[YT-DLP] Binary ready."
    );

    return binary;

  } catch (error) {
    safeDelete(tempBinary);

    throw error;
  }
}

function fastYtDlpArgs() {
  return [
    "--no-playlist",

    "--no-warnings",

    "--retries",
    "3",

    "--fragment-retries",
    "3",

    "--extractor-retries",
    "2",

    "--socket-timeout",
    "20",

    "--concurrent-fragments",
    "4",

    "--force-ipv4",

    "--ffmpeg-location",
    ffmpegPath,

    "--js-runtimes",
    "node",

    "--remote-components",
    "ejs:github"
  ];
}

let generatedCookieFile =
  null;

function getYtDlpAuthArgs() {
  const args = [];

  const cookieFile =
    String(
      process.env.YTDLP_COOKIES_FILE ||
      ""
    ).trim();

  const encoded =
    String(
      process.env.YTDLP_COOKIES_B64 ||
      ""
    ).trim();

  const userAgent =
    String(
      process.env.YTDLP_USER_AGENT ||
      ""
    ).trim();

  if (
    cookieFile &&
    fs.existsSync(cookieFile)
  ) {
    args.push(
      "--cookies",
      cookieFile
    );

  } else if (encoded) {
    try {
      if (
        !generatedCookieFile ||
        !fs.existsSync(
          generatedCookieFile
        )
      ) {
        generatedCookieFile =
          path.join(
            TEMP_DIR,
            "youtube-cookies.txt"
          );

        fs.writeFileSync(
          generatedCookieFile,
          Buffer
            .from(
              encoded,
              "base64"
            )
            .toString(
              "utf8"
            ),
          "utf8"
        );
      }

      args.push(
        "--cookies",
        generatedCookieFile
      );

    } catch {}
  }

  if (userAgent) {
    args.push(
      "--user-agent",
      userAgent
    );
  }

  return args;
}

async function downloadYouTubeAudioViaYtDlp(
  url,
  title
) {
  const binary =
    await ensureYtDlp();

  const base =
    createTempBase(
      "youtube-audio"
    );

  const outputTemplate =
    `${base}.%(ext)s`;

  await runProcess(
    binary,
    [
      ...fastYtDlpArgs(),
      ...getYtDlpAuthArgs(),

      "-x",

      "--audio-format",
      "mp3",

      "--audio-quality",
      "5",

      "-o",
      outputTemplate,

      url
    ]
  );

  const files =
    findDownloadedFiles(
      base
    );

  const file =
    files.find(
      item =>
        path
          .extname(item)
          .toLowerCase() ===
        ".mp3"
    ) ||
    files[0];

  if (!file) {
    throw new Error(
      "yt-dlp audio file was not created."
    );
  }

  return {
    path:
      file,

    title:
      title ||
      "YouTube Audio",

    author:
      "YouTube",

    mimetype:
      "audio/mpeg",

    provider:
      "yt-dlp"
  };
}

async function downloadYouTubeVideoViaYtDlp(
  url,
  title
) {
  const binary =
    await ensureYtDlp();

  const base =
    createTempBase(
      "youtube-video"
    );

  const outputTemplate =
    `${base}.%(ext)s`;

  await runProcess(
    binary,
    [
      ...fastYtDlpArgs(),
      ...getYtDlpAuthArgs(),

      "-f",

      "bv*[height<=720]+ba/b[height<=720]/b",

      "--merge-output-format",
      "mp4",

      "-o",
      outputTemplate,

      url
    ]
  );

  const files =
    findDownloadedFiles(
      base
    );

  let file =
    files.find(
      item =>
        path
          .extname(item)
          .toLowerCase() ===
        ".mp4"
    ) ||
    files[0];

  if (!file) {
    throw new Error(
      "yt-dlp video file was not created."
    );
  }

  if (
    path
      .extname(file)
      .toLowerCase() !==
    ".mp4"
  ) {
    const converted =
      `${base}-converted.mp4`;

    await convertVideoToMp4(
      file,
      converted
    );

    safeDelete(file);

    file =
      converted;
  }

  return {
    path:
      file,

    title:
      title ||
      "YouTube Video",

    author:
      "YouTube",

    mimetype:
      "video/mp4",

    provider:
      "yt-dlp"
  };
}

// ======================================================
// SOCIALDOWNLOADER.SPACE
// ======================================================

function getSocialDownloaderBase() {
  return String(
    process.env.SOCIAL_DOWNLOADER_BASE ||
    "https://www.socialdownloader.space"
  )
    .trim()
    .replace(
      /\/+$/,
      ""
    );
}

function absoluteSocialDownloaderUrl(
  value
) {
  const raw =
    String(
      value ||
      ""
    ).trim();

  if (!raw) {
    return null;
  }

  if (
    /^https?:\/\//i.test(raw)
  ) {
    return raw;
  }

  try {
    return new URL(
      raw,
      `${getSocialDownloaderBase()}/`
    ).toString();

  } catch {
    return null;
  }
}

async function requestSocialDownloader(
  sourceUrl,
  options = {}
) {
  const type =
    options.type ||
    "video";

  const quality =
    options.quality ||
    "hd";

  const format =
    options.format ||
    (
      type === "audio"
        ? "audio"
        : "video"
    );

  const response =
    await fetch(
      `${getSocialDownloaderBase()}/api/download`,

      {
        method:
          "POST",

        headers: {
          "Accept":
            "application/json",

          "Content-Type":
            "application/json",

          "User-Agent":
            "OSTHAR-MINI-BOT/1.0"
        },

        body:
          JSON.stringify({
            url:
              sourceUrl,

            type,

            quality,

            format
          }),

        signal:
          AbortSignal.timeout(
            60000
          )
      }
    );

  let data;

  try {
    data =
      await response.json();

  } catch {
    throw new Error(
      `SocialDownloader returned invalid JSON: HTTP ${response.status}`
    );
  }

  if (
    !response.ok ||
    data?.success === false
  ) {
    throw new Error(
      data?.error ||
      data?.message ||
      `SocialDownloader HTTP ${response.status}`
    );
  }

  return data;
}

function collectSocialUrls(
  value,
  out = []
) {
  if (!value) {
    return out;
  }

  if (
    typeof value ===
    "string"
  ) {
    const url =
      absoluteSocialDownloaderUrl(
        value
      );

    if (url) {
      out.push(url);
    }

    return out;
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item
      of value
    ) {
      collectSocialUrls(
        item,
        out
      );
    }

    return out;
  }

  if (
    typeof value ===
    "object"
  ) {
    for (
      const [key, child]
      of Object.entries(value)
    ) {
      const lower =
        key.toLowerCase();

      if (
        [
          "downloadurl",
          "download_url",
          "streamurl",
          "stream_url",
          "video",
          "audio",
          "url",
          "link"
        ].includes(lower)
      ) {
        collectSocialUrls(
          child,
          out
        );

      } else if (
        child &&
        typeof child === "object"
      ) {
        collectSocialUrls(
          child,
          out
        );
      }
    }
  }

  return out;
}

async function downloadFirstWorkingUrl(
  urls,
  outputBase,
  preferredFileName
) {
  const unique =
    [
      ...new Set(
        (urls || [])
          .filter(Boolean)
      )
    ];

  let lastError =
    null;

  for (
    let i = 0;
    i < unique.length;
    i++
  ) {
    try {
      return await downloadHttpFile(
        unique[i],
        `${outputBase}-${i}`,
        preferredFileName
      );

    } catch (error) {
      lastError =
        error;
    }
  }

  throw new Error(
    lastError
      ? readableError(lastError)
      : "No downloadable media URL was returned."
  );
}

async function downloadYouTubeAudioViaSocialDownloader(
  url,
  title
) {
  const data =
    await requestSocialDownloader(
      url,
      {
        type:
          "audio",

        quality:
          "hd",

        format:
          "audio"
      }
    );

  const urls =
    collectSocialUrls(
      data
    );

  const base =
    createTempBase(
      "youtube-social-audio"
    );

  const source =
    await downloadFirstWorkingUrl(
      urls,
      base,
      "audio.m4a"
    );

  const output =
    `${base}.mp3`;

  try {
    if (
      path
        .extname(source)
        .toLowerCase() ===
      ".mp3"
    ) {
      fs.renameSync(
        source,
        output
      );

    } else {
      await convertAudioToMp3(
        source,
        output
      );

      safeDelete(source);
    }

    return {
      path:
        output,

      title:
        data?.metadata?.title ||
        data?.title ||
        title ||
        "YouTube Audio",

      author:
        data?.metadata?.author ||
        "YouTube",

      mimetype:
        "audio/mpeg",

      provider:
        "socialdownloader.space"
    };

  } catch (error) {
    safeDelete(source);
    safeDelete(output);

    throw error;
  }
}

async function downloadYouTubeVideoViaSocialDownloader(
  url,
  title
) {
  const data =
    await requestSocialDownloader(
      url,
      {
        type:
          "video",

        quality:
          "hd",

        format:
          "video"
      }
    );

  const urls =
    collectSocialUrls(
      data
    );

  const base =
    createTempBase(
      "youtube-social-video"
    );

  const source =
    await downloadFirstWorkingUrl(
      urls,
      base,
      "video.mp4"
    );

  const output =
    `${base}.mp4`;

  try {
    if (
      path
        .extname(source)
        .toLowerCase() ===
      ".mp4"
    ) {
      fs.renameSync(
        source,
        output
      );

    } else {
      await convertVideoToMp4(
        source,
        output
      );

      safeDelete(source);
    }

    return {
      path:
        output,

      title:
        data?.metadata?.title ||
        data?.title ||
        title ||
        "YouTube Video",

      author:
        data?.metadata?.author ||
        "YouTube",

      mimetype:
        "video/mp4",

      provider:
        "socialdownloader.space"
    };

  } catch (error) {
    safeDelete(source);
    safeDelete(output);

    throw error;
  }
}

async function downloadSocialMedia(
  url,
  platform
) {
  if (
    !/^https?:\/\//i.test(
      String(
        url ||
        ""
      )
    )
  ) {
    throw new Error(
      "Please provide a valid URL."
    );
  }

  const data =
    await requestSocialDownloader(
      url,
      {
        type:
          "video",

        quality:
          "hd",

        format:
          "video"
      }
    );

  const metadata =
    data?.metadata ||
    {};

  const direct =
    absoluteSocialDownloaderUrl(
      data?.downloadUrl
    );

  if (direct) {
    const base =
      createTempBase(
        `${platform}-social`
      );

    const filePath =
      await downloadHttpFile(
        direct,
        base,
        "media.mp4"
      );

    return {
      path:
        filePath,

      title:
        metadata?.title ||
        data?.title ||
        `${platform} Media`,

      author:
        metadata?.author ||
        null,

      thumbnail:
        metadata?.thumbnail ||
        null,

      platform:
        metadata?.platform ||
        platform,

      mimetype:
        getMimeType(
          filePath
        ),

      provider:
        "socialdownloader.space"
    };
  }

  const images =
    Array.isArray(
      metadata?.images
    )
      ? metadata.images.filter(
          item =>
            /^https?:\/\//i.test(
              String(
                item ||
                ""
              )
            )
        )
      : [];

  if (images.length) {
    const imageProxy =
      `${getSocialDownloaderBase()}` +
      `/api/image?url=${encodeURIComponent(
        images[0]
      )}`;

    const base =
      createTempBase(
        `${platform}-image-social`
      );

    const filePath =
      await downloadHttpFile(
        imageProxy,
        base,
        "image.jpg"
      );

    return {
      path:
        filePath,

      title:
        metadata?.title ||
        `${platform} Image`,

      author:
        metadata?.author ||
        null,

      platform:
        metadata?.platform ||
        platform,

      imageCount:
        images.length,

      mimetype:
        getMimeType(
          filePath
        ),

      provider:
        "socialdownloader.space"
    };
  }

  const urls =
    collectSocialUrls(
      data
    );

  if (urls.length) {
    const base =
      createTempBase(
        `${platform}-social`
      );

    const filePath =
      await downloadFirstWorkingUrl(
        urls,
        base,
        "media.mp4"
      );

    return {
      path:
        filePath,

      title:
        metadata?.title ||
        data?.title ||
        `${platform} Media`,

      author:
        metadata?.author ||
        null,

      platform:
        metadata?.platform ||
        platform,

      mimetype:
        getMimeType(
          filePath
        ),

      provider:
        "socialdownloader.space"
    };
  }

  throw new Error(
    "SocialDownloader returned no downloadable media."
  );
}

async function tiktokDownload(
  url
) {
  return downloadSocialMedia(
    url,
    "TikTok"
  );
}

async function facebookDownload(
  url
) {
  return downloadSocialMedia(
    url,
    "Facebook"
  );
}

async function instagramDownload(
  url
) {
  return downloadSocialMedia(
    url,
    "Instagram"
  );
}

async function pinterestDownload(
  url
) {
  return downloadSocialMedia(
    url,
    "Pinterest"
  );
}

async function twitterDownload(
  url
) {
  return downloadSocialMedia(
    url,
    "Twitter"
  );
}

async function snapchatDownload(
  url
) {
  return downloadSocialMedia(
    url,
    "Snapchat"
  );
}

// ======================================================
// FINAL YOUTUBE AUDIO
// API KEY 1 -> API KEY 2 -> YT-DLP -> SOCIALDOWNLOADER
// ======================================================

async function downloadYouTubeAudio(
  input
) {
  const url =
    await resolveYouTubeInput(
      input
    );

  const info =
    await getYouTubeInfo(
      url
    ).catch(
      () => null
    );

  const title =
    info?.title ||
    (
      isYouTubeUrl(input)
        ? "YouTube Audio"
        : String(input)
    );

  const errors = [];

  if (
    getYtStreamRapidApiKeys()
      .length
  ) {
    try {
      console.log(
        "[YTSTREAM] Trying RapidAPI audio..."
      );

      return await downloadYouTubeAudioViaRapidApi(
        url,
        title
      );

    } catch (error) {
      errors.push(
        `RAPIDAPI: ${readableError(error)}`
      );

      console.log(
        "[YTSTREAM] RapidAPI audio failed:",
        readableError(error)
      );
    }
  }

  try {
    console.log(
      "[YT-DLP] Trying audio fallback..."
    );

    return await downloadYouTubeAudioViaYtDlp(
      url,
      title
    );

  } catch (error) {
    errors.push(
      `YT-DLP: ${readableError(error)}`
    );

    console.log(
      "[YT-DLP] Audio fallback failed:",
      readableError(error)
    );
  }

  try {
    console.log(
      "[SOCIALDOWNLOADER] Trying YouTube audio fallback..."
    );

    return await downloadYouTubeAudioViaSocialDownloader(
      url,
      title
    );

  } catch (error) {
    errors.push(
      `SOCIAL: ${readableError(error)}`
    );
  }

  throw new Error(
    "YouTube audio failed on every engine. " +
    errors.join(" | ")
  );
}

// ======================================================
// FINAL YOUTUBE VIDEO
// API KEY 1 -> API KEY 2 -> YT-DLP -> SOCIALDOWNLOADER
// ======================================================

async function downloadYouTubeVideo(
  input
) {
  const url =
    await resolveYouTubeInput(
      input
    );

  const info =
    await getYouTubeInfo(
      url
    ).catch(
      () => null
    );

  const title =
    info?.title ||
    (
      isYouTubeUrl(input)
        ? "YouTube Video"
        : String(input)
    );

  const errors = [];

  if (
    getYtStreamRapidApiKeys()
      .length
  ) {
    try {
      console.log(
        "[YTSTREAM] Trying RapidAPI video..."
      );

      return await downloadYouTubeVideoViaRapidApi(
        url,
        title
      );

    } catch (error) {
      errors.push(
        `RAPIDAPI: ${readableError(error)}`
      );

      console.log(
        "[YTSTREAM] RapidAPI video failed:",
        readableError(error)
      );
    }
  }

  try {
    console.log(
      "[YT-DLP] Trying video fallback..."
    );

    return await downloadYouTubeVideoViaYtDlp(
      url,
      title
    );

  } catch (error) {
    errors.push(
      `YT-DLP: ${readableError(error)}`
    );

    console.log(
      "[YT-DLP] Video fallback failed:",
      readableError(error)
    );
  }

  try {
    console.log(
      "[SOCIALDOWNLOADER] Trying YouTube video fallback..."
    );

    return await downloadYouTubeVideoViaSocialDownloader(
      url,
      title
    );

  } catch (error) {
    errors.push(
      `SOCIAL: ${readableError(error)}`
    );
  }

  throw new Error(
    "YouTube video failed on every engine. " +
    errors.join(" | ")
  );
}

// ======================================================
// APK SEARCH
// ======================================================

async function apkSearch(
  query
) {
  if (
    !process.env.APK_API
  ) {
    throw new Error(
      "APK API is not configured."
    );
  }

  const separator =
    process.env.APK_API.includes(
      "?"
    )
      ? "&"
      : "?";

  const url =
    `${process.env.APK_API}${separator}` +
    `q=${encodeURIComponent(query)}`;

  const response =
    await fetch(
      url,
      {
        signal:
          AbortSignal.timeout(
            45000
          )
      }
    );

  if (!response.ok) {
    throw new Error(
      `APK API failed: HTTP ${response.status}`
    );
  }

  return response.json();
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  searchYouTube,

  resolveYouTubeInput,

  getYouTubeInfo,

  downloadYouTubeAudio,

  downloadYouTubeVideo,

  downloadSocialMedia,

  tiktokDownload,

  facebookDownload,

  instagramDownload,

  pinterestDownload,

  twitterDownload,

  snapchatDownload,

  apkSearch
};
