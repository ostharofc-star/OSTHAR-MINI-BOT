const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { Jimp } = require("jimp");
const ffmpegPath = require("ffmpeg-static");

const {
  downloadTargetMedia
} = require("../lib/featureMedia");

const execFileAsync = promisify(execFile);

module.exports = {
  name: "topng",
  aliases: ["tojpg", "tomp3"],
  description: "Convert replied media to PNG, JPG or MP3.",

  async execute({
    sock,
    msg,
    jid,
    command
  }) {
    const tempDir =
      fs.mkdtempSync(
        path.join(os.tmpdir(), "osthar-convert-")
      );

    try {
      const { buffer } =
        await downloadTargetMedia(sock, msg);

      if (command === "topng" || command === "tojpg") {
        const image = await Jimp.read(buffer);
        const mime =
          command === "topng"
            ? "image/png"
            : "image/jpeg";

        const ext =
          command === "topng"
            ? "png"
            : "jpg";

        const out = await image.getBuffer(mime);

        return sock.sendMessage(
          jid,
          {
            document: out,
            mimetype: mime,
            fileName: `converted.${ext}`
          },
          { quoted: msg }
        );
      }

      if (command === "tomp3") {
        if (!ffmpegPath) {
          throw new Error("FFmpeg is not available.");
        }

        const input = path.join(tempDir, "input.bin");
        const output = path.join(tempDir, "converted.mp3");

        fs.writeFileSync(input, buffer);

        await execFileAsync(
          ffmpegPath,
          [
            "-y",
            "-i", input,
            "-vn",
            "-acodec", "libmp3lame",
            "-b:a", "128k",
            output
          ],
          { timeout: 120000 }
        );

        const out = fs.readFileSync(output);

        return sock.sendMessage(
          jid,
          {
            audio: out,
            mimetype: "audio/mpeg",
            fileName: "converted.mp3"
          },
          { quoted: msg }
        );
      }
    } catch (error) {
      return sock.sendMessage(
        jid,
        { text: `❌ *CONVERTER ERROR*\n\n${error?.message || "Unable to convert file."}` },
        { quoted: msg }
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
};
