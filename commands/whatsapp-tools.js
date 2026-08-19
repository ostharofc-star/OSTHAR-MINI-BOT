const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

﻿// ======================================================
// OSTHAR MINI BOT - WHATSAPP TOOLS
// LID-aware version
// ======================================================

function cleanNumber(value = "") {
  return String(value)
    .replace(/[^0-9]/g, "");
}

function numberToJid(number = "") {
  const clean = cleanNumber(number);

  return clean
    ? `${clean}@s.whatsapp.net`
    : null;
}

function getContextInfo(msg) {
  const message =
    msg?.message || {};

  return (
    message
      .extendedTextMessage
      ?.contextInfo ||
    message
      .imageMessage
      ?.contextInfo ||
    message
      .videoMessage
      ?.contextInfo ||
    message
      .documentMessage
      ?.contextInfo ||
    message
      .audioMessage
      ?.contextInfo ||
    message
      .stickerMessage
      ?.contextInfo ||
    null
  );
}

function getTargetJid(
  msg,
  args = []
) {
  const context =
    getContextInfo(msg);

  if (context?.participant) {
    return context.participant;
  }

  const mentioned =
    context
      ?.mentionedJid?.[0];

  if (mentioned) {
    return mentioned;
  }

  const number =
    cleanNumber(
      args?.[0] || ""
    );

  return numberToJid(number);
}

async function sendText(
  sock,
  jid,
  msg,
  text
) {
  return sock.sendMessage(
    jid,
    { text },
    { quoted: msg }
  );
}

// ======================================================
// JID HELPERS
// ======================================================

function isLid(jid = "") {
  return String(jid)
    .endsWith("@lid");
}

function isPhoneJid(jid = "") {
  return String(jid)
    .endsWith(
      "@s.whatsapp.net"
    );
}

function getDisplayJidType(
  jid = ""
) {
  if (isLid(jid)) {
    return "LID";
  }

  if (isPhoneJid(jid)) {
    return "Phone JID";
  }

  if (
    String(jid)
      .endsWith("@g.us")
  ) {
    return "Group";
  }

  return "Unknown";
}

// ======================================================
// TRY TO RESOLVE LID -> PHONE JID
// ======================================================

async function resolveRealJid(
  sock,
  chatJid,
  target
) {
  if (!target) {
    return null;
  }

  // Already a normal phone JID
  if (isPhoneJid(target)) {
    return target;
  }

  // Not an LID
  if (!isLid(target)) {
    return null;
  }

  // Try group metadata mapping
  if (
    String(chatJid || "")
      .endsWith("@g.us")
  ) {
    try {
      const metadata =
        await sock.groupMetadata(
          chatJid
        );

      const participants =
        metadata?.participants ||
        [];

      const participant =
        participants.find(
          item =>
            item?.id === target ||
            item?.lid === target
        );

      if (participant) {
        const candidates = [
          participant.phoneNumber,
          participant.phoneNumberJid,
          participant.jid,
          participant.pn,
          participant.phone,
          participant.id
        ];

        for (
          const candidate
          of candidates
        ) {
          if (
            isPhoneJid(
              candidate
            )
          ) {
            return candidate;
          }
        }
      }
    } catch (error) {
      console.error(
        "LID GROUP RESOLVE ERROR:",
        error?.message
      );
    }
  }

  // Try Baileys LID store if present
  try {
    if (
      sock?.signalRepository
        ?.lidMapping
        ?.getPNForLID
    ) {
      const result =
        await sock
          .signalRepository
          .lidMapping
          .getPNForLID(
            target
          );

      if (
        typeof result ===
          "string" &&
        isPhoneJid(result)
      ) {
        return result;
      }
    }
  } catch (error) {
    console.error(
      "LID MAPPING ERROR:",
      error?.message
    );
  }

  return null;
}

// ======================================================
// DISPLAY NUMBER
// ======================================================

function displayNumber(
  target,
  realJid
) {
  if (
    realJid &&
    isPhoneJid(realJid)
  ) {
    const number =
      cleanNumber(
        realJid.split("@")[0]
      );

    return number
      ? `+${number}`
      : "Hidden / unavailable";
  }

  if (
    isPhoneJid(target)
  ) {
    const number =
      cleanNumber(
        target.split("@")[0]
      );

    return number
      ? `+${number}`
      : "Hidden / unavailable";
  }

  return "Hidden / unavailable";
}

