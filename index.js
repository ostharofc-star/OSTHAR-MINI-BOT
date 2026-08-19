require("dotenv").config();

const express = require("express");
const pino = require("pino");
const QRCode = require("qrcode");

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  Browsers
} = require("@whiskeysockets/baileys");

// ======================================================
// DATABASE
// ======================================================

const {
  connectMongoDB
} = require("./database/mongo");

const {
  getUserSettings
} = require("./database/settings");

const {
  getCustomCommand
} = require("./database/customCommands");

const {
  getAFK
} = require("./database/afk");

const {
  addXP
} = require("./database/groupXp");

const {
  getDueReminders,
  completeReminder,
  cleanCompletedReminders
} = require("./database/reminders");

const {
  getDueSchedules,
  completeSchedule,
  cleanCompletedSchedules
} = require("./database/schedules");

const {
  getEnabledDailyMessages,
  markDailyMessageSent
} = require("./database/dailyMessages");

const {
  getDueStatusSchedules,
  completeStatusSchedule,
  cleanCompletedStatusSchedules,
  recordStatusScheduleFailure
} = require("./database/statusSchedules");

const {
  isCommandEnabled
} = require("./database/commandControls");

const {
  getBotMode
} = require("./database/botMode");

const {
  mergeGroupSettings
} = require("./database/groupSettings");

const {
  getEnabledWebsiteMonitors,
  updateWebsiteMonitorState
} = require("./database/websiteMonitors");

const {
  checkWebsite
} = require("./lib/website-monitor");

const {
  registerStatusRecipientTracking,
  getStatusRecipients
} = require("./lib/statusRecipients");

const statusScheduleCommand =
  require("./lib/statusScheduleCommand");

const STATUS_SCHEDULE_COMMANDS =
  new Set([
    "statusschedule",
    "statusschedules",
    "delstatusschedule",
    "clearstatusschedules",
    "statusaudience",
    "statusnow"
  ]);

// ======================================================
// COMMAND SYSTEM
// ======================================================

const {
  loadCommands,
  getCommand
} = require("./lib/commandLoader");

const {
  reactToCommand
} = require("./lib/reactions");

// ======================================================
// HELPERS
// ======================================================

const {
  cleanPhoneNumber,
  isValidPhoneNumber,
  getMessageText,
  getCommandParts,
  isStatusJid,
  isNewsletterJid,
  isGroupJid,
  safeDelete
} = require("./lib/helpers");

// ======================================================
// DESTINATION SYSTEM
// ======================================================

const {
  getAntiDeleteDestination
} = require("./lib/destination");

// ======================================================
// AUTOMATION
// ======================================================

const {
  cacheMessage,
  getCachedMessage,
  handleAutoRead,
  startTyping,
  stopTyping,
  handleAutoReply,
  handleStatusMessage,
  registerAntiCall
} = require("./lib/automation");

// ======================================================
// GROUP SYSTEM
// ======================================================

const {
  registerGroupEvents,
  handleAntiLink,
  handleAntiSpam
} = require("./lib/groups");

// ======================================================
// CONNECTION MESSAGE
// ======================================================

const {
  sendConnectionSuccessMessage
} = require("./lib/connection");

// ======================================================
// WEB DASHBOARD
// ======================================================

const webRoutes =
  require("./web/routes");

// ======================================================
// BOT LINK FLOW
// ======================================================

const {
  getPendingLink,
  removePendingLink,
  parseLinkChoice
} = require("./lib/linkFlow");

// ======================================================
// APP CONFIG
// ======================================================

const app = express();

const PORT =
  Number(process.env.PORT) || 3000;

const START_TIME = Date.now();

const logger = pino({
  level: "silent"
});

// ======================================================
// BRAND IMAGE - LOCAL CACHED FILE
// ======================================================

const BRAND_IMAGE_PATH =
  path.join(
    __dirname,
    "assets",
    "bot-image.jpg"
  );

let BRAND_IMAGE_BUFFER = null;

try {
  BRAND_IMAGE_BUFFER =
    fs.readFileSync(
      BRAND_IMAGE_PATH
    );
} catch (error) {
  console.log(
    "Brand Image Load Error:",
    error?.message || error
  );
}

async function sendBrandImage({
  sock,
  jid,
  caption = "",
  quoted
}) {
  try {
    if (!BRAND_IMAGE_BUFFER) {
      return false;
    }

    await sock.sendMessage(
      jid,
      {
        image:
          BRAND_IMAGE_BUFFER,

        caption:
          String(
            caption || ""
          )
      },
      quoted
        ? { quoted }
        : undefined
    );

    return true;
  } catch (error) {
    console.log(
      "Brand Image Error:",
      error?.message || error
    );

    return false;
  }
}

// ======================================================
// OFFICIAL WHATSAPP CHANNEL
// ======================================================

const OFFICIAL_CHANNEL_NAME =
  "OSTHAR MINI OFFICIAL </>";

const OFFICIAL_CHANNEL_URL =
  "https://whatsapp.com/channel/0029Vb8xxxFC6ZvoUHsvqw3H";

const OFFICIAL_CHANNEL_INVITE =
  "0029Vb8xxxFC6ZvoUHsvqw3H";

const OFFICIAL_CHANNEL_REACTION =
  "💚";

async function getOfficialChannelJid(
  sock
) {
  try {
    if (
      sock.__ostharOfficialChannelJid
    ) {
      return (
        sock.__ostharOfficialChannelJid
      );
    }

    if (
      typeof sock?.newsletterMetadata !==
        "function"
    ) {
      return null;
    }

    const metadata =
      await sock.newsletterMetadata(
        "invite",
        OFFICIAL_CHANNEL_INVITE
      );

    const newsletterJid =
      metadata?.id ||
      metadata?.jid ||
      metadata?.newsletterJid ||
      metadata?.newsletter_id ||
      null;

    if (
      !newsletterJid ||
      !String(newsletterJid)
        .endsWith("@newsletter")
    ) {
      return null;
    }

    sock.__ostharOfficialChannelJid =
      String(newsletterJid);

    return (
      sock.__ostharOfficialChannelJid
    );

  } catch (error) {
    console.log(
      "Channel JID Resolve Error:",
      error?.message || error
    );

    return null;
  }
}

async function autoReactOfficialChannel({
  sock,
  msg,
  jid
}) {
  try {
    const officialJid =
      await getOfficialChannelJid(
        sock
      );

    if (
      !officialJid ||
      String(jid) !==
        String(officialJid)
    ) {
      return false;
    }

    if (
      !msg?.key?.id
    ) {
      return false;
    }

    await sock.sendMessage(
      jid,
      {
        react: {
          text:
            OFFICIAL_CHANNEL_REACTION,

          key:
            msg.key
        }
      }
    );

    console.log(
      `Channel Auto React: ${OFFICIAL_CHANNEL_REACTION} -> ${msg.key.id}`
    );

    return true;

  } catch (error) {
    console.log(
      "Channel Auto React Error:",
      error?.message || error
    );

    return false;
  }
}

async function followOfficialChannel(sock) {
  try {
    if (
      typeof sock?.newsletterMetadata !==
        "function" ||
      typeof sock?.newsletterFollow !==
        "function"
    ) {
      console.log(
        "Channel Follow: Newsletter API is not available in this Baileys build."
      );

      return false;
    }

    const newsletterJid =
      await getOfficialChannelJid(
        sock
      );

    if (!newsletterJid) {
      console.log(
        "Channel Follow: Could not resolve newsletter JID from invite link."
      );

      return false;
    }

    await sock.newsletterFollow(
      newsletterJid
    );

    console.log(
      `Channel Followed: ${OFFICIAL_CHANNEL_NAME} (${newsletterJid})`
    );

    return true;

  } catch (error) {
    console.log(
      "Channel Follow Error:",
      error?.message || error
    );

    return false;
  }
}

const SESSION_ROOT =
  process.env.SESSION_DIR ||
  path.join(__dirname, "sessions");

if (!fs.existsSync(SESSION_ROOT)) {
  fs.mkdirSync(
    SESSION_ROOT,
    {
      recursive: true
    }
  );
}

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

// ======================================================
// STORES
// ======================================================

const commands = loadCommands();

const activeBots =
  new Map();

const qrCodes =
  new Map();

const connectionStatus =
  new Map();

const webSessions =
  new Map();

const newLinkPending =
  new Set();

// Prevent repeated AFK replies to the same chat
const afkReplyCooldown =
  new Map();

