const {
  getBotMode,
  setBotMode
} = require("../database/botMode");

function digits(value) {
  return String(value || "")
    .split("@")[0]
    .replace(/\D/g, "");
}

function isOwner(
  msg,
  phone
) {
  if (
    msg?.key?.fromMe
  ) {
    return true;
  }

  const sender =
    msg?.key?.participant ||
    msg?.participant ||
    msg?.key?.remoteJid ||
    "";

  return (
    digits(sender) ===
    digits(phone)
  );
}

module.exports = {
  name:
    "public",

  aliases: [
    "private",
    "mode"
  ],

  description:
    "Change or view bot public/private mode.",

  async execute({
    sock,
    msg,
    jid,
    phone,
    command
  }) {
    if (
      command === "mode"
    ) {
      const mode =
        await getBotMode(
          phone
        );

      return sock.sendMessage(
        jid,
        {
          text:
            "⚙️ *BOT MODE*\n\n" +
            `Current Mode: *${mode.toUpperCase()}*\n\n` +
            "PUBLIC = Everyone can use commands.\n" +
            "PRIVATE = Only the linked account owner can use commands."
        },
        {
          quoted:
            msg
        }
      );
    }

    if (
      !isOwner(
        msg,
        phone
      )
    ) {
      return sock.sendMessage(
        jid,
        {
          text:
            "❌ *OWNER ONLY*\n\n" +
            "Only the linked WhatsApp account owner can change bot mode."
        },
        {
          quoted:
            msg
        }
      );
    }

    const mode =
      command === "private"
        ? "private"
        : "public";

    await setBotMode(
      phone,
      mode
    );

    return sock.sendMessage(
      jid,
      {
        text:
          mode === "public"
            ? "🌍 *PUBLIC MODE ENABLED*\n\nEveryone can now use bot commands."
            : "🔒 *PRIVATE MODE ENABLED*\n\nOnly the linked account owner can use bot commands."
      },
      {
        quoted:
          msg
      }
    );
  }
};
