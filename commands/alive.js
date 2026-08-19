const { formatRuntime } = require("../lib/helpers");

module.exports = {
  name: "alive",
  aliases: [],
  description: "Check whether the bot is online.",
  reaction: "✅",

  async execute({ sock, msg, jid, startTime }) {
    const runtimeSeconds =
      Math.floor((Date.now() - startTime) / 1000);

    const runtime = formatRuntime(runtimeSeconds);

    await sock.sendMessage(
      jid,
      {
        text:
          "╭━━━〔 *OSTHAR MINI BOT* 〕━━━╮\n\n" +
          "✅ Status: Online\n" +
          "⚡ System: Active\n" +
          "🔗 Connection: Established\n" +
          `⏱️ Runtime: ${runtime}\n` +
          "🚀 Performance: Running\n\n" +
          "OSTHAR MINI BOT is online and ready to use.\n\n" +
          "*Mini Bot Created by Pamoda Nethsara*\n" +
          "╰━━━━━━━━━━━━━━━━━━━━╯"
      },
      { quoted: msg }
    );
  }
};