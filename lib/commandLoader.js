const fs = require("fs");
const path = require("path");

function loadCommands() {
  const commands = new Map();

  const commandsPath = path.join(
    process.cwd(),
    "commands"
  );

  if (!fs.existsSync(commandsPath)) {
    throw new Error(
      "Commands folder was not found."
    );
  }

  const files = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of files) {
    try {
      const fullPath = path.join(
        commandsPath,
        file
      );

      delete require.cache[
        require.resolve(fullPath)
      ];

      const command = require(fullPath);

      if (!command?.execute) {
        console.log(
          `[Command Loader] Skipped ${file}: execute() not found`
        );

        continue;
      }

      if (command.name) {
        commands.set(
          command.name.toLowerCase(),
          command
        );
      }

      if (
        Array.isArray(command.aliases)
      ) {
        for (const alias of command.aliases) {
          commands.set(
            String(alias).toLowerCase(),
            command
          );
        }
      }

      console.log(
        `[Command Loader] Loaded: ${file}`
      );

    } catch (error) {
      console.log(
        `[Command Loader] Failed: ${file}`
      );

      console.log(
        error?.message || error
      );
    }
  }

  console.log(
    `[Command Loader] Total aliases/commands: ${commands.size}`
  );

  return commands;
}

function getCommand(
  commands,
  commandName
) {
  if (!commandName) {
    return null;
  }

  return (
    commands.get(
      String(commandName).toLowerCase()
    ) || null
  );
}

module.exports = {
  loadCommands,
  getCommand
};