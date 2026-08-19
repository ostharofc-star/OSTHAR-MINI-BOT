const { PDFParse } = require("pdf-parse");

const {
  downloadTargetMedia,
  getDocumentMeta
} = require("../lib/featureMedia");

const { geminiText } = require("../lib/featureAi");

module.exports = {
  name: "docsummary",
  aliases: ["summarizedoc", "pdfsummary"],
  description: "Summarize a replied PDF or text document.",

  async execute({ sock, msg, jid }) {
    let parser;

    try {
      const { buffer, message } =
        await downloadTargetMedia(sock, msg);

      const meta = getDocumentMeta(message);
      if (!meta) {
        throw new Error("Reply to a PDF or text document.");
      }

      const mime = String(meta.mimetype || "").toLowerCase();
      const fileName = String(meta.fileName || "").toLowerCase();

      let text = "";

      if (
        mime.includes("pdf") ||
        fileName.endsWith(".pdf")
      ) {
        parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        text = String(result?.text || "");
      } else if (
        mime.includes("text") ||
        fileName.endsWith(".txt") ||
        fileName.endsWith(".md") ||
        fileName.endsWith(".csv") ||
        fileName.endsWith(".json")
      ) {
        text = buffer.toString("utf8");
      } else {
        throw new Error("Supported documents: PDF, TXT, MD, CSV and JSON.");
      }

      text = text.replace(/\0/g, "").trim();

      if (!text) {
        throw new Error("No readable text was found in the document.");
      }

      await sock.sendMessage(
        jid,
        { text: "📄 *DOCUMENT SUMMARY*\n\nAnalyzing the document..." },
        { quoted: msg }
      );

      const summary = await geminiText(
        "Summarize the following document clearly and accurately. " +
        "Use short sections: Overview, Key Points, Important Details, and Conclusion. " +
        "Do not invent information that is not in the document.\n\nDOCUMENT:\n" +
        text.slice(0, 45000)
      );

      return sock.sendMessage(
        jid,
        {
          text:
            "📄 *DOCUMENT SUMMARY*\n\n" +
            summary.slice(0, 12000)
        },
        { quoted: msg }
      );
    } catch (error) {
      return sock.sendMessage(
        jid,
        { text: `❌ *DOCUMENT SUMMARY ERROR*\n\n${error?.message || "Unable to summarize document."}` },
        { quoted: msg }
      );
    } finally {
      if (parser?.destroy) {
        await parser.destroy().catch(() => {});
      }
    }
  }
};
