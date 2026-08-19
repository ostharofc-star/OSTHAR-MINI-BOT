const mongoose = require("mongoose");

const websiteMonitorSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  createdBy: { type: String, required: true, index: true },
  notifyJid: { type: String, required: true },
  url: { type: String, required: true },
  name: { type: String, default: "" },
  enabled: { type: Boolean, default: true, index: true },
  lastStatus: { type: String, default: "unknown" },
  lastStatusCode: { type: Number, default: null },
  lastCheckedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: "website_monitors" });

websiteMonitorSchema.index(
  { phone: 1, createdBy: 1, url: 1 },
  { unique: true }
);

const WebsiteMonitor =
  mongoose.models.WebsiteMonitor ||
  mongoose.model("WebsiteMonitor", websiteMonitorSchema);

async function addWebsiteMonitor({
  phone,
  createdBy,
  notifyJid,
  url,
  name = ""
}) {
  return WebsiteMonitor.findOneAndUpdate(
    { phone, createdBy, url },
    {
      $set: {
        notifyJid,
        name: String(name || "").trim().slice(0, 80),
        enabled: true,
        updatedAt: new Date()
      },
      $setOnInsert: {
        lastStatus: "unknown",
        lastStatusCode: null,
        lastCheckedAt: null,
        createdAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function getUserWebsiteMonitors({
  phone,
  createdBy,
  limit = 20
}) {
  return WebsiteMonitor.find({
    phone,
    createdBy,
    enabled: true
  })
    .sort({ createdAt: 1 })
    .limit(Math.max(1, Math.min(100, Number(limit) || 20)));
}

async function getEnabledWebsiteMonitors({
  limit = 300
} = {}) {
  return WebsiteMonitor.find({ enabled: true })
    .sort({ lastCheckedAt: 1, createdAt: 1 })
    .limit(Math.max(1, Math.min(500, Number(limit) || 300)));
}

async function removeWebsiteMonitorByIndex({
  phone,
  createdBy,
  index
}) {
  const list = await getUserWebsiteMonitors({
    phone,
    createdBy,
    limit: 100
  });

  const pos = Number(index) - 1;
  if (!Number.isInteger(pos) || pos < 0 || pos >= list.length) {
    return null;
  }

  const item = list[pos];
  await WebsiteMonitor.deleteOne({ _id: item._id });
  return item;
}

async function updateWebsiteMonitorState(id, {
  status,
  statusCode = null
}) {
  return WebsiteMonitor.findByIdAndUpdate(
    id,
    {
      $set: {
        lastStatus: status,
        lastStatusCode: statusCode,
        lastCheckedAt: new Date(),
        updatedAt: new Date()
      }
    },
    { new: true }
  );
}

module.exports = {
  WebsiteMonitor,
  addWebsiteMonitor,
  getUserWebsiteMonitors,
  getEnabledWebsiteMonitors,
  removeWebsiteMonitorByIndex,
  updateWebsiteMonitorState
};
