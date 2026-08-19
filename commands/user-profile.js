const {
  getUserSettings
} = require("../database/settings");

// ==========================================
// FORMAT UPTIME
// ==========================================

function formatUptime(seconds) {
  seconds =
    Math.floor(
      Number(seconds) || 0
    );

  const days =
    Math.floor(
      seconds / 86400
    );

  const hours =
    Math.floor(
      (seconds % 86400) / 3600
    );

  const minutes =
    Math.floor(
      (seconds % 3600) / 60
    );

  const secs =
    seconds % 60;

  const parts = [];

  if (days) {
    parts.push(`${days}d`);
  }

  if (hours) {
    parts.push(`${hours}h`);
  }

  if (minutes) {
    parts.push(`${minutes}m`);
  }

  if (secs || !parts.length) {
    parts.push(`${secs}s`);
  }

  return parts.join(" ");
}

// ==========================================
// ON / OFF
// ==========================================

function statusText(value) {
  return value
    ? "ON"
    : "OFF";
}

// ==========================================
// COMMAND
// ==========================================

module.exports = {
  name: "me",

  aliases: [
    "profilebot",
    "botprofile",
    "mybot"
  ],

  description:
    "Show your OSTHAR MINI BOT profile and current settings.",

  reaction: "👤",

  async execute({
    sock,
    msg,
    jid,
    phone
  }) {
    try {
      const settings =
        await getUserSettings(
          phone
        );

      const displayName =
        String(
          msg?.pushName ||
          "WhatsApp User"
        ).trim();

      const cleanPhone =
        String(
          phone || ""
        ).replace(
          /\D/g,
          ""
        );

      const uptime =
        formatUptime(
          process.uptime()
        );

      const botName =
        settings?.botName ||
        "OSTHAR MINI BOT";

      const prefix =
        settings?.prefix ||
        ".";

      const statusEmoji =
        settings?.statusReactEmoji ||
        "💚";

      const text =
        "👤 *BOT PROFILE*\n\n" +

        `*Name:* ${displayName}\n` +
        `*Number:* +${cleanPhone}\n\n` +

        `*Bot Name:* ${botName}\n` +
        `*Prefix:* ${prefix}\n` +
        `*Bot Status:* Online\n` +
        `*Uptime:* ${uptime}\n\n` +

        "⚙️ *AUTOMATION SETTINGS*\n\n" +

        `Anti Delete: ${statusText(settings?.antiDelete)}\n` +
        `Anti Call: ${statusText(settings?.antiCall)}\n` +
        `Auto Status Seen: ${statusText(settings?.autoStatusSeen)}\n` +
        `Auto React: ${statusText(settings?.autoReact)}\n` +
        `Auto Reply: ${statusText(settings?.autoReply)}\n` +
        `Auto Read: ${statusText(settings?.autoRead)}\n` +
        `Auto Typing: ${statusText(settings?.autoTyping)}\n\n` +

        "📱 *STATUS SETTINGS*\n\n" +

        `Status React: ${statusText(settings?.statusReact)}\n` +
        `Reaction Emoji: ${statusEmoji}\n` +
        `Status Reply: ${statusText(settings?.statusReply)}\n\n` +

        "🛡️ *GROUP SETTINGS*\n\n" +

        `Anti Link: ${statusText(settings?.antiLink)}\n` +
        `Anti Spam: ${statusText(settings?.antiSpam)}\n` +
        `Welcome: ${statusText(settings?.welcome)}\n` +
        `Goodbye: ${statusText(settings?.goodbye)}`;

      await sock.sendMessage(
        jid,
        {
          text
        },
        {
          quoted: msg
        }
      );

    } catch (error) {
      console.log(
        "USER PROFILE ERROR:",
        error?.message || error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *PROFILE ERROR*\n\n" +
            "Unable to load your bot profile right now."
        },
        {
          quoted: msg
        }
      );
    }
  }
};