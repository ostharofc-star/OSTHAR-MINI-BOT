const fs = require("fs");
const path = require("path");

// ==========================================
// LOAD ALL COMMANDS
// ==========================================

function loadAllCommands() {
  const commandsDir =
    __dirname;

  const files =
    fs
      .readdirSync(commandsDir)
      .filter(
        file =>
          file.endsWith(".js") &&
          file !== "findcmd.js"
      );

  const commands = [];

  for (const file of files) {
    try {
      const filePath =
        path.join(
          commandsDir,
          file
        );

      // Remove old require cache
      delete require.cache[
        require.resolve(filePath)
      ];

      const command =
        require(filePath);

      if (!command) {
        continue;
      }

      // Some files may export one command
      if (
        command.name &&
        typeof command.name === "string"
      ) {
        commands.push({
          name:
            command.name,

          aliases:
            Array.isArray(
              command.aliases
            )
              ? command.aliases
              : [],

          description:
            command.description ||
            "No description available."
        });

        continue;
      }

      // Some command files may export arrays
      if (
        Array.isArray(command)
      ) {
        for (
          const item of command
        ) {
          if (
            item?.name &&
            typeof item.name === "string"
          ) {
            commands.push({
              name:
                item.name,

              aliases:
                Array.isArray(
                  item.aliases
                )
                  ? item.aliases
                  : [],

              description:
                item.description ||
                "No description available."
            });
          }
        }
      }

    } catch (error) {
      console.log(
        `FINDCMD LOAD ERROR (${file}):`,
        error?.message || error
      );
    }
  }

  return commands;
}

// ==========================================
// NORMALIZE TEXT
// ==========================================

function normalize(text) {
  return String(
    text || ""
  )
    .trim()
    .toLowerCase();
}

// ==========================================
// SEARCH SCORE
// ==========================================

function getSearchScore(
  command,
  query
) {
  const name =
    normalize(
      command.name
    );

  const aliases =
    command.aliases.map(
      normalize
    );

  const description =
    normalize(
      command.description
    );

  // Exact command match
  if (
    name === query
  ) {
    return 100;
  }

  // Exact alias match
  if (
    aliases.includes(query)
  ) {
    return 90;
  }

  // Command starts with query
  if (
    name.startsWith(query)
  ) {
    return 80;
  }

  // Alias starts with query
  if (
    aliases.some(
      alias =>
        alias.startsWith(query)
    )
  ) {
    return 70;
  }

  // Command contains query
  if (
    name.includes(query)
  ) {
    return 60;
  }

  // Alias contains query
  if (
    aliases.some(
      alias =>
        alias.includes(query)
    )
  ) {
    return 50;
  }

  // Description contains query
  if (
    description.includes(query)
  ) {
    return 30;
  }

  return 0;
}

// ==========================================
// COMMAND
// ==========================================

module.exports = {
  name: "findcmd",

  aliases: [
    "searchcmd",
    "cmdsearch",
    "findcommand"
  ],

  description:
    "Search for available bot commands.",

  reaction: "🔎",

  async execute({
    sock,
    msg,
    jid,
    args,
    query,
    phone
  }) {
    try {
      const searchText =
        normalize(
          query ||
          args?.join(" ")
        );

      if (!searchText) {
        return await sock.sendMessage(
          jid,
          {
            text:
              "🔎 *COMMAND SEARCH*\n\n" +
              "Search for any bot command.\n\n" +
              "Examples:\n" +
              ".findcmd sticker\n" +
              ".findcmd video\n" +
              ".findcmd ai\n" +
              ".findcmd group"
          },
          {
            quoted: msg
          }
        );
      }

      const commands =
        loadAllCommands();

      const results =
        commands
          .map(
            command => ({
              ...command,

              score:
                getSearchScore(
                  command,
                  searchText
                )
            })
          )
          .filter(
            command =>
              command.score > 0
          )
          .sort(
            (a, b) =>
              b.score -
              a.score
          )
          .slice(
            0,
            10
          );

      if (
        results.length === 0
      ) {
        return await sock.sendMessage(
          jid,
          {
            text:
              "❌ *NO COMMAND FOUND*\n\n" +
              `Search: ${searchText}\n\n` +
              "Try another keyword.\n\n" +
              "Example:\n" +
              ".findcmd download"
          },
          {
            quoted: msg
          }
        );
      }

      let text =
        "🔎 *COMMAND SEARCH RESULTS*\n\n" +
        `Search: ${searchText}\n` +
        `Found: ${results.length}\n\n`;

      results.forEach(
        (
          command,
          index
        ) => {
          text +=
            `${index + 1}. *.${command.name}*\n`;

          if (
            command.aliases.length
          ) {
            text +=
              `Aliases: ${command.aliases
                .map(
                  alias =>
                    `.${alias}`
                )
                .join(", ")}\n`;
          }

          text +=
            `${command.description}\n\n`;
        }
      );

      await sock.sendMessage(
        jid,
        {
          text:
            text.trim()
        },
        {
          quoted: msg
        }
      );

    } catch (error) {
      console.log(
        "FINDCMD ERROR:",
        error?.message || error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ *COMMAND SEARCH ERROR*\n\n" +
            "Unable to search commands right now."
        },
        {
          quoted: msg
        }
      );
    }
  }
};