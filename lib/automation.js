const {
  getUserSettings
} = require("../database/settings");

const {
  isGroupJid,
  isStatusJid
} = require("./helpers");

// ==========================================
// MESSAGE CACHE - ANTI DELETE
// ==========================================

const messageCache = new Map();

const messageIdIndex = new Map();

const MAX_CACHE = 5000;

function makeCacheKey(msgOrKey = {}) {
  const key =
    msgOrKey?.key ||
    msgOrKey ||
    {};

  const remoteJid =
    String(
      key?.remoteJid ||
      ""
    );

  const id =
    String(
      key?.id ||
      ""
    );

  if (!id) {
    return null;
  }

  return `${remoteJid}:${id}`;
}

function removeCacheEntry(cacheKey) {
  const item =
    messageCache.get(
      cacheKey
    );

  if (!item) {
    return;
  }

  const id =
    String(
      item?.msg?.key?.id ||
      ""
    );

  messageCache.delete(
    cacheKey
  );

  if (!id) {
    return;
  }

  const keys =
    messageIdIndex.get(
      id
    );

  if (!keys) {
    return;
  }

  keys.delete(
    cacheKey
  );

  if (!keys.size) {
    messageIdIndex.delete(
      id
    );
  }
}

function cacheMessage(msg) {
  try {
    if (
      !msg?.key?.id ||
      !msg?.message
    ) {
      return;
    }

    // Anti-Delete is only for messages received from OTHER users.
    // Do not cache messages sent by the linked account itself.
    if (
      msg?.key?.fromMe === true
    ) {
      return;
    }

    // Never overwrite the original message with
    // the later protocol/revoke wrapper.
    if (
      msg?.message?.protocolMessage
    ) {
      return;
    }

    const cacheKey =
      makeCacheKey(
        msg
      );

    if (!cacheKey) {
      return;
    }

    messageCache.set(
      cacheKey,
      {
        msg,
        savedAt:
          Date.now()
      }
    );

    const id =
      String(
        msg.key.id
      );

    if (
      !messageIdIndex.has(id)
    ) {
      messageIdIndex.set(
        id,
        new Set()
      );
    }

    messageIdIndex
      .get(id)
      .add(
        cacheKey
      );

    // Prevent unlimited memory growth.
    while (
      messageCache.size >
      MAX_CACHE
    ) {
      const firstKey =
        messageCache
          .keys()
          .next()
          .value;

      if (!firstKey) {
        break;
      }

      removeCacheEntry(
        firstKey
      );
    }

  } catch (error) {
    console.log(
      "Message Cache Error:",
      error?.message || error
    );
  }
}

function getCachedMessage(
  messageIdOrKey,
  remoteJid = ""
) {
  const keyObject =
    (
      messageIdOrKey &&
      typeof messageIdOrKey ===
        "object"
    )
      ? messageIdOrKey
      : {
          id:
            messageIdOrKey,
          remoteJid
        };

  const directKey =
    makeCacheKey(
      keyObject
    );

  if (
    directKey &&
    messageCache.has(
      directKey
    )
  ) {
    return (
      messageCache.get(
        directKey
      )?.msg ||
      null
    );
  }

  const id =
    String(
      keyObject?.id ||
      ""
    );

  if (!id) {
    return null;
  }

  const candidates =
    messageIdIndex.get(
      id
    );

  if (!candidates) {
    return null;
  }

  // Prefer a matching chat when one is supplied.
  const wantedJid =
    String(
      keyObject?.remoteJid ||
      ""
    );

  if (wantedJid) {
    for (
      const cacheKey of candidates
    ) {
      const item =
        messageCache.get(
          cacheKey
        );

      if (
        String(
          item?.msg?.key
            ?.remoteJid ||
          ""
        ) ===
        wantedJid
      ) {
        return (
          item?.msg ||
          null
        );
      }
    }
  }

  // Final fallback: message IDs are usually unique.
  for (
    const cacheKey of candidates
  ) {
    const item =
      messageCache.get(
        cacheKey
      );

    if (item?.msg) {
      return item.msg;
    }
  }

  return null;
}

function deleteCachedMessage(
  messageIdOrKey,
  remoteJid = ""
) {
  const keyObject =
    (
      messageIdOrKey &&
      typeof messageIdOrKey ===
        "object"
    )
      ? messageIdOrKey
      : {
          id:
            messageIdOrKey,
          remoteJid
        };

  const directKey =
    makeCacheKey(
      keyObject
    );

  if (
    directKey &&
    messageCache.has(
      directKey
    )
  ) {
    removeCacheEntry(
      directKey
    );

    return;
  }

  const id =
    String(
      keyObject?.id ||
      ""
    );

  if (!id) {
    return;
  }

  const candidates =
    messageIdIndex.get(
      id
    );

  if (!candidates) {
    return;
  }

  for (
    const cacheKey of [
      ...candidates
    ]
  ) {
    removeCacheEntry(
      cacheKey
    );
  }
}

// ==========================================
// AUTO READ
// ==========================================

