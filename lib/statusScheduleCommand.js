const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const moment = require("moment-timezone");
const {
  downloadMediaMessage
} = require("@whiskeysockets/baileys");

const {
  createStatusSchedule,
  listStatusSchedules,
  deleteStatusScheduleByIndex,
  clearStatusSchedules
} = require("../database/statusSchedules");

const {
  rememberStatusRecipient,
  getStatusRecipients,
  forgetStatusRecipient,
  clearStatusRecipients
} = require("./statusRecipients");

const MEDIA_ROOT =
  path.join(
    __dirname,
    "..",
    "status-media"
  );

function cleanPhone(
  phone = ""
) {
  return String(
    phone ||
    ""
  ).replace(
    /\D/g,
    ""
  );
}

function unwrapMessage(
  message
) {
  let current =
    message ||
    {};

  for (
    let i = 0;
    i < 8;
    i++
  ) {
    const next =
      current?.ephemeralMessage?.message ||
      current?.viewOnceMessage?.message ||
      current?.viewOnceMessageV2?.message ||
      current?.viewOnceMessageV2Extension?.message ||
      current?.documentWithCaptionMessage?.message;

    if (!next) {
      break;
    }

    current =
      next;
  }

  return current;
}

function contextInfoFromMessage(
  message
) {
  const m =
    unwrapMessage(
      message
    );

  return (
    m?.extendedTextMessage?.contextInfo ||
    m?.imageMessage?.contextInfo ||
    m?.videoMessage?.contextInfo ||
    m?.documentMessage?.contextInfo ||
    null
  );
}

function detectMedia(
  msg,
  jid
) {
  const current =
    unwrapMessage(
      msg?.message
    );

  if (
    current?.imageMessage
  ) {
    return {
      type:
        "image",
      mimetype:
        current.imageMessage.mimetype ||
        "image/jpeg",
      downloadMessage:
        msg
    };
  }

  if (
    current?.videoMessage
  ) {
    return {
      type:
        "video",
      mimetype:
        current.videoMessage.mimetype ||
        "video/mp4",
      downloadMessage:
        msg
    };
  }

  const context =
    contextInfoFromMessage(
      msg?.message
    );

  const quoted =
    context?.quotedMessage;

  if (!quoted) {
    return null;
  }

  const unwrappedQuoted =
    unwrapMessage(
      quoted
    );

  let type =
    null;

  let mimetype =
    "";

  if (
    unwrappedQuoted?.imageMessage
  ) {
    type =
      "image";

    mimetype =
      unwrappedQuoted.imageMessage.mimetype ||
      "image/jpeg";

  } else if (
    unwrappedQuoted?.videoMessage
  ) {
    type =
      "video";

    mimetype =
      unwrappedQuoted.videoMessage.mimetype ||
      "video/mp4";
  }

  if (!type) {
    return null;
  }

  return {
    type,
    mimetype,
    downloadMessage: {
      key: {
        remoteJid:
          jid,
        id:
          context?.stanzaId ||
          crypto.randomUUID(),
        participant:
          context?.participant ||
          undefined
      },
      message:
        quoted
    }
  };
}

function extensionFor(
  type,
  mimetype
) {
  const mime =
    String(
      mimetype ||
      ""
    ).toLowerCase();

  if (
    type === "image"
  ) {
    if (
      mime.includes("png")
    ) {
      return ".png";
    }

    if (
      mime.includes("webp")
    ) {
      return ".webp";
    }

    return ".jpg";
  }

  if (
    mime.includes("webm")
  ) {
    return ".webm";
  }

  return ".mp4";
}

async function downloadMediaBuffer(
  sock,
  message
) {
  if (
    typeof sock.downloadMediaMessage ===
    "function"
  ) {
    return sock.downloadMediaMessage(
      message
    );
  }

  return downloadMediaMessage(
    message,
    "buffer",
    {},
    {
      reuploadRequest:
        sock.updateMediaMessage
    }
  );
}

