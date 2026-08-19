const {
  createStatusSchedule,
  getUserStatusSchedules,
  deleteStatusScheduleByIndex,
  clearUserStatusSchedules
} = require("../database/statusSchedules");

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
  name: "statusschedule",

  aliases: [
    "statusschedules",
    "delstatusschedule",
    "deletestatusschedule",
    "clearstatusschedules"
  ],

  description:
    "Create and manage scheduled WhatsApp text statuses.",

  reaction:
    "🟢",

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
      // LIST STATUS SCHEDULES
      // ==================================================

      if (
        command ===
        "statusschedules"
      ) {
        const list =
          await getUserStatusSchedules({
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
                "🟢 *STATUS SCHEDULES*\n\n" +
                "You do not have any active scheduled statuses."
            },
            {
              quoted:
                msg
            }
          );
        }

        let text =
          "🟢 *YOUR STATUS SCHEDULES*\n\n";

        list.forEach(
          (
            item,
            index
          ) => {
            text +=
              `${index + 1}. ${item.text}\n` +
              `   Post At: ${formatDate(item.sendAt)}\n\n`;
          }
        );

        text +=
          "Delete a scheduled status:\n" +
          ".delstatusschedule <number>";

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
      // DELETE STATUS SCHEDULE
      // ==================================================

      if (
        command ===
          "delstatusschedule" ||
        command ===
          "deletestatusschedule"
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
                "🗑️ *DELETE STATUS SCHEDULE*\n\n" +
                "Usage:\n" +
                ".delstatusschedule <number>\n\n" +
                "Example:\n" +
                ".delstatusschedule 1"
            },
            {
              quoted:
                msg
            }
          );
        }

        const deleted =
          await deleteStatusScheduleByIndex({
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
                "❌ *STATUS SCHEDULE NOT FOUND*\n\n" +
                "Use *.statusschedules* to view your list."
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
              "✅ *STATUS SCHEDULE DELETED*\n\n" +
              deleted.text
          },
          {
            quoted:
              msg
          }
        );
      }

      // ==================================================
      // CLEAR STATUS SCHEDULES
      // ==================================================

      if (
        command ===
        "clearstatusschedules"
      ) {
        const result =
          await clearUserStatusSchedules({
            phone,

            createdBy:
              sender
          });

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *STATUS SCHEDULES CLEARED*\n\n" +
              `Deleted: ${result?.deletedCount || 0}`
          },
          {
            quoted:
              msg
          }
        );
      }

      // ==================================================
      // CREATE STATUS SCHEDULE
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
              "🟢 *SCHEDULE STATUS*\n\n" +
              "Usage:\n" +
              ".statusschedule <time> <text>\n\n" +
              "Examples:\n" +
              ".statusschedule 10m Good morning\n" +
              ".statusschedule 1h New update available\n" +
              ".statusschedule 2d Have a great day\n\n" +
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

      const statusText =
        String(
          args
            ?.slice(1)
            ?.join(" ") ||
          ""
        ).trim();

      if (!statusText) {
        return await sock.sendMessage(
          jid,
          {
            text:
              "❌ *STATUS TEXT REQUIRED*\n\n" +
              "Example:\n" +
              ".statusschedule 10m Good morning everyone"
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
        await createStatusSchedule({
          phone,

          createdBy:
            sender,

          text:
            statusText,

          sendAt
        });

      return await sock.sendMessage(
        jid,
        {
          text:
            "✅ *STATUS SCHEDULED*\n\n" +
            `Text: ${schedule.text}\n` +
            `Post At: ${formatDate(schedule.sendAt)}`
        },
        {
          quoted:
            msg
        }
      );

    } catch (error) {
      console.log(
        "STATUS SCHEDULE COMMAND ERROR:",
        error?.message ||
        error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *STATUS SCHEDULE ERROR*\n\n" +
            "Unable to process this scheduled status right now."
        },
        {
          quoted:
            msg
        }
      );
    }
  }
};