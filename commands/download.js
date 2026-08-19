const fs = require("fs");

const {
  searchYouTube,
  downloadYouTubeAudio,
  downloadYouTubeVideo,
  tiktokDownload,
  facebookDownload,
  instagramDownload,
  pinterestDownload,
  twitterDownload,
  snapchatDownload
} = require("../lib/downloaders");

const {
  downloadApk,
  deleteDirectory
} = require("../lib/apk");

const {
  sendSuccess,
  sendError,
  sendInfo,
  sendLoading,
  usage
} = require("../lib/messages");

module.exports = {
  name: "download",

  aliases: [
    "yts",
    "song",
    "video",
    "tiktok",
    "facebook",
    "fb",
    "instagram",
    "ig",
    "pinterest",
    "pin",
    "twitter",
    "x",
    "snapchat",
    "apk"
  ],

  description: "Download media and APK files.",
  reaction: "⬇️",

  async execute({
    sock,
    msg,
    jid,
    command,
    query,
    settings
  }) {
    const prefix = settings?.prefix || ".";

    try {
      // =========================
      // YOUTUBE SEARCH
      // =========================
      if (command === "yts") {
        if (!query) {
          return sock.sendMessage(
            jid,
            {
              text: usage({
                title: "YOUTUBE SEARCH",
                usage: `${prefix}yts <search query>`,
                example: `${prefix}yts Alan Walker Faded`
              })
            },
            { quoted: msg }
          );
        }

        await sendLoading(
          sock,
          jid,
          msg,
          "Searching YouTube...",
          "YOUTUBE SEARCH"
        );

        const results =
          await searchYouTube(query);

        if (!results?.length) {
          return sendError(
            sock,
            jid,
            msg,
            "No YouTube results were found.",
            "NO RESULTS"
          );
        }

        let text =
          "Top YouTube results:\n\n";

        results
          .slice(0, 10)
          .forEach((item, index) => {
            text +=
              `${index + 1}. *${item.title}*\n` +
              `${item.url}\n\n`;
          });

        return sendInfo(
          sock,
          jid,
          msg,
          text.trim(),
          "YOUTUBE RESULTS"
        );
      }

      // =========================
      // SONG
      // =========================
      if (command === "song") {
        if (!query) {
          return sock.sendMessage(
            jid,
            {
              text: usage({
                title: "SONG DOWNLOAD",
                usage: `${prefix}song <name or YouTube URL>`,
                example: `${prefix}song Faded`
              })
            },
            { quoted: msg }
          );
        }

        await sendLoading(
          sock,
          jid,
          msg,
          "Finding and preparing your audio...",
          "SONG DOWNLOAD"
        );

        const result =
          await downloadYouTubeAudio(query);

        if (!result?.path) {
          throw new Error(
            "Audio file was not created."
          );
        }

        try {
          await sock.sendMessage(
            jid,
            {
              audio: fs.readFileSync(result.path),
              mimetype: "audio/mpeg",
              fileName:
                `${result.title || "OSTHAR-AUDIO"}.mp3`,
              ptt: false
            },
            { quoted: msg }
          );

          return sendSuccess(
            sock,
            jid,
            msg,
            `*${result.title || "Song"}*\n\nAudio downloaded successfully.\nProvider: ${result.provider || "YouTube fallback engine"}`,
            "DOWNLOAD COMPLETE"
          );
        } finally {
          try {
            fs.unlinkSync(result.path);
          } catch {}
        }
      }

      // =========================
      // VIDEO
      // =========================
      if (command === "video") {
        if (!query) {
          return sock.sendMessage(
            jid,
            {
              text: usage({
                title: "VIDEO DOWNLOAD",
                usage: `${prefix}video <name or YouTube URL>`,
                example: `${prefix}video Faded`
              })
            },
            { quoted: msg }
          );
        }

        await sendLoading(
          sock,
          jid,
          msg,
          "Preparing the video...",
          "VIDEO DOWNLOAD"
        );

        const result =
          await downloadYouTubeVideo(query);

        if (!result?.path) {
          throw new Error(
            "Video file was not created."
          );
        }

        try {
          await sock.sendMessage(
            jid,
            {
              video: fs.readFileSync(result.path),
              mimetype: "video/mp4",
              caption:
                `🎬 *${result.title || "VIDEO"}*\n\n` +
                "*Mini Bot Created by Pamoda Nethsara*"
            },
            { quoted: msg }
          );
        } finally {
          try {
            fs.unlinkSync(result.path);
          } catch {}
        }

        return;
      }

      // =========================
      // SOCIAL DOWNLOAD
      // =========================
      const socialMap = {
        tiktok: tiktokDownload,
        facebook: facebookDownload,
        fb: facebookDownload,
        instagram: instagramDownload,
        ig: instagramDownload,
        pinterest: pinterestDownload,
        pin: pinterestDownload,
        twitter: twitterDownload,
        x: twitterDownload,
        snapchat: snapchatDownload
      };

      if (socialMap[command]) {
        if (!query) {
          return sock.sendMessage(
            jid,
            {
              text: usage({
                title: "SOCIAL DOWNLOAD",
                usage: `${prefix}${command} <url>`,
                example: `${prefix}${command} https://example.com/video`
              })
            },
            { quoted: msg }
          );
        }

        await sendLoading(
          sock,
          jid,
          msg,
          "Downloading media from the supplied URL...",
          "SOCIAL DOWNLOAD"
        );

        const result =
          await socialMap[command](query);

        if (!result?.path) {
          throw new Error(
            "Downloaded file was not created."
          );
        }

        try {
          const media =
            fs.readFileSync(
              result.path
            );

          const mimetype =
            String(
              result.mimetype ||
              ""
            ).toLowerCase();

          const extra =
            result.imageCount > 1
              ? `\n*Carousel images:* ${result.imageCount}`
              : "";

          const caption =
            "✅ *DOWNLOAD COMPLETE*\n\n" +
            `*Provider:* socialdownloader.space${extra}\n\n` +
            "*Mini Bot Created by Pamoda Nethsara*";

          if (
            mimetype.startsWith(
              "image/"
            )
          ) {
            await sock.sendMessage(
              jid,
              {
                image:
                  media,

                mimetype:
                  result.mimetype ||
                  "image/jpeg",

                caption
              },
              {
                quoted:
                  msg
              }
            );

          } else {
            await sock.sendMessage(
              jid,
              {
                video:
                  media,

                mimetype:
                  result.mimetype ||
                  "video/mp4",

                caption
              },
              {
                quoted:
                  msg
              }
            );
          }

        } finally {
          try {
            fs.unlinkSync(
              result.path
            );
          } catch {}
        }

        return;
      }

      // =========================
      // APK
      // =========================
      if (command === "apk") {
        if (!query) {
          return sock.sendMessage(
            jid,
            {
              text: usage({
                title: "APK DOWNLOAD",
                usage: `${prefix}apk <app or game name>`,
                example:
                  `${prefix}apk whatsapp`
              })
            },
            { quoted: msg }
          );
        }

        await sendLoading(
          sock,
          jid,
          msg,
          "Searching for the application...",
          "APK SEARCH"
        );

        const result =
          await downloadApk(query);

        if (!result?.path) {
          throw new Error(
            "APK file was not created."
          );
        }

        try {
          await sendInfo(
            sock,
            jid,
            msg,
            `*App:* ${result.title || query}\n` +
            `*Package:* ${result.packageId || "Unknown"}\n` +
            `*Developer:* ${result.developer || "Unknown"}\n` +
            `*Size:* ${result.size || "Unknown"}`,
            "APK FOUND"
          );

          await sock.sendMessage(
            jid,
            {
              document:
                fs.readFileSync(result.path),

              mimetype:
                "application/vnd.android.package-archive",

              fileName:
                result.fileName ||
                `${result.title || "app"}.apk`,

              caption:
                "📦 *APK DOWNLOAD*\n\n" +
                "*Mini Bot Created by Pamoda Nethsara*"
            },
            { quoted: msg }
          );

          return;
        } finally {
          if (result.directory) {
            deleteDirectory(
              result.directory
            );
          }
        }
      }

    } catch (error) {
      console.error(
        "DOWNLOAD COMMAND ERROR:",
        error
      );

      return sendError(
        sock,
        jid,
        msg,
        error?.message ||
          "The download could not be completed.",
        "DOWNLOAD FAILED"
      );
    }
  }
};