async function saveMediaForSchedule({
  sock,
  msg,
  jid,
  phone
}) {
  const media =
    detectMedia(
      msg,
      jid
    );

  if (!media) {
    return null;
  }

  const buffer =
    await downloadMediaBuffer(
      sock,
      media.downloadMessage
    );

  if (
    !Buffer.isBuffer(
      buffer
    ) ||
    !buffer.length
  ) {
    throw new Error(
      "Unable to download the photo/video for scheduling."
    );
  }

  const directory =
    path.join(
      MEDIA_ROOT,
      cleanPhone(
        phone
      )
    );

  fs.mkdirSync(
    directory,
    {
      recursive: true
    }
  );

  const filePath =
    path.join(
      directory,
      `${Date.now()}-${crypto.randomUUID()}${extensionFor(
        media.type,
        media.mimetype
      )}`
    );

  fs.writeFileSync(
    filePath,
    buffer
  );

  return {
    type:
      media.type,
    mimetype:
      media.mimetype,
    mediaPath:
      filePath
  };
}

function parseRunAt(
  token
) {
  const value =
    String(
      token ||
      ""
    ).trim().toLowerCase();

  const relative =
    value.match(
      /^(\d+)(s|m|h|d)$/
    );

  if (relative) {
    const amount =
      Number(
        relative[1]
      );

    const unit =
      relative[2];

    const multiplier = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    }[unit];

    return new Date(
      Date.now() +
      amount * multiplier
    );
  }

  if (
    /^([01]\d|2[0-3]):[0-5]\d$/.test(
      value
    )
  ) {
    const now =
      moment.tz(
        "Asia/Colombo"
      );

    const [hour, minute] =
      value
        .split(":")
        .map(Number);

    const target =
      now
        .clone()
        .hour(hour)
        .minute(minute)
        .second(0)
        .millisecond(0);

    if (
      !target.isAfter(
        now
      )
    ) {
      target.add(
        1,
        "day"
      );
    }

    return target.toDate();
  }

  return null;
}

function formatRunAt(
  date
) {
  return moment(
    date
  )
    .tz(
      "Asia/Colombo"
    )
    .format(
      "YYYY-MM-DD hh:mm A"
    );
}

function shortText(
  text,
  max = 70
) {
  const value =
    String(
      text ||
      ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (
    value.length <= max
  ) {
    return value;
  }

  return (
    value.slice(
      0,
      max - 3
    ) +
    "..."
  );
}

async function reply(
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
      quoted:
        msg
    }
  );
}

async function handleAudience({
  sock,
  jid,
  msg,
  phone,
  query
}) {
  const raw =
    String(
      query ||
      ""
    ).trim();

  const parts =
    raw.split(/\s+/)
      .filter(Boolean);

  const action =
    String(
      parts[0] ||
      ""
    ).toLowerCase();

  if (
    action === "add"
  ) {
    const number =
      cleanPhone(
        parts[1]
      );

    if (!number) {
      return reply(
        sock,
        jid,
        msg,
        "❌ Use: .statusaudience add 94771234567"
      );
    }

    rememberStatusRecipient(
      phone,
      `${number}@s.whatsapp.net`
    );

    return reply(
      sock,
      jid,
      msg,
      `✅ Status audience added: ${number}`
    );
  }

  if (
    action === "del" ||
    action === "delete" ||
    action === "remove"
  ) {
    const number =
      cleanPhone(
        parts[1]
      );

    if (!number) {
      return reply(
        sock,
        jid,
        msg,
        "❌ Use: .statusaudience del 94771234567"
      );
    }

    const removed =
      forgetStatusRecipient(
        phone,
        `${number}@s.whatsapp.net`
      );

    return reply(
      sock,
      jid,
      msg,
      removed
        ? `✅ Removed: ${number}`
        : `ℹ️ ${number} was not in the saved audience.`
    );
  }

  if (
    action === "clear"
  ) {
    clearStatusRecipients(
      phone
    );

    return reply(
      sock,
      jid,
      msg,
      "✅ Saved status audience cleared. It will auto-sync again from contacts/chats."
    );
  }

  const audience =
    getStatusRecipients(
      phone
    );

  return reply(
    sock,
    jid,
    msg,
    "👥 *STATUS AUDIENCE*\n\n" +
    `Synced PHONE-number recipients: *${audience.length}*\n\n` +
    "Auto-sync: only resolved phone JIDs are kept; @lid entries are ignored.\n\n" +
    "Manual add: .statusaudience add 94771234567\n" +
    "Manual remove: .statusaudience del 94771234567"
  );
}

