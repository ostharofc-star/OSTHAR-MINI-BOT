const COMMAND_REACTIONS = {
  ping: "⚡",
  alive: "✅",
  menu: "📋",
  help: "📘",
  owner: "👤",

  song: "🎵",
  video: "🎬",
  yts: "🔎",

  tiktok: "🎶",
  facebook: "📘",
  fb: "📘",
  instagram: "📸",
  ig: "📸",
  pinterest: "📌",
  pin: "📌",
  twitter: "🐦",
  x: "✖️",
  snapchat: "👻",
  apk: "📦",

  antidelete: "🛡️",
  anticall: "📵",
  autostatus: "👁️",
  autoreact: "✨",
  autoreply: "💬",
  autoread: "📖",
  autotyping: "⌨️",
  statusreact: "💚",
  statusreply: "💭",
  settings: "⚙️",

  runtime: "⏱️",
  speed: "🚀",
  jid: "🆔",

  block: "🚫",
  unblock: "✅",
  restart: "🔄",
  logout: "🔒",

  setprefix: "✏️",
  setname: "🏷️",

  welcome: "👋",
  goodbye: "👋",
  antilink: "🔗",
  antispam: "🛡️",

  vv: "👁️",
  sticker: "🖼️",
  toimg: "🌄",
  mp3: "🎧",
  tts: "🔊",

  weather: "🌦️",
  translate: "🌐",
  google: "🔎",
  image: "🖼️",
  wiki: "📚",
  calc: "🧮",
  shorturl: "🔗",
  qr: "🔳",
  ss: "📷",
  upload: "☁️"
};

function normalizeCommand(text = "", prefix = ".") {
  const cleanText = String(text).trim();

  if (!cleanText.startsWith(prefix)) {
    return null;
  }

  const withoutPrefix = cleanText
    .slice(prefix.length)
    .trim();

  if (!withoutPrefix) {
    return null;
  }

  const commandName = withoutPrefix
    .split(/\s+/)[0]
    .toLowerCase();

  return commandName;
}

function getCommandReaction(commandName) {
  if (!commandName) {
    return "⚡";
  }

  return COMMAND_REACTIONS[commandName] || "⚡";
}

async function reactToCommand(sock, msg, commandName) {
  try {
    if (!sock || !msg?.key?.remoteJid) {
      return false;
    }

    const emoji = getCommandReaction(commandName);

    await sock.sendMessage(msg.key.remoteJid, {
      react: {
        text: emoji,
        key: msg.key
      }
    });

    return true;
  } catch (error) {
    console.log(
      "Command Reaction Error:",
      error?.message || error
    );

    return false;
  }
}

module.exports = {
  COMMAND_REACTIONS,
  normalizeCommand,
  getCommandReaction,
  reactToCommand
};