const {
  createReminder,
  getUserReminders,
  deleteReminderByIndex,
  clearUserReminders
} = require("../database/reminders");

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

// ======================================================
// TIME PARSER
// Supports:
// 10s
// 5m
// 2h
// 3d
// ======================================================

function parseDuration(
  value
) {
  const text =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  const match =
    text.match(
      /^(\d+)(s|m|h|d)$/
    );

  if (!match) {
    return null;
  }

  const amount =
    Number(
      match[1]
    );

  const unit =
    match[2];

  if (
    !Number.isFinite(
      amount
    ) ||
    amount <= 0
  ) {
    return null;
  }

  const units = {
    s: 1000,

    m:
      60 * 1000,

    h:
      60 *
      60 *
      1000,

    d:
      24 *
      60 *
      60 *
      1000
  };

  return (
    amount *
    units[unit]
  );
}

// ======================================================
// FORMAT DATE
// ======================================================

function formatDate(
  date
) {
  try {
    return new Date(
      date
    ).toLocaleString(
      "en-LK",
      {
        timeZone:
          "Asia/Colombo",

        year:
          "numeric",

        month:
          "short",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit"
      }
    );

  } catch {
    return String(
      date
    );
  }
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {
  name: "remind",

  aliases: [
    "reminder",
    "reminders",
    "delreminder",
    "deletereminder",
    "clearreminders"
  ],

  description:
    "Create and manage personal reminders.",

  reaction:
    "⏰",

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
      // LIST REMINDERS
      // ==================================================

      if (
        command ===
        "reminders"
      ) {
        const list =
          await getUserReminders({
            phone,

            userJid:
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
                "⏰ *YOUR REMINDERS*\n\n" +
                "You do not have any active reminders."
            },
            {
              quoted:
                msg
            }
          );
        }

        let text =
          "⏰ *YOUR REMINDERS*\n\n";

        list.forEach(
          (
            reminder,
            index
          ) => {
            text +=
              `${index + 1}. ${reminder.message}\n` +
              `   Time: ${formatDate(reminder.remindAt)}\n\n`;
          }
        );

        text +=
          "Delete a reminder:\n" +
          ".delreminder <number>";

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
      // DELETE REMINDER
      // ==================================================

      if (
        command ===
          "delreminder" ||
        command ===
          "deletereminder"
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
                "🗑️ *DELETE REMINDER*\n\n" +
                "Usage:\n" +
                ".delreminder <number>\n\n" +
                "Example:\n" +
                ".delreminder 1"
            },
            {
              quoted:
                msg
            }
          );
        }

        const deleted =
          await deleteReminderByIndex({
            phone,

            userJid:
              sender,

            index
          });

        if (!deleted) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *REMINDER NOT FOUND*\n\n" +
                "Use *.reminders* to see your active reminder numbers."
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
              "✅ *REMINDER DELETED*\n\n" +
              deleted.message
          },
          {
            quoted:
              msg
          }
        );
      }

      // ==================================================
      // CLEAR REMINDERS
      // ==================================================

      if (
        command ===
        "clearreminders"
      ) {
        const result =
          await clearUserReminders({
            phone,

            userJid:
              sender
          });

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *REMINDERS CLEARED*\n\n" +
              `Deleted: ${result?.deletedCount || 0}`
          },
          {
            quoted:
              msg
          }
        );
      }

      // ==================================================
      // CREATE REMINDER
      // ==================================================

      const timeText =
        args?.[0];

      const duration =
        parseDuration(
          timeText
        );

      if (!duration) {
        return await sock.sendMessage(
          jid,
          {
            text:
              "⏰ *CREATE REMINDER*\n\n" +
              "Usage:\n" +
              ".remind <time> <message>\n\n" +
              "Examples:\n" +
              ".remind 10m Drink water\n" +
              ".remind 1h Check website\n" +
              ".remind 2d Renew domain\n\n" +
              "Time units:\n" +
              "s = seconds\n" +
              "m = minutes\n" +
              "h = hours\n" +
              "d = days"
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
              ".remind 10m Drink water"
          },
          {
            quoted:
              msg
          }
        );
      }

      // Maximum 30 days
      const maxDuration =
        30 *
        24 *
        60 *
        60 *
        1000;

      if (
        duration >
        maxDuration
      ) {
        return await sock.sendMessage(
          jid,
          {
            text:
              "❌ *TIME TOO LONG*\n\n" +
              "Maximum reminder duration is 30 days."
          },
          {
            quoted:
              msg
          }
        );
      }

      const remindAt =
        new Date(
          Date.now() +
          duration
        );

      const reminder =
        await createReminder({
          phone,

          chatJid:
            jid,

          userJid:
            sender,

          message,

          remindAt
        });

      return await sock.sendMessage(
        jid,
        {
          text:
            "✅ *REMINDER CREATED*\n\n" +
            `Message: ${reminder.message}\n` +
            `Time: ${formatDate(reminder.remindAt)}`
        },
        {
          quoted:
            msg
        }
      );

    } catch (error) {
      console.log(
        "REMINDER COMMAND ERROR:",
        error?.message ||
        error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *REMINDER ERROR*\n\n" +
            "Unable to process this reminder right now."
        },
        {
          quoted:
            msg
        }
      );
    }
  }
};