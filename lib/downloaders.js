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

const BIN_DIR = path.join(
  __dirname,
  "..",
  "bin"
);

const TEMP_DIR = path.join(
  __dirname,
  "..",
  "temp"
);

fs.mkdirSync(
  BIN_DIR,
  {
    recursive: true
  }
);

fs.mkdirSync(
  TEMP_DIR,
  {
    recursive: true
  }
);

// ======================================================
// YT-DLP PATH
// ======================================================

function getYtDlpPath() {
  if (process.platform === "win32") {
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

// ======================================================
// YT-DLP DOWNLOAD URL
// ======================================================

function getYtDlpDownloadUrl() {
  if (process.platform === "win32") {
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

// ======================================================
// BINARY DOWNLOAD
// ======================================================

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
          (response) => {
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
                    resolve(destination)
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

// ======================================================
// ENSURE / AUTO-REFRESH YT-DLP
// ======================================================

let lastYtDlpRefreshCheck =
  0;

async function ensureYtDlp(
  forceRefresh = false
) {
  const binary =
    getYtDlpPath();

  const refreshHours =
    Math.max(
      1,
      Number(
        process.env.YTDLP_REFRESH_HOURS ||
        12
      ) || 12
    );

  const refreshMs =
    refreshHours *
    60 *
    60 *
    1000;

  let shouldRefresh =
    forceRefresh ||
    !fs.existsSync(
      binary
    );

  if (
    !shouldRefresh &&
    Date.now() -
      lastYtDlpRefreshCheck >
      60 * 1000
  ) {
    lastYtDlpRefreshCheck =
      Date.now();

    try {
      const stat =
        fs.statSync(
          binary
        );

      shouldRefresh =
        Date.now() -
          stat.mtimeMs >
        refreshMs;

    } catch {
      shouldRefresh =
        true;
    }
  }

  if (!shouldRefresh) {
    return binary;
  }

  const tempBinary =
    `${binary}.new-${Date.now()}`;

  console.log(
    forceRefresh
      ? "[YT-DLP] Force refreshing latest binary..."
      : "[YT-DLP] Checking/downloading latest binary..."
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

    if (
      fs.existsSync(
        binary
      )
    ) {
      fs.rmSync(
        binary,
        {
          force:
            true
        }
      );
    }

    fs.renameSync(
      tempBinary,
      binary
    );

    console.log(
      "[YT-DLP] Latest binary ready."
    );

  } catch (error) {
    try {
      fs.rmSync(
        tempBinary,
        {
          force:
            true
        }
      );
    } catch {}

    if (
      fs.existsSync(
        binary
      )
    ) {
      console.log(
        "[YT-DLP] Update failed; using existing binary:",
        error?.message ||
        error
      );

      return binary;
    }

    throw error;
  }

  return binary;
}

// ======================================================
// PROCESS RUNNER
// ======================================================

function runProcess(
  executable,
  args
) {
  return new Promise(
    (resolve, reject) => {
      const child =
        spawn(
          executable,
          args,
          {
            windowsHide: true
          }
        );

      let stdout = "";
      let stderr = "";

      child.stdout?.on(
        "data",
        (data) => {
          stdout +=
            data.toString();
        }
      );

      child.stderr?.on(
        "data",
        (data) => {
          stderr +=
            data.toString();
        }
      );

      child.on(
        "error",
        reject
      );

      child.on(
        "close",
        (code) => {
          if (
            code === 0
          ) {
            return resolve({
              stdout,
              stderr
            });
          }

          reject(
            new Error(
              stderr.trim() ||
              stdout.trim() ||
              `yt-dlp exited with code ${code}`
            )
          );
        }
      );
    }
  );
}

// ======================================================
// TEMP
// ======================================================

function createTempBase(
  type = "media"
) {
  return path.join(
    TEMP_DIR,
    `${type}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`
  );
}

function findDownloadedFiles(
  basePath
) {
  const directory =
    path.dirname(basePath);

  const base =
    path.basename(basePath);

  return fs
    .readdirSync(directory)
    .filter(
      (file) =>
        file.startsWith(base)
    )
    .map(
      (file) =>
        path.join(
          directory,
          file
        )
    )
    .filter(
      (file) => {
        try {
          return (
            fs.statSync(file).size >
            0
          );
        } catch {
          return false;
        }
      }
    );
}

// ======================================================
// MIME TYPE
// ======================================================

function getMimeType(file) {
  const ext =
    path
      .extname(file)
      .toLowerCase();

  if (
    ext === ".jpg" ||
    ext === ".jpeg"
  ) {
    return "image/jpeg";
  }

  if (
    ext === ".png"
  ) {
    return "image/png";
  }

  if (
    ext === ".webp"
  ) {
    return "image/webp";
  }

  if (
    ext === ".mp3"
  ) {
    return "audio/mpeg";
  }

  if (
    ext === ".m4a"
  ) {
    return "audio/mp4";
  }

  if (
    ext === ".webm"
  ) {
    return "video/webm";
  }

  return "video/mp4";
}

// ======================================================
// FAST SETTINGS
// ======================================================

function fastArgs() {
  return [
    "--no-playlist",
    "--no-warnings",
    "--retries", "3",
    "--fragment-retries", "3",
    "--extractor-retries", "2",
    "--socket-timeout", "20",
    "--concurrent-fragments", "4",
    "--force-ipv4",
    "--ffmpeg-location", ffmpegPath
  ];
}

// ======================================================
// YOUTUBE SETTINGS
// ======================================================

function youtubeArgs(
  playerClient = null
) {
  const args = [
    ...fastArgs(),

    // Current yt-dlp YouTube support needs an external
    // JavaScript runtime. This bot already runs on Node.
    "--js-runtimes",
    "node",

    // Allow yt-dlp to fetch the official EJS challenge
    // solver component when required.
    "--remote-components",
    "ejs:github"
  ];

  if (playerClient) {
    args.push(
      "--extractor-args",
      `youtube:player_client=${playerClient}`
    );
  }

  return args;
}

function youtubePlayerClients() {
  return [
    null,
    "web_safari",
    "tv"
  ];
}

function shouldRefreshYtDlpAfterError(
  error
) {
  const message =
    String(
      error?.message ||
      error ||
      ""
    );

  return (
    /HTTP Error 403/i.test(
      message
    ) ||
    /challenge|signature|nsig|player response/i.test(
      message
    )
  );
}

// ======================================================
// AUTH / COOKIE RETRY
// ======================================================

let generatedCookieFile = null;

function ensureBase64CookieFile() {
  if (generatedCookieFile && fs.existsSync(generatedCookieFile)) {
    return generatedCookieFile;
  }

  const encoded = String(process.env.YTDLP_COOKIES_B64 || "").trim();
  if (!encoded) return null;

  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");

    if (
      !decoded.includes("# Netscape HTTP Cookie File") &&
      !decoded.includes("# HTTP Cookie File")
    ) {
      console.log("[YT-DLP] Ignoring YTDLP_COOKIES_B64: not a Netscape cookie file.");
      return null;
    }

    generatedCookieFile = path.join(TEMP_DIR, "yt-dlp-cookies.txt");
    fs.writeFileSync(generatedCookieFile, decoded, { encoding: "utf8", mode: 0o600 });
    return generatedCookieFile;
  } catch (error) {
    console.log("[YT-DLP] Could not create cookie file:", error?.message || error);
    return null;
  }
}

function getCookieFile() {
  const configured = String(process.env.YTDLP_COOKIES_FILE || "").trim();
  if (configured && fs.existsSync(configured)) return configured;
  return ensureBase64CookieFile();
}

function getBrowserCookieSource() {
  if (process.platform !== "win32") return null;

  const browser = String(process.env.YTDLP_BROWSER || "").trim().toLowerCase();
  if (!browser) return null;

  const allowed = new Set([
    "brave", "chrome", "chromium", "edge", "firefox", "opera", "vivaldi"
  ]);

  if (!allowed.has(browser)) {
    console.log(`[YT-DLP] Unsupported YTDLP_BROWSER: ${browser}`);
    return null;
  }

  return browser;
}

function authArgs() {
  const args = [];
  const cookieFile = getCookieFile();

  if (cookieFile) {
    args.push("--cookies", cookieFile);
  } else {
    const browser = getBrowserCookieSource();
    if (browser) args.push("--cookies-from-browser", browser);
  }

  const userAgent = String(process.env.YTDLP_USER_AGENT || "").trim();
  if (userAgent) args.push("--user-agent", userAgent);

  return args;
}

function hasAuthRetry() {
  return authArgs().length > 0;
}

// ======================================================
// YOUTUBE URL CHECK
// ======================================================

function isYouTubeUrl(
  input = ""
) {
  return /youtube\.com|youtu\.be/i
    .test(
      String(input)
    );
}

// ======================================================
// YOUTUBE SEARCH
// ======================================================

async function searchYouTube(
  query,
  limit = 5
) {
  const result =
    await ytSearch(query);

  return result.videos
    .slice(
      0,
      limit
    )
    .map(
      (video) => ({
        id:
          video.videoId,

        title:
          video.title,

        author:
          video.author?.name ||
          "Unknown",

        duration:
          video.timestamp ||
          "Unknown",

        views:
          video.views ||
          0,

        url:
          video.url,

        thumbnail:
          video.thumbnail
      })
    );
}

// ======================================================
// RESOLVE YOUTUBE
// ======================================================

async function resolveYouTubeInput(
  input
) {
  if (
    isYouTubeUrl(input)
  ) {
    return input;
  }

  const results =
    await searchYouTube(
      input,
      1
    );

  if (
    !results.length
  ) {
    throw new Error(
      "No YouTube results found."
    );
  }

  return results[0].url;
}

// ======================================================
// YOUTUBE INFO
// ======================================================

async function getYouTubeInfo(
  input
) {
  const binary =
    await ensureYtDlp();

  const url =
    await resolveYouTubeInput(
      input
    );

  const {
    stdout
  } =
    await runProcess(
      binary,
      [
        ...youtubeArgs(),

        "--skip-download",

        "--dump-single-json",

        url
      ]
    );

  const info =
    JSON.parse(stdout);

  return {
    url,

    title:
      info.title ||
      "YouTube Media",

    author:
      info.uploader ||
      info.channel ||
      "Unknown",

    thumbnail:
      info.thumbnail ||
      null
  };
}

function readableError(
  error
) {
  if (!error) {
    return "unknown error";
  }

  if (
    typeof error ===
    "string"
  ) {
    return error;
  }

  if (
    typeof error?.message ===
    "string" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  try {
    return JSON.stringify(
      error
    );
  } catch {
    return String(
      error
    );
  }
}

// ======================================================
// YOUTUBE AUDIO
// ======================================================

function canonicalYouTubeUrl(
  value
) {
  const raw =
    String(
      value ||
      ""
    ).trim();

  try {
    const parsed =
      new URL(
        raw
      );

    let id =
      "";

    if (
      /(^|\.)youtu\.be$/i.test(
        parsed.hostname
      )
    ) {
      id =
        parsed.pathname
          .split("/")
          .filter(Boolean)[0] ||
        "";

    } else if (
      /(^|\.)youtube\.com$/i.test(
        parsed.hostname
      )
    ) {
      id =
        parsed.searchParams.get(
          "v"
        ) ||
        "";

      if (!id) {
        const parts =
          parsed.pathname
            .split("/")
            .filter(Boolean);

        if (
          [
            "shorts",
            "embed",
            "live"
          ].includes(
            String(
              parts[0] ||
              ""
            ).toLowerCase()
          )
        ) {
          id =
            parts[1] ||
            "";
        }
      }
    }

    if (
      /^[A-Za-z0-9_-]{11}$/.test(
        id
      )
    ) {
      return (
        "https://www.youtube.com/watch?v=" +
        id
      );
    }

  } catch {}

  return raw;
}

function youtubeNoTokenAttempts(
  kind
) {
  if (
    kind ===
    "audio"
  ) {
    return [
      {
        name:
          "web_safari HLS",

        client:
          "web_safari",

        format:
          "b[protocol^=m3u8]/b"
      },

      {
        name:
          "web_embedded",

        client:
          "web_embedded",

        format:
          "ba/b"
      },

      {
        name:
          "android_vr",

        client:
          "android_vr",

        format:
          "ba/b"
      },

      {
        name:
          "tv",

        client:
          "tv",

        format:
          "ba/b"
      }
    ];
  }

  return [
    {
      name:
        "web_safari HLS",

      client:
        "web_safari",

      format:
        "b[height<=720][protocol^=m3u8]/b[protocol^=m3u8]/b[height<=720]/b"
    },

    {
      name:
        "web_embedded",

      client:
        "web_embedded",

      format:
        "b[height<=720][ext=mp4]/b[height<=720]/bv*[height<=720]+ba/b"
    },

    {
      name:
        "android_vr",

      client:
        "android_vr",

      format:
        "b[height<=720][ext=mp4]/b[height<=720]/bv*[height<=720]+ba/b"
    },

    {
      name:
        "tv",

      client:
        "tv",

      format:
        "b[height<=720][ext=mp4]/b[height<=720]/bv*[height<=720]+ba/b"
    }
  ];
}

async function tryLocalYouTubeAudio(
  binary,
  url
) {
  const attempts =
    youtubeNoTokenAttempts(
      "audio"
    );

  let lastError =
    null;

  for (
    let i = 0;
    i < attempts.length;
    i++
  ) {
    const attempt =
      attempts[i];

    const base =
      createTempBase(
        `youtube-audio-final-${i}`
      );

    try {
      console.log(
        `[YOUTUBE FINAL] Audio ${i + 1}/${attempts.length}: ${attempt.name}`
      );

      await runProcess(
        binary,
        [
          ...youtubeArgs(
            attempt.client
          ),

          "-f",
          attempt.format,

          "-x",

          "--audio-format",
          "mp3",

          "--audio-quality",
          "5",

          "-o",
          `${base}.%(ext)s`,

          url
        ]
      );

      const files =
        findDownloadedFiles(
          base
        );

      if (
        files.length
      ) {
        return {
          path:
            files[0],

          engine:
            `local yt-dlp / ${attempt.name}`
        };
      }

      throw new Error(
        "Local audio file was not created."
      );

    } catch (error) {
      lastError =
        error;

      console.log(
        `[YOUTUBE FINAL] Audio ${attempt.name} failed: ${readableError(error)}`
      );
    }
  }

  throw lastError ||
    new Error(
      "All local YouTube audio attempts failed."
    );
}

async function tryLocalYouTubeVideo(
  binary,
  url
) {
  const attempts =
    youtubeNoTokenAttempts(
      "video"
    );

  let lastError =
    null;

  for (
    let i = 0;
    i < attempts.length;
    i++
  ) {
    const attempt =
      attempts[i];

    const base =
      createTempBase(
        `youtube-video-final-${i}`
      );

    try {
      console.log(
        `[YOUTUBE FINAL] Video ${i + 1}/${attempts.length}: ${attempt.name}`
      );

      await runProcess(
        binary,
        [
          ...youtubeArgs(
            attempt.client
          ),

          "-f",
          attempt.format,

          "--merge-output-format",
          "mp4",

          "--remux-video",
          "mp4",

          "-o",
          `${base}.%(ext)s`,

          url
        ]
      );

      const files =
        findDownloadedFiles(
          base
        );

      if (
        files.length
      ) {
        return {
          path:
            files[0],

          engine:
            `local yt-dlp / ${attempt.name}`
        };
      }

      throw new Error(
        "Local video file was not created."
      );

    } catch (error) {
      lastError =
        error;

      console.log(
        `[YOUTUBE FINAL] Video ${attempt.name} failed: ${readableError(error)}`
      );
    }
  }

  throw lastError ||
    new Error(
      "All local YouTube video attempts failed."
    );
}

async function trySocialDownloaderYouTubeAudio(
  url
) {
  let lastError =
    null;

  for (
    const quality of [
      "hd",
      "sd"
    ]
  ) {
    try {
      const data =
        await requestSocialDownloader(
          url,
          {
            type:
              "audio",

            quality,

            format:
              "audio"
          }
        );

      const base =
        createTempBase(
          `youtube-audio-social-${quality}`
        );

      const filePath =
        await downloadFirstWorkingUrl({
          urls: [
            data?.metadata?.directAudioUrl,
            data?.audioUrl
          ],

          outputBase:
            base,

          preferredFileName:
            "song.mp3",

          label:
            "audio"
        });

      return {
        path:
          filePath,

        title:
          data?.metadata?.title ||
          "YouTube Audio",

        author:
          data?.metadata?.author ||
          "YouTube",

        engine:
          "socialdownloader.space"
      };

    } catch (error) {
      lastError =
        error;

      console.log(
        `[YOUTUBE FINAL] SocialDownloader audio ${quality} failed: ${readableError(error)}`
      );
    }
  }

  throw lastError ||
    new Error(
      "SocialDownloader audio failed."
    );
}

async function trySocialDownloaderYouTubeVideo(
  url
) {
  let lastError =
    null;

  for (
    const quality of [
      "hd",
      "sd"
    ]
  ) {
    try {
      const data =
        await requestSocialDownloader(
          url,
          {
            type:
              "video",

            quality,

            format:
              "video"
          }
        );

      const base =
        createTempBase(
          `youtube-video-social-${quality}`
        );

      const filePath =
        await downloadFirstWorkingUrl({
          urls: [
            data?.metadata?.directVideoUrl,
            data?.downloadUrl
          ],

          outputBase:
            base,

          preferredFileName:
            "video.mp4",

          label:
            "video"
        });

      return {
        path:
          filePath,

        title:
          data?.metadata?.title ||
          "YouTube Video",

        author:
          data?.metadata?.author ||
          "YouTube",

        engine:
          "socialdownloader.space"
      };

    } catch (error) {
      lastError =
        error;

      console.log(
        `[YOUTUBE FINAL] SocialDownloader video ${quality} failed: ${readableError(error)}`
      );
    }
  }

  throw lastError ||
    new Error(
      "SocialDownloader video failed."
    );
}


// ======================================================
// RAPIDAPI YTSTREAM (RAILWAY-FRIENDLY YOUTUBE ENGINE)
// ======================================================

function getYtStreamRapidApiKey() {
  return String(
    process.env.YTSTREAM_RAPIDAPI_KEY ||
    process.env.RAPIDAPI_KEY ||
    ""
  ).trim();
}

function getYtStreamRapidApiHost() {
  return String(
    process.env.YTSTREAM_RAPIDAPI_HOST ||
    "ytstream-download-youtube-videos.p.rapidapi.com"
  ).trim();
}

function getYouTubeVideoId(value = "") {
  const raw = String(value || "").trim();

  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./i, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] || "";
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const normal = parsed.searchParams.get("v") || "";
      if (/^[A-Za-z0-9_-]{11}$/.test(normal)) return normal;

      const parts = parsed.pathname.split("/").filter(Boolean);
      if (
        ["shorts", "embed", "live"].includes(
          String(parts[0] || "").toLowerCase()
        )
      ) {
        const id = parts[1] || "";
        return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
      }
    }
  } catch {}

  const match = raw.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/i
  );

  return match?.[1] || "";
}

function ytStreamNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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
  const label = String(
    item?.qualityLabel ||
    item?.quality ||
    item?.resolution ||
    ""
  );

  const match = label.match(/(\d{3,4})p/i);
  return match ? Number(match[1]) : 0;
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

function collectYtStreamCandidates(value, pathName = "root", out = []) {
  if (!value || typeof value !== "object") return out;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectYtStreamCandidates(
        item,
        `${pathName}[${index}]`,
        out
      );
    });
    return out;
  }

  const url = String(
    value?.url ||
    value?.downloadUrl ||
    value?.download_url ||
    value?.streamUrl ||
    value?.stream_url ||
    value?.link ||
    ""
  ).trim();

  if (/^https?:\/\//i.test(url)) {
    const mime = ytStreamMime(value);
    const lowerPath = pathName.toLowerCase();

    const looksMedia =
      mime.startsWith("audio/") ||
      mime.startsWith("video/") ||
      value?.itag != null ||
      value?.qualityLabel != null ||
      value?.audioQuality != null ||
      /format|adaptive|audio|video|stream/.test(lowerPath);

    const looksImage =
      /^image\//i.test(mime) ||
      /thumbnail|avatar|channel.*image/.test(lowerPath);

    if (looksMedia && !looksImage) {
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
        _path: pathName,
        _mime: mime,
        _isAudio: Boolean(isAudio),
        _isVideo: Boolean(isVideo),
        _quality: ytStreamQuality(value),
        _bitrate: ytStreamBitrate(value),
        _length: ytStreamLength(value)
      });
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object") {
      collectYtStreamCandidates(
        child,
        `${pathName}.${key}`,
        out
      );
    }
  }

  return out;
}

