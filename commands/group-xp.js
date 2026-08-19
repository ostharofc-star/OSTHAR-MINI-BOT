const {
  getOrCreateUserXP,
  getLeaderboard,
  getUserRank,
  resetUserXP,
  resetGroupXP,
  xpForNextLevel
} = require("../database/groupXp");

// ======================================================
// HELPERS
// ======================================================

function isGroup(jid) {
  return String(
    jid || ""
  ).endsWith("@g.us");
}

function getSenderJid(
  msg,
  jid
) {
  return (
    msg?.key?.participant ||
    msg?.participant ||
    jid ||
    ""
  );
}

function getMentionedJids(msg) {
  const contextInfo =
    msg?.message
      ?.extendedTextMessage
      ?.contextInfo ||
    msg?.message
      ?.imageMessage
      ?.contextInfo ||
    msg?.message
      ?.videoMessage
      ?.contextInfo ||
    {};

  return Array.isArray(
    contextInfo.mentionedJid
  )
    ? contextInfo.mentionedJid
    : [];
}

function getQuotedParticipant(
  msg
) {
  const contextInfo =
    msg?.message
      ?.extendedTextMessage
      ?.contextInfo ||
    {};

  return (
    contextInfo.participant ||
    ""
  );
}

function jidToNumber(jid) {
  return String(
    jid || ""
  )
    .split("@")[0]
    .replace(/\D/g, "");
}

function normalizeUserJid(
  value
) {
  const text =
    String(
      value || ""
    ).trim();

  if (!text) {
    return "";
  }

  if (
    text.includes("@")
  ) {
    return text;
  }

  const number =
    text.replace(
      /\D/g,
      ""
    );

  if (!number) {
    return "";
  }

  return (
    `${number}@s.whatsapp.net`
  );
}

function getTargetUser(
  msg,
  args,
  sender
) {
  const mentioned =
    getMentionedJids(
      msg
    );

  if (
    mentioned.length
  ) {
    return mentioned[0];
  }

  const quoted =
    getQuotedParticipant(
      msg
    );

  if (quoted) {
    return quoted;
  }

  if (
    args?.[0]
  ) {
    return normalizeUserJid(
      args[0]
    );
  }

  return sender;
}

// ======================================================
// ADMIN CHECK
// ======================================================

async function isAdmin(
  sock,
  jid,
  userJid
) {
  try {
    const metadata =
      await sock.groupMetadata(
        jid
      );

    const targetNumber =
      jidToNumber(
        userJid
      );

    const participant =
      metadata?.participants
        ?.find(
          item => {
            const id =
              item?.id ||
              item?.jid ||
              "";

            return (
              id === userJid ||
              jidToNumber(id) ===
              targetNumber
            );
          }
        );

    return Boolean(
      participant?.admin ===
        "admin" ||
      participant?.admin ===
        "superadmin" ||
      participant?.isAdmin ||
      participant?.isSuperAdmin
    );

  } catch {
    return false;
  }
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {
  name: "rank",

  aliases: [
    "level",
    "xp",
    "leaderboard",
    "lb",
    "resetxp",
    "resetgroupxp"
  ],

  description:
    "View and manage group XP, levels and leaderboard.",

  reaction: "🏆",

  async execute({
    sock,
    msg,
    jid,
    command,
    args,
    phone
  }) {
    try {
      if (
        !isGroup(jid)
      ) {
        return await sock.sendMessage(
          jid,
          {
            text:
              "❌ *GROUP ONLY*\n\n" +
              "XP commands can only be used inside groups."
          },
          {
            quoted: msg
          }
        );
      }

      const sender =
        getSenderJid(
          msg,
          jid
        );

      // ==================================================
      // LEADERBOARD
      // ==================================================

      if (
        command ===
          "leaderboard" ||
        command ===
          "lb"
      ) {
        const list =
          await getLeaderboard({
            phone,
            groupJid: jid,
            limit: 10
          });

        if (
          !list.length
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "🏆 *LEADERBOARD*\n\n" +
                "No XP data is available yet."
            },
            {
              quoted: msg
            }
          );
        }

        let text =
          "🏆 *GROUP LEADERBOARD*\n\n";

        const mentions =
          [];

        list.forEach(
          (
            item,
            index
          ) => {
            const number =
              jidToNumber(
                item.userJid
              );

            mentions.push(
              item.userJid
            );

            text +=
              `${index + 1}. @${number}\n` +
              `   Level: ${item.level}\n` +
              `   XP: ${item.xp}\n` +
              `   Messages: ${item.messages}\n\n`;
          }
        );

        return await sock.sendMessage(
          jid,
          {
            text:
              text.trim(),

            mentions
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // RESET WHOLE GROUP XP
      // ==================================================

      if (
        command ===
        "resetgroupxp"
      ) {
        const admin =
          await isAdmin(
            sock,
            jid,
            sender
          );

        if (!admin) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *ADMIN ONLY*\n\n" +
                "Only group admins can reset group XP."
            },
            {
              quoted: msg
            }
          );
        }

        const result =
          await resetGroupXP({
            phone,
            groupJid: jid
          });

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *GROUP XP RESET*\n\n" +
              `Removed XP records: ${result?.deletedCount || 0}`
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // TARGET MEMBER
      // ==================================================

      const target =
        getTargetUser(
          msg,
          args,
          sender
        );

      if (!target) {
        return;
      }

      // ==================================================
      // RESET USER XP
      // ==================================================

      if (
        command ===
        "resetxp"
      ) {
        const admin =
          await isAdmin(
            sock,
            jid,
            sender
          );

        if (!admin) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *ADMIN ONLY*\n\n" +
                "Only group admins can reset member XP."
            },
            {
              quoted: msg
            }
          );
        }

        const result =
          await resetUserXP({
            phone,
            groupJid: jid,
            userJid: target
          });

        if (!result) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "ℹ️ *XP*\n\n" +
                "No XP data was found for this member."
            },
            {
              quoted: msg
            }
          );
        }

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *XP RESET*\n\n" +
              `User: @${jidToNumber(target)}\n` +
              "Level: 1\n" +
              "XP: 0",

            mentions: [
              target
            ]
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // RANK / LEVEL / XP
      // ==================================================

      const data =
        await getOrCreateUserXP({
          phone,
          groupJid: jid,
          userJid: target
        });

      const rankData =
        await getUserRank({
          phone,
          groupJid: jid,
          userJid: target
        });

      const nextLevelXP =
        xpForNextLevel(
          data.level
        );

      const remaining =
        Math.max(
          0,
          nextLevelXP -
          data.xp
        );

      return await sock.sendMessage(
        jid,
        {
          text:
            "🏆 *GROUP RANK*\n\n" +
            `User: @${jidToNumber(target)}\n` +
            `Rank: #${rankData?.rank || 1}\n` +
            `Level: ${data.level}\n` +
            `XP: ${data.xp}\n` +
            `Messages: ${data.messages}\n` +
            `Next Level: ${remaining} XP remaining`,

          mentions: [
            target
          ]
        },
        {
          quoted: msg
        }
      );

    } catch (error) {
      console.log(
        "GROUP XP COMMAND ERROR:",
        error?.message || error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *XP SYSTEM ERROR*\n\n" +
            "Unable to load group XP right now."
        },
        {
          quoted: msg
        }
      );
    }
  }
};