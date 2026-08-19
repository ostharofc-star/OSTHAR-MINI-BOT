const {
  addWarning,
  getWarnings,
  resetWarnings,
  removeOneWarning,
  getGroupWarnings
} = require("../database/warnings");

const {
  getUserSettings,
  setSetting
} = require("../database/settings");

// ======================================================
// HELPERS
// ======================================================

function isGroup(jid) {
  return String(
    jid || ""
  ).endsWith(
    "@g.us"
  );
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

// ======================================================
// CONTEXT INFO
// ======================================================

function getContextInfo(
  msg
) {
  return (
    msg?.message
      ?.extendedTextMessage
      ?.contextInfo ||

    msg?.message
      ?.imageMessage
      ?.contextInfo ||

    msg?.message
      ?.videoMessage
      ?.contextInfo ||

    msg?.message
      ?.documentMessage
      ?.contextInfo ||

    {}
  );
}

// ======================================================
// MENTIONED USERS
// ======================================================

function getMentionedJids(
  msg
) {
  const contextInfo =
    getContextInfo(
      msg
    );

  return Array.isArray(
    contextInfo.mentionedJid
  )
    ? contextInfo.mentionedJid
    : [];
}

// ======================================================
// QUOTED USER
// ======================================================

function getQuotedParticipant(
  msg
) {
  const contextInfo =
    getContextInfo(
      msg
    );

  return (
    contextInfo.participant ||
    ""
  );
}

// ======================================================
// JID TO NUMBER
// ======================================================

function jidToNumber(jid) {
  return String(
    jid || ""
  )
    .split("@")[0]
    .replace(
      /\D/g,
      ""
    );
}

// ======================================================
// NORMALIZE USER JID
// ======================================================

function normalizeUserJid(
  jid
) {
  const value =
    String(
      jid || ""
    ).trim();

  if (!value) {
    return "";
  }

  if (
    value.includes("@")
  ) {
    return value;
  }

  const number =
    value.replace(
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

// ======================================================
// GET TARGET MEMBER
// ======================================================

function getTargetUser(
  msg,
  args = []
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

  const firstArg =
    String(
      args?.[0] ||
      ""
    ).trim();

  if (firstArg) {
    return normalizeUserJid(
      firstArg
    );
  }

  return "";
}

// ======================================================
// GET WARNING REASON
// ======================================================

function getReason(
  msg,
  args = []
) {
  const mentioned =
    getMentionedJids(
      msg
    );

  if (
    mentioned.length
  ) {
    return String(
      args
        ?.slice(1)
        .join(" ") ||
      ""
    ).trim();
  }

  const quoted =
    getQuotedParticipant(
      msg
    );

  if (quoted) {
    return String(
      args
        ?.join(" ") ||
      ""
    ).trim();
  }

  return String(
    args
      ?.slice(1)
      .join(" ") ||
    ""
  ).trim();
}

// ======================================================
// GET GROUP PARTICIPANTS
// ======================================================

async function getParticipants(
  sock,
  jid
) {
  const metadata =
    await sock.groupMetadata(
      jid
    );

  return Array.isArray(
    metadata?.participants
  )
    ? metadata.participants
    : [];
}

// ======================================================
// FIND PARTICIPANT
// ======================================================

function findParticipant(
  participants,
  userJid
) {
  const targetNumber =
    jidToNumber(
      userJid
    );

  return participants.find(
    item => {
      const id =
        item?.id ||
        item?.jid ||
        "";

      if (
        id === userJid
      ) {
        return true;
      }

      if (
        targetNumber &&
        jidToNumber(id) ===
        targetNumber
      ) {
        return true;
      }

      return false;
    }
  );
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
    const participants =
      await getParticipants(
        sock,
        jid
      );

    const participant =
      findParticipant(
        participants,
        userJid
      );

    return Boolean(
      participant?.admin ===
        "admin" ||

      participant?.admin ===
        "superadmin" ||

      participant?.isAdmin ||

      participant?.isSuperAdmin
    );

  } catch (error) {
    console.log(
      "WARN ADMIN CHECK ERROR:",
      error?.message || error
    );

    return false;
  }
}

// ======================================================
// GET BOT JID
// ======================================================

function getBotJid(sock) {
  return (
    sock?.user?.id ||
    ""
  );
}

// ======================================================
// BOT ADMIN CHECK
// ======================================================

async function isBotAdmin(
  sock,
  jid
) {
  try {
    const botJid =
      getBotJid(
        sock
      );

    if (!botJid) {
      return false;
    }

    return await isAdmin(
      sock,
      jid,
      botJid
    );

  } catch {
    return false;
  }
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {
  name: "warn",

  aliases: [
    "warnings",
    "unwarn",
    "resetwarn",
    "warnlist",

    "autowarnkick"
  ],

  description:
    "Manage group warnings and automatic warning kicks.",

  reaction: "⚠️",

  async execute({
    sock,
    msg,
    jid,
    command,
    args,
    phone
  }) {
    try {

      // ==================================================
      // GROUP ONLY
      // ==================================================

      if (
        !isGroup(jid)
      ) {
        return await sock.sendMessage(
          jid,
          {
            text:
              "❌ *GROUP ONLY*\n\n" +
              "This command can only be used inside WhatsApp groups."
          },
          {
            quoted: msg
          }
        );
      }

      const senderJid =
        getSenderJid(
          msg,
          jid
        );

      // ==================================================
      // AUTO WARN KICK ON / OFF
      // ==================================================

      if (
        command ===
        "autowarnkick"
      ) {
        const senderIsAdmin =
          await isAdmin(
            sock,
            jid,
            senderJid
          );

        if (
          !senderIsAdmin
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *ADMIN ONLY*\n\n" +
                "Only group admins can change Auto Warn Kick."
            },
            {
              quoted: msg
            }
          );
        }

        const value =
          String(
            args?.[0] ||
            ""
          )
            .trim()
            .toLowerCase();

        if (
          ![
            "on",
            "off"
          ].includes(
            value
          )
        ) {
          const settings =
            await getUserSettings(
              phone
            );

          return await sock.sendMessage(
            jid,
            {
              text:
                "⚙️ *AUTO WARN KICK*\n\n" +
                `Current: ${settings?.autoWarnKick ? "ON" : "OFF"}\n\n` +
                "Usage:\n" +
                ".autowarnkick on\n" +
                ".autowarnkick off\n\n" +
                "When enabled, a member will be removed after reaching 3 warnings."
            },
            {
              quoted: msg
            }
          );
        }

        const enabled =
          value === "on";

        await setSetting(
          phone,
          "autoWarnKick",
          enabled
        );

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *AUTO WARN KICK UPDATED*\n\n" +
              `Status: ${enabled ? "ON" : "OFF"}\n\n` +
              (
                enabled
                  ? "Members will automatically be removed when they reach 3 warnings."
                  : "Members will no longer be automatically removed at 3 warnings."
              )
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // WARNING LIST
      // ==================================================

      if (
        command ===
        "warnlist"
      ) {
        const list =
          await getGroupWarnings({
            phone,

            groupJid:
              jid
          });

        if (
          !list.length
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "⚠️ *GROUP WARNING LIST*\n\n" +
                "No active warnings were found in this group."
            },
            {
              quoted: msg
            }
          );
        }

        let text =
          "⚠️ *GROUP WARNING LIST*\n\n";

        const mentions =
          [];

        list
          .slice(
            0,
            30
          )
          .forEach(
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
                `${index + 1}. @${number} — ${item.warnings} warning(s)\n`;
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
      // TARGET
      // ==================================================

      const targetJid =
        getTargetUser(
          msg,
          args
        );

      if (!targetJid) {
        return await sock.sendMessage(
          jid,
          {
            text:
              "⚠️ *WARNING SYSTEM*\n\n" +
              "Mention a member or reply to their message.\n\n" +
              "Examples:\n" +
              ".warn @user Spam\n" +
              ".warnings @user\n" +
              ".unwarn @user\n" +
              ".resetwarn @user"
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // WARN MEMBER
      // ==================================================

      if (
        command === "warn"
      ) {
        const senderIsAdmin =
          await isAdmin(
            sock,
            jid,
            senderJid
          );

        if (
          !senderIsAdmin
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *ADMIN ONLY*\n\n" +
                "Only group admins can warn members."
            },
            {
              quoted: msg
            }
          );
        }

        // Prevent warning yourself
        if (
          jidToNumber(
            senderJid
          ) ===
          jidToNumber(
            targetJid
          )
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *INVALID TARGET*\n\n" +
                "You cannot warn yourself."
            },
            {
              quoted: msg
            }
          );
        }

        const reason =
          getReason(
            msg,
            args
          ) ||
          "No reason provided.";

        const result =
          await addWarning({
            phone,

            groupJid:
              jid,

            userJid:
              targetJid,

            reason,

            warnedBy:
              senderJid
          });

        const settings =
          await getUserSettings(
            phone
          );

        const warningCount =
          Number(
            result?.warnings ||
            0
          );

        // ==================================================
        // BELOW 3 WARNINGS
        // ==================================================

        if (
          warningCount < 3
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "⚠️ *MEMBER WARNED*\n\n" +
                `User: @${jidToNumber(targetJid)}\n` +
                `Warnings: ${warningCount}/3\n` +
                `Reason: ${reason}`,

              mentions: [
                targetJid
              ]
            },
            {
              quoted: msg
            }
          );
        }

        // ==================================================
        // 3 WARNINGS - AUTO KICK OFF
        // ==================================================

        if (
          !settings?.autoWarnKick
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "🚨 *WARNING LIMIT REACHED*\n\n" +
                `User: @${jidToNumber(targetJid)}\n` +
                `Warnings: ${warningCount}/3\n` +
                `Reason: ${reason}\n\n` +
                "Auto Warn Kick is currently OFF.",

              mentions: [
                targetJid
              ]
            },
            {
              quoted: msg
            }
          );
        }

        // ==================================================
        // CHECK BOT ADMIN
        // ==================================================

        const botAdmin =
          await isBotAdmin(
            sock,
            jid
          );

        if (
          !botAdmin
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "🚨 *WARNING LIMIT REACHED*\n\n" +
                `User: @${jidToNumber(targetJid)}\n` +
                `Warnings: ${warningCount}/3\n\n` +
                "Automatic removal failed because the bot is not a group admin.",

              mentions: [
                targetJid
              ]
            },
            {
              quoted: msg
            }
          );
        }

        // ==================================================
        // DO NOT REMOVE GROUP ADMIN
        // ==================================================

        const targetIsAdmin =
          await isAdmin(
            sock,
            jid,
            targetJid
          );

        if (
          targetIsAdmin
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "🚨 *WARNING LIMIT REACHED*\n\n" +
                `User: @${jidToNumber(targetJid)}\n` +
                `Warnings: ${warningCount}/3\n\n` +
                "Automatic removal was skipped because this member is a group admin.",

              mentions: [
                targetJid
              ]
            },
            {
              quoted: msg
            }
          );
        }

        // ==================================================
        // REMOVE MEMBER
        // ==================================================

        try {
          await sock.groupParticipantsUpdate(
            jid,
            [
              targetJid
            ],
            "remove"
          );

          await resetWarnings({
            phone,

            groupJid:
              jid,

            userJid:
              targetJid
          });

          return await sock.sendMessage(
            jid,
            {
              text:
                "🚫 *MEMBER REMOVED*\n\n" +
                `User: @${jidToNumber(targetJid)}\n` +
                "Warnings: 3/3\n" +
                `Final Reason: ${reason}\n\n` +
                "The member was automatically removed after reaching the warning limit.",

              mentions: [
                targetJid
              ]
            }
          );

        } catch (error) {
          console.log(
            "AUTO WARN KICK ERROR:",
            error?.message || error
          );

          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *AUTO KICK FAILED*\n\n" +
                `@${jidToNumber(targetJid)} reached 3 warnings, but the bot could not remove the member.\n\n` +
                "Check whether the bot has group admin permission.",

              mentions: [
                targetJid
              ]
            },
            {
              quoted: msg
            }
          );
        }
      }

      // ==================================================
      // VIEW WARNINGS
      // ==================================================

      if (
        command ===
        "warnings"
      ) {
        const result =
          await getWarnings({
            phone,

            groupJid:
              jid,

            userJid:
              targetJid
          });

        const count =
          Number(
            result?.warnings ||
            0
          );

        let text =
          "⚠️ *MEMBER WARNINGS*\n\n" +
          `User: @${jidToNumber(targetJid)}\n` +
          `Warnings: ${count}/3`;

        const reasons =
          Array.isArray(
            result?.reasons
          )
            ? result.reasons
            : [];

        if (
          reasons.length
        ) {
          text +=
            "\n\n*History:*\n";

          reasons
            .slice(
              -5
            )
            .forEach(
              (
                item,
                index
              ) => {
                text +=
                  `${index + 1}. ${item.reason}\n`;
              }
            );
        }

        return await sock.sendMessage(
          jid,
          {
            text:
              text.trim(),

            mentions: [
              targetJid
            ]
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // REMOVE ONE WARNING
      // ==================================================

      if (
        command ===
        "unwarn"
      ) {
        const senderIsAdmin =
          await isAdmin(
            sock,
            jid,
            senderJid
          );

        if (
          !senderIsAdmin
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *ADMIN ONLY*\n\n" +
                "Only group admins can remove warnings."
            },
            {
              quoted: msg
            }
          );
        }

        const current =
          await getWarnings({
            phone,

            groupJid:
              jid,

            userJid:
              targetJid
          });

        if (
          !current ||
          current.warnings <= 0
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "ℹ️ *NO WARNINGS*\n\n" +
                `@${jidToNumber(targetJid)} has no active warnings.`,

              mentions: [
                targetJid
              ]
            },
            {
              quoted: msg
            }
          );
        }

        const result =
          await removeOneWarning({
            phone,

            groupJid:
              jid,

            userJid:
              targetJid
          });

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *WARNING REMOVED*\n\n" +
              `User: @${jidToNumber(targetJid)}\n` +
              `Warnings Left: ${result?.warnings || 0}/3`,

            mentions: [
              targetJid
            ]
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // RESET WARNINGS
      // ==================================================

      if (
        command ===
        "resetwarn"
      ) {
        const senderIsAdmin =
          await isAdmin(
            sock,
            jid,
            senderJid
          );

        if (
          !senderIsAdmin
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *ADMIN ONLY*\n\n" +
                "Only group admins can reset warnings."
            },
            {
              quoted: msg
            }
          );
        }

        await resetWarnings({
          phone,

          groupJid:
            jid,

          userJid:
            targetJid
        });

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *WARNINGS RESET*\n\n" +
              `All warnings for @${jidToNumber(targetJid)} have been cleared.`,

            mentions: [
              targetJid
            ]
          },
          {
            quoted: msg
          }
        );
      }

    } catch (error) {
      console.log(
        "WARNINGS COMMAND ERROR:",
        error?.message || error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *WARNING SYSTEM ERROR*\n\n" +
            "Unable to process this warning request right now."
        },
        {
          quoted: msg
        }
      );
    }
  }
};