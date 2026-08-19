// ======================================================
// OSTHAR MINI BOT - MESSAGE STYLE SYSTEM
// ======================================================

function safeText(value = "") {
  return String(value || "").trim();
}

function line(char = "━", length = 18) {
  return char.repeat(length);
}

// ======================================================
// BASIC BOX
// ======================================================

function box({
  title = "INFO",
  icon = "ℹ️",
  body = "",
  footer = false
}) {
  const content =
    safeText(body) ||
    "No information available.";

  let text =
    `╭━━〔 ${icon} *${title}* 〕━━╮\n\n` +
    `${content}\n\n`;


  text +=
    "╰━━━━━━━━━━━━━━━━━━━━╯";

  return text;
}

// ======================================================
// SUCCESS
// ======================================================

function success(
  body,
  title = "SUCCESS"
) {
  return box({
    title,
    icon: "✅",
    body
  });
}

// ======================================================
// ERROR
// ======================================================

function error(
  body,
  title = "ERROR"
) {
  return box({
    title,
    icon: "❌",
    body
  });
}

// ======================================================
// WARNING
// ======================================================

function warning(
  body,
  title = "WARNING"
) {
  return box({
    title,
    icon: "⚠️",
    body
  });
}

// ======================================================
// INFO
// ======================================================

function info(
  body,
  title = "INFORMATION"
) {
  return box({
    title,
    icon: "ℹ️",
    body
  });
}

// ======================================================
// LOADING
// ======================================================

function loading(
  body = "Please wait...",
  title = "PROCESSING"
) {
  return box({
    title,
    icon: "⏳",
    body,
    footer: false
  });
}

// ======================================================
// OWNER ONLY
// ======================================================

function ownerOnly() {
  return box({
    title:
      "OWNER ONLY",

    icon:
      "🔐",

    body:
      "You are not authorized to use this command."
  });
}

// ======================================================
// ADMIN ONLY
// ======================================================

function adminOnly() {
  return box({
    title:
      "ADMIN ONLY",

    icon:
      "👑",

    body:
      "Only group admins can use this command."
  });
}

// ======================================================
// GROUP ONLY
// ======================================================

function groupOnly() {
  return box({
    title:
      "GROUP ONLY",

    icon:
      "👥",

    body:
      "This command can only be used inside a WhatsApp group."
  });
}

// ======================================================
// BOT ADMIN REQUIRED
// ======================================================

function botAdminRequired() {
  return box({
    title:
      "BOT ADMIN REQUIRED",

    icon:
      "🛡️",

    body:
      "Please make the bot account a group admin first."
  });
}

// ======================================================
// USAGE
// ======================================================

function usage({
  title = "COMMAND USAGE",
  usage = "",
  example = "",
  note = ""
}) {
  let body = "";

  if (usage) {
    body +=
      `*Usage:*\n${usage}`;
  }

  if (example) {
    body +=
      `${body ? "\n\n" : ""}` +
      `*Example:*\n${example}`;
  }

  if (note) {
    body +=
      `${body ? "\n\n" : ""}` +
      `*Note:*\n${note}`;
  }

  return box({
    title,
    icon: "📘",
    body
  });
}

// ======================================================
// DOWNLOAD FOUND
// ======================================================

function downloadInfo({
  title = "DOWNLOAD FOUND",
  name = "",
  quality = "",
  size = "",
  format = "",
  extra = ""
}) {
  let body = "";

  if (name) {
    body +=
      `*Name:* ${name}`;
  }

  if (quality) {
    body +=
      `${body ? "\n" : ""}` +
      `*Quality:* ${quality}`;
  }

  if (size) {
    body +=
      `${body ? "\n" : ""}` +
      `*Size:* ${size}`;
  }

  if (format) {
    body +=
      `${body ? "\n" : ""}` +
      `*Format:* ${format}`;
  }

  if (extra) {
    body +=
      `${body ? "\n\n" : ""}` +
      extra;
  }

  return box({
    title,
    icon: "⬇️",
    body
  });
}

// ======================================================
// AI RESPONSE
// ======================================================

function ai(
  body,
  title = "OSTHAR AI"
) {
  return box({
    title,
    icon: "🤖",
    body
  });
}

// ======================================================
// SUPPORT
// ======================================================

function support(
  body,
  title = "SUPPORT"
) {
  return box({
    title,
    icon: "📩",
    body
  });
}

// ======================================================
// SIMPLE SEND HELPERS
// ======================================================

async function sendStyled(
  sock,
  jid,
  msg,
  text
) {
  return sock.sendMessage(
    jid,
    {
      text
    },
    {
      quoted: msg
    }
  );
}

async function sendSuccess(
  sock,
  jid,
  msg,
  body,
  title = "SUCCESS"
) {
  return sendStyled(
    sock,
    jid,
    msg,
    success(
      body,
      title
    )
  );
}

async function sendError(
  sock,
  jid,
  msg,
  body,
  title = "ERROR"
) {
  return sendStyled(
    sock,
    jid,
    msg,
    error(
      body,
      title
    )
  );
}

async function sendInfo(
  sock,
  jid,
  msg,
  body,
  title = "INFORMATION"
) {
  return sendStyled(
    sock,
    jid,
    msg,
    info(
      body,
      title
    )
  );
}

async function sendWarning(
  sock,
  jid,
  msg,
  body,
  title = "WARNING"
) {
  return sendStyled(
    sock,
    jid,
    msg,
    warning(
      body,
      title
    )
  );
}

async function sendLoading(
  sock,
  jid,
  msg,
  body,
  title = "PROCESSING"
) {
  return sendStyled(
    sock,
    jid,
    msg,
    loading(
      body,
      title
    )
  );
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  line,
  box,

  success,
  error,
  warning,
  info,
  loading,

  ownerOnly,
  adminOnly,
  groupOnly,
  botAdminRequired,

  usage,
  downloadInfo,
  ai,
  support,

  sendStyled,
  sendSuccess,
  sendError,
  sendInfo,
  sendWarning,
  sendLoading
};