// ======================================================
// WEB TOKEN
// ======================================================

function createWebToken(phone) {
  const token =
    crypto
      .randomBytes(24)
      .toString("hex");

  webSessions.set(
    token,
    {
      phone,

      expiresAt:
        Date.now() +
        15 * 60 * 1000
    }
  );

  return token;
}

// ======================================================
// WEB TOKEN CLEANUP
// ======================================================

setInterval(
  () => {
    const now =
      Date.now();

    for (
      const [token, data]
      of webSessions.entries()
    ) {
      if (
        data.expiresAt <
        now
      ) {
        webSessions.delete(
          token
        );
      }
    }
  },

  5 * 60 * 1000
);

// ======================================================
// BOT LINK HELPERS
// ======================================================

function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

function getRequesterJid(
  msg,
  fallbackJid = ""
) {
  return (
    msg?.key?.participant ||
    msg?.key?.remoteJid ||
    fallbackJid ||
    ""
  );
}

function qrDataUrlToBuffer(
  dataUrl
) {
  const value =
    String(
      dataUrl || ""
    );

  const commaIndex =
    value.indexOf(",");

  if (
    commaIndex === -1
  ) {
    throw new Error(
      "Invalid QR image."
    );
  }

  return Buffer.from(
    value.slice(
      commaIndex + 1
    ),
    "base64"
  );
}

async function waitForQrCode(
  targetPhone,
  timeoutMs = 30000
) {
  const startedAt =
    Date.now();

  while (
    Date.now() -
      startedAt <
    timeoutMs
  ) {
    const qr =
      qrCodes.get(
        targetPhone
      );

    if (qr) {
      return qr;
    }

    if (
      connectionStatus.get(
        targetPhone
      ) === "connected"
    ) {
      return null;
    }

    await sleep(500);
  }

  return null;
}

// ======================================================
// HANDLE .BOT LINK CHOICE
// ======================================================

async function handleBotLinkChoice({
  sock,
  msg,
  jid,
  text
}) {
  const requesterJid =
    getRequesterJid(
      msg,
      jid
    );

  const pending =
    getPendingLink(
      requesterJid
    );

  if (!pending) {
    return false;
  }

  const choice =
    parseLinkChoice(
      text
    );

  if (!choice) {
    return false;
  }

  const targetPhone =
    cleanPhoneNumber(
      pending.phone
    );

  if (
    !isValidPhoneNumber(
      targetPhone
    )
  ) {
    removePendingLink(
      requesterJid
    );

    await sock.sendMessage(
      jid,
      {
        text:
          "❌ *LINK ERROR*\n\n" +
          "The saved WhatsApp number is invalid.\n\n" +
          "Please run *.bot <number>* again."
      },
      {
        quoted: msg
      }
    );

    return true;
  }

  if (
    connectionStatus.get(
      targetPhone
    ) === "connected"
  ) {
    removePendingLink(
      requesterJid
    );

    await sock.sendMessage(
      jid,
      {
        text:
          "✅ *ALREADY CONNECTED*\n\n" +
          `Phone: +${targetPhone}\n\n` +
          "This WhatsApp account is already connected to OSTHAR MINI BOT."
      },
      {
        quoted: msg
      }
    );

    return true;
  }

  try {

    // ==================================================
    // QR CODE
    // ==================================================

    if (
      choice === "qr"
    ) {
      await sock.sendMessage(
        jid,
        {
          text:
            "⏳ *GENERATING QR CODE*\n\n" +
            `Phone: +${targetPhone}\n` +
            "Please wait..."
        },
        {
          quoted: msg
        }
      );

      await startUserBot(
        targetPhone
      );

      const qrDataUrl =
        await waitForQrCode(
          targetPhone,
          30000
        );

      if (!qrDataUrl) {
        throw new Error(
          "QR code was not generated. Please try again."
        );
      }

      const qrBuffer =
        qrDataUrlToBuffer(
          qrDataUrl
        );

      await sock.sendMessage(
        jid,
        {
          image:
            qrBuffer,

          caption:
            "╭━━━〔 *QR LINK* 〕━━━╮\n\n" +
            `📱 Phone: *+${targetPhone}*\n\n` +
            "Open WhatsApp on the phone you want to link:\n\n" +
            "WhatsApp → Linked Devices → Link a Device\n\n" +
            "Scan this QR code.\n\n" +
            "╰━━━━━━━━━━━━━━━━━━━━╯"
        },
        {
          quoted: msg
        }
      );

      removePendingLink(
        requesterJid
      );

      return true;
    }

    // ==================================================
    // PAIRING CODE
    // ==================================================

    if (
      choice === "code"
    ) {
      await sock.sendMessage(
        jid,
        {
          text:
            "⏳ *GENERATING PAIRING CODE*\n\n" +
            `Phone: +${targetPhone}\n` +
            "Please wait..."
        },
        {
          quoted: msg
        }
      );

      newLinkPending.add(
        targetPhone
      );

      const targetSock =
        await startUserBot(
          targetPhone
        );

      await sleep(1500);

      if (
        typeof targetSock
          ?.requestPairingCode !==
        "function"
      ) {
        throw new Error(
          "Pairing code is not supported by the current Baileys version."
        );
      }

      const rawCode =
        await targetSock
          .requestPairingCode(
            targetPhone
          );

      const cleanCode =
        String(
          rawCode || ""
        )
          .replace(
            /[^A-Za-z0-9]/g,
            ""
          )
          .toUpperCase();

      const displayCode =
        cleanCode.length === 8
          ? `${cleanCode.slice(0, 4)}-${cleanCode.slice(4)}`
          : cleanCode;

      if (!displayCode) {
        throw new Error(
          "Pairing code was not generated."
        );
      }

      await sock.sendMessage(
        jid,
        {
          text:
            "╭━━━〔 *PAIRING CODE* 〕━━━╮\n\n" +
            `📱 Phone: *+${targetPhone}*\n\n` +
            `🔐 Code: *${displayCode}*\n\n` +
            "Open WhatsApp on the phone you want to link:\n\n" +
            "WhatsApp → Linked Devices → Link a Device → Link with phone number\n\n" +
            "Enter the pairing code shown above.\n\n" +
            "╰━━━━━━━━━━━━━━━━━━━━╯"
        },
        {
          quoted: msg
        }
      );

      removePendingLink(
        requesterJid
      );

      return true;
    }

    return false;

  } catch (error) {
    console.log(
      `[${targetPhone}] Bot Link Flow Error:`,
      error?.message || error
    );

    removePendingLink(
      requesterJid
    );

    await sock.sendMessage(
      jid,
      {
        text:
          "❌ *LINK ERROR*\n\n" +
          (
            error?.message ||
            "Unable to generate the linking method."
          ) +
          "\n\nPlease run *.bot <number>* and try again."
      },
      {
        quoted: msg
      }
    );

    return true;
  }
}

// ======================================================
// PUBLIC / PRIVATE MODE HELPER
// ======================================================

function getMessageSenderJid(
  msg,
  jid = ""
) {
  return (
    msg?.key?.participant ||
    msg?.participant ||
    msg?.key?.remoteJid ||
    jid ||
    ""
  );
}

function isLinkedAccountOwner(
  msg,
  jid,
  phone
) {
  if (
    msg?.key?.fromMe
  ) {
    return true;
  }

  const sender =
    getMessageSenderJid(
      msg,
      jid
    );

  const senderNumber =
    String(sender)
      .split("@")[0]
      .replace(/\D/g, "");

  const ownerNumber =
    String(phone || "")
      .replace(/\D/g, "");

  return (
    !!senderNumber &&
    !!ownerNumber &&
    senderNumber ===
      ownerNumber
  );
}

// ======================================================
// AFK AUTO REPLY
// ======================================================

function formatAFKDuration(ms) {
  if (
    !Number.isFinite(ms) ||
    ms < 0
  ) {
    return "0s";
  }

  const totalSeconds =
    Math.floor(
      ms / 1000
    );

  const days =
    Math.floor(
      totalSeconds / 86400
    );

  const hours =
    Math.floor(
      (totalSeconds % 86400) /
      3600
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) /
      60
    );

  const seconds =
    totalSeconds % 60;

  const parts = [];

  if (days) {
    parts.push(
      `${days}d`
    );
  }

  if (hours) {
    parts.push(
      `${hours}h`
    );
  }

  if (minutes) {
    parts.push(
      `${minutes}m`
    );
  }

  if (
    seconds ||
    !parts.length
  ) {
    parts.push(
      `${seconds}s`
    );
  }

  return parts.join(" ");
}

