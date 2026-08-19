const {
  getGroupWelcome,
  setWelcomeMessage,
  setGoodbyeMessage,
  resetGroupWelcome
} = require("../database/groupWelcome");

// ======================================================
// HELPERS
// ======================================================

function isGroup(jid) {
  return String(
    jid || ""
  ).endsWith(
    "@g.us"
  );
}

function getSenderJid(
  msg,
  jid
) {
  return (
    msg?.key?.participant ||
    msg?.participant ||
    jid ||
    ""
  );
}

function jidToNumber(jid) {
  return String(
    jid || ""
  )
    .split("@")[0]
    .replace(
      /\D/g,
      ""
    );
}

// ======================================================
// ADMIN CHECK
// ======================================================

async function isAdmin(
  sock,
  jid,
  userJid
) {
  try {
    const metadata =
      await sock.groupMetadata(
        jid
      );

    const participants =
      Array.isArray(
        metadata?.participants
      )
        ? metadata.participants
        : [];

    const targetNumber =
      jidToNumber(
        userJid
      );

    const participant =
      participants.find(
        item => {
          const id =
            item?.id ||
            item?.jid ||
            "";

          if (
            id === userJid
          ) {
            return true;
          }

          return (
            targetNumber &&
            jidToNumber(id) ===
            targetNumber
          );
        }
      );

    return Boolean(
      participant?.admin ===
        "admin" ||

      participant?.admin ===
        "superadmin" ||

      participant?.isAdmin ||

      participant?.isSuperAdmin
    );

  } catch (error) {
    console.log(
      "WELCOME ADMIN CHECK ERROR:",
      error?.message || error
    );

    return false;
  }
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {
  name: "setwelcome",

  aliases: [
    "setgoodbye",
    "welcomemsg",
    "goodbyemsg",
    "resetwelcome"
  ],

  description:
    "Manage custom group welcome and goodbye messages.",

  reaction: "👋",

  async execute({
    sock,
    msg,
    jid,
    command,
    args,
    query,
    phone
  }) {
    try {

      // ==================================================
      // GROUP ONLY
      // ==================================================

      if (
        !isGroup(jid)
      ) {
        return await sock.sendMessage(
          jid,
          {
            text:
              "❌ *GROUP ONLY*\n\n" +
              "This command can only be used inside WhatsApp groups."
          },
          {
            quoted: msg
          }
        );
      }

      const senderJid =
        getSenderJid(
          msg,
          jid
        );

      // ==================================================
      // VIEW WELCOME MESSAGE
      // ==================================================

      if (
        command ===
        "welcomemsg"
      ) {
        const data =
          await getGroupWelcome(
            phone,
            jid
          );

        const message =
          data?.welcomeMessage ||
          "Welcome {user} to {group}.";

        return await sock.sendMessage(
          jid,
          {
            text:
              "👋 *WELCOME MESSAGE*\n\n" +
              message +
              "\n\n" +
              "Variables:\n" +
              "{user} = Member mention\n" +
              "{number} = Member number\n" +
              "{group} = Group name"
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // VIEW GOODBYE MESSAGE
      // ==================================================

      if (
        command ===
        "goodbyemsg"
      ) {
        const data =
          await getGroupWelcome(
            phone,
            jid
          );

        const message =
          data?.goodbyeMessage ||
          "Goodbye {user}. Take care.";

        return await sock.sendMessage(
          jid,
          {
            text:
              "👋 *GOODBYE MESSAGE*\n\n" +
              message +
              "\n\n" +
              "Variables:\n" +
              "{user} = Member mention\n" +
              "{number} = Member number\n" +
              "{group} = Group name"
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // ADMIN CHECK FOR CHANGES
      // ==================================================

      const senderIsAdmin =
        await isAdmin(
          sock,
          jid,
          senderJid
        );

      if (
        !senderIsAdmin
      ) {
        return await sock.sendMessage(
          jid,
          {
            text:
              "❌ *ADMIN ONLY*\n\n" +
              "Only group admins can change welcome or goodbye messages."
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // SET WELCOME MESSAGE
      // ==================================================

      if (
        command ===
        "setwelcome"
      ) {
        const message =
          String(
            query ||
            args?.join(" ") ||
            ""
          ).trim();

        if (!message) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "👋 *SET WELCOME MESSAGE*\n\n" +
                "Usage:\n" +
                ".setwelcome <message>\n\n" +
                "Example:\n" +
                ".setwelcome Welcome {user} to {group}!\n\n" +
                "Variables:\n" +
                "{user} = Member mention\n" +
                "{number} = Member number\n" +
                "{group} = Group name"
            },
            {
              quoted: msg
            }
          );
        }

        const saved =
          await setWelcomeMessage(
            phone,
            jid,
            message
          );

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *WELCOME MESSAGE UPDATED*\n\n" +
              saved.welcomeMessage
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // SET GOODBYE MESSAGE
      // ==================================================

      if (
        command ===
        "setgoodbye"
      ) {
        const message =
          String(
            query ||
            args?.join(" ") ||
            ""
          ).trim();

        if (!message) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "👋 *SET GOODBYE MESSAGE*\n\n" +
                "Usage:\n" +
                ".setgoodbye <message>\n\n" +
                "Example:\n" +
                ".setgoodbye Goodbye {user}. Thanks for being part of {group}.\n\n" +
                "Variables:\n" +
                "{user} = Member mention\n" +
                "{number} = Member number\n" +
                "{group} = Group name"
            },
            {
              quoted: msg
            }
          );
        }

        const saved =
          await setGoodbyeMessage(
            phone,
            jid,
            message
          );

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *GOODBYE MESSAGE UPDATED*\n\n" +
              saved.goodbyeMessage
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // RESET WELCOME SETTINGS
      // ==================================================

      if (
        command ===
        "resetwelcome"
      ) {
        await resetGroupWelcome(
          phone,
          jid
        );

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *WELCOME SETTINGS RESET*\n\n" +
              "Custom welcome and goodbye messages have been reset to the defaults."
          },
          {
            quoted: msg
          }
        );
      }

    } catch (error) {
      console.log(
        "GROUP WELCOME COMMAND ERROR:",
        error?.message || error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *WELCOME SYSTEM ERROR*\n\n" +
            "Unable to process this request right now."
        },
        {
          quoted: msg
        }
      );
    }
  }
};