async function sendStatusImmediately({
  sock,
  phone,
  savedMedia,
  text
}) {
  const statusJidList =
    getStatusRecipients(
      phone
    );

  if (!statusJidList.length) {
    throw new Error(
      "No PHONE-number status audience is synced. Use .statusaudience add 9477XXXXXXX first."
    );
  }

  let content = null;

  if (
    savedMedia?.type ===
    "image"
  ) {
    content = {
      image: {
        url:
          savedMedia.mediaPath
      },

      ...(text
        ? {
            caption:
              text
          }
        : {}),

      contextInfo: {
        featureEligibilities: {
          canBeReshared: true
        }
      }
    };

  } else if (
    savedMedia?.type ===
    "video"
  ) {
    content = {
      video: {
        url:
          savedMedia.mediaPath
      },

      ...(text
        ? {
            caption:
              text
          }
        : {}),

      contextInfo: {
        featureEligibilities: {
          canBeReshared: true
        }
      }
    };

  } else {
    if (!text) {
      throw new Error(
        "Text status ekakata text ekak denna."
      );
    }

    content = {
      text
    };
  }

  console.log(
    `[STATUS NOW] Sending to ${statusJidList.length} PN recipient(s)`
  );

  const result =
    await sock.sendMessage(
      "status@broadcast",
      content,
      {
        statusJidList,
        broadcast: true,
        backgroundColor:
          "#111827",
        font:
          2,
        mediaUploadTimeoutMs:
          120000
      }
    );

  console.log(
    "[STATUS NOW] Baileys result:",
    result?.key ||
    result
  );

  return {
    result,
    audienceCount:
      statusJidList.length
  };
}