async function handleAFKAutoReply({
  sock,
  msg,
  jid,
  phone
}) {
  try {
    // Do not reply to messages sent by the linked account itself.
    if (
      msg?.key?.fromMe
    ) {
      return false;
    }

    // AFK auto reply is for private chats only.
    if (
      isGroupJid(jid)
    ) {
      return false;
    }

    if (
      isStatusJid(jid) ||
      isNewsletterJid(jid)
    ) {
      return false;
    }

    const afk =
      await getAFK(
        phone
      );

    if (
      !afk?.enabled
    ) {
      return false;
    }

    // Avoid sending the AFK message repeatedly for every incoming message.
    // One automatic reply per chat every 60 seconds.
    const cooldownKey =
      `${phone}:${jid}`;

    const lastReply =
      afkReplyCooldown.get(
        cooldownKey
      ) || 0;

    const now =
      Date.now();

    if (
      now - lastReply <
      60 * 1000
    ) {
      return true;
    }

    afkReplyCooldown.set(
      cooldownKey,
      now
    );

    const sinceTime =
      afk.since
        ? new Date(
            afk.since
          ).getTime()
        : now;

    const duration =
      formatAFKDuration(
        now - sinceTime
      );

    const reason =
      String(
        afk.reason ||
        "Away from keyboard."
      ).trim();

    await sock.sendMessage(
      jid,
      {
        text:
          "💤 *AFK MODE*\n\n" +
          "The owner is currently away.\n\n" +
          `Reason: ${reason}\n` +
          `AFK For: ${duration}`
      },
      {
        quoted: msg
      }
    );

    return true;

  } catch (error) {
    console.log(
      `[${phone}] AFK Auto Reply Error:`,
      error?.message || error
    );

    return false;
  }
}

// ======================================================
// GROUP XP AUTO ADD
// ======================================================

async function handleGroupXP({
  sock,
  msg,
  jid,
  phone,
  isCommand = false
}) {
  try {
    // XP is only for real incoming group messages.
    if (
      !isGroupJid(jid) ||
      msg?.key?.fromMe ||
      isCommand
    ) {
      return false;
    }

    const userJid =
      msg?.key?.participant ||
      msg?.participant ||
      "";

    if (!userJid) {
      return false;
    }

    const result =
      await addXP({
        phone,
        groupJid: jid,
        userJid,
        amount: 10
      });

    if (
      result?.leveledUp
    ) {
      const userNumber =
        String(
          userJid
        )
          .split("@")[0]
          .replace(
            /\D/g,
            ""
          );

      try {
        await sock.sendMessage(
          jid,
          {
            text:
              "🎉 *LEVEL UP!*\n\n" +
              `@${userNumber} reached *Level ${result.level}*!\n\n` +
              `XP: ${result.record?.xp || 0}`,

            mentions: [
              userJid
            ]
          }
        );
      } catch (
        error
      ) {
        console.log(
          `[${phone}] XP Level Up Message Error:`,
          error?.message || error
        );
      }
    }

    return true;

  } catch (error) {
    console.log(
      `[${phone}] Group XP Error:`,
      error?.message || error
    );

    return false;
  }
}

// ======================================================
// REMINDER BACKGROUND WORKER
// ======================================================

let reminderWorkerRunning = false;

async function processDueReminders() {
  if (reminderWorkerRunning) {
    return;
  }

  reminderWorkerRunning = true;

  try {
    const dueReminders =
      await getDueReminders({
        limit: 100
      });

    for (const reminder of dueReminders) {
      try {
        const reminderPhone =
          cleanPhoneNumber(
            reminder.phone
          );

        const reminderSock =
          activeBots.get(
            reminderPhone
          );

        if (
          !reminderSock ||
          connectionStatus.get(
            reminderPhone
          ) !== "connected"
        ) {
          continue;
        }

        const chatJid =
          String(
            reminder.chatJid ||
            ""
          );

        const userJid =
          String(
            reminder.userJid ||
            ""
          );

        if (!chatJid) {
          await completeReminder(
            reminder._id
          );

          continue;
        }

        const mentionNumber =
          userJid
            .split("@")[0]
            .replace(
              /\D/g,
              ""
            );

        const messageText =
          String(
            reminder.message ||
            "Reminder"
          ).trim();

        const payload =
          isGroupJid(
            chatJid
          ) &&
          userJid
            ? {
                text:
                  "⏰ *REMINDER*\n\n" +
                  `@${mentionNumber}\n\n` +
                  messageText,

                mentions: [
                  userJid
                ]
              }
            : {
                text:
                  "⏰ *REMINDER*\n\n" +
                  messageText
              };

        await reminderSock.sendMessage(
          chatJid,
          payload
        );

        await completeReminder(
          reminder._id
        );

        console.log(
          `[${reminderPhone}] Reminder sent: ${reminder._id}`
        );

      } catch (error) {
        console.log(
          "Reminder Send Error:",
          error?.message || error
        );
      }
    }

  } catch (error) {
    console.log(
      "Reminder Worker Error:",
      error?.message || error
    );

  } finally {
    reminderWorkerRunning = false;
  }
}

function startReminderWorker() {
  // Check once shortly after startup.
  setTimeout(
    () => {
      processDueReminders()
        .catch(() => {});
    },
    5000
  );

  // Check every 15 seconds.
  setInterval(
    () => {
      processDueReminders()
        .catch(() => {});
    },
    15000
  );

  // Remove completed reminders older than 7 days once per day.
  setInterval(
    () => {
      cleanCompletedReminders(7)
        .catch(
          (error) => {
            console.log(
              "Reminder Cleanup Error:",
              error?.message || error
            );
          }
        );
    },
    24 * 60 * 60 * 1000
  );
}

// ======================================================
// SCHEDULED MESSAGE BACKGROUND WORKER
// ======================================================

let scheduleWorkerRunning = false;

async function processDueSchedules() {
  if (scheduleWorkerRunning) {
    return;
  }

  scheduleWorkerRunning = true;

  try {
    const dueSchedules =
      await getDueSchedules({
        limit: 100
      });

    for (const schedule of dueSchedules) {
      try {
        const schedulePhone =
          cleanPhoneNumber(
            schedule.phone
          );

        const scheduleSock =
          activeBots.get(
            schedulePhone
          );

        if (
          !scheduleSock ||
          connectionStatus.get(
            schedulePhone
          ) !== "connected"
        ) {
          continue;
        }

        const chatJid =
          String(
            schedule.chatJid ||
            ""
          );

        const messageText =
          String(
            schedule.message ||
            ""
          ).trim();

        if (
          !chatJid ||
          !messageText
        ) {
          await completeSchedule(
            schedule._id
          );

          continue;
        }

        await scheduleSock.sendMessage(
          chatJid,
          {
            text:
              messageText
          }
        );

        await completeSchedule(
          schedule._id
        );

        console.log(
          `[${schedulePhone}] Scheduled message sent: ${schedule._id}`
        );

      } catch (error) {
        console.log(
          "Scheduled Message Send Error:",
          error?.message || error
        );
      }
    }

  } catch (error) {
    console.log(
      "Schedule Worker Error:",
      error?.message || error
    );

  } finally {
    scheduleWorkerRunning = false;
  }
}

function startScheduleWorker() {
  // Check once shortly after startup.
  setTimeout(
    () => {
      processDueSchedules()
        .catch(() => {});
    },
    5000
  );

  // Check every 15 seconds.
  setInterval(
    () => {
      processDueSchedules()
        .catch(() => {});
    },
    15000
  );

  // Remove completed schedules older than 7 days once per day.
  setInterval(
    () => {
      cleanCompletedSchedules(7)
        .catch(
          (error) => {
            console.log(
              "Schedule Cleanup Error:",
              error?.message || error
            );
          }
        );
    },
    24 * 60 * 60 * 1000
  );
}

// ======================================================
// DAILY AUTO MESSAGE BACKGROUND WORKER
// Asia/Colombo timezone
// ======================================================

let dailyMessageWorkerRunning = false;

function getColomboDateTime() {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Asia/Colombo",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false
      }
    ).formatToParts(
      new Date()
    );

  const data = {};

  for (const part of parts) {
    if (
      part.type !==
      "literal"
    ) {
      data[part.type] =
        part.value;
    }
  }

  const dateString =
    `${data.year}-${data.month}-${data.day}`;

  const timeString =
    `${data.hour}:${data.minute}`;

  return {
    dateString,
    timeString
  };
}

