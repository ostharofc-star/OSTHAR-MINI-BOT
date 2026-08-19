const {
  disableCommand,
  enableCommand,
  getDisabledCommands,
  normalizeCommand
} = require("../database/commandControls");

function digits(value) {
  return String(value || "")
    .split("@")[0]
    .replace(/\D/g, "");
}

function isOwner(msg, phone) {
  if (msg?.key?.fromMe) return true;
  const sender =
    msg?.key?.participant ||
    msg?.participant ||
    msg?.key?.remoteJid ||
    "";
  return digits(sender) === digits(phone);
}

module.exports = {
  name: "disablecmd",
  aliases: ["enablecmd", "cmdstatus"],
  description: "Owner-only command enable/disable controls.",

  async execute({
    sock,
    msg,
    jid,
    phone,
    command,
    args
  }) {
    if (!isOwner(msg, phone)) {
      return sock.sendMessage(
        jid,
        { text: "❌ *OWNER ONLY*" },
        { quoted: msg }
      );
    }

    try {
      if (command === "cmdstatus") {
        const list = await getDisabledCommands(phone);

        return sock.sendMessage(
          jid,
          {
            text:
              "⚙️ *COMMAND STATUS*\n\n" +
              (
                list.length
                  ? "Disabled:\n" + list.map((x) => `• .${x}`).join("\n")
                  : "No commands are disabled."
              )
          },
          { quoted: msg }
        );
      }

      const target = normalizeCommand(args?.[0]);
      if (!target) {
        return sock.sendMessage(
          jid,
          {
            text:
              `Usage:\n.${command} <command>\n\n` +
              `Example:\n.${command} song`
          },
          { quoted: msg }
        );
      }

      if (command === "disablecmd") {
        await disableCommand(phone, target);

        return sock.sendMessage(
          jid,
          { text: `✅ *COMMAND DISABLED*\n\n.${target}` },
          { quoted: msg }
        );
      }

      await enableCommand(phone, target);

      return sock.sendMessage(
        jid,
        { text: `✅ *COMMAND ENABLED*\n\n.${target}` },
        { quoted: msg }
      );
    } catch (error) {
      return sock.sendMessage(
        jid,
        { text: `❌ *COMMAND CONTROL ERROR*\n\n${error?.message || "Unable to update command."}` },
        { quoted: msg }
      );
    }
  }
};
