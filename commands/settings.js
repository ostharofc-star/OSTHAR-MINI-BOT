module.exports = {
  name: "settings",
  aliases: ["setting"],
  description: "Show current bot settings.",
  reaction: "⚙️",

  async execute({ sock, msg, jid, settings }) {
    const onOff = (value) => value ? "ON" : "OFF";

    await sock.sendMessage(
      jid,
      {
        text:
          "╭━━━〔 *BOT SETTINGS* 〕━━━╮\n\n" +

          `Bot Name: ${settings.botName}\n` +
          `Prefix: ${settings.prefix}\n\n` +

          "🛡️ *AUTOMATION*\n" +
          `│ Anti Delete: ${onOff(settings.antiDelete)}\n` +
          `│ Anti Call: ${onOff(settings.antiCall)}\n` +
          `│ Auto Status Seen: ${onOff(settings.autoStatusSeen)}\n` +
          `│ Auto React: ${onOff(settings.autoReact)}\n` +
          `│ Auto Reply: ${onOff(settings.autoReply)}\n` +
          `│ Auto Read: ${onOff(settings.autoRead)}\n` +
          `│ Auto Typing: ${onOff(settings.autoTyping)}\n\n` +

          "📱 *STATUS*\n" +
          `│ Status React: ${onOff(settings.statusReact)}\n` +
          `│ Status Reply: ${onOff(settings.statusReply)}\n\n` +

          "👥 *GROUP*\n" +
          `│ Welcome: ${onOff(settings.welcome)}\n` +
          `│ Goodbye: ${onOff(settings.goodbye)}\n` +
          `│ Anti Link: ${onOff(settings.antiLink)}\n` +
          `│ Anti Spam: ${onOff(settings.antiSpam)}\n\n` +

          "*Mini Bot Created by Pamoda Nethsara*\n" +
          "╰━━━━━━━━━━━━━━━━━━━━╯"
      },
      { quoted: msg }
    );
  }
};