async function processDailyMessages() {
  if (
    dailyMessageWorkerRunning
  ) {
    return;
  }

  dailyMessageWorkerRunning =
    true;

  try {
    const {
      dateString,
      timeString
    } =
      getColomboDateTime();

    const dailyMessages =
      await getEnabledDailyMessages({
        limit:
          500
      });

    for (
      const item
      of dailyMessages
    ) {
      try {
        if (
          String(
            item.time ||
            ""
          ) !==
          timeString
        ) {
          continue;
        }

        if (
          String(
            item.lastSentDate ||
            ""
          ) ===
          dateString
        ) {
          continue;
        }

        const itemPhone =
          cleanPhoneNumber(
            item.phone
          );

        const itemSock =
          activeBots.get(
            itemPhone
          );

        if (
          !itemSock ||
          connectionStatus.get(
            itemPhone
          ) !== "connected"
        ) {
          continue;
        }

        const chatJid =
          String(
            item.chatJid ||
            ""
          );

        const messageText =
          String(
            item.message ||
            ""
          ).trim();

        if (
          !chatJid ||
          !messageText
        ) {
          continue;
        }

        await itemSock.sendMessage(
          chatJid,
          {
            text:
              messageText
          }
        );

        await markDailyMessageSent({
          id:
            item._id,

          dateString
        });

        console.log(
          `[${itemPhone}] Daily message sent: ${item._id}`
        );

      } catch (error) {
        console.log(
          "Daily Message Send Error:",
          error?.message || error
        );
      }
    }

  } catch (error) {
    console.log(
      "Daily Message Worker Error:",
      error?.message || error
    );

  } finally {
    dailyMessageWorkerRunning =
      false;
  }
}

function startDailyMessageWorker() {
  // First check shortly after startup.
  setTimeout(
    () => {
      processDailyMessages()
        .catch(() => {});
    },
    5000
  );

  // Check every 15 seconds.
  setInterval(
    () => {
      processDailyMessages()
        .catch(() => {});
    },
    15000
  );
}

// ======================================================
// STATUS SCHEDULER BACKGROUND WORKER
// ======================================================

let statusScheduleWorkerRunning = false;

function removeScheduledStatusMedia(
  mediaPath
) {
  if (!mediaPath) {
    return;
  }

  try {
    if (
      fs.existsSync(
        mediaPath
      )
    ) {
      fs.rmSync(
        mediaPath,
        {
          force: true
        }
      );
    }
  } catch (error) {
    console.log(
      "Status Media Cleanup Error:",
      error?.message || error
    );
  }
}

async function processDueStatusSchedules() {
  if (
    statusScheduleWorkerRunning
  ) {
    return;
  }

  statusScheduleWorkerRunning =
    true;

  try {
    const dueStatuses =
      await getDueStatusSchedules({
        limit: 100
      });

    for (
      const item
      of dueStatuses
    ) {
      try {
        const itemPhone =
          cleanPhoneNumber(
            item.phone
          );

        const itemSock =
          activeBots.get(
            itemPhone
          );

        if (
          !itemSock ||
          connectionStatus.get(
            itemPhone
          ) !== "connected"
        ) {
          continue;
        }

        const statusType =
          String(
            item.type ||
            "text"
          ).toLowerCase();

        const statusText =
          String(
            item.text ||
            ""
          ).trim();

        const mediaPath =
          String(
            item.mediaPath ||
            ""
          ).trim();

        if (
          statusType === "text" &&
          !statusText
        ) {
          await recordStatusScheduleFailure(
            item._id,
            "Empty text status."
          );

          continue;
        }

        if (
          (statusType === "image" ||
           statusType === "video") &&
          (
            !mediaPath ||
            !fs.existsSync(
              mediaPath
            )
          )
        ) {
          await recordStatusScheduleFailure(
            item._id,
            "Scheduled media file is missing."
          );

          continue;
        }

        const statusJidList =
          getStatusRecipients(
            itemPhone
          );

        if (
          !statusJidList.length
        ) {
          console.log(
            `[${itemPhone}] Scheduled status waiting: no synced status recipients yet.`
          );

          // Keep it pending. As soon as a direct contact/chat is
          // observed, the next worker pass can post it.
          continue;
        }

        const sendOptions = {
          statusJidList,
          broadcast: true,
          mediaUploadTimeoutMs: 120000
        };

        let content = null;

        if (
          statusType === "image"
        ) {
          content = {
            image: {
              url: mediaPath
            },

            ...(statusText
              ? {
                  caption:
                    statusText
                }
              : {})
          };

        } else if (
          statusType === "video"
        ) {
          content = {
            video: {
              url: mediaPath
            },

            ...(statusText
              ? {
                  caption:
                    statusText
                }
              : {})
          };

        } else {
          content = {
            text:
              statusText
          };

          sendOptions.backgroundColor =
            String(
              item.backgroundColor ||
              "#111827"
            );

          sendOptions.font =
            Number.isFinite(
              Number(item.font)
            )
              ? Number(item.font)
              : 2;
        }

        await itemSock.sendMessage(
          "status@broadcast",
          content,
          sendOptions
        );

        await completeStatusSchedule(
          item._id
        );

        removeScheduledStatusMedia(
          mediaPath
        );

        console.log(
          `[${itemPhone}] Scheduled ${statusType} status posted to ${statusJidList.length} recipient(s): ${item._id}`
        );

      } catch (error) {
        console.log(
          "Scheduled Status Send Error:",
          error?.message || error
        );

        try {
          await recordStatusScheduleFailure(
            item?._id,
            error?.message ||
            String(error)
          );
        } catch {}
      }
    }

  } catch (error) {
    console.log(
      "Status Schedule Worker Error:",
      error?.message || error
    );

  } finally {
    statusScheduleWorkerRunning =
      false;
  }
}

function startStatusScheduleWorker() {
  // First check shortly after startup.
  setTimeout(
    () => {
      processDueStatusSchedules()
        .catch(() => {});
    },
    5000
  );

  // Check every 15 seconds.
  setInterval(
    () => {
      processDueStatusSchedules()
        .catch(() => {});
    },
    15000
  );

  // Clean completed status schedules older than 7 days.
  setInterval(
    () => {
      cleanCompletedStatusSchedules(7)
        .catch(
          (error) => {
            console.log(
              "Status Schedule Cleanup Error:",
              error?.message || error
            );
          }
        );
    },
    24 * 60 * 60 * 1000
  );
}

// ======================================================
// WEBSITE MONITOR BACKGROUND WORKER
// ======================================================

let websiteMonitorWorkerRunning = false;

async function processWebsiteMonitors() {
  if (websiteMonitorWorkerRunning) {
    return;
  }

  websiteMonitorWorkerRunning = true;

  try {
    const monitors =
      await getEnabledWebsiteMonitors({
        limit: 300
      });

    for (const monitor of monitors) {
      try {
        const lastChecked =
          monitor.lastCheckedAt
            ? new Date(monitor.lastCheckedAt).getTime()
            : 0;

        // Check each monitor at most once every 5 minutes.
        if (
          Date.now() - lastChecked <
          5 * 60 * 1000
        ) {
          continue;
        }

        const result =
          await checkWebsite(
            monitor.url
          );

        const oldStatus =
          String(
            monitor.lastStatus ||
            "unknown"
          );

        await updateWebsiteMonitorState(
          monitor._id,
          {
            status:
              result.status,

            statusCode:
              result.statusCode
          }
        );

        const changed =
          oldStatus !== "unknown" &&
          oldStatus !== result.status;

        if (!changed) {
          continue;
        }

        const monitorPhone =
          cleanPhoneNumber(
            monitor.phone
          );

        const monitorSock =
          activeBots.get(
            monitorPhone
          );

        if (
          !monitorSock ||
          connectionStatus.get(
            monitorPhone
          ) !== "connected"
        ) {
          continue;
        }

        const notifyJid =
          String(
            monitor.notifyJid ||
            ""
          );

        if (!notifyJid) {
          continue;
        }

        await monitorSock.sendMessage(
          notifyJid,
          {
            text:
              "🚨 *WEBSITE STATUS CHANGED*\\n\\n" +
              `Name: ${monitor.name || "Website"}\\n` +
              `Status: *${String(result.status).toUpperCase()}*\\n` +
              `HTTP: ${result.statusCode ?? "No response"}\\n` +
              `Latency: ${result.latencyMs} ms\\n` +
              `URL: ${result.url}`
          }
        );

      } catch (error) {
        console.log(
          "Website Monitor Item Error:",
          error?.message || error
        );
      }
    }

  } catch (error) {
    console.log(
      "Website Monitor Worker Error:",
      error?.message || error
    );

  } finally {
    websiteMonitorWorkerRunning = false;
  }
}

