const {
  setSetting
} = require("../database/settings");

const TOGGLES = {
  antidelete: "antiDelete",
  anticall: "antiCall",
  autostatus: "autoStatusSeen",
  autoreact: "autoReact",
  autoreply: "autoReply",
  autoread: "autoRead",
  autotyping: "autoTyping",
  statusreact: "statusReact",
  statusreply: "statusReply",
  antilink: "antiLink",
  antispam: "antiSpam",
  welcome: "welcome",
  goodbye: "goodbye"
};

module.exports = {
  name: "toggle",

  aliases: [
    ...Object.keys(TOGGLES),
    "setstatusreact"
  ],

  description:
    "Enable or disable bot features and set status reaction emoji.",

  reaction: "⚙️",

  async execute({
    sock,
    msg,
    jid,
    command,
    args,
    phone
  }) {
    try {

      // ==================================================
      // SET STATUS REACTION EMOJI
      // ==================================================

      if (
        command ===
        "setstatusreact"
      ) {
        const emoji =
          String(
            args?.[0] || ""
          ).trim();

        if (!emoji) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "⚙️ *SET STATUS REACTION*\n\n" +
                "Usage:\n" +
                ".setstatusreact ❤️\n\n" +
                "Examples:\n" +
                ".setstatusreact 💚\n" +
                ".setstatusreact ❤️\n" +
                ".setstatusreact 🔥\n" +
                ".setstatusreact 😍"
            },
            {
              quoted: msg
            }
          );
        }

        // Keep value small
        if (
          emoji.length > 12
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *INVALID EMOJI*\n\n" +
                "Please enter only one emoji.\n\n" +
                "Example:\n" +
                ".setstatusreact ❤️"
            },
            {
              quoted: msg
            }
          );
        }

        await setSetting(
          phone,
          "statusReactEmoji",
          emoji
        );

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *STATUS REACTION UPDATED*\n\n" +
              `Reaction Emoji: ${emoji}\n\n` +
              "Use *.statusreact on* to enable automatic status reactions."
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // NORMAL TOGGLES
      // ==================================================

      const settingKey =
        TOGGLES[command];

      if (!settingKey) {
        return;
      }

      const value =
        String(
          args?.[0] || ""
        )
          .trim()
          .toLowerCase();

      if (
        ![
          "on",
          "off"
        ].includes(value)
      ) {
        return await sock.sendMessage(
          jid,
          {
            text:
              `⚙️ *${command.toUpperCase()}*\n\n` +
              `Usage: .${command} on\n` +
              `Usage: .${command} off`
          },
          {
            quoted: msg
          }
        );
      }

      const enabled =
        value === "on";

      await setSetting(
        phone,
        settingKey,
        enabled
      );

      // ==================================================
      // SPECIAL STATUS REACT MESSAGE
      // ==================================================

      if (
        command ===
        "statusreact"
      ) {
        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *STATUS AUTO REACTION UPDATED*\n\n" +
              `Status React: ${enabled ? "ON" : "OFF"}\n\n` +
              (
                enabled
                  ? "The bot will automatically react to new WhatsApp statuses using your selected reaction emoji.\n\nUse *.setstatusreact ❤️* to change the emoji."
                  : "Automatic status reactions are now disabled."
              )
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // NORMAL SUCCESS MESSAGE
      // ==================================================

      await sock.sendMessage(
        jid,
        {
          text:
            "✅ *SETTING UPDATED*\n\n" +
            `${command}: ${enabled ? "ON" : "OFF"}\n\n` +
            "Your preference has been saved successfully."
        },
        {
          quoted: msg
        }
      );

    } catch (error) {
      console.log(
        "TOGGLE COMMAND ERROR:",
        error?.message || error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *SETTING ERROR*\n\n" +
            "Unable to update this setting right now."
        },
        {
          quoted: msg
        }
      );
    }
  }
};