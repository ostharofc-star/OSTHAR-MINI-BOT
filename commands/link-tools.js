const {
  heuristicUrlSafety,
  fetchPreview
} = require("../lib/urlTools");

module.exports = {
  name: "urlcheck",
  aliases: ["linkpreview"],
  description: "Check a URL or fetch link preview metadata.",

  async execute({
    sock,
    msg,
    jid,
    command,
    query
  }) {
    const input = String(query || "").trim();

    if (!input) {
      return sock.sendMessage(
        jid,
        {
          text:
            command === "urlcheck"
              ? "🔐 *URL CHECK*\n\nUsage: .urlcheck https://example.com"
              : "🔗 *LINK PREVIEW*\n\nUsage: .linkpreview https://example.com"
        },
        { quoted: msg }
      );
    }

    try {
      if (command === "urlcheck") {
        const result = heuristicUrlSafety(input);

        return sock.sendMessage(
          jid,
          {
            text:
              "🔐 *URL SAFETY CHECK*\n\n" +
              `Risk: *${result.level}*\n` +
              `Host: ${result.host}\n` +
              `Score: ${result.score}\n\n` +
              (
                result.reasons.length
                  ? result.reasons.map((x) => `• ${x}`).join("\n")
                  : "• No obvious suspicious URL patterns were detected."
              ) +
              "\n\n⚠️ This is a heuristic check, not a malware guarantee."
          },
          { quoted: msg }
        );
      }

      const preview = await fetchPreview(input);

      return sock.sendMessage(
        jid,
        {
          text:
            "🔗 *LINK PREVIEW*\n\n" +
            `Title: ${preview.title || "Not available"}\n` +
            `Description: ${preview.description || "Not available"}\n` +
            `Status: ${preview.status}\n` +
            `Type: ${preview.contentType || "Unknown"}\n` +
            `Final URL: ${preview.url}`
        },
        { quoted: msg }
      );
    } catch (error) {
      return sock.sendMessage(
        jid,
        { text: `❌ *LINK TOOL ERROR*\n\n${error?.message || "Unable to process URL."}` },
        { quoted: msg }
      );
    }
  }
};
