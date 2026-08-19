const {
  createSchedule,
  getUserSchedules,
  deleteScheduleByIndex,
  clearUserSchedules
} = require("../database/schedules");

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
  name: "schedule",

  aliases: [
    "schedules",
    "delschedule",
    "deleteschedule",
    "clearschedules"
  ],

  description:
    "Create and manage scheduled messages.",

  reaction:
    "📅",

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
      // LIST SCHEDULES
      // ==================================================

      if (
        command ===
        "schedules"
      ) {
        const list =
          await getUserSchedules({
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
                "📅 *SCHEDULED MESSAGES*\n\n" +
                "You do not have any active scheduled messages."
            },
            {
              quoted:
                msg
            }
          );
        }

        let text =
          "📅 *YOUR SCHEDULED MESSAGES*\n\n";

        list.forEach(
          (
            item,
            index
          ) => {
            text +=
              `${index + 1}. ${item.message}\n` +
              `   Send At: ${formatDate(item.sendAt)}\n\n`;
          }
        );

        text +=
          "Delete a schedule:\n" +
          ".delschedule <number>";

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
      // DELETE SCHEDULE
      // ==================================================

      if (
        command ===
          "delschedule" ||
        command ===
          "deleteschedule"
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
                "🗑️ *DELETE SCHEDULE*\n\n" +
                "Usage:\n" +
                ".delschedule <number>\n\n" +
                "Example:\n" +
                ".delschedule 1"
            },
            {
              quoted:
                msg
            }
          );
        }

        const deleted =
          await deleteScheduleByIndex({
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
                "❌ *SCHEDULE NOT FOUND*\n\n" +
                "Use *.schedules* to see your active schedule numbers."
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
              "✅ *SCHEDULE DELETED*\n\n" +
              deleted.message
          },
          {
            quoted:
              msg
          }
        );
      }

      // ==================================================
      // CLEAR SCHEDULES
      // ==================================================

      if (
        command ===
        "clearschedules"
      ) {
        const result =
          await clearUserSchedules({
            phone,

            createdBy:
              sender
          });

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *SCHEDULES CLEARED*\n\n" +
              `Deleted: ${result?.deletedCount || 0}`
          },
          {
            quoted:
              msg
          }
        );
      }

      // ==================================================
      // CREATE SCHEDULE
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
              "📅 *CREATE SCHEDULE*\n\n" +
              "Usage:\n" +
              ".schedule <time> <message>\n\n" +
              "Examples:\n" +
              ".schedule 10m Hello everyone\n" +
              ".schedule 1h Meeting starts soon\n" +
              ".schedule 2d Weekly update\n\n" +
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
              ".schedule 10m Hello everyone"
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
              "Maximum schedule duration is 30 days."
          },
          {
            quoted:
              msg
          }
        );
      }

      const sendAt =
        new Date(
          Date.now() +
          duration
        );

      const schedule =
        await createSchedule({
          phone,

          chatJid:
            jid,

          createdBy:
            sender,

          message,

          sendAt
        });

      return await sock.sendMessage(
        jid,
        {
          text:
            "✅ *MESSAGE SCHEDULED*\n\n" +
            `Message: ${schedule.message}\n` +
            `Send At: ${formatDate(schedule.sendAt)}`
        },
        {
          quoted:
            msg
        }
      );

    } catch (error) {
      console.log(
        "SCHEDULE COMMAND ERROR:",
        error?.message ||
        error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *SCHEDULE ERROR*\n\n" +
            "Unable to process this scheduled message right now."
        },
        {
          quoted:
            msg
        }
      );
    }
  }
};