async function execute({
  sock,
  msg,
  jid,
  phone,
  command,
  query
}) {
  const cmd =
    String(
      command ||
      "statusschedule"
    ).toLowerCase();

  // Always remember the direct chat / participant that invoked it.
  rememberStatusRecipient(
    phone,
    jid
  );

  rememberStatusRecipient(
    phone,
    msg?.key?.participant
  );

  rememberStatusRecipient(
    phone,
    msg?.key?.remoteJidAlt
  );

  rememberStatusRecipient(
    phone,
    msg?.key?.participantAlt
  );

  if (
    cmd === "statusaudience"
  ) {
    return handleAudience({
      sock,
      jid,
      msg,
      phone,
      query
    });
  }

  if (
    cmd === "statusschedules"
  ) {
    const list =
      await listStatusSchedules(
        phone,
        {
          limit: 100
        }
      );

    if (!list.length) {
      return reply(
        sock,
        jid,
        msg,
        "📭 No pending/failed status schedules."
      );
    }

    const lines = [
      "🕒 *STATUS SCHEDULES*",
      ""
    ];

    list.forEach(
      (item, index) => {
        lines.push(
          `${index + 1}. *${String(item.type || "text").toUpperCase()}* | ${formatRunAt(item.runAt)}`,
          `   Status: ${String(item.status || "pending").toUpperCase()}`,
          `   ${shortText(item.text) || "(no caption)"}`,
          item.lastError
            ? `   Error: ${shortText(item.lastError, 100)}`
            : ""
        );
      }
    );

    return reply(
      sock,
      jid,
      msg,
      lines
        .filter(
          line =>
            line !== ""
        )
        .join("\n")
    );
  }

  if (
    cmd === "delstatusschedule"
  ) {
    const index =
      Number(
        String(
          query ||
          ""
        ).trim()
      );

    const deleted =
      await deleteStatusScheduleByIndex(
        phone,
        index
      );

    if (!deleted) {
      return reply(
        sock,
        jid,
        msg,
        "❌ Invalid schedule number. First use .statusschedules"
      );
    }

    return reply(
      sock,
      jid,
      msg,
      `✅ Status schedule ${index} deleted.`
    );
  }

  if (
    cmd === "clearstatusschedules"
  ) {
    const count =
      await clearStatusSchedules(
        phone
      );

    return reply(
      sock,
      jid,
      msg,
      `✅ Cleared ${count} pending/failed status schedule(s).`
    );
  }

  if (
    cmd === "statusnow"
  ) {
    const text =
      String(
        query ||
        ""
      ).trim();

    let savedMedia =
      null;

    try {
      savedMedia =
        await saveMediaForSchedule({
          sock,
          msg,
          jid,
          phone
        });

      if (
        !savedMedia &&
        !text
      ) {
        return reply(
          sock,
          jid,
          msg,
          "❌ Use: .statusnow Test status\nOr reply to a photo/video: .statusnow Caption"
        );
      }

      const sent =
        await sendStatusImmediately({
          sock,
          phone,
          savedMedia,
          text
        });

      return reply(
        sock,
        jid,
        msg,
        "✅ *STATUS SENT TO BAILEYS*\n\n" +
        `Type: *${String(savedMedia?.type || "text").toUpperCase()}*\n` +
        `PN audience: *${sent.audienceCount}*\n\n` +
        "Dan WhatsApp > Updates > My status balanna."
      );

    } finally {
      if (
        savedMedia?.mediaPath
      ) {
        try {
          fs.rmSync(
            savedMedia.mediaPath,
            {
              force: true
            }
          );
        } catch {}
      }
    }
  }

  const raw =
    String(
      query ||
      ""
    ).trim();

  const firstSpace =
    raw.search(/\s/);

  const timeToken =
    firstSpace === -1
      ? raw
      : raw.slice(
          0,
          firstSpace
        );

  const text =
    firstSpace === -1
      ? ""
      : raw
          .slice(
            firstSpace + 1
          )
          .trim();

  const runAt =
    parseRunAt(
      timeToken
    );

  if (!runAt) {
    return reply(
      sock,
      jid,
      msg,
      "❌ *INVALID TIME*\n\n" +
      "Examples:\n" +
      ".statusschedule 10s Test\n" +
      ".statusschedule 30m Good evening\n" +
      ".statusschedule 1h Hello\n" +
      ".statusschedule 18:30 Good evening"
    );
  }

  let savedMedia =
    null;

  try {
    savedMedia =
      await saveMediaForSchedule({
        sock,
        msg,
        jid,
        phone
      });

    const type =
      savedMedia?.type ||
      "text";

    if (
      type === "text" &&
      !text
    ) {
      return reply(
        sock,
        jid,
        msg,
        "❌ Text status ekakata message ekak denna. Photo/video nam media eka attach/reply karala command eka denna."
      );
    }

    const item =
      await createStatusSchedule({
        phone,
        runAt,
        text,
        type,
        mediaPath:
          savedMedia?.mediaPath ||
          "",
        mimetype:
          savedMedia?.mimetype ||
          "",
        sourceJid:
          jid
      });

    const audienceCount =
      getStatusRecipients(
        phone
      ).length;

    return reply(
      sock,
      jid,
      msg,
      "✅ *STATUS SCHEDULED*\n\n" +
      `Type: *${type.toUpperCase()}*\n` +
      `Time: *${formatRunAt(item.runAt)}*\n` +
      `Caption/Text: ${text || "(none)"}\n` +
      `Synced audience: *${audienceCount}*\n\n` +
      "Bot eka connected wela thiyenawanam time eka awama auto post wenawa."
    );

  } catch (error) {
    if (
      savedMedia?.mediaPath
    ) {
      try {
        fs.rmSync(
          savedMedia.mediaPath,
          {
            force: true
          }
        );
      } catch {}
    }

    throw error;
  }
}

module.exports = {
  execute,
  parseRunAt,
  detectMedia
};
