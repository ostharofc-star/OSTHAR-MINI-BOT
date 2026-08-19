module.exports = {
  name: "owner-tools",

  aliases: [
    "block",
    "unblock",
    "restart",
    "logout"
  ],

  description:
    "Owner-only bot control commands.",

  reaction: "🔐",

  async execute({
    sock,
    msg,
    jid,
    command,
    phone,
    settings
  }) {
    const prefix =
      settings?.prefix || ".";

    // ==================================================
    // OWNER CHECK
    // ==================================================

    const botOwnerNumber =
      String(phone || "")
        .replace(/[^0-9]/g, "");

    const senderJid =
      msg.key.participant ||
      msg.key.remoteJid ||
      "";

    const senderNumber =
      String(senderJid)
        .split("@")[0]
        .replace(/[^0-9]/g, "");

    const isFromMe =
      msg.key.fromMe === true;

    const isOwner =
      isFromMe ||
      senderNumber === botOwnerNumber;

    if (!isOwner) {
      return sock.sendMessage(
        jid,
        {
          text:
            "🔒 *OWNER ONLY COMMAND*\n\n" +
            "You are not authorized to use this command."
        },
        {
          quoted: msg
        }
      );
    }

    // ==================================================
    // GET REPLIED USER
    // ==================================================

    const context =
      msg.message
        ?.extendedTextMessage
        ?.contextInfo;

    const repliedParticipant =
      context?.participant ||
      null;

    const repliedRemoteJid =
      context?.remoteJid ||
      null;

    const target =
      repliedParticipant ||
      repliedRemoteJid;

    // ==================================================
    // BLOCK
    // ==================================================

    if (command === "block") {
      if (!target) {
        return sock.sendMessage(
          jid,
          {
            text:
              "🚫 *BLOCK USER*\n\n" +
              "Reply to the user's message with:\n" +
              `${prefix}block`
          },
          {
            quoted: msg
          }
        );
      }

      try {
        await sock.updateBlockStatus(
          target,
          "block"
        );

        return sock.sendMessage(
          jid,
          {
            text:
              "✅ *USER BLOCKED*\n\n" +
              "The selected WhatsApp user was blocked successfully."
          },
          {
            quoted: msg
          }
        );

      } catch (error) {
        console.error(
          "BLOCK ERROR:",
          error
        );

        return sock.sendMessage(
          jid,
          {
            text:
              "❌ *BLOCK FAILED*\n\n" +
              `Error: ${
                error?.message ||
                "Unable to block this user."
              }`
          },
          {
            quoted: msg
          }
        );
      }
    }

    // ==================================================
    // UNBLOCK
    // ==================================================

    if (command === "unblock") {
      if (!target) {
        return sock.sendMessage(
          jid,
          {
            text:
              "✅ *UNBLOCK USER*\n\n" +
              "Reply to the user's message with:\n" +
              `${prefix}unblock`
          },
          {
            quoted: msg
          }
        );
      }

      try {
        await sock.updateBlockStatus(
          target,
          "unblock"
        );

        return sock.sendMessage(
          jid,
          {
            text:
              "✅ *USER UNBLOCKED*\n\n" +
              "The selected WhatsApp user was unblocked successfully."
          },
          {
            quoted: msg
          }
        );

      } catch (error) {
        console.error(
          "UNBLOCK ERROR:",
          error
        );

        return sock.sendMessage(
          jid,
          {
            text:
              "❌ *UNBLOCK FAILED*\n\n" +
              `Error: ${
                error?.message ||
                "Unable to unblock this user."
              }`
          },
          {
            quoted: msg
          }
        );
      }
    }

    // ==================================================
    // RESTART
    // ==================================================

    if (command === "restart") {
      await sock.sendMessage(
        jid,
        {
          text:
            "🔄 *RESTARTING BOT*\n\n" +
            "The bot process is restarting..."
        },
        {
          quoted: msg
        }
      );

      setTimeout(
        () => {
          process.exit(0);
        },
        1500
      );

      return;
    }

    // ==================================================
    // LOGOUT
    // ==================================================

    if (command === "logout") {
      await sock.sendMessage(
        jid,
        {
          text:
            "⚠️ *LOGOUT WARNING*\n\n" +
            "This will disconnect the linked WhatsApp session.\n\n" +
            "Use `.logout confirm` to continue."
        },
        {
          quoted: msg
        }
      );

      return;
    }
  }
};