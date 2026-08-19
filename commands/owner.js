module.exports = {
  name: "owner",
  aliases: ["creator"],
  description: "Show bot owner information.",
  reaction: "👤",

  async execute({ sock, msg, jid }) {
    await sock.sendMessage(
      jid,
      {
        text:
          "👤 *OSTHAR MINI BOT*\n\n" +
          "Developer: Pamoda Nethsara\n" +
          "System: Advanced WhatsApp Mini Bot\n" +
          "Status: Active\n\n" +
          "*Mini Bot Created by Pamoda Nethsara*"
      },
      { quoted: msg }
    );
  }
};