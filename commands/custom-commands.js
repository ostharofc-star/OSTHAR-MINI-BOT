const {
  saveCustomCommand,
  getCustomCommands,
  deleteCustomCommand,
  countCustomCommands,
  normalizeCommand
} = require("../database/customCommands");

const RESERVED_COMMANDS = new Set([
  "addcmd",
  "delcmd",
  "deletecmd",
  "removecmd",
  "listcmd",
  "customcmds"
]);

module.exports = {
  name: "addcmd",

  aliases: [
    "delcmd",
    "deletecmd",
    "removecmd",
    "listcmd",
    "customcmds"
  ],

  description:
    "Create, list, or delete custom bot commands.",

  reaction: "🧩",

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
      // ADD CUSTOM COMMAND
      // ==================================================

      if (command === "addcmd") {
        const commandName =
          normalizeCommand(
            args?.[0]
          );

        const response =
          String(
            args
              ?.slice(1)
              .join(" ") ||
            ""
          ).trim();

        if (
          !commandName ||
          !response
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "🧩 *ADD CUSTOM COMMAND*\n\n" +
                "Usage:\n" +
                ".addcmd hello Hello! Welcome.\n\n" +
                "After saving, use:\n" +
                ".hello"
            },
            {
              quoted: msg
            }
          );
        }

        if (
          RESERVED_COMMANDS.has(
            commandName
          )
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *RESERVED COMMAND*\n\n" +
                "That command name cannot be used."
            },
            {
              quoted: msg
            }
          );
        }

        await saveCustomCommand(
          phone,
          commandName,
          response
        );

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *CUSTOM COMMAND SAVED*\n\n" +
              `Command: .${commandName}\n\n` +
              "You can use it now."
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // DELETE CUSTOM COMMAND
      // ==================================================

      if (
        command === "delcmd" ||
        command === "deletecmd" ||
        command === "removecmd"
      ) {
        const commandName =
          normalizeCommand(
            args?.[0]
          );

        if (!commandName) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "🗑️ *DELETE CUSTOM COMMAND*\n\n" +
                "Usage:\n" +
                ".delcmd hello"
            },
            {
              quoted: msg
            }
          );
        }

        const result =
          await deleteCustomCommand(
            phone,
            commandName
          );

        if (
          !result?.deletedCount
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *COMMAND NOT FOUND*\n\n" +
                `No custom command named .${commandName} was found.`
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
              "✅ *CUSTOM COMMAND DELETED*\n\n" +
              `Removed: .${commandName}`
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // LIST CUSTOM COMMANDS
      // ==================================================

      if (
        command === "listcmd" ||
        command === "customcmds"
      ) {
        const commands =
          await getCustomCommands(
            phone
          );

        if (
          !commands.length
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "🧩 *CUSTOM COMMANDS*\n\n" +
                "You do not have any custom commands yet.\n\n" +
                "Create one with:\n" +
                ".addcmd hello Hello!"
            },
            {
              quoted: msg
            }
          );
        }

        const count =
          await countCustomCommands(
            phone
          );

        let text =
          "🧩 *CUSTOM COMMANDS*\n\n" +
          `Total: ${count}\n\n`;

        commands.forEach(
          (item, index) => {
            text +=
              `${index + 1}. .${item.command}\n`;
          }
        );

        text +=
          "\nUse *.delcmd commandname* to remove one.";

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

    } catch (error) {
      console.log(
        "CUSTOM COMMAND ERROR:",
        error?.message || error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *CUSTOM COMMAND ERROR*\n\n" +
            "Unable to process this custom command request."
        },
        {
          quoted: msg
        }
      );
    }
  }
};