function getYtStreamTitle(data, fallback = "YouTube Media") {
  const direct = [
    data?.title,
    data?.videoDetails?.title,
    data?.details?.title,
    data?.data?.title,
    data?.data?.videoDetails?.title,
    data?.meta?.title,
    data?.metadata?.title
  ].find(Boolean);

  if (direct) return String(direct);

  let found = "";

  function walk(value, depth = 0) {
    if (
      found ||
      !value ||
      typeof value !== "object" ||
      depth > 4
    ) return;

    if (
      typeof value.title === "string" &&
      value.title.trim()
    ) {
      found = value.title.trim();
      return;
    }

    for (const child of Object.values(value)) {
      if (child && typeof child === "object") {
        walk(child, depth + 1);
        if (found) return;
      }
    }
  }

  walk(data);
  return found || fallback;
}

async function requestYtStreamRapidApi(videoId) {
  const apiKey = getYtStreamRapidApiKey();

  if (!apiKey) {
    throw new Error(
      "RAPIDAPI_KEY is not configured."
    );
  }

  const host = getYtStreamRapidApiHost();

  const params = new URLSearchParams({
    id: videoId
  });

  const cgeo =
    String(process.env.YTSTREAM_CGEO || "").trim();

  const lang =
    String(process.env.YTSTREAM_LANG || "").trim();

  if (cgeo) params.set("cgeo", cgeo);
  if (lang) params.set("lang", lang);

  const response = await fetch(
    `https://${host}/dl?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": host,
        "Accept": "application/json"
      },
      signal: AbortSignal.timeout(45000)
    }
  );

  const raw = await response.text();

  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `YTStream returned invalid JSON (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      `YTStream API HTTP ${response.status}: ` +
      String(data?.message || data?.error || "request failed")
    );
  }

  if (
    String(data?.status || "").toLowerCase() === "fail" ||
    Number(data?.code || 0) >= 400
  ) {
    throw new Error(
      `YTStream API: ${String(
        data?.error ||
        data?.message ||
        "request failed"
      )}`
    );
  }

  const candidates =
    collectYtStreamCandidates(data);

  if (!candidates.length) {
    throw new Error(
      "YTStream API returned no downloadable media URLs."
    );
  }

  return {
    data,
    candidates,
    title:
      getYtStreamTitle(
        data,
        "YouTube Media"
      )
  };
}

