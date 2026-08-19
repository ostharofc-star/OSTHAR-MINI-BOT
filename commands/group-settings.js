const {
  getGroupSettings,
  setGroupSetting,
  resetGroupSettings,
  normalizeKey
} = require("../database/groupSettings");

function isGroup(jid) {
  return String(jid || "").endsWith("@g.us");
}

async function isAdmin(sock, jid, msg) {
  const sender =
    msg?.key?.participant ||
    msg?.participant ||
    "";

  if (msg?.key?.fromMe) return true;

  const metadata = await sock.groupMetadata(jid);
  const participant = metadata.participants.find(
    (p) => p.id === sender || p.lid === sender
  );

  return !!participant?.admin;
}

module.exports = {
  name: "groupsetting",
  aliases: ["groupsettings", "resetgroupsettings"],
  description: "Per-group overrides for selected automation settings.",

  async execute({
    sock,
    msg,
    jid,
    phone,
    command,
    args
  }) {
    if (!isGroup(jid)) {
      return sock.sendMessage(
        jid,
        { text: "❌ *GROUP ONLY*\n\nThis command only works in WhatsApp groups." },
        { quoted: msg }
      );
    }

    try {
      if (command === "groupsettings") {
        const row = await getGroupSettings(phone, jid);
        const o = row?.overrides || {};

        return sock.sendMessage(
          jid,
          {
            text:
              "⚙️ *GROUP SETTINGS OVERRIDES*\n\n" +
              `Anti Link: ${o.antiLink === undefined ? "DEFAULT" : o.antiLink ? "ON" : "OFF"}\n` +
              `Anti Spam: ${o.antiSpam === undefined ? "DEFAULT" : o.antiSpam ? "ON" : "OFF"}\n` +
              `Auto Reply: ${o.autoReply === undefined ? "DEFAULT" : o.autoReply ? "ON" : "OFF"}\n` +
              `Auto Read: ${o.autoRead === undefined ? "DEFAULT" : o.autoRead ? "ON" : "OFF"}\n` +
              `Auto React: ${o.autoReact === undefined ? "DEFAULT" : o.autoReact ? "ON" : "OFF"}\n` +
              `Auto Typing: ${o.autoTyping === undefined ? "DEFAULT" : o.autoTyping ? "ON" : "OFF"}`
          },
          { quoted: msg }
        );
      }

      if (!(await isAdmin(sock, jid, msg))) {
        return sock.sendMessage(
          jid,
          { text: "❌ *ADMIN ONLY*\n\nOnly group admins can change group settings." },
          { quoted: msg }
        );
      }

      if (command === "resetgroupsettings") {
        await resetGroupSettings(phone, jid);
        return sock.sendMessage(
          jid,
          { text: "✅ *GROUP SETTINGS RESET*\n\nThis group now uses the bot's global settings." },
          { quoted: msg }
        );
      }

      const key = normalizeKey(args?.[0]);
      const state = String(args?.[1] || "").toLowerCase();

      if (!key || !["on", "off"].includes(state)) {
        return sock.sendMessage(
          jid,
          {
            text:
              "⚙️ *GROUP SETTING*\n\n" +
              "Usage: .groupsetting <setting> <on/off>\n\n" +
              "Settings:\n" +
              "antilink\nantispam\nautoreply\nautoread\nautoreact\nautotyping\n\n" +
              "Example: .groupsetting antilink on"
          },
          { quoted: msg }
        );
      }

      await setGroupSetting(
        phone,
        jid,
        key,
        state === "on"
      );

      return sock.sendMessage(
        jid,
        {
          text:
            "✅ *GROUP SETTING UPDATED*\n\n" +
            `${key}: ${state.toUpperCase()}`
        },
        { quoted: msg }
      );
    } catch (error) {
      return sock.sendMessage(
        jid,
        { text: `❌ *GROUP SETTINGS ERROR*\n\n${error?.message || "Unable to update group settings."}` },
        { quoted: msg }
      );
    }
  }
};
