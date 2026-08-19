const fs = require("fs");

const {
  tempFile,
  safeDelete,
  compressVideo,
  resizeImage,
  videoToGif,
  audioToVoice,
  mediaToMp3,
  normalizePhoto
} = require("../lib/media-pro");

const {
  sendError,
  sendLoading,
  usage
} = require("../lib/messages");

function context(msg) {
  const m = msg?.message || {};

  return (
    m.extendedTextMessage?.contextInfo ||
    m.imageMessage?.contextInfo ||
    m.videoMessage?.contextInfo ||
    m.documentMessage?.contextInfo ||
    m.audioMessage?.contextInfo ||
    null
  );
}

function quoted(msg) {
  const c = context(msg);

  if (!c?.quotedMessage) {
    return null;
  }

  return {
    key: {
      remoteJid:
        msg.key.remoteJid,
      id: c.stanzaId,
      participant:
        c.participant,
      fromMe: false
    },
    message:
      c.quotedMessage
  };
}

function unwrap(m) {
  if (!m) return null;

  if (
    m.ephemeralMessage?.message
  ) {
    return unwrap(
      m.ephemeralMessage.message
    );
  }

  if (
    m.viewOnceMessage?.message
  ) {
    return unwrap(
      m.viewOnceMessage.message
    );
  }

  if (
    m.viewOnceMessageV2?.message
  ) {
    return unwrap(
      m.viewOnceMessageV2.message
    );
  }

  return m;
}

async function download(
  sock,
  q
) {
  const content =
    unwrap(q.message);

  const buffer =
    await sock.downloadMediaMessage({
      key: q.key,
      message: content
    });

  if (
    !Buffer.isBuffer(buffer)
  ) {
    throw new Error(
      "Media download failed."
    );
  }

  return {
    buffer,
    content
  };
}

function formatSize(bytes = 0) {
  const units =
    ["B", "KB", "MB", "GB"];

  let value = bytes;
  let i = 0;

  while (
    value >= 1024 &&
    i < units.length - 1
  ) {
    value /= 1024;
    i++;
  }

  return `${value.toFixed(2)} ${units[i]}`;
}

