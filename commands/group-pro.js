function isGroup(jid = "") {
  return String(jid).endsWith("@g.us");
}

function normalizeNumber(value = "") {
  return String(value)
    .replace(/[^0-9]/g, "");
}

function numberToJid(number = "") {
  const clean =
    normalizeNumber(number);

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
    normalizeNumber(
      args?.[0] || ""
    );

  return numberToJid(number);
}

function participantIsAdmin(
  participant
) {
  return (
    participant?.admin ===
      "admin" ||
    participant?.admin ===
      "superadmin"
  );
}

function sameUser(
  first = "",
  second = ""
) {
  if (!first || !second) {
    return false;
  }

  if (first === second) {
    return true;
  }

  const a =
    normalizeNumber(
      first.split("@")[0]
    );

  const b =
    normalizeNumber(
      second.split("@")[0]
    );

  return (
    !!a &&
    !!b &&
    a === b
  );
}

async function getGroupContext(
  sock,
  msg,
  jid
) {
  const metadata =
    await sock.groupMetadata(jid);

  const participants =
    metadata?.participants ||
    [];

  const sender =
    msg.key.participant ||
    msg.key.remoteJid;

  const botJid =
    sock.user?.id || "";

  const senderData =
    participants.find(
      participant =>
        sameUser(
          participant.id,
          sender
        )
    );

  const botData =
    participants.find(
      participant =>
        sameUser(
          participant.id,
          botJid
        )
    );

  const senderAdmin =
    msg.key.fromMe === true ||
    participantIsAdmin(
      senderData
    );

  const botAdmin =
    participantIsAdmin(
      botData
    );

  return {
    metadata,
    participants,
    sender,
    botJid,
    senderAdmin,
    botAdmin
  };
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

module.exports = {
  name: "group-pro",

  aliases: [
    "groupinfo",
    "tagall",
    "hidetag",
    "admins",
    "kick",
    "add",
    "promote",
    "demote",
    "mute",
    "unmute",
    "lock",
    "unlock",
    "setsubject",
    "setdesc",
    "invite",
    "revoke"
  ],

  description:
    "Professional group management commands.",

  reaction: "👥",

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

    // ===============================================
    // GROUP CHECK
    // ===============================================

    if (!isGroup(jid)) {
      return sendText(
        sock,
        jid,
        msg,
        "❌ *GROUP ONLY COMMAND*\n\nThis command can only be used inside a WhatsApp group."
      );
    }

    let context;

    try {
      context =
        await getGroupContext(
          sock,
          msg,
          jid
        );
    } catch (error) {
      console.error(
        "GROUP METADATA ERROR:",
        error
      );

      return sendText(
        sock,
        jid,
        msg,
        "❌ Unable to load group information."
      );
    }

    const {
      metadata,
      participants,
      senderAdmin,
      botAdmin
    } = context;

    // ===============================================
    // GROUP INFO
    // ===============================================

    if (
      command ===
      "groupinfo"
    ) {
      const admins =
        participants.filter(
          participantIsAdmin
        );

      const owner =
        metadata.owner ||
        metadata.subjectOwner ||
        "Unknown";

      return sendText(
        sock,
        jid,
        msg,
        "╭━━〔 *GROUP INFORMATION* 〕━━╮\n\n" +
        `Name: ${metadata.subject || "Unknown"}\n` +
        `Members: ${participants.length}\n` +
        `Admins: ${admins.length}\n` +
        `Owner: ${owner}\n` +
        `ID: ${jid}\n` +
        `Description: ${
          metadata.desc ||
          "No description"
        }\n\n` +
        "╰━━━━━━━━━━━━━━━━━━━━╯"
      );
    }

    // ===============================================
    // ADMINS
    // ===============================================

    if (
      command ===
      "admins"
    ) {
      const admins =
        participants.filter(
          participantIsAdmin
        );

      if (!admins.length) {
        return sendText(
          sock,
          jid,
          msg,
          "❌ No group admins were found."
        );
      }

      let text =
        "👑 *GROUP ADMINS*\n\n";

      const mentions = [];

      admins.forEach(
        (admin, index) => {
          const number =
            admin.id
              .split("@")[0];

          text +=
            `${index + 1}. @${number}\n`;

          mentions.push(
            admin.id
          );
        }
      );

      return sock.sendMessage(
        jid,
        {
          text,
          mentions
        },
        {
          quoted: msg
        }
      );
    }

    // ===============================================
    // TAG ALL
    // ===============================================

    if (
      command ===
      "tagall"
    ) {
      if (!senderAdmin) {
        return sendText(
          sock,
          jid,
          msg,
          "🔒 *ADMIN ONLY COMMAND*\n\nOnly group admins can use this command."
        );
      }

      const mentions =
        participants.map(
          participant =>
            participant.id
        );

      let text =
        query
          ? `📢 *${query}*\n\n`
          : "📢 *TAG ALL*\n\n";

      for (
        const participant
        of participants
      ) {
        text +=
          `@${participant.id.split("@")[0]}\n`;
      }

      return sock.sendMessage(
        jid,
        {
          text,
          mentions
        },
        {
          quoted: msg
        }
      );
    }

    // ===============================================
    // HIDE TAG
    // ===============================================

    if (
      command ===
      "hidetag"
    ) {
      if (!senderAdmin) {
        return sendText(
          sock,
          jid,
          msg,
          "🔒 *ADMIN ONLY COMMAND*\n\nOnly group admins can use this command."
        );
      }

      const mentions =
        participants.map(
          participant =>
            participant.id
        );

      const text =
        query ||
        "📢 Group announcement";

      return sock.sendMessage(
        jid,
        {
          text,
          mentions
        },
        {
          quoted: msg
        }
      );
    }

    // ===============================================
    // ADMIN COMMAND CHECK
    // ===============================================

    const adminCommands = [
      "kick",
      "add",
      "promote",
      "demote",
      "mute",
      "unmute",
      "lock",
      "unlock",
      "setsubject",
      "setdesc",
      "invite",
      "revoke"
    ];

    if (
      adminCommands.includes(
        command
      )
    ) {
      if (!senderAdmin) {
        return sendText(
          sock,
          jid,
          msg,
          "🔒 *ADMIN ONLY COMMAND*\n\nOnly group admins can use this command."
        );
      }
    }

    // ===============================================
    // BOT ADMIN CHECK
    // ===============================================

    const botAdminCommands = [
      "kick",
      "add",
      "promote",
      "demote",
      "mute",
      "unmute",
      "lock",
      "unlock",
      "setsubject",
      "setdesc",
      "revoke"
    ];

    if (
      botAdminCommands.includes(
        command
      ) &&
      !botAdmin
    ) {
      return sendText(
        sock,
        jid,
        msg,
        "❌ *BOT IS NOT ADMIN*\n\nPlease make the bot account a group admin first."
      );
    }

    // ===============================================
    // KICK
    // ===============================================

    if (
      command ===
      "kick"
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
          "🚫 *REMOVE MEMBER*\n\nReply to a member or mention them:\n" +
          `${prefix}kick @user`
        );
      }

      try {
        await sock
          .groupParticipantsUpdate(
            jid,
            [target],
            "remove"
          );

        return sendText(
          sock,
          jid,
          msg,
          "✅ Member removed successfully."
        );

      } catch (error) {
        console.error(
          "KICK ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ Unable to remove this member."
        );
      }
    }

    // ===============================================
    // ADD
    // ===============================================

    if (
      command ===
      "add"
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
          "➕ *ADD MEMBER*\n\nExample:\n" +
          `${prefix}add 94771234567`
        );
      }

      try {
        const result =
          await sock
            .groupParticipantsUpdate(
              jid,
              [target],
              "add"
            );

        console.log(
          "ADD RESULT:",
          result
        );

        return sendText(
          sock,
          jid,
          msg,
          "✅ Add request completed."
        );

      } catch (error) {
        console.error(
          "ADD ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ Unable to add this user. Their WhatsApp privacy settings may require an invitation instead."
        );
      }
    }

    // ===============================================
    // PROMOTE
    // ===============================================

    if (
      command ===
      "promote"
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
          "👑 *PROMOTE MEMBER*\n\nReply to a member or mention them:\n" +
          `${prefix}promote @user`
        );
      }

      try {
        await sock
          .groupParticipantsUpdate(
            jid,
            [target],
            "promote"
          );

        return sendText(
          sock,
          jid,
          msg,
          "✅ Member promoted to admin."
        );

      } catch (error) {
        console.error(
          "PROMOTE ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ Unable to promote this member."
        );
      }
    }

    // ===============================================
    // DEMOTE
    // ===============================================

    if (
      command ===
      "demote"
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
          "👤 *DEMOTE ADMIN*\n\nReply to an admin or mention them:\n" +
          `${prefix}demote @user`
        );
      }

      try {
        await sock
          .groupParticipantsUpdate(
            jid,
            [target],
            "demote"
          );

        return sendText(
          sock,
          jid,
          msg,
          "✅ Admin demoted successfully."
        );

      } catch (error) {
        console.error(
          "DEMOTE ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ Unable to demote this admin."
        );
      }
    }

    // ===============================================
    // MUTE
    // ===============================================

    if (
      command ===
      "mute" ||
      command ===
      "lock"
    ) {
      try {
        await sock
          .groupSettingUpdate(
            jid,
            "announcement"
          );

        return sendText(
          sock,
          jid,
          msg,
          "🔒 *GROUP LOCKED*\n\nOnly admins can send messages now."
        );

      } catch (error) {
        console.error(
          "MUTE ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ Unable to lock this group."
        );
      }
    }

    // ===============================================
    // UNMUTE
    // ===============================================

    if (
      command ===
      "unmute" ||
      command ===
      "unlock"
    ) {
      try {
        await sock
          .groupSettingUpdate(
            jid,
            "not_announcement"
          );

        return sendText(
          sock,
          jid,
          msg,
          "🔓 *GROUP UNLOCKED*\n\nAll members can send messages now."
        );

      } catch (error) {
        console.error(
          "UNMUTE ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ Unable to unlock this group."
        );
      }
    }

    // ===============================================
    // SET SUBJECT
    // ===============================================

    if (
      command ===
      "setsubject"
    ) {
      if (!query) {
        return sendText(
          sock,
          jid,
          msg,
          "✏️ *CHANGE GROUP NAME*\n\nUsage:\n" +
          `${prefix}setsubject <new name>`
        );
      }

      try {
        await sock
          .groupUpdateSubject(
            jid,
            query
          );

        return sendText(
          sock,
          jid,
          msg,
          "✅ Group name updated successfully."
        );

      } catch (error) {
        console.error(
          "SUBJECT ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ Unable to update the group name."
        );
      }
    }

    // ===============================================
    // SET DESCRIPTION
    // ===============================================

    if (
      command ===
      "setdesc"
    ) {
      if (!query) {
        return sendText(
          sock,
          jid,
          msg,
          "📝 *CHANGE GROUP DESCRIPTION*\n\nUsage:\n" +
          `${prefix}setdesc <description>`
        );
      }

      try {
        await sock
          .groupUpdateDescription(
            jid,
            query
          );

        return sendText(
          sock,
          jid,
          msg,
          "✅ Group description updated successfully."
        );

      } catch (error) {
        console.error(
          "DESCRIPTION ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ Unable to update the group description."
        );
      }
    }

    // ===============================================
    // INVITE
    // ===============================================

    if (
      command ===
      "invite"
    ) {
      try {
        const code =
          await sock
            .groupInviteCode(
              jid
            );

        if (!code) {
          throw new Error(
            "Invite code unavailable."
          );
        }

        return sendText(
          sock,
          jid,
          msg,
          "🔗 *GROUP INVITE LINK*\n\n" +
          `https://chat.whatsapp.com/${code}\n\n` +
          "Share this link only with people you trust."
        );

      } catch (error) {
        console.error(
          "INVITE ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ Unable to retrieve the group invite link."
        );
      }
    }

    // ===============================================
    // REVOKE
    // ===============================================

    if (
      command ===
      "revoke"
    ) {
      try {
        await sock
          .groupRevokeInvite(
            jid
          );

        return sendText(
          sock,
          jid,
          msg,
          "✅ *INVITE LINK RESET*\n\nThe previous group invite link is no longer valid."
        );

      } catch (error) {
        console.error(
          "REVOKE ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ Unable to reset the group invite link."
        );
      }
    }
  }
};