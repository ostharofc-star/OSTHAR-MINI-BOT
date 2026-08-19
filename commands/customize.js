const { setSetting } = require("../database/settings");

module.exports = {
  name: "customize",
  aliases: [
    "setprefix",
    "setname",
    "setwelcome",
    "setgoodbye",
    "setautoreply"
  ],
  description: "Customize bot settings and messages.",
  reaction: "✏️",

  async execute({
    sock,
    msg,
    jid,
    command,
    args,
    query,
    phone,
    settings
  }) {
    // ===============================
    // SET PREFIX
    // ===============================
    if (command === "setprefix") {
      const newPrefix = String(args[0] || "").trim();

      if (!newPrefix) {
        return sock.sendMessage(
          jid,
          {
            text:
              "✏️ *SET PREFIX*\n\n" +
              `Current Prefix: ${settings.prefix}\n\n` +
              "Usage:\n" +
              `${settings.prefix}setprefix !`
          },
          { quoted: msg }
        );
      }

      if (newPrefix.length > 3) {
        return sock.sendMessage(
          jid,
          {
            text:
              "❌ Prefix must be 1 to 3 characters long."
          },
          { quoted: msg }
        );
      }

      await setSetting(
        phone,
        "prefix",
        newPrefix
      );

      return sock.sendMessage(
        jid,
        {
          text:
            "✅ *PREFIX UPDATED*\n\n" +
            `New Prefix: ${newPrefix}\n\n` +
            `Example: ${newPrefix}menu`
        },
        { quoted: msg }
      );
    }

    // ===============================
    // SET BOT NAME
    // ===============================
    if (command === "setname") {
      const newName = String(query || "").trim();

      if (!newName) {
        return sock.sendMessage(
          jid,
          {
            text:
              "🏷️ *SET BOT NAME*\n\n" +
              `Usage: ${settings.prefix}setname My Mini Bot`
          },
          { quoted: msg }
        );
      }

      if (newName.length > 40) {
        return sock.sendMessage(
          jid,
          {
            text:
              "❌ Bot name is too long. Maximum 40 characters."
          },
          { quoted: msg }
        );
      }

      await setSetting(
        phone,
        "botName",
        newName
      );

      return sock.sendMessage(
        jid,
        {
          text:
            "✅ *BOT NAME UPDATED*\n\n" +
            `New Name: ${newName}`
        },
        { quoted: msg }
      );
    }

    // ===============================
    // SET WELCOME MESSAGE
    // ===============================
    if (command === "setwelcome") {
      const message = String(query || "").trim();

      if (!message) {
        return sock.sendMessage(
          jid,
          {
            text:
              "👋 *SET WELCOME MESSAGE*\n\n" +
              `Usage: ${settings.prefix}setwelcome Welcome to our group!`
          },
          { quoted: msg }
        );
      }

      await setSetting(
        phone,
        "welcomeMessage",
        message
      );

      return sock.sendMessage(
        jid,
        {
          text:
            "✅ *WELCOME MESSAGE UPDATED*\n\n" +
            message
        },
        { quoted: msg }
      );
    }

    // ===============================
    // SET GOODBYE MESSAGE
    // ===============================
    if (command === "setgoodbye") {
      const message = String(query || "").trim();

      if (!message) {
        return sock.sendMessage(
          jid,
          {
            text:
              "👋 *SET GOODBYE MESSAGE*\n\n" +
              `Usage: ${settings.prefix}setgoodbye Goodbye and take care!`
          },
          { quoted: msg }
        );
      }

      await setSetting(
        phone,
        "goodbyeMessage",
        message
      );

      return sock.sendMessage(
        jid,
        {
          text:
            "✅ *GOODBYE MESSAGE UPDATED*\n\n" +
            message
        },
        { quoted: msg }
      );
    }

    // ===============================
    // SET AUTO REPLY MESSAGE
    // ===============================
    if (command === "setautoreply") {
      const message = String(query || "").trim();

      if (!message) {
        return sock.sendMessage(
          jid,
          {
            text:
              "💬 *SET AUTO REPLY*\n\n" +
              `Usage: ${settings.prefix}setautoreply Thank you for your message.`
          },
          { quoted: msg }
        );
      }

      await setSetting(
        phone,
        "autoReplyMessage",
        message
      );

      return sock.sendMessage(
        jid,
        {
          text:
            "✅ *AUTO REPLY MESSAGE UPDATED*\n\n" +
            message
        },
        { quoted: msg }
      );
    }
  }
};