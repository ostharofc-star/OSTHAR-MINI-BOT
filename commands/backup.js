const mongoose = require("mongoose");

const {
  downloadTargetMedia,
  getDocumentMeta
} = require("../lib/featureMedia");

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

const COLLECTIONS = [
  "settings",
  "custom_commands",
  "notes",
  "favorites",
  "afk",
  "warnings",
  "group_rules",
  "group_welcome",
  "group_xp",
  "reminders",
  "scheduled_messages",
  "daily_messages",
  "status_schedules",
  "command_controls",
  "group_settings",
  "website_monitors"
];

module.exports = {
  name: "backup",
  aliases: ["restorebackup"],
  description: "Owner-only MongoDB data backup/restore for this linked number.",

  async execute({
    sock,
    msg,
    jid,
    phone,
    command
  }) {
    if (!isOwner(msg, phone)) {
      return sock.sendMessage(
        jid,
        { text: "❌ *OWNER ONLY*" },
        { quoted: msg }
      );
    }

    try {
      if (command === "backup") {
        const db = mongoose.connection.db;
        if (!db) throw new Error("MongoDB is not connected.");

        const payload = {
          format: "OSTHAR-MINI-BOT-BACKUP-v1",
          phone,
          createdAt: new Date().toISOString(),
          collections: {}
        };

        for (const name of COLLECTIONS) {
          try {
            const rows =
              await db.collection(name).find({ phone }).toArray();
            payload.collections[name] = rows;
          } catch {
            payload.collections[name] = [];
          }
        }

        const buffer = Buffer.from(
          JSON.stringify(payload, null, 2),
          "utf8"
        );

        return sock.sendMessage(
          jid,
          {
            document: buffer,
            mimetype: "application/json",
            fileName: `osthar-backup-${phone}-${Date.now()}.json`,
            caption: "✅ OSTHAR MINI BOT backup created."
          },
          { quoted: msg }
        );
      }

      const { buffer, message } =
        await downloadTargetMedia(sock, msg);

      const meta = getDocumentMeta(message);
      if (!meta) {
        throw new Error("Reply to an OSTHAR backup JSON file.");
      }

      const payload = JSON.parse(buffer.toString("utf8"));

      if (
        payload?.format !== "OSTHAR-MINI-BOT-BACKUP-v1" ||
        digits(payload?.phone) !== digits(phone)
      ) {
        throw new Error("This backup does not match this linked WhatsApp number.");
      }

      const db = mongoose.connection.db;
      if (!db) throw new Error("MongoDB is not connected.");

      let restored = 0;

      for (const name of COLLECTIONS) {
        const rows = Array.isArray(payload?.collections?.[name])
          ? payload.collections[name]
          : [];

        for (const row of rows) {
          const copy = { ...row, phone };
          delete copy._id;

          const filter =
            row._id
              ? { _id: row._id }
              : {
                  phone,
                  ...(row.groupJid ? { groupJid: row.groupJid } : {}),
                  ...(row.userJid ? { userJid: row.userJid } : {}),
                  ...(row.command ? { command: row.command } : {}),
                  ...(row.name ? { name: row.name } : {}),
                  ...(row.url ? { url: row.url } : {})
                };

          try {
            if (row._id) {
              const id = new mongoose.Types.ObjectId(String(row._id));
              await db.collection(name).updateOne(
                { _id: id },
                { $set: copy },
                { upsert: true }
              );
            } else {
              await db.collection(name).updateOne(
                filter,
                { $set: copy },
                { upsert: true }
              );
            }
            restored++;
          } catch {}
        }
      }

      return sock.sendMessage(
        jid,
        {
          text:
            "✅ *BACKUP RESTORED*\n\n" +
            `Records processed: ${restored}\n\n` +
            "Restart the bot if you want every in-memory feature to refresh immediately."
        },
        { quoted: msg }
      );
    } catch (error) {
      return sock.sendMessage(
        jid,
        { text: `❌ *BACKUP ERROR*\n\n${error?.message || "Unable to process backup."}` },
        { quoted: msg }
      );
    }
  }
};