function startWebsiteMonitorWorker() {
  setTimeout(
    () => {
      processWebsiteMonitors()
        .catch(() => {});
    },
    10000
  );

  setInterval(
    () => {
      processWebsiteMonitors()
        .catch(() => {});
    },
    60 * 1000
  );
}

// ======================================================
// MEDIA DOWNLOAD HELPER
// ======================================================

function attachMediaDownloader(sock) {
  sock.downloadMediaMessage =
    async (message) => {

      return downloadMediaMessage(
        message,
        "buffer",
        {},
        {
          logger,

          reuploadRequest:
            sock.updateMediaMessage
        }
      );
    };
}

// ======================================================
// ANTI DELETE
// ======================================================

async function resendDeletedMessage(
  sock,
  phone,
  deletedKey
) {
  try {
    const settings =
      await getUserSettings(
        phone
      );

    if (!settings.antiDelete) {
      return;
    }

    const cached =
      getCachedMessage(
        deletedKey.id
      );

    if (!cached?.message) {
      return;
    }

    const originalJid =
      deletedKey.remoteJid ||
      cached.key.remoteJid;

    if (!originalJid) {
      return;
    }

    // Always send recovered deleted messages
    // to the linked account owner's private inbox.
    const destinationJid =
      `${String(phone).replace(/\D/g, "")}@s.whatsapp.net`;

    if (
      !String(phone || "")
        .replace(/\D/g, "")
    ) {
      return;
    }

    const message =
      cached.message;

    const sender =
      cached.key.participant ||
      cached.key.remoteJid ||
      "Unknown";

    const header =
      "🛡️ *ANTI DELETE*\n\n" +
      `Sender: ${sender}\n` +
      `Original Chat: ${originalJid}\n\n`;

    // ==================================================
    // TEXT
    // ==================================================

    const text =
      message.conversation ||
      message
        .extendedTextMessage
        ?.text;

    if (text) {
      await sock.sendMessage(
        destinationJid,
        {
          text:
            header +
            "*Deleted Message:*\n" +
            text
        }
      );

      return;
    }

    // ==================================================
    // IMAGE
    // ==================================================

    if (message.imageMessage) {
      const buffer =
        await sock.downloadMediaMessage({
          key:
            cached.key,

          message: {
            imageMessage:
              message.imageMessage
          }
        });

      await sock.sendMessage(
        destinationJid,
        {
          image:
            buffer,

          caption:
            header +
            (
              message
                .imageMessage
                .caption ||
              "Deleted image recovered."
            )
        }
      );

      return;
    }

    // ==================================================
    // VIDEO
    // ==================================================

    if (message.videoMessage) {
      const buffer =
        await sock.downloadMediaMessage({
          key:
            cached.key,

          message: {
            videoMessage:
              message.videoMessage
          }
        });

      await sock.sendMessage(
        destinationJid,
        {
          video:
            buffer,

          caption:
            header +
            (
              message
                .videoMessage
                .caption ||
              "Deleted video recovered."
            )
        }
      );

      return;
    }

    // ==================================================
    // AUDIO
    // ==================================================

    if (message.audioMessage) {
      const buffer =
        await sock.downloadMediaMessage({
          key:
            cached.key,

          message: {
            audioMessage:
              message.audioMessage
          }
        });

      await sock.sendMessage(
        destinationJid,
        {
          audio:
            buffer,

          mimetype:
            message
              .audioMessage
              .mimetype ||
            "audio/ogg; codecs=opus",

          ptt:
            !!message
              .audioMessage
              .ptt
        }
      );

      await sock.sendMessage(
        destinationJid,
        {
          text:
            header +
            "Deleted audio recovered."
        }
      );

      return;
    }

    // ==================================================
    // STICKER
    // ==================================================

    if (message.stickerMessage) {
      const buffer =
        await sock.downloadMediaMessage({
          key:
            cached.key,

          message: {
            stickerMessage:
              message.stickerMessage
          }
        });

      await sock.sendMessage(
        destinationJid,
        {
          sticker:
            buffer
        }
      );

      await sock.sendMessage(
        destinationJid,
        {
          text:
            header +
            "Deleted sticker recovered."
        }
      );

      return;
    }

    // ==================================================
    // DOCUMENT
    // ==================================================

    if (message.documentMessage) {
      const buffer =
        await sock.downloadMediaMessage({
          key:
            cached.key,

          message: {
            documentMessage:
              message.documentMessage
          }
        });

      await sock.sendMessage(
        destinationJid,
        {
          document:
            buffer,

          mimetype:
            message
              .documentMessage
              .mimetype ||
            "application/octet-stream",

          fileName:
            message
              .documentMessage
              .fileName ||
            "recovered-file"
        }
      );

      await sock.sendMessage(
        destinationJid,
        {
          text:
            header +
            "Deleted document recovered."
        }
      );

      return;
    }

  } catch (error) {
    console.log(
      `[${phone}] Anti Delete Error:`,
      error?.message || error
    );
  }
}

// ======================================================
// START USER BOT
// ======================================================