module.exports = {
  name: "media-pro",

  aliases: [
    "compress",
    "resize",
    "gif",
    "voice",
    "photo",
    "audio"
  ],

  description:
    "PRO media utilities.",

  reaction: "🎨",

  async execute({
    sock,
    msg,
    jid,
    command,
    args,
    settings
  }) {
    const prefix =
      settings?.prefix || ".";

    const q = quoted(msg);

    if (!q) {
      return sock.sendMessage(
        jid,
        {
          text: usage({
            title: "MEDIA TOOL",
            usage:
              `Reply to supported media with ${prefix}${command}`
          })
        },
        { quoted: msg }
      );
    }

    let input;
    let output;

    try {
      const media =
        await download(sock, q);

      // COMPRESS
      if (command === "compress") {
        if (
          !media.content
            ?.videoMessage
        ) {
          return sendError(
            sock,
            jid,
            msg,
            "Reply to a video.",
            "VIDEO REQUIRED"
          );
        }

        await sendLoading(
          sock,
          jid,
          msg,
          "Compressing video...",
          "VIDEO COMPRESSOR"
        );

        input =
          tempFile(".mp4");

        output =
          tempFile(".mp4");

        fs.writeFileSync(
          input,
          media.buffer
        );

        await compressVideo(
          input,
          output
        );

        const after =
          fs.statSync(
            output
          ).size;

        return sock.sendMessage(
          jid,
          {
            video:
              fs.readFileSync(
                output
              ),

            mimetype:
              "video/mp4",

            caption:
              "╭━━〔 ✅ *VIDEO COMPRESSED* 〕━━╮\n\n" +
              `Original: ${formatSize(media.buffer.length)}\n` +
              `Compressed: ${formatSize(after)}\n\n` +
              "*Mini Bot Created by Pamoda Nethsara*\n" +
              "╰━━━━━━━━━━━━━━━━━━━━╯"
          },
          { quoted: msg }
        );
      }

      // RESIZE
      if (command === "resize") {
        if (
          !media.content
            ?.imageMessage
        ) {
          return sendError(
            sock,
            jid,
            msg,
            "Reply to an image.",
            "IMAGE REQUIRED"
          );
        }

        const size =
          args?.[0] ||
          "512x512";

        const match =
          size.match(
            /^(\d{2,4})x(\d{2,4})$/i
          );

        if (!match) {
          return sendError(
            sock,
            jid,
            msg,
            `Example: ${prefix}resize 512x512`,
            "INVALID SIZE"
          );
        }

        input =
          tempFile(".jpg");

        output =
          tempFile(".jpg");

        fs.writeFileSync(
          input,
          media.buffer
        );

        await sendLoading(
          sock,
          jid,
          msg,
          "Resizing image...",
          "IMAGE RESIZE"
        );

        await resizeImage(
          input,
          output,
          Number(match[1]),
          Number(match[2])
        );

        return sock.sendMessage(
          jid,
          {
            image:
              fs.readFileSync(
                output
              ),

            caption:
              `✅ Image resized to ${match[1]}x${match[2]}.\n\n` +
              "*Mini Bot Created by Pamoda Nethsara*"
          },
          { quoted: msg }
        );
      }

      // GIF
      if (command === "gif") {
        if (
          !media.content
            ?.videoMessage
        ) {
          return sendError(
            sock,
            jid,
            msg,
            "Reply to a video.",
            "VIDEO REQUIRED"
          );
        }

        input =
          tempFile(".mp4");

        output =
          tempFile(".gif");

        fs.writeFileSync(
          input,
          media.buffer
        );

        await sendLoading(
          sock,
          jid,
          msg,
          "Creating GIF...",
          "GIF MAKER"
        );

        await videoToGif(
          input,
          output
        );

        return sock.sendMessage(
          jid,
          {
            document:
              fs.readFileSync(
                output
              ),

            mimetype:
              "image/gif",

            fileName:
              "OSTHAR-GIF.gif"
          },
          { quoted: msg }
        );
      }

      // VOICE
      if (command === "voice") {
        const valid =
          media.content
            ?.audioMessage ||
          media.content
            ?.videoMessage;

        if (!valid) {
          return sendError(
            sock,
            jid,
            msg,
            "Reply to an audio or video.",
            "MEDIA REQUIRED"
          );
        }

        input =
          tempFile(
            media.content
              ?.videoMessage
              ? ".mp4"
              : ".ogg"
          );

        output =
          tempFile(".ogg");

        fs.writeFileSync(
          input,
          media.buffer
        );

        await audioToVoice(
          input,
          output
        );

        return sock.sendMessage(
          jid,
          {
            audio:
              fs.readFileSync(
                output
              ),

            mimetype:
              "audio/ogg; codecs=opus",

            ptt: true
          },
          { quoted: msg }
        );
      }

      // PHOTO
      if (command === "photo") {
        const doc =
          media.content
            ?.documentMessage;

        if (
          !doc ||
          !String(
            doc.mimetype || ""
          ).startsWith("image/")
        ) {
          return sendError(
            sock,
            jid,
            msg,
            "Reply to an image sent as a document.",
            "IMAGE DOCUMENT REQUIRED"
          );
        }

        input =
          tempFile(".img");

        output =
          tempFile(".jpg");

        fs.writeFileSync(
          input,
          media.buffer
        );

        await normalizePhoto(
          input,
          output
        );

        return sock.sendMessage(
          jid,
          {
            image:
              fs.readFileSync(
                output
              ),

            caption:
              "✅ Converted to normal photo.\n\n" +
              "*Mini Bot Created by Pamoda Nethsara*"
          },
          { quoted: msg }
        );
      }

      // AUDIO
      if (command === "audio") {
        const valid =
          media.content
            ?.videoMessage ||
          media.content
            ?.audioMessage;

        if (!valid) {
          return sendError(
            sock,
            jid,
            msg,
            "Reply to a video or audio.",
            "MEDIA REQUIRED"
          );
        }

        input =
          tempFile(
            media.content
              ?.videoMessage
              ? ".mp4"
              : ".ogg"
          );

        output =
          tempFile(".mp3");

        fs.writeFileSync(
          input,
          media.buffer
        );

        await sendLoading(
          sock,
          jid,
          msg,
          "Converting media to MP3...",
          "AUDIO CONVERTER"
        );

        await mediaToMp3(
          input,
          output
        );

        return sock.sendMessage(
          jid,
          {
            audio:
              fs.readFileSync(
                output
              ),

            mimetype:
              "audio/mpeg",

            fileName:
              "OSTHAR-AUDIO.mp3",

            ptt: false
          },
          { quoted: msg }
        );
      }

    } catch (error) {
      console.error(
        "MEDIA PRO ERROR:",
        error
      );

      return sendError(
        sock,
        jid,
        msg,
        error.message,
        "MEDIA PROCESS FAILED"
      );

    } finally {
      safeDelete(input);
      safeDelete(output);
    }
  }
};