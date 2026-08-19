const fs = require("fs");
const googleTTS =
  require("google-tts-api");

const {
  createMediaTempPath,
  removeMediaFile,
  mediaToSticker,
  stickerToImage,
  videoToMp3
} = require("../lib/media");

const {
  getViewOnceDestination
} = require("../lib/destination");

const {
  sendSuccess,
  sendError,
  sendLoading,
  usage
} = require("../lib/messages");

function getContextInfo(msg) {
  const message = msg?.message || {};

  return (
    message.extendedTextMessage?.contextInfo ||
    message.imageMessage?.contextInfo ||
    message.videoMessage?.contextInfo ||
    message.documentMessage?.contextInfo ||
    message.audioMessage?.contextInfo ||
    message.stickerMessage?.contextInfo ||
    null
  );
}

function getQuotedMessage(msg) {
  const context = getContextInfo(msg);

  if (!context?.quotedMessage) {
    return null;
  }

  return {
    key: {
      remoteJid: msg.key.remoteJid,
      fromMe: false,
      id: context.stanzaId,
      participant: context.participant
    },
    message: context.quotedMessage
  };
}

function unwrapMessage(message) {
  if (!message) return null;

  if (message.ephemeralMessage?.message) {
    return unwrapMessage(
      message.ephemeralMessage.message
    );
  }

  if (message.viewOnceMessage?.message) {
    return unwrapMessage(
      message.viewOnceMessage.message
    );
  }

  if (message.viewOnceMessageV2?.message) {
    return unwrapMessage(
      message.viewOnceMessageV2.message
    );
  }

  if (
    message.viewOnceMessageV2Extension
      ?.message
  ) {
    return unwrapMessage(
      message
        .viewOnceMessageV2Extension
        .message
    );
  }

  if (
    message.documentWithCaptionMessage
      ?.message
  ) {
    return unwrapMessage(
      message
        .documentWithCaptionMessage
        .message
    );
  }

  return message;
}

function isViewOnce(message) {
  if (!message) return false;

  if (
    message.viewOnceMessage ||
    message.viewOnceMessageV2 ||
    message.viewOnceMessageV2Extension
  ) {
    return true;
  }

  const content =
    unwrapMessage(message);

  return !!(
    content?.imageMessage?.viewOnce ||
    content?.videoMessage?.viewOnce
  );
}

async function downloadQuotedMedia(
  sock,
  quoted
) {
  const content =
    unwrapMessage(
      quoted.message
    );

  const buffer =
    await sock.downloadMediaMessage({
      key: quoted.key,
      message: content
    });

  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0
  ) {
    throw new Error(
      "Unable to download the replied media."
    );
  }

  return {
    buffer,
    content
  };
}