function ytStreamCandidateScore(item, kind) {
  const length = item?._length || 0;

  if (
    kind === "video" &&
    length > 90 * 1024 * 1024
  ) return -1000000;

  if (
    kind === "audio" &&
    length > 35 * 1024 * 1024
  ) return -1000000;

  let score = 0;

  if (kind === "audio") {
    if (item?._isAudio) score += 10000;
    if (item?._mime.startsWith("audio/mp4")) score += 1200;
    if (item?._mime.startsWith("audio/mpeg")) score += 1100;
    if (item?._mime.startsWith("audio/webm")) score += 900;
    score += Math.min(item?._bitrate || 0, 512000) / 100;
    return score;
  }

  const q = item?._quality || 0;

  if (item?._isVideo) score += 10000;

  if (
    /\.formats(?:\[|\.|$)/i.test(
      String(item?._path || "")
    ) &&
    !/adaptive/i.test(
      String(item?._path || "")
    )
  ) score += 5000;

  if (item?._mime.startsWith("video/mp4")) score += 1800;
  if (item?._mime.startsWith("video/webm")) score += 900;

  if (q > 0 && q <= 720) {
    score += 3000 + q * 4;
  } else if (q > 720) {
    score += 1000 - (q - 720);
  } else {
    score += 500;
  }

  return score;
}

function pickYtStreamAudio(candidates = []) {
  return candidates
    .filter(item => item?._isAudio)
    .sort(
      (a, b) =>
        ytStreamCandidateScore(b, "audio") -
        ytStreamCandidateScore(a, "audio")
    )[0] || null;
}

function pickYtStreamProgressiveVideo(candidates = []) {
  return candidates
    .filter(item => {
      if (!item?._isVideo) return false;

      const pathName =
        String(item?._path || "");

      const likelyProgressive =
        /\.formats(?:\[|\.|$)/i.test(pathName) &&
        !/adaptive/i.test(pathName);

      const hasAudioHints =
        item?._isAudio ||
        item?.audioQuality != null ||
        item?.audioSampleRate != null ||
        item?.audioChannels != null;

      return likelyProgressive || hasAudioHints;
    })
    .sort(
      (a, b) =>
        ytStreamCandidateScore(b, "video") -
        ytStreamCandidateScore(a, "video")
    )[0] || null;
}

function pickYtStreamVideo(candidates = []) {
  return candidates
    .filter(item => item?._isVideo)
    .sort(
      (a, b) =>
        ytStreamCandidateScore(b, "video") -
        ytStreamCandidateScore(a, "video")
    )[0] || null;
}

function extensionForYtStreamCandidate(item, fallback) {
  const mime = String(item?._mime || "").toLowerCase();

  if (mime.includes("audio/mp4")) return ".m4a";
  if (mime.includes("audio/mpeg")) return ".mp3";
  if (mime.includes("audio/webm")) return ".webm";
  if (mime.includes("video/mp4")) return ".mp4";
  if (mime.includes("video/webm")) return ".webm";

  return fallback;
}

async function downloadYtStreamUrl(mediaUrl, outputPath) {
  const response = await fetch(
    mediaUrl,
    {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
        "Accept": "*/*",
        "Accept-Encoding": "identity"
      },
      signal: AbortSignal.timeout(120000)
    }
  );

  if (!response.ok) {
    throw new Error(
      `YTStream media download HTTP ${response.status}`
    );
  }

  if (!response.body) {
    throw new Error(
      "YTStream media body is empty."
    );
  }

  await pipeline(
    Readable.fromWeb(response.body),
    fs.createWriteStream(outputPath)
  );

  if (
    !fs.existsSync(outputPath) ||
    fs.statSync(outputPath).size <= 0
  ) {
    throw new Error(
      "YTStream media file was not created."
    );
  }

  return outputPath;
}

async function convertYtStreamAudioToMp3(
  inputPath,
  outputPath
) {
  await runProcess(
    ffmpegPath,
    [
      "-y",
      "-i", inputPath,
      "-vn",
      "-codec:a", "libmp3lame",
      "-q:a", "4",
      outputPath
    ]
  );

  return outputPath;
}

async function ensureYtStreamMp4(
  inputPath,
  outputPath
) {
  if (
    path.extname(inputPath).toLowerCase() === ".mp4"
  ) {
    if (inputPath !== outputPath) {
      fs.copyFileSync(inputPath, outputPath);
    }
    return outputPath;
  }

  try {
    await runProcess(
      ffmpegPath,
      [
        "-y",
        "-i", inputPath,
        "-c:v", "copy",
        "-c:a", "aac",
        "-movflags", "+faststart",
        outputPath
      ]
    );
  } catch {
    await runProcess(
      ffmpegPath,
      [
        "-y",
        "-i", inputPath,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "25",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        outputPath
      ]
    );
  }

  return outputPath;
}

async function downloadYouTubeAudioViaYtStream(
  url,
  fallbackTitle = "YouTube Audio"
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

  const source =
    `${base}${extensionForYtStreamCandidate(
      audio,
      ".m4a"
    )}`;

  const output =
    `${base}.mp3`;

  try {
    await downloadYtStreamUrl(
      audio.url,
      source
    );

    if (
      path.extname(source).toLowerCase() === ".mp3"
    ) {
      fs.renameSync(
        source,
        output
      );
    } else {
      await convertYtStreamAudioToMp3(
        source,
        output
      );

      try {
        fs.unlinkSync(source);
      } catch {}
    }

    return {
      path: output,
      title:
        result.title ||
        fallbackTitle,
      author: "YouTube",
      mimetype: "audio/mpeg",
      provider: "RapidAPI YTStream"
    };
  } catch (error) {
    try {
      if (fs.existsSync(source)) {
        fs.unlinkSync(source);
      }
    } catch {}

    try {
      if (fs.existsSync(output)) {
        fs.unlinkSync(output);
      }
    } catch {}

    throw error;
  }
}

async function downloadYouTubeVideoViaYtStream(
  url,
  fallbackTitle = "YouTube Video"
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
    const source =
      `${base}-progressive${extensionForYtStreamCandidate(
        progressive,
        ".mp4"
      )}`;

    try {
      await downloadYtStreamUrl(
        progressive.url,
        source
      );

      await ensureYtStreamMp4(
        source,
        output
      );

      if (source !== output) {
        try {
          fs.unlinkSync(source);
        } catch {}
      }

      return {
        path: output,
        title:
          result.title ||
          fallbackTitle,
        author: "YouTube",
        mimetype: "video/mp4",
        provider: "RapidAPI YTStream"
      };
    } catch (error) {
      try {
        if (fs.existsSync(source)) {
          fs.unlinkSync(source);
        }
      } catch {}

      try {
        if (fs.existsSync(output)) {
          fs.unlinkSync(output);
        }
      } catch {}

      console.log(
        "[YTSTREAM] Progressive video failed; trying separate video + audio:",
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

  const videoPath =
    `${base}-video${extensionForYtStreamCandidate(
      video,
      ".mp4"
    )}`;

  const audioPath =
    `${base}-audio${extensionForYtStreamCandidate(
      audio,
      ".m4a"
    )}`;

  try {
    await downloadYtStreamUrl(
      video.url,
      videoPath
    );

    await downloadYtStreamUrl(
      audio.url,
      audioPath
    );

    await runProcess(
      ffmpegPath,
      [
        "-y",
        "-i", videoPath,
        "-i", audioPath,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",
        "-movflags", "+faststart",
        output
      ]
    );

    return {
      path: output,
      title:
        result.title ||
        fallbackTitle,
      author: "YouTube",
      mimetype: "video/mp4",
      provider: "RapidAPI YTStream"
    };
  } finally {
    for (const file of [
      videoPath,
      audioPath
    ]) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch {}
    }
  }
}


async function downloadYouTubeAudio(
  input
) {
  let binary =
    await ensureYtDlp();

  const resolved =
    await resolveYouTubeInput(
      input
    );

  const url =
    canonicalYouTubeUrl(
      resolved
    );

  const errors =
    [];

  // Railway-friendly API engine first.
  if (getYtStreamRapidApiKey()) {
    try {
      console.log(
        "[YTSTREAM] Trying RapidAPI audio..."
      );

      return await downloadYouTubeAudioViaYtStream(
        url,
        isYouTubeUrl(input)
          ? "YouTube Audio"
          : String(
              input ||
              "YouTube Audio"
            )
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
    const local =
      await tryLocalYouTubeAudio(
        binary,
        url
      );

    return {
      path:
        local.path,

      title:
        isYouTubeUrl(input)
          ? "YouTube Audio"
          : String(
              input ||
              "YouTube Audio"
            ),

      author:
        "YouTube",

      mimetype:
        "audio/mpeg",

      provider:
        local.engine
    };

  } catch (error) {
    errors.push(
      `LOCAL: ${readableError(error)}`
    );

    try {
      console.log(
        "[YOUTUBE FINAL] Refreshing yt-dlp and retrying audio once..."
      );

      binary =
        await ensureYtDlp(
          true
        );

      const localRetry =
        await tryLocalYouTubeAudio(
          binary,
          url
        );

      return {
        path:
          localRetry.path,

        title:
          isYouTubeUrl(input)
            ? "YouTube Audio"
            : String(
                input ||
                "YouTube Audio"
              ),

        author:
          "YouTube",

        mimetype:
          "audio/mpeg",

        provider:
          localRetry.engine
      };

    } catch (retryError) {
      errors.push(
        `LOCAL RETRY: ${readableError(retryError)}`
      );
    }
  }

  try {
    const remote =
      await trySocialDownloaderYouTubeAudio(
        url
      );

    return {
      path:
        remote.path,

      title:
        remote.title ||
        String(
          input ||
          "YouTube Audio"
        ),

      author:
        remote.author ||
        "YouTube",

      mimetype:
        "audio/mpeg",

      provider:
        remote.engine
    };

  } catch (error) {
    errors.push(
      `REMOTE: ${readableError(error)}`
    );
  }

  throw new Error(
    "YouTube audio failed on every engine.\\n" +
    errors
      .slice(
        -3
      )
      .join(
        "\\n"
      )
  );
}

// ======================================================
// YOUTUBE VIDEO
// ======================================================

async function downloadYouTubeVideo(
  input
) {
  let binary =
    await ensureYtDlp();

  const resolved =
    await resolveYouTubeInput(
      input
    );

  const url =
    canonicalYouTubeUrl(
      resolved
    );

  const errors =
    [];

  // Railway-friendly API engine first.
  if (getYtStreamRapidApiKey()) {
    try {
      console.log(
        "[YTSTREAM] Trying RapidAPI video..."
      );

      return await downloadYouTubeVideoViaYtStream(
        url,
        isYouTubeUrl(input)
          ? "YouTube Video"
          : String(
              input ||
              "YouTube Video"
            )
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
    const local =
      await tryLocalYouTubeVideo(
        binary,
        url
      );

    return {
      path:
        local.path,

      title:
        isYouTubeUrl(input)
          ? "YouTube Video"
          : String(
              input ||
              "YouTube Video"
            ),

      author:
        "YouTube",

      mimetype:
        getMimeType(
          local.path
        ),

      provider:
        local.engine
    };

  } catch (error) {
    errors.push(
      `LOCAL: ${readableError(error)}`
    );

    try {
      console.log(
        "[YOUTUBE FINAL] Refreshing yt-dlp and retrying video once..."
      );

      binary =
        await ensureYtDlp(
          true
        );

      const localRetry =
        await tryLocalYouTubeVideo(
          binary,
          url
        );

      return {
        path:
          localRetry.path,

        title:
          isYouTubeUrl(input)
            ? "YouTube Video"
            : String(
                input ||
                "YouTube Video"
              ),

        author:
          "YouTube",

        mimetype:
          getMimeType(
            localRetry.path
          ),

        provider:
          localRetry.engine
      };

    } catch (retryError) {
      errors.push(
        `LOCAL RETRY: ${readableError(retryError)}`
      );
    }
  }

  try {
    const remote =
      await trySocialDownloaderYouTubeVideo(
        url
      );

    return {
      path:
        remote.path,

      title:
        remote.title ||
        String(
          input ||
          "YouTube Video"
        ),

      author:
        remote.author ||
        "YouTube",

      mimetype:
        getMimeType(
          remote.path
        ),

      provider:
        remote.engine
    };

  } catch (error) {
    errors.push(
      `REMOTE: ${readableError(error)}`
    );
  }

  throw new Error(
    "YouTube video failed on every engine.\\n" +
    errors
      .slice(
        -3
      )
      .join(
        "\\n"
      )
  );
}

// ======================================================
// LOCAL / SELF-HOSTED COBALT FALLBACK
// ======================================================

function getCobaltApiUrl() {
  return String(process.env.COBALT_API_URL || "").trim().replace(/\/+$/, "");
}

function getCobaltHeaders() {
  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "OSTHAR-MINI-BOT/1.0"
  };

  const apiKey = String(process.env.COBALT_API_KEY || "").trim();
  if (apiKey) headers.Authorization = `Api-Key ${apiKey}`;
  return headers;
}

function extensionFromContentType(contentType = "") {
  const type = String(contentType).toLowerCase();
  if (type.includes("video/mp4")) return ".mp4";
  if (type.includes("video/webm")) return ".webm";
  if (type.includes("image/jpeg")) return ".jpg";
  if (type.includes("image/png")) return ".png";
  if (type.includes("image/webp")) return ".webp";
  if (type.includes("audio/mpeg")) return ".mp3";
  if (type.includes("audio/mp4")) return ".m4a";
  return ".mp4";
}

async function downloadHttpFile(
  url,
  outputBase,
  preferredFileName = ""
) {
  const response =
    await fetch(
      url,
      {
        redirect:
          "follow",

        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",

          "Accept":
            "video/webm,video/ogg,video/*;q=0.9,audio/*;q=0.8,*/*;q=0.5",

          "Accept-Language":
            "en-US,en;q=0.9",

          "Accept-Encoding":
            "identity",

          "Referer":
            "https://www.socialdownloader.space/"
        }
      }
    );

  if (!response.ok) {
    throw new Error(
      `Fallback media request failed: HTTP ${response.status}`
    );
  }

  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  const preferredExt =
    path.extname(
      String(
        preferredFileName ||
        ""
      )
    ).toLowerCase();

  const ext =
    preferredExt &&
    preferredExt.length <= 8
      ? preferredExt
      : extensionFromContentType(
          contentType
        );

  const outputPath =
    `${outputBase}${ext}`;

  if (!response.body) {
    throw new Error(
      "Fallback downloader returned an empty body."
    );
  }

  await pipeline(
    Readable.fromWeb(
      response.body
    ),
    fs.createWriteStream(
      outputPath
    )
  );

  if (
    !fs.existsSync(
      outputPath
    ) ||
    fs.statSync(
      outputPath
    ).size <= 0
  ) {
    throw new Error(
      "Fallback file was not created."
    );
  }

  return outputPath;
}

async function downloadFirstWorkingUrl({
  urls,
  outputBase,
  preferredFileName,
  label
}) {
  const unique =
    [
      ...new Set(
        (urls || [])
          .map(
            absoluteSocialDownloaderUrl
          )
          .filter(Boolean)
      )
    ];

  if (!unique.length) {
    throw new Error(
      `SocialDownloader returned no ${label} URL.`
    );
  }

  let lastError =
    null;

  for (
    let i = 0;
    i < unique.length;
    i++
  ) {
    try {
      console.log(
        `[SOCIALDOWNLOADER] ${label} media URL ${i + 1}/${unique.length}`
      );

      return await downloadHttpFile(
        unique[i],
        `${outputBase}-${i}`,
        preferredFileName
      );

    } catch (error) {
      lastError =
        error;

      console.log(
        `[SOCIALDOWNLOADER] ${label} URL ${i + 1} failed:`,
        error?.message ||
        error
      );
    }
  }

  throw new Error(
    `All SocialDownloader ${label} media URLs failed: ${
      lastError?.message ||
      "unknown error"
    }`
  );
}

async function requestCobalt(sourceUrl) {
  const apiUrl = getCobaltApiUrl();
  if (!apiUrl) throw new Error("Cobalt fallback is not configured.");

  const response = await fetch(`${apiUrl}/`, {
    method: "POST",
    headers: getCobaltHeaders(),
    body: JSON.stringify({
      url: sourceUrl,
      downloadMode: "auto",
      videoQuality: "720",
      filenameStyle: "basic"
    })
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Cobalt returned invalid JSON: HTTP ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(`Cobalt HTTP ${response.status}: ${data?.error?.code || "request failed"}`);
  }

  if (data?.status === "error") {
    throw new Error(`Cobalt: ${data?.error?.code || "unknown error"}`);
  }

  return data;
}

async function cobaltDownload(sourceUrl, platform) {
  const data = await requestCobalt(sourceUrl);
  let mediaUrl = null;
  let fileName = "";

  if (data?.status === "tunnel" || data?.status === "redirect") {
    mediaUrl = data.url;
    fileName = data.filename || "";
  } else if (data?.status === "picker" && Array.isArray(data.picker)) {
    const selected = data.picker.find((item) => item?.type === "video") || data.picker[0];
    mediaUrl = selected?.url || null;
    fileName = data.filename || "";
  }

  if (!mediaUrl) {
    throw new Error(`Cobalt returned unsupported status: ${data?.status || "unknown"}`);
  }

  const base = createTempBase(`${platform}-cobalt`);
  const filePath = await downloadHttpFile(mediaUrl, base, fileName);

  return {
    path: filePath,
    title: `${platform} Media`,
    mimetype: getMimeType(filePath),
    provider: "cobalt"
  };
}

// ======================================================
// SOCIAL DOWNLOADER - SOCIALDOWNLOADER.SPACE ONLY
// ======================================================

function getSocialDownloaderBase() {
  return String(
    process.env.SOCIAL_DOWNLOADER_BASE ||
    "https://www.socialdownloader.space"
  )
    .trim()
    .replace(/\/+$/, "");
}

function absoluteSocialDownloaderUrl(
  value
) {
  const raw =
    String(value || "").trim();

  if (!raw) {
    return null;
  }

  if (/^https?:\/\//i.test(raw)) {
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
  const base =
    getSocialDownloaderBase();

  const type =
    options.type ||
    "video";

  const quality =
    options.quality ||
    "hd";

  const format =
    options.format ||
    (type === "audio"
      ? "audio"
      : "video");

  const response =
    await fetch(
      `${base}/api/download`,
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
          })
      }
    );

  let data =
    null;

  try {
    data =
      await response.json();
  } catch {
    throw new Error(
      `SocialDownloader returned invalid JSON: HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `SocialDownloader HTTP ${response.status}`
    );
  }

  if (
    data?.success === false
  ) {
    throw new Error(
      data?.error ||
      data?.message ||
      "SocialDownloader could not resolve this URL."
    );
  }

  return data;
}

async function downloadSocialMedia(
  url,
  platform
) {
  if (
    !/^https?:\/\//i.test(
      String(url || "")
    )
  ) {
    throw new Error(
      "Please provide a valid URL."
    );
  }

  console.log(
    `[SOCIALDOWNLOADER] ${platform} request...`
  );

  const data =
    await requestSocialDownloader(
      url
    );

  const metadata =
    data?.metadata ||
    {};

  // ------------------------------------------
  // VIDEO / REEL / CLIP
  // API returns /api/video?url=...
  // ------------------------------------------
  const downloadUrl =
    absoluteSocialDownloaderUrl(
      data?.downloadUrl
    );

  if (downloadUrl) {
    const base =
      createTempBase(
        `${platform}-socialdownloader`
      );

    const filePath =
      await downloadHttpFile(
        downloadUrl,
        base,
        "media.mp4"
      );

    return {
      path:
        filePath,

      title:
        metadata?.title ||
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

  // ------------------------------------------
  // PHOTO / CAROUSEL
  // Send the first image through the site's
  // /api/image proxy so hotlink protection works.
  // ------------------------------------------
  const images =
    Array.isArray(
      metadata?.images
    )
      ? metadata.images.filter(
          item =>
            /^https?:\/\//i.test(
              String(item || "")
            )
        )
      : [];

  if (images.length) {
    const imageProxy =
      `${getSocialDownloaderBase()}` +
      `/api/image?url=${encodeURIComponent(images[0])}`;

    const base =
      createTempBase(
        `${platform}-image-socialdownloader`
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

  throw new Error(
    "SocialDownloader returned no downloadable video or image."
  );
}

// ======================================================
// SOCIAL FUNCTIONS
// ======================================================

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
// APK
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
    await fetch(url);

  if (
    !response.ok
  ) {
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