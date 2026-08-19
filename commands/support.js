const {
  sendSuccess,
  sendError,
  usage
} = require("../lib/messages");

function cleanNumber(value = "") {
  return String(value)
    .replace(/[^0-9]/g, "");
}

function numberToJid(number = "") {
  const clean =
    cleanNumber(number);

  return clean
    ? `${clean}@s.whatsapp.net`
    : null;
}

module.exports = {
  name: "support",

  aliases: [
    "report",
    "feedback"
  ],

  description:
    "Send feedback and reports.",

  reaction: "📩",

  async execute({
    sock,
    msg,
    jid,
    command,
    query,
    phone,
    settings
  }) {
    const prefix =
      settings?.prefix || ".";

    if (!query) {
      return sock.sendMessage(
        jid,
        {
          text: usage({
            title:
              command === "report"
                ? "REPORT A PROBLEM"
                : "SEND FEEDBACK",

            usage:
              `${prefix}${command} <message>`,

            example:
              command === "report"
                ? `${prefix}report video command is not working`
                : `${prefix}feedback please add a new feature`
          })
        },
        { quoted: msg }
      );
    }

    const owner =
      numberToJid(phone);

    if (!owner) {
      return sendError(
        sock,
        jid,
        msg,
        "Owner destination is unavailable.",
        "SUPPORT FAILED"
      );
    }

    const sender =
      msg.key.participant ||
      msg.key.remoteJid ||
      "Unknown";

    const title =
      command === "report"
        ? "🐞 NEW REPORT"
        : "💬 NEW FEEDBACK";

    const body =
      `╭━━━〔 *${title}* 〕━━━╮\n\n` +
      `Sender: ${sender}\n` +
      `Chat: ${jid}\n` +
      `Date: ${new Date().toLocaleString("en-US", {
        timeZone:
          "Asia/Colombo"
      })}\n\n` +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      `${query}\n\n` +
      "╰━━━━━━━━━━━━━━━━━━━━╯";

    try {
      await sock.sendMessage(
        owner,
        { text: body }
      );

      return sendSuccess(
        sock,
        jid,
        msg,
        command === "report"
          ? "Your report was successfully sent to the bot owner."
          : "Your feedback was successfully sent to the bot owner.",
        command === "report"
          ? "REPORT SENT"
          : "FEEDBACK SENT"
      );

    } catch (error) {
      return sendError(
        sock,
        jid,
        msg,
        error.message,
        "SUPPORT FAILED"
      );
    }
  }
};