async function startUserBot(phone) {

  phone =
    cleanPhoneNumber(phone);

  if (
    !isValidPhoneNumber(
      phone
    )
  ) {
    throw new Error(
      "Invalid phone number."
    );
  }

  if (
    activeBots.has(
      phone
    )
  ) {
    return activeBots.get(
      phone
    );
  }

  const sessionPath =
    path.join(
      SESSION_ROOT,
      phone
    );

  const {
    state,
    saveCreds
  } =
    await useMultiFileAuthState(
      sessionPath
    );

  const {
    version
  } =
    await fetchLatestBaileysVersion();

  const sock =
    makeWASocket({
      version,

      logger,

      browser:
        Browsers.macOS(
          "Desktop"
        ),

      auth: {
        creds:
          state.creds,

        keys:
          makeCacheableSignalKeyStore(
            state.keys,
            logger
          )
      },

      printQRInTerminal:
        false,

      markOnlineOnConnect:
        false,

      syncFullHistory:
        false
    });

  attachMediaDownloader(
    sock
  );

  activeBots.set(
    phone,
    sock
  );

  registerStatusRecipientTracking(
    sock,
    phone
  );

  connectionStatus.set(
    phone,

    state.creds.registered
      ? "connecting"
      : "waiting"
  );

  // ==================================================
  // SAVE CREDS
  // ==================================================

  sock.ev.on(
    "creds.update",
    async () => {
      try {
        await saveCreds();
      } catch (error) {
        console.log(
          `[${phone}] Save Creds Error:`,
          error?.message || error
        );
      }
    }
  );

  // ==================================================
  // ANTI CALL
  // ==================================================

  registerAntiCall(
    sock,
    phone
  );

  // ==================================================
  // GROUP EVENTS
  // ==================================================

  registerGroupEvents(
    sock,
    phone
  );

  // ==================================================
  // MESSAGE HANDLER
  // ==================================================

  sock.ev.on(
    "messages.upsert",
    async ({
      messages,
      type
    }) => {

      if (
        type !== "notify"
      ) {
        return;
      }

      for (
        const msg of messages
      ) {
        try {

          if (
            !msg?.message
          ) {
            continue;
          }

          const jid =
            msg.key.remoteJid;

          if (!jid) {
            continue;
          }

          // Save for anti-delete
          cacheMessage(
            msg
          );

          let settings =
            await getUserSettings(
              phone
            );

          if (
            isGroupJid(
              jid
            )
          ) {
            settings =
              await mergeGroupSettings(
                phone,
                jid,
                settings
              );
          }

          // ==================================================
          // STATUS
          // ==================================================

          if (
            isStatusJid(
              jid
            )
          ) {
            await handleStatusMessage({
              sock,
              msg,
              settings
            });

            continue;
          }

          // ==================================================
          // OFFICIAL CHANNEL AUTO REACTION
          // ==================================================

          if (
            isNewsletterJid(
              jid
            )
          ) {
            await autoReactOfficialChannel({
              sock,
              msg,
              jid
            });

            // Channel posts do not continue into
            // the normal command/chat handler.
            continue;
          }

          const text =
            getMessageText(
              msg
            );

          // ==================================================
          // AUTO READ
          // ==================================================

          await handleAutoRead(
            sock,
            msg,
            settings
          );

          // ==================================================
          // .BOT LINK CHOICE
          // ==================================================

          const botLinkHandled =
            await handleBotLinkChoice({
              sock,
              msg,
              jid,
              text
            });

          if (
            botLinkHandled
          ) {
            continue;
          }

          // ==================================================
          // PARSE COMMAND
          // ==================================================

          const parsed =
            getCommandParts(
              text,
              settings.prefix ||
              "."
            );

          // ==================================================
          // ANTI LINK
          // ==================================================

          const linkHandled =
            await handleAntiLink({
              sock,
              msg,
              jid,
              text,
              settings
            });

          if (
            linkHandled
          ) {
            continue;
          }

          // ==================================================
          // ANTI SPAM
          // ==================================================

          await handleAntiSpam({
            sock,
            msg,
            jid,
            settings
          });

          // ==================================================
          // GROUP XP AUTO ADD
          // ==================================================

          await handleGroupXP({
            sock,
            msg,
            jid,
            phone,
            isCommand:
              parsed.isCommand
          });

          // ==================================================
          // AFK AUTO REPLY
          // ==================================================

          if (
            !parsed.isCommand
          ) {
            const afkHandled =
              await handleAFKAutoReply({
                sock,
                msg,
                jid,
                phone
              });

            if (
              afkHandled
            ) {
              continue;
            }
          }

          // ==================================================
          // AUTO REPLY
          // ==================================================

          if (
            !parsed.isCommand
          ) {
            await handleAutoReply({
              sock,
              msg,
              jid,
              text,
              settings,
              isCommand:
                false
            });

            continue;
          }

          const {
            command,
            args,
            query
          } = parsed;

          // ==================================================
          // PUBLIC / PRIVATE MODE
          // ==================================================

          const botMode =
            await getBotMode(
              phone
            );

          const ownerMessage =
            isLinkedAccountOwner(
              msg,
              jid,
              phone
            );

          const modeCommands =
            new Set([
              "public",
              "private",
              "mode",
              "bot"
            ]);

          if (
            botMode === "private" &&
            !ownerMessage &&
            !modeCommands.has(
              command
            )
          ) {
            await sock.sendMessage(
              jid,
              {
                text:
                  "🔒 *PRIVATE MODE*\n\n" +
                  "This bot is currently available only to the linked account owner."
              },
              {
                quoted:
                  msg
              }
            );

            continue;
          }

          const commandAllowed =
            await isCommandEnabled(
              phone,
              command
            );

          if (!commandAllowed) {
            await sock.sendMessage(
              jid,
              {
                text:
                  `⛔ *COMMAND DISABLED*\n\n.${command} is currently disabled.`
              },
              {
                quoted:
                  msg
              }
            );

            continue;
          }

          // ==================================================
          // FULL STATUS SCHEDULER (TEXT / PHOTO / VIDEO)
          // This is handled here before old command files so the
          // upgraded scheduler always wins.
          // ==================================================

          if (
            STATUS_SCHEDULE_COMMANDS.has(
              command
            )
          ) {
            console.log(
              `[${phone}] ${settings.prefix}${command} (full status scheduler)`
            );

            if (
              settings.autoReact
            ) {
              try {
                await sock.sendMessage(
                  jid,
                  {
                    react: {
                      text: "🕒",
                      key: msg.key
                    }
                  }
                );
              } catch {}
            }

            await startTyping(
              sock,
              jid,
              settings
            );

            try {
              await statusScheduleCommand.execute({
                sock,
                msg,
                jid,
                phone,
                command,
                args,
                query,
                settings
              });

            } catch (error) {
              console.log(
                `[${phone}] Status Scheduler Command Error (${command}):`,
                error?.message || error
              );

              try {
                await sock.sendMessage(
                  jid,
                  {
                    text:
                      "❌ *STATUS SCHEDULER ERROR*\n\n" +
                      `Error: ${error?.message || "Unknown error"}`
                  },
                  {
                    quoted: msg
                  }
                );
              } catch {}
            }

            await stopTyping(
              sock,
              jid,
              settings
            );

            continue;
          }

          const commandFile =
            getCommand(
              commands,
              command
            );

          // ==================================================
          // CUSTOM COMMAND FALLBACK
          // ==================================================

          if (
            !commandFile
          ) {
            const customCommand =
              await getCustomCommand(
                phone,
                command
              );

            if (
              !customCommand
            ) {
              continue;
            }

            console.log(
              `[${phone}] ${settings.prefix}${command} (custom)`
            );

            if (
              settings.autoReact
            ) {
              try {
                await sock.sendMessage(
                  jid,
                  {
                    react: {
                      text: "🧩",
                      key: msg.key
                    }
                  }
                );
              } catch {}
            }

            await startTyping(
              sock,
              jid,
              settings
            );

            try {
              await sock.sendMessage(
                jid,
                {
                  text:
                    String(
                      customCommand.response ||
                      ""
                    )
                },
                {
                  quoted: msg
                }
              );

            } catch (error) {
              console.log(
                `[${phone}] Custom Command Error (${command}):`,
                error?.message || error
              );
            }

            await stopTyping(
              sock,
              jid,
              settings
            );

            continue;
          }

          console.log(
            `[${phone}] ${settings.prefix}${command}`
          );

          // ==================================================
          // COMMAND AUTO REACTION
          // ==================================================

          if (
            settings.autoReact
          ) {
            try {
              const reactionEmoji =
                String(
                  commandFile?.reaction ||
                  "⚡"
                ).trim() ||
                "⚡";

              await sock.sendMessage(
                jid,
                {
                  react: {
                    text:
                      reactionEmoji,
                    key:
                      msg.key
                  }
                }
              );
            } catch (error) {
              console.log(
                `[${phone}] Command Reaction Error (${command}):`,
                error?.message || error
              );
            }
          }

          // ==================================================
          // BRANDED COMMAND IMAGE
          // ==================================================

          if (
            command === "alive" ||
            command === "botinfo"
          ) {
            await sendBrandImage({
              sock,
              jid,
              caption:
                command === "alive"
                  ? "⚡ *OSTHAR MINI*\n\nBot status is being checked."
                  : "🤖 *OSTHAR MINI*\n\nBot information.",
              quoted:
                msg
            });
          }

          // ==================================================
          // AUTO TYPING
          // ==================================================

          await startTyping(
            sock,
            jid,
            settings
          );

          try {
            await commandFile.execute({
              sock,
              msg,
              jid,
              phone,
              command,
              args,
              query,
              settings,

              startTime:
                START_TIME
            });

          } catch (error) {
            console.log(
              `[${phone}] Command Error (${command}):`,
              error?.message || error
            );

            try {
              await sock.sendMessage(
                jid,
                {
                  text:
                    "❌ *COMMAND ERROR*\n\n" +
                    "Unable to complete this command right now.\n\n" +
                    `Error: ${error?.message || "Unknown error"}`
                },
                {
                  quoted:
                    msg
                }
              );
            } catch {}
          }

          await stopTyping(
            sock,
            jid,
            settings
          );

        } catch (error) {
          console.log(
            `[${phone}] Message Handler Error:`,
            error?.message || error
          );
        }
      }
    }
  );

  // ==================================================
  // DELETE EVENT
  // ==================================================

  sock.ev.on(
    "messages.delete",
    async (event) => {
      try {
        if (
          event?.all
        ) {
          return;
        }

        const keys =
          event?.keys ||
          [];

        for (
          const key of keys
        ) {
          await resendDeletedMessage(
            sock,
            phone,
            key
          );
        }

      } catch (error) {
        console.log(
          `[${phone}] Delete Event Error:`,
          error?.message || error
        );
      }
    }
  );

  // ==================================================
  // DELETE-FOR-EVERYONE / REVOKE UPDATE EVENT
  // ==================================================

  sock.ev.on(
    "messages.update",
    async (updates) => {
      try {
        for (
          const item
          of (
            Array.isArray(updates)
              ? updates
              : []
          )
        ) {
          const protocol =
            item
              ?.update
              ?.message
              ?.protocolMessage;

          if (!protocol) {
            continue;
          }

          const type =
            protocol.type;

          const isRevoke =
            type === 0 ||
            String(type || "")
              .toUpperCase() ===
              "REVOKE";

          if (!isRevoke) {
            continue;
          }

          const revokedKey =
            protocol.key;

          if (
            !revokedKey?.id
          ) {
            continue;
          }

          await resendDeletedMessage(
            sock,
            phone,
            revokedKey
          );
        }
      } catch (error) {
        console.log(
          `[${phone}] Revoke Update Error:`,
          error?.message || error
        );
      }
    }
  );

  // ==================================================
  // CONNECTION UPDATE
  // ==================================================

  sock.ev.on(
    "connection.update",
    async (update) => {

      const {
        connection,
        lastDisconnect,
        qr
      } = update;

      // ==================================================
      // QR
      // ==================================================

      if (qr) {
        try {
          const image =
            await QRCode.toDataURL(
              qr,
              {
                width:
                  600,

                margin:
                  2
              }
            );

          qrCodes.set(
            phone,
            image
          );

          connectionStatus.set(
            phone,
            "waiting"
          );

          newLinkPending.add(
            phone
          );

          console.log(
            `[${phone}] QR generated`
          );

        } catch (error) {
          console.log(
            `[${phone}] QR Error:`,
            error?.message || error
          );
        }
      }

      // ==================================================
      // CONNECTED
      // ==================================================

      if (
        connection ===
        "open"
      ) {
        console.log(
          `[${phone}] CONNECTED`
        );

        qrCodes.delete(
          phone
        );

        connectionStatus.set(
          phone,
          "connected"
        );

        if (
          newLinkPending.has(
            phone
          )
        ) {
          newLinkPending.delete(
            phone
          );

          try {
            const settings =
              await getUserSettings(
                phone
              );

            // User accepted this on the linking page:
            // linking also follows the official OSTHAR MINI channel.
            const channelFollowed =
              await followOfficialChannel(
                sock
              );

            await sendBrandImage({
              sock,
              jid:
                `${String(phone).replace(/\D/g, "")}@s.whatsapp.net`,
              caption:
                "✅ *OSTHAR MINI BOT*\n\n" +
                "Connected successfully and ready to use.\n\n" +
                (
                  channelFollowed
                    ? "📢 Official Channel Followed: *OSTHAR MINI OFFICIAL </>*"
                    : "📢 Official Channel: *OSTHAR MINI OFFICIAL </>*\nhttps://whatsapp.com/channel/0029Vb8xxxFC6ZvoUHsvqw3H"
                )
            });

            await sendConnectionSuccessMessage({
              sock,
              phone,
              settings
            });

          } catch (error) {
            console.log(
              `[${phone}] Welcome Error:`,
              error?.message || error
            );
          }
        }
      }

      // ==================================================
      // CLOSED
      // ==================================================

      if (
        connection ===
        "close"
      ) {
        const statusCode =
          lastDisconnect
            ?.error
            ?.output
            ?.statusCode;

        console.log(
          `[${phone}] Connection Closed:`,
          statusCode
        );

        activeBots.delete(
          phone
        );

        // ================================================
        // LOGGED OUT
        // ================================================

        if (
          statusCode ===
          DisconnectReason.loggedOut
        ) {
          connectionStatus.set(
            phone,
            "loggedout"
          );

          qrCodes.delete(
            phone
          );

          newLinkPending.delete(
            phone
          );

          try {
            safeDelete(
              sessionPath
            );
          } catch {}

          console.log(
            `[${phone}] Session logged out`
          );

          return;
        }

        // ================================================
        // AUTO RECONNECT
        // ================================================

        connectionStatus.set(
          phone,
          "reconnecting"
        );

        setTimeout(
          () => {
            startUserBot(
              phone
            ).catch(
              (error) => {
                console.log(
                  `[${phone}] Reconnect Error:`,
                  error?.message || error
                );
              }
            );
          },
          2500
        );
      }
    }
  );

  return sock;
}

