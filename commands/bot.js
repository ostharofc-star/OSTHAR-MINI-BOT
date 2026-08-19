const {
  createPendingLink
} = require("../lib/linkFlow");

module.exports = {
  name: "bot",
  aliases: [
    "linkbot",
    "connectbot"
  ],
  description: "Link OSTHAR MINI BOT to a WhatsApp number.",
  reaction: "🤖",

  async execute({
    sock,
    msg,
    jid,
    args,
    query
  }) {
    try {
      // ==========================================
      // GET PHONE NUMBER
      // ==========================================

      const rawNumber =
        query ||
        args?.join(" ") ||
        "";

      const phone =
        String(rawNumber)
          .replace(/[^0-9]/g, "")
          .trim();

      // ==========================================
      // VALIDATE NUMBER
      // ==========================================

      if (
        !phone ||
        phone.length < 8 ||
        phone.length > 15
      ) {
        return await sock.sendMessage(
          jid,
          {
            text:
              "╭━━━〔 *LINK BOT* 〕━━━╮\n\n" +
              "❌ *INVALID NUMBER*\n\n" +
              "Please enter your WhatsApp number with country code.\n\n" +
              "*Example:*\n" +
              ".bot 94771234567\n\n" +
              "Do not use the + symbol.\n\n" +
              "╰━━━━━━━━━━━━━━━━━━━━╯"
          },
          {
            quoted: msg
          }
        );
      }

      // ==========================================
      // GET REQUESTER
      // ==========================================

      const requesterJid =
        msg.key.participant ||
        msg.key.remoteJid ||
        jid;

      // ==========================================
      // SAVE PENDING LINK REQUEST
      // ==========================================

      createPendingLink({
        requesterJid,
        phone
      });

      // ==========================================
      // SEND LINK MENU
      // ==========================================

      await sock.sendMessage(
        jid,
        {
          text:
            "╭━━━〔 *OSTHAR MINI BOT* 〕━━━╮\n\n" +

            "🔗 *LINK YOUR BOT*\n\n" +

            `📱 Phone: *+${phone}*\n\n` +

            "*Choose a linking method:*\n\n" +

            "1️⃣ *QR CODE*\n" +
            "Scan a QR code using WhatsApp Linked Devices.\n\n" +

            "2️⃣ *PAIRING CODE*\n" +
            "Link using a WhatsApp pairing code.\n\n" +

            "↩️ *Reply with:*\n" +
            "*1* for QR Code\n" +
            "*2* for Pairing Code\n\n" +

            "This request will expire in 5 minutes.\n\n" +

            "╰━━━━━━━━━━━━━━━━━━━━╯"
        },
        {
          quoted: msg
        }
      );

    } catch (error) {
      console.log(
        "BOT LINK COMMAND ERROR:",
        error?.message || error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *LINK ERROR*\n\n" +
            "Unable to prepare the bot linking process.\n\n" +
            "Please try again."
        },
        {
          quoted: msg
        }
      );
    }
  }
};