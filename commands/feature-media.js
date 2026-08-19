const jsQR = require("jsqr");
const { createWorker } = require("tesseract.js");

const {
  downloadTargetMedia,
  imageToRgba
} = require("../lib/featureMedia");

module.exports = {
  name: "qrscan",
  aliases: ["ocr"],
  description: "Scan QR codes or read text from images.",

  async execute({
    sock,
    msg,
    jid,
    command
  }) {
    if (command === "qrscan") {
      try {
        const { buffer } =
          await downloadTargetMedia(sock, msg);

        const image =
          await imageToRgba(buffer);

        const result =
          jsQR(
            image.data,
            image.width,
            image.height,
            { inversionAttempts: "attemptBoth" }
          );

        if (!result?.data) {
          return sock.sendMessage(
            jid,
            { text: "❌ *QR NOT FOUND*\n\nNo readable QR code was found in that image." },
            { quoted: msg }
          );
        }

        return sock.sendMessage(
          jid,
          {
            text:
              "✅ *QR SCAN RESULT*\n\n" +
              result.data.slice(0, 4000)
          },
          { quoted: msg }
        );
      } catch (error) {
        return sock.sendMessage(
          jid,
          { text: `❌ *QR SCAN ERROR*\n\n${error?.message || "Unable to scan QR."}` },
          { quoted: msg }
        );
      }
    }

    if (command === "ocr") {
      let worker;

      try {
        const { buffer } =
          await downloadTargetMedia(sock, msg);

        await sock.sendMessage(
          jid,
          { text: "🔎 *OCR*\n\nReading text from the image..." },
          { quoted: msg }
        );

        worker = await createWorker("eng");
        const result = await worker.recognize(buffer);
        const text = String(result?.data?.text || "").trim();

        if (!text) {
          return sock.sendMessage(
            jid,
            { text: "❌ *NO TEXT FOUND*\n\nI could not detect readable English text." },
            { quoted: msg }
          );
        }

        return sock.sendMessage(
          jid,
          {
            text:
              "📝 *OCR RESULT*\n\n" +
              text.slice(0, 12000)
          },
          { quoted: msg }
        );
      } catch (error) {
        return sock.sendMessage(
          jid,
          { text: `❌ *OCR ERROR*\n\n${error?.message || "Unable to read the image."}` },
          { quoted: msg }
        );
      } finally {
        if (worker) {
          await worker.terminate().catch(() => {});
        }
      }
    }
  }
};
