const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function sleep(ms = 1000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanPhoneNumber(number = "") {
  return String(number).replace(/[^0-9]/g, "");
}

function isValidPhoneNumber(number = "") {
  const clean = cleanPhoneNumber(number);

  return clean.length >= 8 && clean.length <= 15;
}

function formatRuntime(seconds = 0) {
  seconds = Math.floor(Number(seconds) || 0);

  const days = Math.floor(seconds / 86400);
  seconds %= 86400;

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);

  parts.push(`${seconds}s`);

  return parts.join(" ");
}

function formatBytes(bytes = 0) {
  bytes = Number(bytes) || 0;

  if (bytes === 0) return "0 Bytes";

  const units = [
    "Bytes",
    "KB",
    "MB",
    "GB",
    "TB"
  ];

  const index = Math.floor(
    Math.log(bytes) / Math.log(1024)
  );

  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(2)} ${units[index]}`;
}

function getMessageText(msg) {
  if (!msg?.message) return "";

  return (
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    msg.message.documentMessage?.caption ||
    ""
  ).trim();
}

function getCommandParts(text = "", prefix = ".") {
  const cleanText = String(text).trim();

  if (!cleanText.startsWith(prefix)) {
    return {
      isCommand: false,
      command: "",
      args: [],
      query: ""
    };
  }

  const body = cleanText
    .slice(prefix.length)
    .trim();

  if (!body) {
    return {
      isCommand: false,
      command: "",
      args: [],
      query: ""
    };
  }

  const parts = body.split(/\s+/);

  const command = parts
    .shift()
    .toLowerCase();

  return {
    isCommand: true,
    command,
    args: parts,
    query: parts.join(" ")
  };
}

function generateId(prefix = "OSTHAR") {
  const random = crypto
    .randomBytes(6)
    .toString("hex")
    .toUpperCase();

  return `${prefix}-${random}`;
}

function ensureDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, {
      recursive: true
    });
  }

  return directoryPath;
}

function safeDelete(filePath) {
  try {
    if (!filePath) return false;

    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, {
        recursive: true,
        force: true
      });

      return true;
    }
  } catch (error) {
    console.log(
      "Delete Error:",
      error?.message || error
    );
  }

  return false;
}

function createTempFilePath(extension = "tmp") {
  const tempDirectory = path.join(
    process.cwd(),
    "temp"
  );

  ensureDirectory(tempDirectory);

  const id = crypto
    .randomBytes(8)
    .toString("hex");

  const cleanExtension = String(extension)
    .replace(/^\./, "");

  return path.join(
    tempDirectory,
    `${Date.now()}-${id}.${cleanExtension}`
  );
}

function truncateText(text = "", maxLength = 1000) {
  text = String(text);

  if (text.length <= maxLength) {
    return text;
  }

  return (
    text.slice(0, maxLength - 3) +
    "..."
  );
}

function normalizeUrl(url = "") {
  const value = String(url).trim();

  if (!value) return null;

  try {
    const parsed = new URL(value);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function isGroupJid(jid = "") {
  return String(jid).endsWith("@g.us");
}

function isStatusJid(jid = "") {
  return jid === "status@broadcast";
}

function isNewsletterJid(jid = "") {
  return String(jid).endsWith("@newsletter");
}

function jidToNumber(jid = "") {
  return String(jid)
    .split("@")[0]
    .replace(/[^0-9]/g, "");
}

module.exports = {
  sleep,
  cleanPhoneNumber,
  isValidPhoneNumber,
  formatRuntime,
  formatBytes,
  getMessageText,
  getCommandParts,
  generateId,
  ensureDirectory,
  safeDelete,
  createTempFilePath,
  truncateText,
  normalizeUrl,
  isGroupJid,
  isStatusJid,
  isNewsletterJid,
  jidToNumber
};