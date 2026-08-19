const {
  saveGroupRules,
  getGroupRules,
  clearGroupRules
} = require("../database/groupRules");

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

    const participants =
      Array.isArray(
        metadata?.participants
      )
        ? metadata.participants
        : [];

    const targetNumber =
      jidToNumber(
        userJid
      );

    const participant =
      participants.find(
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

          return (
            targetNumber &&
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

  } catch (error) {
    console.log(
      "RULES ADMIN CHECK ERROR:",
      error?.message || error
    );

    return false;
  }
}

// ======================================================
// FORMAT RULES
// ======================================================

function formatRules(
  rawRules
) {
  const rules =
    String(
      rawRules || ""
    )
      .split("|")
      .map(
        item =>
          item.trim()
      )
      .filter(Boolean);

  if (
    rules.length <= 1
  ) {
    return String(
      rawRules || ""
    ).trim();
  }

  return rules
    .map(
      (rule, index) =>
        `${index + 1}. ${rule}`
    )
    .join("\n");
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {
  name: "setrules",

  aliases: [
    "rules",
    "clearrules"
  ],

  description:
    "Set, view, or clear WhatsApp group rules.",

  reaction: "📜",

  async execute({
    sock,
    msg,
    jid,
    command,
    args,
    query,
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
      // VIEW RULES
      // ==================================================

      if (
        command === "rules"
      ) {
        const data =
          await getGroupRules(
            phone,
            jid
          );

        if (
          !data?.rules
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "📜 *GROUP RULES*\n\n" +
                "No rules have been set for this group yet."
            },
            {
              quoted: msg
            }
          );
        }

        const formatted =
          formatRules(
            data.rules
          );

        return await sock.sendMessage(
          jid,
          {
            text:
              "📜 *GROUP RULES*\n\n" +
              formatted
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // SET RULES
      // ==================================================

      if (
        command === "setrules"
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
                "Only group admins can change the group rules."
            },
            {
              quoted: msg
            }
          );
        }

        const rules =
          String(
            query ||
            args?.join(" ") ||
            ""
          ).trim();

        if (!rules) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "📜 *SET GROUP RULES*\n\n" +
                "Usage:\n" +
                ".setrules <rules>\n\n" +
                "Example:\n" +
                ".setrules No spam | No links | Respect all members"
            },
            {
              quoted: msg
            }
          );
        }

        const saved =
          await saveGroupRules(
            phone,
            jid,
            rules
          );

        const formatted =
          formatRules(
            saved.rules
          );

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *GROUP RULES UPDATED*\n\n" +
              formatted
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // CLEAR RULES
      // ==================================================

      if (
        command ===
        "clearrules"
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
                "Only group admins can clear the group rules."
            },
            {
              quoted: msg
            }
          );
        }

        const existing =
          await getGroupRules(
            phone,
            jid
          );

        if (
          !existing
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "ℹ️ *GROUP RULES*\n\n" +
                "This group does not have any saved rules."
            },
            {
              quoted: msg
            }
          );
        }

        await clearGroupRules(
          phone,
          jid
        );

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *GROUP RULES CLEARED*\n\n" +
              "All saved rules for this group have been removed."
          },
          {
            quoted: msg
          }
        );
      }

    } catch (error) {
      console.log(
        "GROUP RULES ERROR:",
        error?.message || error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *GROUP RULES ERROR*\n\n" +
            "Unable to process the group rules right now."
        },
        {
          quoted: msg
        }
      );
    }
  }
};