const mongoose = require("mongoose");

const allowedKeys = [
  "antiLink",
  "antiSpam",
  "autoReply",
  "autoRead",
  "autoReact",
  "autoTyping"
];

const groupSettingsSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  groupJid: { type: String, required: true, index: true },
  overrides: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now }
}, { collection: "group_settings" });

groupSettingsSchema.index(
  { phone: 1, groupJid: 1 },
  { unique: true }
);

const GroupSettings =
  mongoose.models.GroupSettings ||
  mongoose.model("GroupSettings", groupSettingsSchema);

function normalizeKey(key) {
  const raw = String(key || "").trim().toLowerCase();
  const map = {
    antilink: "antiLink",
    antispam: "antiSpam",
    autoreply: "autoReply",
    autoread: "autoRead",
    autoreact: "autoReact",
    autotyping: "autoTyping"
  };
  return map[raw] || null;
}

async function getGroupSettings(phone, groupJid) {
  if (!phone || !groupJid) return null;
  return GroupSettings.findOne({ phone, groupJid }).lean();
}

async function setGroupSetting(phone, groupJid, key, value) {
  const normalized = normalizeKey(key);
  if (!normalized || !allowedKeys.includes(normalized)) {
    throw new Error("Unsupported group setting.");
  }

  return GroupSettings.findOneAndUpdate(
    { phone, groupJid },
    {
      $set: {
        [`overrides.${normalized}`]: Boolean(value),
        updatedAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function resetGroupSettings(phone, groupJid) {
  return GroupSettings.deleteOne({ phone, groupJid });
}

async function mergeGroupSettings(phone, groupJid, baseSettings) {
  const row = await getGroupSettings(phone, groupJid);
  if (!row?.overrides) return baseSettings;

  return {
    ...baseSettings,
    ...row.overrides
  };
}

module.exports = {
  GroupSettings,
  allowedKeys,
  normalizeKey,
  getGroupSettings,
  setGroupSetting,
  resetGroupSettings,
  mergeGroupSettings
};