async function handleAutoRead(
  sock,
  msg,
  settings
) {
  try {
    if (!settings?.autoRead) {
      return;
    }

    if (!msg?.key) {
      return;
    }

    await sock.readMessages([
      msg.key
    ]);

  } catch (error) {
    console.log(
      "Auto Read Error:",
      error?.message || error
    );
  }
}

// ==========================================
// AUTO TYPING
// ==========================================

async function startTyping(
  sock,
  jid,
  settings
) {
  try {
    if (!settings?.autoTyping) {
      return;
    }

    await sock.sendPresenceUpdate(
      "composing",
      jid
    );

  } catch {}
}

async function stopTyping(
  sock,
  jid,
  settings
) {
  try {
    if (!settings?.autoTyping) {
      return;
    }

    await sock.sendPresenceUpdate(
      "paused",
      jid
    );

  } catch {}
}

// ==========================================
// AUTO REPLY
// ==========================================

async function handleAutoReply({
  sock,
  msg,
  jid,
  text,
  settings,
  isCommand = false
}) {
  try {
    if (!settings?.autoReply) {
      return;
    }

    if (isCommand) {
      return;
    }

    if (msg?.key?.fromMe) {
      return;
    }

    if (isGroupJid(jid)) {
      return;
    }

    if (isStatusJid(jid)) {
      return;
    }

    if (!text) {
      return;
    }

    await sock.sendMessage(
      jid,
      {
        text:
          settings.autoReplyMessage ||
          "Thank you for your message. OSTHAR MINI BOT is currently active."
      },
      {
        quoted: msg
      }
    );

  } catch (error) {
    console.log(
      "Auto Reply Error:",
      error?.message || error
    );
  }
}

// ==========================================
// STATUS SEEN / REACTION / REPLY
// ==========================================

async function handleStatusMessage({
  sock,
  msg,
  settings
}) {
  try {
    const jid =
      msg?.key?.remoteJid;

    if (
      jid !== "status@broadcast"
    ) {
      return;
    }

    // ======================================
    // AUTO STATUS SEEN
    // ======================================

    if (
      settings?.autoStatusSeen
    ) {
      try {
        await sock.readMessages([
          msg.key
        ]);

      } catch (error) {
        console.log(
          "Status Seen Error:",
          error?.message || error
        );
      }
    }

    // ======================================
    // STATUS AUTO REACTION
    // ======================================

    if (
      settings?.statusReact &&
      !msg.key.fromMe
    ) {
      try {
        const reactionEmoji =
          String(
            settings?.statusReactEmoji ||
            "💚"
          ).trim() || "💚";

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
          "Status Reaction Error:",
          error?.message || error
        );
      }
    }

    // ======================================
    // STATUS REPLY
    // ======================================

    if (
      settings?.statusReply &&
      !msg.key.fromMe
    ) {
      const participant =
        msg.key.participant;

      if (participant) {
        try {
          await sock.sendMessage(
            participant,
            {
              text:
                "Your status has been viewed by OSTHAR MINI BOT."
            }
          );

        } catch (error) {
          console.log(
            "Status Reply Error:",
            error?.message || error
          );
        }
      }
    }

  } catch (error) {
    console.log(
      "Status Automation Error:",
      error?.message || error
    );
  }
}

// ==========================================
// ANTI CALL
// ==========================================

function registerAntiCall(
  sock,
  phone
) {
  sock.ev.on(
    "call",
    async (calls) => {
      try {
        const settings =
          await getUserSettings(
            phone
          );

        if (
          !settings?.antiCall
        ) {
          return;
        }

        for (
          const call of calls
        ) {
          if (
            call.status !==
            "offer"
          ) {
            continue;
          }

          // Reject call
          try {
            if (
              typeof sock.rejectCall ===
              "function"
            ) {
              await sock.rejectCall(
                call.id,
                call.from
              );
            }

          } catch (error) {
            console.log(
              "Reject Call Error:",
              error?.message || error
            );
          }

          // Send warning
          try {
            await sock.sendMessage(
              call.from,
              {
                text:
                  "📵 *CALL REJECTED*\n\n" +
                  "This WhatsApp account does not accept incoming calls while Anti Call is enabled."
              }
            );

          } catch {}
        }

      } catch (error) {
        console.log(
          "Anti Call Error:",
          error?.message || error
        );
      }
    }
  );
}

// ==========================================
// CLEAN OLD CACHE
// ==========================================

function cleanMessageCache(
  maxAgeHours = 24
) {
  const maxAge =
    maxAgeHours *
    60 *
    60 *
    1000;

  const now =
    Date.now();

  for (
    const [cacheKey, item]
    of messageCache.entries()
  ) {
    if (
      now - item.savedAt >
      maxAge
    ) {
      removeCacheEntry(
        cacheKey
      );
    }
  }
}

// ==========================================
// AUTO CACHE CLEANUP
// ==========================================

setInterval(
  () => {
    cleanMessageCache(
      24
    );
  },

  30 * 60 * 1000
);

// ==========================================
// EXPORT
// ==========================================

module.exports = {
  cacheMessage,

  getCachedMessage,

  deleteCachedMessage,

  handleAutoRead,

  startTyping,

  stopTyping,

  handleAutoReply,

  handleStatusMessage,

  registerAntiCall,

  cleanMessageCache
};