module.exports = {
  name: "media",

  aliases: [
    "sticker",
    "toimg",
    "mp3",
    "vv",
    "tts"
  ],

  description:
    "Media conversion tools.",

  reaction: "🎨",

  async execute({
    sock,
    msg,
    jid,
    phone,
    command,
    args,
    query,
    settings
  }) {
    const prefix =
      settings?.prefix || ".";

    // STICKER
    if (command === "sticker") {
      const quoted =
        getQuotedMessage(msg);

      if (!quoted) {
        return sock.sendMessage(
          jid,
          {
            text: usage({
              title: "STICKER MAKER",
              usage:
                `Reply to an image or video with ${prefix}sticker`
            })
          },
          { quoted: msg }
        );
      }

      const content =
        unwrapMessage(
          quoted.message
        );

      const isImage =
        !!content?.imageMessage;

      const isVideo =
        !!content?.videoMessage;

      if (!isImage && !isVideo) {
        return sendError(
          sock,
          jid,
          msg,
          "Reply to an image or video.",
          "INVALID MEDIA"
        );
      }

      let input;
      let output;

      try {
        await sendLoading(
          sock,
          jid,
          msg,
          "Creating your sticker...",
          "STICKER MAKER"
        );

        const media =
          await downloadQuotedMedia(
            sock,
            quoted
          );

        input =
          createMediaTempPath(
            isVideo
              ? ".mp4"
              : ".jpg"
          );

        output =
          createMediaTempPath(
            ".webp"
          );

        fs.writeFileSync(
          input,
          media.buffer
        );

        await mediaToSticker(
          input,
          output
        );

        await sock.sendMessage(
          jid,
          {
            sticker:
              fs.readFileSync(
                output
              )
          },
          { quoted: msg }
        );

      } catch (error) {
        console.error(
          "STICKER ERROR:",
          error
        );

        return sendError(
          sock,
          jid,
          msg,
          error.message,
          "STICKER FAILED"
        );

      } finally {
        removeMediaFile(input);
        removeMediaFile(output);
      }

      return;
    }

    // TOIMG
    if (command === "toimg") {
      const quoted =
        getQuotedMessage(msg);

      if (!quoted) {
        return sendError(
          sock,
          jid,
          msg,
          `Reply to a sticker with ${prefix}toimg`,
          "STICKER REQUIRED"
        );
      }

      const content =
        unwrapMessage(
          quoted.message
        );

      if (
        !content?.stickerMessage
      ) {
        return sendError(
          sock,
          jid,
          msg,
          "The replied message is not a sticker.",
          "INVALID MEDIA"
        );
      }

      let input;
      let output;

      try {
        await sendLoading(
          sock,
          jid,
          msg,
          "Converting sticker to image...",
          "MEDIA CONVERSION"
        );

        const media =
          await downloadQuotedMedia(
            sock,
            quoted
          );

        input =
          createMediaTempPath(
            ".webp"
          );

        output =
          createMediaTempPath(
            ".png"
          );

        fs.writeFileSync(
          input,
          media.buffer
        );

        await stickerToImage(
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
              "╭━━〔 ✅ *SUCCESS* 〕━━╮\n\n" +
              "Sticker converted to image.\n\n" +
              "*Mini Bot Created by Pamoda Nethsara*\n" +
              "╰━━━━━━━━━━━━━━━━━━━━╯"
          },
          { quoted: msg }
        );

      } catch (error) {
        return sendError(
          sock,
          jid,
          msg,
          error.message,
          "CONVERSION FAILED"
        );

      } finally {
        removeMediaFile(input);
        removeMediaFile(output);
      }
    }

    // MP3
    if (command === "mp3") {
      const quoted =
        getQuotedMessage(msg);

      if (!quoted) {
        return sendError(
          sock,
          jid,
          msg,
          `Reply to a video with ${prefix}mp3`,
          "VIDEO REQUIRED"
        );
      }

      const content =
        unwrapMessage(
          quoted.message
        );

      if (
        !content?.videoMessage
      ) {
        return sendError(
          sock,
          jid,
          msg,
          "The replied message is not a video.",
          "INVALID MEDIA"
        );
      }

      let input;
      let output;

      try {
        await sendLoading(
          sock,
          jid,
          msg,
          "Extracting MP3 audio...",
          "MP3 CONVERSION"
        );

        const media =
          await downloadQuotedMedia(
            sock,
            quoted
          );

        input =
          createMediaTempPath(
            ".mp4"
          );

        output =
          createMediaTempPath(
            ".mp3"
          );

        fs.writeFileSync(
          input,
          media.buffer
        );

        await videoToMp3(
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
              "OSTHAR-MINI-BOT.mp3",

            ptt: false
          },
          { quoted: msg }
        );

      } catch (error) {
        return sendError(
          sock,
          jid,
          msg,
          error.message,
          "MP3 FAILED"
        );

      } finally {
        removeMediaFile(input);
        removeMediaFile(output);
      }
    }

    // VIEW ONCE
    if (command === "vv") {
      const quoted =
        getQuotedMessage(msg);

      if (!quoted) {
        return sendError(
          sock,
          jid,
          msg,
          `Reply to a View Once image/video with ${prefix}vv`,
          "VIEW ONCE REQUIRED"
        );
      }

      if (
        !isViewOnce(
          quoted.message
        )
      ) {
        return sendError(
          sock,
          jid,
          msg,
          "The replied message is not detected as View Once media.",
          "INVALID MEDIA"
        );
      }

      try {
        const content =
          unwrapMessage(
            quoted.message
          );

        const media =
          await downloadQuotedMedia(
            sock,
            quoted
          );

        const destinationJid =
          getViewOnceDestination({
            settings,
            ownerPhone: phone,
            currentJid: jid
          });

        if (
          content?.imageMessage
        ) {
          await sock.sendMessage(
            destinationJid,
            {
              image:
                media.buffer,

              caption:
                "👁️ *VIEW ONCE MEDIA*\n\n" +
                "*Mini Bot Created by Pamoda Nethsara*"
            }
          );
        }

        if (
          content?.videoMessage
        ) {
          await sock.sendMessage(
            destinationJid,
            {
              video:
                media.buffer,

              caption:
                "👁️ *VIEW ONCE MEDIA*\n\n" +
                "*Mini Bot Created by Pamoda Nethsara*"
            }
          );
        }

        return sendSuccess(
          sock,
          jid,
          msg,
          "View Once media was sent to the configured destination.",
          "VIEW ONCE SAVED"
        );

      } catch (error) {
        return sendError(
          sock,
          jid,
          msg,
          error.message,
          "VIEW ONCE FAILED"
        );
      }
    }

    // TTS
    if (command === "tts") {
      if (!query) {
        return sock.sendMessage(
          jid,
          {
            text: usage({
              title: "TEXT TO SPEECH",
              usage:
                `${prefix}tts <text>`,
              example:
                `${prefix}tts Hello world`
            })
          },
          { quoted: msg }
        );
      }

      try {
        await sendLoading(
          sock,
          jid,
          msg,
          "Generating voice audio...",
          "TEXT TO SPEECH"
        );

        let language = "en";
        let text = query.trim();

        if (
          Array.isArray(args) &&
          args.length >= 2 &&
          /^[a-z]{2,5}(-[a-z]{2,5})?$/i.test(
            args[0]
          )
        ) {
          language =
            args[0];

          text =
            args
              .slice(1)
              .join(" ");
        }

        const base64 =
          await googleTTS
            .getAudioBase64(
              text,
              {
                lang: language,
                slow: false,
                host:
                  "https://translate.google.com"
              }
            );

        const audio =
          Buffer.from(
            base64,
            "base64"
          );

        return sock.sendMessage(
          jid,
          {
            audio,
            mimetype:
              "audio/mpeg",
            ptt: false
          },
          { quoted: msg }
        );

      } catch (error) {
        return sendError(
          sock,
          jid,
          msg,
          error.message,
          "TTS FAILED"
        );
      }
    }
  }
};