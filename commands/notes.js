const {
  saveNote,
  getNote,
  getNotes,
  deleteNote,
  countNotes,
  normalizeNoteName
} = require("../database/notes");

// ======================================================
// NOTES COMMAND
// ======================================================

module.exports = {
  name: "setnote",

  aliases: [
    "getnote",
    "notes",
    "delnote",
    "deletenote",
    "removenote"
  ],

  description:
    "Save, view, list, or delete personal bot notes.",

  reaction: "📝",

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
      // SET NOTE
      // ==================================================

      if (
        command === "setnote"
      ) {
        const noteName =
          normalizeNoteName(
            args?.[0]
          );

        const content =
          String(
            args
              ?.slice(1)
              .join(" ") ||
            ""
          ).trim();

        if (
          !noteName ||
          !content
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "📝 *SAVE NOTE*\n\n" +
                "Usage:\n" +
                ".setnote <name> <content>\n\n" +
                "Example:\n" +
                ".setnote wifi My WiFi password is 12345678"
            },
            {
              quoted: msg
            }
          );
        }

        const saved =
          await saveNote(
            phone,
            noteName,
            content
          );

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *NOTE SAVED*\n\n" +
              `Name: ${saved.name}\n\n` +
              "Use:\n" +
              `.getnote ${saved.name}`
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // GET NOTE
      // ==================================================

      if (
        command === "getnote"
      ) {
        const noteName =
          normalizeNoteName(
            args?.[0]
          );

        if (!noteName) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "📝 *GET NOTE*\n\n" +
                "Usage:\n" +
                ".getnote <name>\n\n" +
                "Example:\n" +
                ".getnote wifi"
            },
            {
              quoted: msg
            }
          );
        }

        const note =
          await getNote(
            phone,
            noteName
          );

        if (!note) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *NOTE NOT FOUND*\n\n" +
                `No note named "${noteName}" was found.`
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
              "📝 *NOTE*\n\n" +
              `Name: ${note.name}\n\n` +
              `${note.content}`
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // LIST NOTES
      // ==================================================

      if (
        command === "notes"
      ) {
        const notes =
          await getNotes(
            phone
          );

        if (
          !notes.length
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "📝 *MY NOTES*\n\n" +
                "You do not have any saved notes yet.\n\n" +
                "Create one with:\n" +
                ".setnote wifi My WiFi password"
            },
            {
              quoted: msg
            }
          );
        }

        const count =
          await countNotes(
            phone
          );

        let text =
          "📝 *MY NOTES*\n\n" +
          `Total: ${count}\n\n`;

        notes.forEach(
          (
            note,
            index
          ) => {
            text +=
              `${index + 1}. ${note.name}\n`;
          }
        );

        text +=
          "\nUse *.getnote <name>* to open a note.";

        return await sock.sendMessage(
          jid,
          {
            text
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // DELETE NOTE
      // ==================================================

      if (
        command === "delnote" ||
        command === "deletenote" ||
        command === "removenote"
      ) {
        const noteName =
          normalizeNoteName(
            args?.[0]
          );

        if (!noteName) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "🗑️ *DELETE NOTE*\n\n" +
                "Usage:\n" +
                ".delnote <name>\n\n" +
                "Example:\n" +
                ".delnote wifi"
            },
            {
              quoted: msg
            }
          );
        }

        const result =
          await deleteNote(
            phone,
            noteName
          );

        if (
          !result?.deletedCount
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *NOTE NOT FOUND*\n\n" +
                `No note named "${noteName}" was found.`
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
              "✅ *NOTE DELETED*\n\n" +
              `Removed: ${noteName}`
          },
          {
            quoted: msg
          }
        );
      }

    } catch (error) {
      console.log(
        "NOTES COMMAND ERROR:",
        error?.message || error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *NOTES ERROR*\n\n" +
            "Unable to process your note right now."
        },
        {
          quoted: msg
        }
      );
    }
  }
};