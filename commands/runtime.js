const { formatRuntime } = require("../lib/helpers");

module.exports = {
  name: "runtime",
  aliases: ["uptime"],
  description: "Show bot runtime.",
  reaction: "⏱️",

  async execute({ sock, msg, jid, startTime }) {
    const seconds =
      Math.floor((Date.now() - startTime) / 1000);

    const runtime = formatRuntime(seconds);

    await sock.sendMessage(
      jid,
      {
        text:
          "⏱️ *OSTHAR MINI BOT RUNTIME*\n\n" +
          `Runtime: ${runtime}\n` +
          "Status: Online\n\n" +
          "*Mini Bot Created by Pamoda Nethsara*"
      },
      { quoted: msg }
    );
  }
};