// ======================================================
// VIEW ONCE HELPERS
// ======================================================

function unwrapMessageContent(
  content
) {
  let current =
    content || null;

  // WhatsApp/Baileys may wrap View Once media in several
  // container message types. Unwrap them safely.
  for (
    let i = 0;
    i < 12 && current;
    i++
  ) {
    if (current.ephemeralMessage?.message) {
      current =
        current.ephemeralMessage.message;
      continue;
    }

    if (current.viewOnceMessage?.message) {
      current =
        current.viewOnceMessage.message;
      continue;
    }

    if (current.viewOnceMessageV2?.message) {
      current =
        current.viewOnceMessageV2.message;
      continue;
    }

    if (
      current
        .viewOnceMessageV2Extension
        ?.message
    ) {
      current =
        current
          .viewOnceMessageV2Extension
          .message;
      continue;
    }

    if (current.documentWithCaptionMessage?.message) {
      current =
        current
          .documentWithCaptionMessage
          .message;
      continue;
    }

    break;
  }

  return current;
}

function getQuotedMessageInfo(
  msg
) {
  const context =
    getContextInfo(msg);

  const quoted =
    context?.quotedMessage;

  if (!quoted) {
    return null;
  }

  return {
    context,
    quoted,
    unwrapped:
      unwrapMessageContent(
        quoted
      )
  };
}

function getViewOnceMedia(
  msg
) {
  const quotedInfo =
    getQuotedMessageInfo(
      msg
    );

  if (!quotedInfo) {
    return null;
  }

  const {
    context,
    quoted,
    unwrapped
  } = quotedInfo;

  const wasWrappedViewOnce =
    !!(
      quoted?.viewOnceMessage ||
      quoted?.viewOnceMessageV2 ||
      quoted?.viewOnceMessageV2Extension
    );

  const media =
    unwrapped || {};

  if (media.imageMessage) {
    const node =
      media.imageMessage;

    if (
      !wasWrappedViewOnce &&
      !node?.viewOnce
    ) {
      return null;
    }

    return {
      type:
        "image",

      node,

      caption:
        node?.caption ||
        "",

      context
    };
  }

  if (media.videoMessage) {
    const node =
      media.videoMessage;

    if (
      !wasWrappedViewOnce &&
      !node?.viewOnce
    ) {
      return null;
    }

    return {
      type:
        "video",

      node,

      caption:
        node?.caption ||
        "",

      context
    };
  }

  if (media.audioMessage) {
    const node =
      media.audioMessage;

    if (
      !wasWrappedViewOnce &&
      !node?.viewOnce
    ) {
      return null;
    }

    return {
      type:
        "audio",

      node,

      caption:
        "",

      context
    };
  }

  return null;
}

async function mediaNodeToBuffer(
  node,
  type
) {
  const stream =
    await downloadContentFromMessage(
      node,
      type
    );

  const chunks = [];

  for await (
    const chunk of stream
  ) {
    chunks.push(
      Buffer.from(chunk)
    );
  }

  return Buffer.concat(
    chunks
  );
}

async function recoverViewOnce({
  sock,
  msg,
  jid
}) {
  const media =
    getViewOnceMedia(
      msg
    );

  if (!media) {
    return sendText(
      sock,
      jid,
      msg,
      "❌ *VIEW ONCE MEDIA NOT FOUND*\n\n" +
      "Reply to a View Once image, video, or audio/voice message and type *.vv*."
    );
  }

  try {
    const buffer =
      await mediaNodeToBuffer(
        media.node,
        media.type
      );

    if (
      !buffer ||
      !buffer.length
    ) {
      throw new Error(
        "Downloaded media is empty."
      );
    }

    if (
      media.type === "image"
    ) {
      return sock.sendMessage(
        jid,
        {
          image:
            buffer,

          caption:
            media.caption ||
            "Recovered View Once image."
        },
        {
          quoted:
            msg
        }
      );
    }

    if (
      media.type === "video"
    ) {
      return sock.sendMessage(
        jid,
        {
          video:
            buffer,

          caption:
            media.caption ||
            "Recovered View Once video.",

          mimetype:
            media.node?.mimetype ||
            "video/mp4"
        },
        {
          quoted:
            msg
        }
      );
    }

    if (
      media.type === "audio"
    ) {
      return sock.sendMessage(
        jid,
        {
          audio:
            buffer,

          mimetype:
            media.node?.mimetype ||
            "audio/ogg; codecs=opus",

          ptt:
            !!media.node?.ptt
        },
        {
          quoted:
            msg
        }
      );
    }

  } catch (error) {
    console.error(
      "VV ERROR:",
      error
    );

    return sendText(
      sock,
      jid,
      msg,
      "❌ *VIEW ONCE RECOVERY FAILED*\n\n" +
      "The media may have expired, already been removed from WhatsApp servers, or the linked session may not have received its media data."
    );
  }
}

