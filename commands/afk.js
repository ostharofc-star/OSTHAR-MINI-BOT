const {
  enableAFK,
  disableAFK,
  getAFK
} = require("../database/afk");

// ======================================================
// FORMAT DURATION
// ======================================================

function formatDuration(ms) {
  if (!ms || ms < 0) {
    return "0s";
  }

  const seconds =
    Math.floor(
      ms / 1000
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

// ======================================================
// COMMAND
// ======================================================

module.exports = {
  name: "afk",

  aliases: [
    "back",
    "unafk"
  ],

  description:
    "Enable or disable AFK mode.",

  reaction: "💤",

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
      // ENABLE AFK
      // ==================================================

      if (
        command === "afk"
      ) {
        const reason =
          String(
            query ||
            args?.join(" ") ||
            ""
          ).trim();

        const data =
          await enableAFK(
            phone,
            reason
          );

        return await sock.sendMessage(
          jid,
          {
            text:
              "💤 *AFK MODE ENABLED*\n\n" +
              `Reason: ${data.reason}\n\n` +
              "Use *.back* when you return."
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // DISABLE AFK
      // ==================================================

      if (
        command === "back" ||
        command === "unafk"
      ) {
        const current =
          await getAFK(
            phone
          );

        if (
          !current?.enabled
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "ℹ️ *AFK MODE*\n\n" +
                "AFK mode is already OFF."
            },
            {
              quoted: msg
            }
          );
        }

        const duration =
          current.since
            ? formatDuration(
                Date.now() -
                new Date(
                  current.since
                ).getTime()
              )
            : "Unknown";

        await disableAFK(
          phone
        );

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *WELCOME BACK*\n\n" +
              "AFK mode has been disabled.\n\n" +
              `AFK Duration: ${duration}`
          },
          {
            quoted: msg
          }
        );
      }

    } catch (error) {
      console.log(
        "AFK COMMAND ERROR:",
        error?.message || error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *AFK ERROR*\n\n" +
            "Unable to update AFK mode right now."
        },
        {
          quoted: msg
        }
      );
    }
  }
};