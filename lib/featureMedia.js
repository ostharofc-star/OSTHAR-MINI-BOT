const { Jimp } = require("jimp");

function unwrapMessage(message) {
  let m = message || {};

  if (m.ephemeralMessage?.message) {
    m = m.ephemeralMessage.message;
  }

  if (m.viewOnceMessage?.message) {
    m = m.viewOnceMessage.message;
  }

  if (m.viewOnceMessageV2?.message) {
    m = m.viewOnceMessageV2.message;
  }

  if (m.viewOnceMessageV2Extension?.message) {
    m = m.viewOnceMessageV2Extension.message;
  }

  return m;
}

function getQuotedMessage(msg) {
  const m = unwrapMessage(msg?.message);

  const context =
    m?.extendedTextMessage?.contextInfo ||
    m?.imageMessage?.contextInfo ||
    m?.videoMessage?.contextInfo ||
    m?.documentMessage?.contextInfo ||
    m?.audioMessage?.contextInfo ||
    null;

  return context?.quotedMessage
    ? unwrapMessage(context.quotedMessage)
    : null;
}

function getMediaMessage(msg) {
  const current = unwrapMessage(msg?.message);
  const quoted = getQuotedMessage(msg);

  const hasMedia = (m) =>
    !!(
      m?.imageMessage ||
      m?.videoMessage ||
      m?.documentMessage ||
      m?.audioMessage ||
      m?.stickerMessage
    );

  if (hasMedia(current)) {
    return {
      key: msg.key,
      message: current
    };
  }

  if (hasMedia(quoted)) {
    const context =
      current?.extendedTextMessage?.contextInfo ||
      current?.imageMessage?.contextInfo ||
      current?.videoMessage?.contextInfo ||
      current?.documentMessage?.contextInfo ||
      current?.audioMessage?.contextInfo ||
      {};

    return {
      key: {
        remoteJid: msg?.key?.remoteJid,
        id: context.stanzaId,
        participant: context.participant,
        fromMe: false
      },
      message: quoted
    };
  }

  return null;
}

async function downloadTargetMedia(sock, msg) {
  const target = getMediaMessage(msg);
  if (!target) {
    throw new Error("Reply to an image, video, audio, sticker or document.");
  }

  if (typeof sock.downloadMediaMessage !== "function") {
    throw new Error("Media downloader is not available.");
  }

  const buffer = await sock.downloadMediaMessage(target);
  if (!buffer?.length) {
    throw new Error("Unable to download the media.");
  }

  return {
    buffer,
    target,
    message: target.message
  };
}

async function imageToRgba(buffer) {
  const image = await Jimp.read(buffer);
  return {
    data: new Uint8ClampedArray(image.bitmap.data),
    width: image.bitmap.width,
    height: image.bitmap.height
  };
}

function getDocumentMeta(message) {
  const doc = message?.documentMessage;
  if (!doc) return null;

  return {
    fileName: doc.fileName || "document",
    mimetype: doc.mimetype || "application/octet-stream"
  };
}

module.exports = {
  unwrapMessage,
  getQuotedMessage,
  getMediaMessage,
  downloadTargetMedia,
  imageToRgba,
  getDocumentMeta
};
