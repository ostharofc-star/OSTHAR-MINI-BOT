module.exports = {
  name: "jid",
  aliases: ["id"],
  description: "Show the current WhatsApp chat JID.",
  reaction: "🆔",

  async execute({ sock, msg, jid }) {
    const sender =
      msg.key.participant ||
      msg.key.remoteJid ||
      "Unknown";

    await sock.sendMessage(
      jid,
      {
        text:
          "🆔 *WHATSAPP JID INFORMATION*\n\n" +
          `Chat JID:\n${jid}\n\n` +
          `Sender JID:\n${sender}`
      },
      { quoted: msg }
    );
  }
};