const {
  getFavorites,
  addFavorite,
  removeFavorite,
  clearFavorites,
  countFavorites,
  isFavorite,
  normalizeFavoriteCommand
} = require("../database/favorites");

// ======================================================
// FAVORITES COMMAND
// ======================================================

module.exports = {
  name: "addfav",

  aliases: [
    "fav",
    "favorites",
    "delfav",
    "removefav",
    "clearfav"
  ],

  description:
    "Manage your favorite bot commands.",

  reaction: "⭐",

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
      // ADD FAVORITE
      // ==================================================

      if (
        command === "addfav"
      ) {
        const commandName =
          normalizeFavoriteCommand(
            args?.[0]
          );

        if (!commandName) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "⭐ *ADD FAVORITE*\n\n" +
                "Usage:\n" +
                ".addfav <command>\n\n" +
                "Examples:\n" +
                ".addfav menu\n" +
                ".addfav sticker\n" +
                ".addfav ai"
            },
            {
              quoted: msg
            }
          );
        }

        const alreadyFavorite =
          await isFavorite(
            phone,
            commandName
          );

        if (alreadyFavorite) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "ℹ️ *ALREADY FAVORITE*\n\n" +
                `.${commandName} is already in your favorites.`
            },
            {
              quoted: msg
            }
          );
        }

        await addFavorite(
          phone,
          commandName
        );

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *FAVORITE ADDED*\n\n" +
              `Command: .${commandName}\n\n` +
              "Use *.fav* to view your favorites."
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // LIST FAVORITES
      // ==================================================

      if (
        command === "fav" ||
        command === "favorites"
      ) {
        const favorites =
          await getFavorites(
            phone
          );

        if (
          !favorites.length
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "⭐ *MY FAVORITES*\n\n" +
                "You do not have any favorite commands yet.\n\n" +
                "Add one with:\n" +
                ".addfav menu"
            },
            {
              quoted: msg
            }
          );
        }

        const count =
          await countFavorites(
            phone
          );

        let text =
          "⭐ *MY FAVORITES*\n\n" +
          `Total: ${count}\n\n`;

        favorites.forEach(
          (
            item,
            index
          ) => {
            text +=
              `${index + 1}. .${item}\n`;
          }
        );

        text +=
          "\nUse *.delfav <command>* to remove one.";

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
      // REMOVE FAVORITE
      // ==================================================

      if (
        command === "delfav" ||
        command === "removefav"
      ) {
        const commandName =
          normalizeFavoriteCommand(
            args?.[0]
          );

        if (!commandName) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "🗑️ *REMOVE FAVORITE*\n\n" +
                "Usage:\n" +
                ".delfav <command>\n\n" +
                "Example:\n" +
                ".delfav sticker"
            },
            {
              quoted: msg
            }
          );
        }

        const exists =
          await isFavorite(
            phone,
            commandName
          );

        if (!exists) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "❌ *FAVORITE NOT FOUND*\n\n" +
                `.${commandName} is not in your favorites.`
            },
            {
              quoted: msg
            }
          );
        }

        await removeFavorite(
          phone,
          commandName
        );

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *FAVORITE REMOVED*\n\n" +
              `Removed: .${commandName}`
          },
          {
            quoted: msg
          }
        );
      }

      // ==================================================
      // CLEAR FAVORITES
      // ==================================================

      if (
        command === "clearfav"
      ) {
        const favorites =
          await getFavorites(
            phone
          );

        if (
          !favorites.length
        ) {
          return await sock.sendMessage(
            jid,
            {
              text:
                "ℹ️ *FAVORITES*\n\n" +
                "Your favorites list is already empty."
            },
            {
              quoted: msg
            }
          );
        }

        await clearFavorites(
          phone
        );

        return await sock.sendMessage(
          jid,
          {
            text:
              "✅ *FAVORITES CLEARED*\n\n" +
              "All favorite commands have been removed."
          },
          {
            quoted: msg
          }
        );
      }

    } catch (error) {
      console.log(
        "FAVORITES COMMAND ERROR:",
        error?.message || error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *FAVORITES ERROR*\n\n" +
            "Unable to process your favorites right now."
        },
        {
          quoted: msg
        }
      );
    }
  }
};