// ======================================================
// MODULE
// ======================================================

module.exports = {
  name: "whatsapp-tools",

  aliases: [
    "getpp",
    "profile",
    "savecontact",
    "poll",
    "readmore",
    "vv"
  ],

  description:
    "WhatsApp utility commands.",

  reaction: "📱",

  async execute({
    sock,
    msg,
    jid,
    command,
    args,
    query,
    settings
  }) {
    const prefix =
      settings?.prefix || ".";

    // ==================================================
    // GET PROFILE PICTURE
    // ==================================================

    if (
      command === "getpp"
    ) {
      const target =
        getTargetJid(
          msg,
          args
        ) ||
        jid;

      try {
        const realJid =
          await resolveRealJid(
            sock,
            jid,
            target
          );

        const lookupJid =
          realJid ||
          target;

        const url =
          await sock.profilePictureUrl(
            lookupJid,
            "image"
          );

        if (!url) {
          throw new Error(
            "Profile picture unavailable."
          );
        }

        return sock.sendMessage(
          jid,
          {
            image: {
              url
            },

            caption:
              "🖼️ *PROFILE PICTURE*\n\n" +
              "*Mini Bot Created by Pamoda Nethsara*"
          },
          {
            quoted: msg
          }
        );

      } catch (error) {
        console.error(
          "GETPP ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ *PROFILE PICTURE UNAVAILABLE*\n\n" +
          "The profile picture may be hidden by WhatsApp privacy settings."
        );
      }
    }

    // ==================================================
    // PROFILE INFO
    // ==================================================

    if (
      command === "profile"
    ) {
      const target =
        getTargetJid(
          msg,
          args
        ) ||
        jid;

      try {
        const realJid =
          await resolveRealJid(
            sock,
            jid,
            target
          );

        const lookupJid =
          realJid ||
          target;

        let ppUrl = null;

        try {
          ppUrl =
            await sock.profilePictureUrl(
              lookupJid,
              "image"
            );
        } catch {}

        let statusText =
          "Unavailable";

        try {
          const status =
            await sock.fetchStatus(
              lookupJid
            );

          if (
            status?.status
          ) {
            statusText =
              status.status;
          }
        } catch {}

        const numberText =
          displayNumber(
            target,
            realJid
          );

        const jidType =
          getDisplayJidType(
            target
          );

        const caption =
          "👤 *WHATSAPP PROFILE*\n\n" +
          `Number: ${numberText}\n` +
          `JID: ${target}\n` +
          `JID Type: ${jidType}\n` +
          `About: ${statusText}\n\n` +
          (
            isLid(target) &&
            !realJid
              ? "ℹ️ WhatsApp is using a private LID for this user, so the real phone number is not exposed.\n\n"
              : ""
          ) +
          "*Mini Bot Created by Pamoda Nethsara*";

        if (ppUrl) {
          return sock.sendMessage(
            jid,
            {
              image: {
                url:
                  ppUrl
              },

              caption
            },
            {
              quoted: msg
            }
          );
        }

        return sendText(
          sock,
          jid,
          msg,
          caption
        );

      } catch (error) {
        console.error(
          "PROFILE ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ Unable to retrieve profile information."
        );
      }
    }

    // ==================================================
    // SAVE CONTACT
    // ==================================================

    if (
      command ===
      "savecontact"
    ) {
      const target =
        getTargetJid(
          msg,
          args
        );

      if (!target) {
        return sendText(
          sock,
          jid,
          msg,
          "📇 *SAVE CONTACT*\n\n" +
          "Reply to a user's message or provide a number:\n\n" +
          `${prefix}savecontact 94771234567`
        );
      }

      const realJid =
        await resolveRealJid(
          sock,
          jid,
          target
        );

      const contactJid =
        realJid ||
        (
          isPhoneJid(target)
            ? target
            : null
        );

      if (!contactJid) {
        return sendText(
          sock,
          jid,
          msg,
          "❌ *PHONE NUMBER UNAVAILABLE*\n\n" +
          "WhatsApp is exposing only an LID for this user, so the bot cannot create a phone-number contact card."
        );
      }

      const number =
        cleanNumber(
          contactJid
            .split("@")[0]
        );

      let name =
        "WhatsApp Contact";

      if (
        args?.length >= 2
      ) {
        name =
          args
            .slice(1)
            .join(" ")
            .trim();
      }

      const vcard =
        "BEGIN:VCARD\n" +
        "VERSION:3.0\n" +
        `FN:${name}\n` +
        `TEL;type=CELL;type=VOICE;waid=${number}:+${number}\n` +
        "END:VCARD";

      try {
        return sock.sendMessage(
          jid,
          {
            contacts: {
              displayName:
                name,

              contacts: [
                {
                  vcard
                }
              ]
            }
          },
          {
            quoted: msg
          }
        );

      } catch (error) {
        console.error(
          "SAVECONTACT ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ Unable to create the contact card."
        );
      }
    }

    // ==================================================
    // POLL
    // ==================================================

    if (
      command === "poll"
    ) {
      if (!query) {
        return sendText(
          sock,
          jid,
          msg,
          "📊 *CREATE POLL*\n\n" +
          `Usage:\n${prefix}poll Question | Option 1 | Option 2\n\n` +
          `Example:\n${prefix}poll Which one is better? | Android | iPhone`
        );
      }

      const parts =
        query
          .split("|")
          .map(
            item =>
              item.trim()
          )
          .filter(Boolean);

      if (
        parts.length < 3
      ) {
        return sendText(
          sock,
          jid,
          msg,
          "❌ A poll needs a question and at least two options."
        );
      }

      const question =
        parts[0];

      const options =
        parts
          .slice(1)
          .slice(0, 12);

      try {
        return sock.sendMessage(
          jid,
          {
            poll: {
              name:
                question,

              values:
                options,

              selectableCount:
                1
            }
          },
          {
            quoted: msg
          }
        );

      } catch (error) {
        console.error(
          "POLL ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ Unable to create the poll."
        );
      }
    }

    // ==================================================
    // VIEW ONCE RECOVERY
    // ==================================================

    if (
      command === "vv"
    ) {
      return recoverViewOnce({
        sock,
        msg,
        jid
      });
    }

    // ==================================================
    // READ MORE
    // ==================================================

    if (
      command ===
      "readmore"
    ) {
      if (!query) {
        return sendText(
          sock,
          jid,
          msg,
          "📖 *READ MORE MESSAGE*\n\n" +
          `Usage:\n${prefix}readmore First text | Hidden text`
        );
      }

      const parts =
        query.split("|");

      if (
        parts.length < 2
      ) {
        return sendText(
          sock,
          jid,
          msg,
          "❌ Use `|` between the visible and hidden text."
        );
      }

      const firstText =
        parts
          .shift()
          .trim();

      const hiddenText =
        parts
          .join("|")
          .trim();

      if (
        !firstText ||
        !hiddenText
      ) {
        return sendText(
          sock,
          jid,
          msg,
          "❌ Both visible and hidden text are required."
        );
      }

      const readMore =
        "\u200E".repeat(4001);

      const result =
        firstText +
        "\n" +
        readMore +
        "\n" +
        hiddenText;

      try {
        return sock.sendMessage(
          jid,
          {
            text:
              result
          },
          {
            quoted: msg
          }
        );

      } catch (error) {
        console.error(
          "READMORE ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ Unable to create the Read More message."
        );
      }
    }
  }
};