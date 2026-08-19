const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// ======================================================
// PATHS
// ======================================================

const BIN_DIR = path.join(
  __dirname,
  "..",
  "bin"
);

const TEMP_ROOT = path.join(
  __dirname,
  "..",
  "temp",
  "apk"
);

fs.mkdirSync(
  BIN_DIR,
  { recursive: true }
);

fs.mkdirSync(
  TEMP_ROOT,
  { recursive: true }
);

// ======================================================
// GOOGLE PLAY SCRAPER
// ======================================================

let gplayClient = null;

async function getGooglePlayClient() {
  if (gplayClient) {
    return gplayClient;
  }

  const mod =
    await import(
      "google-play-scraper"
    );

  gplayClient =
    mod.default ||
    mod;

  return gplayClient;
}

// ======================================================
// APKEEP PATH
// ======================================================

function getApkeepPath() {
  if (
    process.env.APKEEP_PATH
  ) {
    return process.env.APKEEP_PATH;
  }

  if (
    process.platform === "win32"
  ) {
    return path.join(
      BIN_DIR,
      "apkeep.exe"
    );
  }

  return path.join(
    BIN_DIR,
    "apkeep"
  );
}

// ======================================================
// PACKAGE ID CHECK
// ======================================================

function isPackageId(
  input = ""
) {
  return /^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$/
    .test(
      String(input).trim()
    );
}

// ======================================================
// APP SEARCH
// ======================================================

async function searchApp(
  query
) {
  const clean =
    String(query || "")
      .trim();

  if (!clean) {
    throw new Error(
      "Please enter an app or game name."
    );
  }

  // Direct package ID
  if (
    isPackageId(clean)
  ) {
    return {
      title: clean,
      appId: clean,
      developer: "Unknown",
      free: true
    };
  }

  const gplay =
    await getGooglePlayClient();

  console.log(
    `[APK SEARCH] ${clean}`
  );

  const results =
    await gplay.search({
      term: clean,

      num: 5,

      lang: "en",

      country: "us",

      throttle: 1
    });

  if (
    !Array.isArray(results) ||
    !results.length
  ) {
    throw new Error(
      "No Android app or game was found."
    );
  }

  // Prefer free result
  const selected =
    results.find(
      (app) =>
        app.free === true &&
        app.appId
    ) ||
    results.find(
      (app) =>
        app.appId
    );

  if (
    !selected?.appId
  ) {
    throw new Error(
      "Unable to find the Android package ID."
    );
  }

  console.log(
    `[APK FOUND] ${selected.title} -> ${selected.appId}`
  );

  return {
    title:
      selected.title ||
      clean,

    appId:
      selected.appId,

    developer:
      selected.developer ||
      "Unknown",

    free:
      selected.free !== false,

    icon:
      selected.icon ||
      null
  };
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
              `apkeep exited with code ${code}`
            )
          );
        }
      );
    }
  );
}

// ======================================================
// TEMP DIRECTORY
// ======================================================

function createTempDirectory() {
  const directory =
    path.join(
      TEMP_ROOT,
      `download-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`
    );

  fs.mkdirSync(
    directory,
    {
      recursive: true
    }
  );

  return directory;
}

// ======================================================
// FIND APK / XAPK
// ======================================================

function findDownloadedFile(
  directory
) {
  if (
    !fs.existsSync(directory)
  ) {
    return null;
  }

  const files =
    fs.readdirSync(directory);

  const supported =
    files.find(
      (file) =>
        /\.(apk|xapk)$/i.test(
          file
        )
    );

  if (!supported) {
    return null;
  }

  return path.join(
    directory,
    supported
  );
}

// ======================================================
// DELETE TEMP DIRECTORY
// ======================================================

function deleteDirectory(
  directory
) {
  try {
    fs.rmSync(
      directory,
      {
        recursive: true,
        force: true
      }
    );
  } catch {}
}

// ======================================================
// DOWNLOAD APK
// ======================================================

async function downloadApk(
  query
) {
  const apkeep =
    getApkeepPath();

  if (
    !fs.existsSync(apkeep)
  ) {
    throw new Error(
      `apkeep was not found: ${apkeep}`
    );
  }

  // Search app/game
  const app =
    await searchApp(query);

  const directory =
    createTempDirectory();

  try {
    console.log(
      `[APK DOWNLOAD] ${app.title}`
    );

    console.log(
      `[APK PACKAGE] ${app.appId}`
    );

    await runProcess(
      apkeep,
      [
        "-a",
        app.appId,

        "-d",
        "apk-pure",

        directory
      ]
    );

    const file =
      findDownloadedFile(
        directory
      );

    if (!file) {
      throw new Error(
        "APK file was not created."
      );
    }

    const stat =
      fs.statSync(file);

    if (
      stat.size <= 0
    ) {
      throw new Error(
        "Downloaded APK file is empty."
      );
    }

    console.log(
      `[APK READY] ${file}`
    );

    return {
      path:
        file,

      directory,

      title:
        app.title,

      packageId:
        app.appId,

      developer:
        app.developer,

      fileName:
        path.basename(file),

      size:
        stat.size
    };

  } catch (error) {
    deleteDirectory(
      directory
    );

    throw error;
  }
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  searchApp,
  downloadApk,
  deleteDirectory
};