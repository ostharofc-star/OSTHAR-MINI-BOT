const {
  createDailyMessage,
  getUserDailyMessages,
  deleteDailyMessageByIndex,
  clearUserDailyMessages,
  setDailyMessageEnabled
} = require("../database/dailyMessages");

// ======================================================
// HELPERS
// ======================================================

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

function isValidTime(
  value
) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(
    String(
      value || ""
    ).trim()
  );
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {
  name: "dailymsg",

  aliases: [
    "dailymsgs",
    "deldailymsg",
    "deletedailymsg",
    "dailymessageoff",
    "dailymessageon",
    "cleardailymsgs"
  ],

  description:
    "Create and manage daily automatic messages.",

  reaction:
    "🕒",

  async execute({
    sock,
    msg,
    jid,
    command,
    args,
    phone
  }) {
    try {
      const sender =
        getSenderJid(
          msg,
          jid
        );

      if (!sender) {
        return;
      }

      // ==================================================
      // LIST DAILY MESSAGES
      // ==================================================

      if (
        command ===
        "dailymsgs"
      ) {
        const list =
          await getUserDailyMessages({
            phone,

            createdBy:
              sender,

            limit:
              20
          });

        if (
          !list.length
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "🕒 *DAILY MESSAGES*\n\n" +
                "You do not have any daily messages."
            },
            {
              quoted:
                msg
            }
          );
        }

        let text =
          "🕒 *YOUR DAILY MESSAGES*\n\n";

        list.forEach(
          (
            item,
            index
          ) => {
            const status =
              item.enabled
                ? "ON"
                : "OFF";

            text +=
              `${index + 1}. ${item.time}\n` +
              `   Status: ${status}\n` +
              `   Message: ${item.message}\n\n`;
          }
        );

        text +=
          "Manage:\n" +
          ".deldailymsg <number>\n" +
          ".dailymessageon <number>\n" +
          ".dailymessageoff <number>";

        return await sock.sendMessage(
          jid,
          {
            text:
              text.trim()
          },
          {
            quoted:
              msg
          }
        );
      }

      // ==================================================
      // DELETE DAILY MESSAGE
      // ==================================================

      if (
        command ===
          "deldailymsg" ||
        command ===
          "deletedailymsg"
      ) {
        const index =
          Number(
            args?.[0]
          );

        if (
          !Number.isInteger(
            index
          ) ||
          index <= 0
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "🗑️ *DELETE DAILY MESSAGE*\n\n" +
                "Usage:\n" +
                ".deldailymsg <number>\n\n" +
                "Example:\n" +
                ".deldailymsg 1"
            },
            {
              quoted:
                msg
            }
          );
        }

        const deleted =
          await deleteDailyMessageByIndex({
            phone,

            createdBy:
              sender,

            index
          });

        if (!deleted) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *DAILY MESSAGE NOT FOUND*\n\n" +
                "Use *.dailymsgs* to view your list."
            },
            {
              quoted:
                msg
            }
          );
        }

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *DAILY MESSAGE DELETED*\n\n" +
              deleted.message
          },
          {
            quoted:
              msg
          }
        );
      }

      // ==================================================
      // ENABLE DAILY MESSAGE
      // ==================================================

      if (
        command ===
        "dailymessageon"
      ) {
        const index =
          Number(
            args?.[0]
          );

        if (
          !Number.isInteger(
            index
          ) ||
          index <= 0
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "🕒 *ENABLE DAILY MESSAGE*\n\n" +
                "Usage:\n" +
                ".dailymessageon <number>"
            },
            {
              quoted:
                msg
            }
          );
        }

        const result =
          await setDailyMessageEnabled({
            phone,

            createdBy:
              sender,

            index,

            enabled:
              true
          });

        if (!result) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *DAILY MESSAGE NOT FOUND*\n\n" +
                "Use *.dailymsgs* to view your list."
            },
            {
              quoted:
                msg
            }
          );
        }

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *DAILY MESSAGE ENABLED*\n\n" +
              `Time: ${result.time}\n` +
              `Message: ${result.message}`
          },
          {
            quoted:
              msg
          }
        );
      }

      // ==================================================
      // DISABLE DAILY MESSAGE
      // ==================================================

      if (
        command ===
        "dailymessageoff"
      ) {
        const index =
          Number(
            args?.[0]
          );

        if (
          !Number.isInteger(
            index
          ) ||
          index <= 0
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "🕒 *DISABLE DAILY MESSAGE*\n\n" +
                "Usage:\n" +
                ".dailymessageoff <number>"
            },
            {
              quoted:
                msg
            }
          );
        }

        const result =
          await setDailyMessageEnabled({
            phone,

            createdBy:
              sender,

            index,

            enabled:
              false
          });

        if (!result) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *DAILY MESSAGE NOT FOUND*\n\n" +
                "Use *.dailymsgs* to view your list."
            },
            {
              quoted:
                msg
            }
          );
        }

        return await sock.sendMessage(
          jid,
          {
            text:
              "⏸️ *DAILY MESSAGE DISABLED*\n\n" +
              `Time: ${result.time}\n` +
              `Message: ${result.message}`
          },
          {
            quoted:
              msg
          }
        );
      }

      // ==================================================
      // CLEAR DAILY MESSAGES
      // ==================================================

      if (
        command ===
        "cleardailymsgs"
      ) {
        const result =
          await clearUserDailyMessages({
            phone,

            createdBy:
              sender
          });

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *DAILY MESSAGES CLEARED*\n\n" +
              `Deleted: ${result?.deletedCount || 0}`
          },
          {
            quoted:
              msg
          }
        );
      }

      // ==================================================
      // CREATE DAILY MESSAGE
      // ==================================================

      const time =
        String(
          args?.[0] ||
          ""
        ).trim();

      if (
        !isValidTime(
          time
        )
      ) {
        return await sock.sendMessage(
          jid,
          {
            text:
              "🕒 *CREATE DAILY MESSAGE*\n\n" +
              "Usage:\n" +
              ".dailymsg HH:MM <message>\n\n" +
              "Examples:\n" +
              ".dailymsg 08:00 Good morning everyone\n" +
              ".dailymsg 21:30 Good night everyone\n\n" +
              "Use 24-hour time format."
          },
          {
            quoted:
              msg
          }
        );
      }

      const message =
        String(
          args
            ?.slice(1)
            ?.join(" ") ||
          ""
        ).trim();

      if (!message) {
        return await sock.sendMessage(
          jid,
          {
            text:
              "❌ *MESSAGE REQUIRED*\n\n" +
              "Example:\n" +
              ".dailymsg 08:00 Good morning everyone"
          },
          {
            quoted:
              msg
          }
        );
      }

      const daily =
        await createDailyMessage({
          phone,

          chatJid:
            jid,

          createdBy:
            sender,

          time,

          message
        });

      return await sock.sendMessage(
        jid,
        {
          text:
            "✅ *DAILY MESSAGE CREATED*\n\n" +
            `Time: ${daily.time}\n` +
            `Message: ${daily.message}\n` +
            "Status: ON"
        },
        {
          quoted:
            msg
        }
      );

    } catch (error) {
      console.log(
        "DAILY MESSAGE COMMAND ERROR:",
        error?.message ||
        error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *DAILY MESSAGE ERROR*\n\n" +
            "Unable to process this request right now."
        },
        {
          quoted:
            msg
        }
      );
    }
  }
};