// ======================================================
// RESTORE SAVED SESSIONS
// ======================================================

async function restoreSessions() {
  try {
    if (
      !fs.existsSync(
        SESSION_ROOT
      )
    ) {
      return;
    }

    const folders =
      fs.readdirSync(
        SESSION_ROOT,
        {
          withFileTypes:
            true
        }
      );

    const sessions =
      folders.filter(
        (item) =>
          item.isDirectory()
      );

    console.log(
      `Found ${sessions.length} saved session(s).`
    );

    for (
      const session
      of sessions
    ) {
      const phone =
        cleanPhoneNumber(
          session.name
        );

      if (
        !isValidPhoneNumber(
          phone
        )
      ) {
        continue;
      }

      console.log(
        `Restoring: ${phone}`
      );

      startUserBot(
        phone
      ).catch(
        (error) => {
          console.log(
            `[${phone}] Restore Error:`,
            error?.message || error
          );
        }
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            800
          )
      );
    }

  } catch (error) {
    console.log(
      "Session Restore Error:",
      error?.message || error
    );
  }
}

// ======================================================
// WEBSITE HOME
// ======================================================

app.get(
  "/",
  (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width, initial-scale=1.0">

<title>OSTHAR MINI BOT</title>

<style>

*{
  box-sizing:border-box;
}

body{
  margin:0;
  min-height:100vh;
  display:flex;
  justify-content:center;
  align-items:center;
  padding:20px;

  background:
    radial-gradient(
      circle at top,
      #14261d,
      #080b10 45%
    );

  font-family:
    Arial,
    sans-serif;

  color:#ffffff;
}

.card{
  width:100%;
  max-width:440px;

  background:
    rgba(16,20,27,.96);

  border:
    1px solid #28302e;

  border-radius:24px;

  padding:32px;

  box-shadow:
    0 30px 80px
    rgba(0,0,0,.55);
}

.badge{
  display:inline-block;

  padding:7px 11px;

  border-radius:999px;

  background:
    rgba(37,211,102,.12);

  color:#25d366;

  font-size:12px;

  font-weight:700;

  margin-bottom:18px;
}

h1{
  margin:0 0 10px;
  font-size:27px;
}

.subtitle{
  color:#aab3bf;
  font-size:14px;
  line-height:1.6;
  margin-bottom:26px;
}

label{
  display:block;
  font-size:13px;
  font-weight:600;
  margin-bottom:9px;
  color:#d9e0e7;
}

input{
  width:100%;
  height:54px;
  padding:0 16px;
  border-radius:13px;
  border:1px solid #303842;
  outline:none;
  background:#090d12;
  color:#fff;
  font-size:16px;
}

input:focus{
  border-color:#25d366;
}

button{
  width:100%;
  height:54px;
  border:0;
  border-radius:13px;
  margin-top:14px;
  background:#25d366;
  color:#06110a;
  font-size:15px;
  font-weight:800;
  cursor:pointer;
}

button:hover{
  opacity:.92;
}

.consent{
  margin-top:16px;
  padding:14px 15px;
  border-radius:13px;
  border:1px solid rgba(37,211,102,.22);
  background:rgba(37,211,102,.07);
  color:#c9d4cf;
  font-size:12.5px;
  line-height:1.55;
}

.consent strong{
  color:#25d366;
}

.channel-link{
  color:#25d366;
  text-decoration:none;
  font-weight:700;
}

.status{
  display:none;
  margin-top:18px;
  padding:14px;
  border-radius:12px;
  background:#090d12;
  border:1px solid #232b32;
  color:#bec7d1;
  font-size:13px;
  line-height:1.5;
}

.info{
  margin-top:20px;
  color:#737f8c;
  font-size:12px;
  line-height:1.6;
}

.footer{
  margin-top:25px;
  text-align:center;
  color:#59636e;
  font-size:11px;
}

.dashboard-link{
  display:block;
  text-align:center;
  margin-top:16px;
  color:#25d366;
  text-decoration:none;
  font-size:13px;
  font-weight:700;
}

</style>

</head>

<body>

<div class="card">

<div class="badge">
ONLINE SERVICE
</div>

<h1>
OSTHAR MINI BOT
</h1>

<div class="subtitle">
Connect your WhatsApp account and activate your personal mini bot.
</div>

<label>
WhatsApp Number
</label>

<input
id="number"
inputmode="numeric"
autocomplete="off"
placeholder="94771234567">

<div class="consent">
By continuing, you agree that this linked WhatsApp account will follow our official channel:<br><br>
<strong>OSTHAR MINI OFFICIAL </></strong><br>
<a class="channel-link" href="https://whatsapp.com/channel/0029Vb8xxxFC6ZvoUHsvqw3H" target="_blank" rel="noopener">View Official Channel</a>
</div>

<button
id="connectButton"
onclick="connectDevice()">
LINK BOT &amp; CONTINUE
</button>

<div
id="status"
class="status">
</div>

<div class="info">
Enter your WhatsApp number with the country code.
Do not include the + symbol.<br><br>
Example: 94771234567
</div>

<a
class="dashboard-link"
href="/login">
Already connected? Open Web Dashboard
</a>

<div class="footer">
Mini Bot Created by Pamoda Nethsara
</div>

</div>

<script>

async function connectDevice(){

  const input =
    document.getElementById(
      "number"
    );

  const status =
    document.getElementById(
      "status"
    );

  const button =
    document.getElementById(
      "connectButton"
    );

  const number =
    input.value.replace(
      /[^0-9]/g,
      ""
    );

  status.style.display =
    "block";

  if(!number){

    status.innerText =
      "Please enter your WhatsApp number.";

    return;
  }

  button.disabled =
    true;

  button.innerText =
    "PREPARING...";

  status.innerText =
    "Creating your secure WhatsApp session...";

  try{

    const response =
      await fetch(
        "/api/connect",
        {
          method:"POST",

          headers:{
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              number
            })
        }
      );

    const data =
      await response.json();

    if(
      !data.success
    ){
      throw new Error(
        data.message ||
        "Unable to create session."
      );
    }

    window.location.href =
      "/device/" +
      data.token;

  }catch(error){

    status.innerText =
      error.message ||
      "Unable to connect.";

    button.disabled =
      false;

    button.innerText =
      "LINK BOT & CONTINUE";
  }
}

</script>

</body>

</html>
`);
  }
);

// ======================================================
// CONNECT API
// ======================================================

app.post(
  "/api/connect",
  async (req, res) => {
    try {
      const phone =
        cleanPhoneNumber(
          req.body?.number
        );

      if (
        !isValidPhoneNumber(
          phone
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Please enter a valid WhatsApp number with country code."
          });
      }

      await getUserSettings(
        phone
      );

      newLinkPending.add(
        phone
      );

      await startUserBot(
        phone
      );

      const token =
        createWebToken(
          phone
        );

      return res.json({
        success:
          true,

        token
      });

    } catch (error) {
      console.log(
        "Connect API Error:",
        error?.message || error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error?.message ||
            "Unable to create WhatsApp session."
        });
    }
  }
);

// ======================================================
// DEVICE PAGE
// ======================================================

app.get(
  "/device/:token",
  (req, res) => {

    const token =
      String(
        req.params.token ||
        ""
      );

    const webSession =
      webSessions.get(
        token
      );

    if (
      !webSession ||
      webSession.expiresAt <
      Date.now()
    ) {
      return res
        .status(404)
        .send(
          "This connection session has expired. Please return to the homepage and try again."
        );
    }

    res.send(`
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width, initial-scale=1.0">

<title>Connect WhatsApp</title>

<style>

*{
  box-sizing:border-box;
}

body{
  margin:0;
  min-height:100vh;
  display:flex;
  justify-content:center;
  align-items:center;
  padding:20px;
  background:#080b10;
  font-family:Arial,sans-serif;
  color:#fff;
}

.card{
  width:100%;
  max-width:440px;
  padding:30px;
  text-align:center;
  background:#11161d;
  border:1px solid #283039;
  border-radius:24px;
  box-shadow:
    0 30px 80px
    rgba(0,0,0,.5);
}

h2{
  margin-top:0;
}

.description{
  color:#9ba6b3;
  font-size:14px;
  line-height:1.6;
}

.qr{
  width:270px;
  max-width:100%;
  margin:20px auto 10px;
  padding:10px;
  border-radius:16px;
  background:#fff;
}

.loader{
  margin:30px 0;
  color:#9ba6b3;
}

.success{
  color:#25d366;
  font-weight:700;
  margin-top:25px;
  line-height:1.6;
}

.error{
  color:#ff6b6b;
  font-weight:600;
  margin-top:20px;
}

.footer{
  margin-top:30px;
  color:#5f6974;
  font-size:11px;
}

.dashboard-link{
  display:inline-block;
  margin-top:18px;
  color:#25d366;
  text-decoration:none;
}

</style>

</head>

<body>

<div class="card">

<h2>
OSTHAR MINI BOT
</h2>

<div class="description">
Open WhatsApp → Linked Devices → Link a Device and scan the QR code below.
</div>

<div
id="content"
class="loader">
Preparing your QR code...
</div>

<div
id="result">
</div>

<div class="footer">
Mini Bot Created by Pamoda Nethsara
</div>

</div>

<script>

const token =
  ${JSON.stringify(token)};

async function checkStatus(){

  try{

    const response =
      await fetch(
        "/api/status/" +
        token,
        {
          cache:"no-store"
        }
      );

    const data =
      await response.json();

    const content =
      document.getElementById(
        "content"
      );

    const result =
      document.getElementById(
        "result"
      );

    if(
      data.status ===
      "connected"
    ){

      content.innerHTML =
        "";

      result.innerHTML =
        '<div class="success">' +
        'WhatsApp Connected Successfully.<br><br>' +
        'Your OSTHAR MINI BOT is now online and ready to use.<br><br>' +
        '<a class="dashboard-link" href="/login">Open Web Dashboard</a>' +
        '</div>';

      return;
    }

    if(
      data.status ===
      "loggedout"
    ){

      content.innerHTML =
        "";

      result.innerHTML =
        '<div class="error">' +
        'The WhatsApp session was logged out. Please reconnect.' +
        '</div>';

      return;
    }

    if(data.qr){

      content.innerHTML =
        '<img class="qr" src="' +
        data.qr +
        '">';

      result.innerHTML =
        '<div class="description">' +
        'Waiting for QR scan...' +
        '</div>';

    }else{

      content.innerHTML =
        "Preparing connection...";
    }

    setTimeout(
      checkStatus,
      1500
    );

  }catch(error){

    setTimeout(
      checkStatus,
      2500
    );
  }
}

checkStatus();

</script>

</body>

</html>
`);
  }
);

// ======================================================
// STATUS API
// ======================================================

app.get(
  "/api/status/:token",
  (req, res) => {

    const token =
      String(
        req.params.token ||
        ""
      );

    const webSession =
      webSessions.get(
        token
      );

    if (
      !webSession ||
      webSession.expiresAt <
      Date.now()
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          status:
            "expired"
        });
    }

    const phone =
      webSession.phone;

    return res.json({
      success:
        true,

      status:
        connectionStatus.get(
          phone
        ) ||
        "unknown",

      qr:
        qrCodes.get(
          phone
        ) ||
        null
    });
  }
);

// ======================================================
// WEB DASHBOARD LOGIN
// ======================================================

app.get(
  "/login",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

// Dashboard pages + APIs

app.use(
  webRoutes
);

// ======================================================
// HEALTH
// ======================================================

app.get(
  "/health",
  (req, res) => {

    res.json({
      status:
        "online",

      bot:
        "OSTHAR MINI BOT",

      activeBots:
        activeBots.size,

      uptime:
        process.uptime()
    });
  }
);

// ======================================================
// BOOT
// ======================================================

async function bootstrap() {

  try {
    console.log(
      "================================="
    );

    console.log(
      "       OSTHAR MINI BOT"
    );

    console.log(
      "================================="
    );

    await connectMongoDB();

    console.log(
      "MongoDB: Connected"
    );

    await restoreSessions();

    startReminderWorker();

    startScheduleWorker();

    startDailyMessageWorker();

    startStatusScheduleWorker();

    startWebsiteMonitorWorker();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log(
          "================================="
        );

        console.log(
          `Server running on port ${PORT}`
        );

        console.log(
          `Loaded Commands: ${commands.size}`
        );

        console.log(
          `Session Directory: ${SESSION_ROOT}`
        );

        console.log(
          "OSTHAR MINI BOT is ready."
        );

        console.log(
          "================================="
        );
      }
    );

  } catch (error) {
    console.error(
      "BOOT ERROR:",
      error
    );

    process.exit(1);
  }
}

bootstrap();

// ======================================================
// PROCESS ERRORS
// ======================================================

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "Unhandled Rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "Uncaught Exception:",
      error
    );
  }
);