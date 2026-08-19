const crypto = require("crypto");
const os = require("os");

// ======================================================
// HELPERS
// ======================================================

function formatBytes(bytes = 0) {
  const units = ["B", "KB", "MB", "GB", "TB"];

  let value = Number(bytes) || 0;
  let index = 0;

  while (
    value >= 1024 &&
    index < units.length - 1
  ) {
    value /= 1024;
    index++;
  }

  return `${value.toFixed(
    index >= 2 ? 2 : 0
  )} ${units[index]}`;
}

function formatRuntime(seconds = 0) {
  seconds = Math.floor(seconds);

  const days =
    Math.floor(seconds / 86400);

  const hours =
    Math.floor(
      (seconds % 86400) / 3600
    );

  const minutes =
    Math.floor(
      (seconds % 3600) / 60
    );

  const secs =
    seconds % 60;

  return (
    `${days}d ` +
    `${hours}h ` +
    `${minutes}m ` +
    `${secs}s`
  );
}

function randomItem(array) {
  return array[
    Math.floor(
      Math.random() *
      array.length
    )
  ];
}

function randomNumber(min, max) {
  return Math.floor(
    Math.random() *
      (max - min + 1)
  ) + min;
}

// ======================================================
// FUN DATA
// ======================================================

const quotes = [
  "Success is built one step at a time.",
  "Small progress is still progress.",
  "Focus on improvement, not perfection.",
  "Consistency turns ideas into results.",
  "Every expert was once a beginner.",
  "Discipline beats motivation when motivation disappears.",
  "Learn, build, improve, repeat.",
  "Your future is shaped by what you do today.",
  "Great things take time and consistent effort.",
  "Dream big, but build step by step."
];

const facts = [
  "Octopuses have three hearts.",
  "A day on Venus is longer than a year on Venus.",
  "Honey can remain edible for an extremely long time when stored properly.",
  "The human brain uses roughly one fifth of the body's energy.",
  "Lightning can heat the surrounding air to temperatures hotter than the surface of the Sun.",
  "Bananas are botanically classified as berries.",
  "Sharks existed before trees.",
  "The Pacific Ocean is larger than all Earth's land area combined.",
  "Sound travels faster through water than through air.",
  "The first computer mouse was made primarily from wood."
];

const jokes = [
  "Why did the developer go broke? Because he used up all his cache.",
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "Why was the computer cold? It left its Windows open.",
  "Why did the JavaScript developer wear glasses? Because he could not C#.",
  "There are 10 kinds of people: those who understand binary and those who do not."
];

const truths = [
  "What is something you want to become better at?",
  "What was your most embarrassing mistake?",
  "What is one goal you have not told many people about?",
  "What habit would you most like to change?",
  "What is something you are proud of?",
  "Who inspires you the most?",
  "What is something you have always wanted to learn?"
];

const dares = [
  "Do 10 push-ups.",
  "Send a positive message to a friend.",
  "Drink a full glass of water.",
  "Do not use social media for the next 20 minutes.",
  "Learn one new English word and use it in a sentence.",
  "Clean your desk for five minutes.",
  "Write down three goals you want to complete."
];

// ======================================================
// COMMAND INFORMATION
// ======================================================

const commandInfo = {
  password:
    "Generate a secure random password.",

  uuid:
    "Generate a random UUID.",

  base64:
    "Encode or decode Base64 text.",

  hash:
    "Create a SHA-256 hash.",

  random:
    "Generate a random number.",

  dice:
    "Roll a six-sided dice.",

  coin:
    "Flip a coin.",

  quote:
    "Get a random motivational quote.",

  fact:
    "Get a random fact.",

  joke:
    "Get a random joke.",

  truth:
    "Get a random truth question.",

  dare:
    "Get a random dare.",

  botinfo:
    "View bot system information.",

  version:
    "View bot and Node.js versions.",

  uptime:
    "View bot uptime.",

  memory:
    "View memory usage.",

  cpu:
    "View CPU information.",

  status:
    "View current bot status.",

  commands:
    "View PRO utility commands.",

  cmdinfo:
    "View information about a command."
};

// ======================================================
// MODULE
// ======================================================

module.exports = {
  name: "pro-tools",

  aliases: [
    "password",
    "uuid",
    "base64",
    "hash",
    "random",
    "dice",
    "coin",
    "quote",
    "fact",
    "joke",
    "truth",
    "dare",
    "botinfo",
    "version",
    "uptime",
    "memory",
    "cpu",
    "status",
    "commands",
    "cmdinfo"
  ],

  description:
    "PRO system, utility and fun commands.",

  reaction: "⚡",

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

    const botName =
      settings?.botName ||
      "OSTHAR MINI BOT";

    // ==================================================
    // PASSWORD
    // ==================================================

    if (command === "password") {
      let length =
        parseInt(args?.[0]) || 16;

      if (length < 8) {
        length = 8;
      }

      if (length > 128) {
        length = 128;
      }

      const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ" +
        "abcdefghijkmnopqrstuvwxyz" +
        "23456789" +
        "!@#$%^&*_-+=";

      let password = "";

      const bytes =
        crypto.randomBytes(length);

      for (
        let i = 0;
        i < length;
        i++
      ) {
        password +=
          chars[
            bytes[i] %
              chars.length
          ];
      }

      return sock.sendMessage(
        jid,
        {
          text:
            "🔐 *SECURE PASSWORD*\n\n" +
            `${password}\n\n` +
            `Length: ${length} characters`
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // UUID
    // ==================================================

    if (command === "uuid") {
      return sock.sendMessage(
        jid,
        {
          text:
            "🆔 *UUID*\n\n" +
            crypto.randomUUID()
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // BASE64
    // ==================================================

    if (command === "base64") {
      const mode =
        String(
          args?.[0] || ""
        ).toLowerCase();

      const text =
        (args || [])
          .slice(1)
          .join(" ")
          .trim();

      if (
        !["encode", "decode"].includes(
          mode
        ) ||
        !text
      ) {
        return sock.sendMessage(
          jid,
          {
            text:
              "🔤 *BASE64 TOOL*\n\n" +
              `Encode:\n${prefix}base64 encode Hello World\n\n` +
              `Decode:\n${prefix}base64 decode SGVsbG8=`
          },
          { quoted: msg }
        );
      }

      try {
        let result;

        if (mode === "encode") {
          result =
            Buffer.from(
              text,
              "utf8"
            ).toString(
              "base64"
            );
        } else {
          result =
            Buffer.from(
              text,
              "base64"
            ).toString(
              "utf8"
            );
        }

        return sock.sendMessage(
          jid,
          {
            text:
              `🔤 *BASE64 ${mode.toUpperCase()}*\n\n` +
              result
          },
          { quoted: msg }
        );

      } catch (error) {
        return sock.sendMessage(
          jid,
          {
            text:
              "❌ Base64 conversion failed."
          },
          { quoted: msg }
        );
      }
    }

    // ==================================================
    // HASH
    // ==================================================

    if (command === "hash") {
      if (!query) {
        return sock.sendMessage(
          jid,
          {
            text:
              "🔒 *SHA-256 HASH*\n\n" +
              `Usage:\n${prefix}hash <text>`
          },
          { quoted: msg }
        );
      }

      const result =
        crypto
          .createHash("sha256")
          .update(query)
          .digest("hex");

      return sock.sendMessage(
        jid,
        {
          text:
            "🔒 *SHA-256*\n\n" +
            result
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // RANDOM
    // ==================================================

    if (command === "random") {
      let min =
        parseInt(args?.[0]);

      let max =
        parseInt(args?.[1]);

      if (
        !Number.isFinite(min) ||
        !Number.isFinite(max)
      ) {
        min = 1;
        max = 100;
      }

      if (min > max) {
        [min, max] =
          [max, min];
      }

      if (
        Math.abs(max - min) >
        1000000000
      ) {
        return sock.sendMessage(
          jid,
          {
            text:
              "❌ Number range is too large."
          },
          { quoted: msg }
        );
      }

      return sock.sendMessage(
        jid,
        {
          text:
            "🎲 *RANDOM NUMBER*\n\n" +
            `${randomNumber(
              min,
              max
            )}\n\n` +
            `Range: ${min} - ${max}`
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // DICE
    // ==================================================

    if (command === "dice") {
      const number =
        randomNumber(1, 6);

      return sock.sendMessage(
        jid,
        {
          text:
            "🎲 *DICE ROLL*\n\n" +
            `You rolled: *${number}*`
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // COIN
    // ==================================================

    if (command === "coin") {
      const result =
        Math.random() < 0.5
          ? "HEADS"
          : "TAILS";

      return sock.sendMessage(
        jid,
        {
          text:
            "🪙 *COIN FLIP*\n\n" +
            `Result: *${result}*`
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // QUOTE
    // ==================================================

    if (command === "quote") {
      return sock.sendMessage(
        jid,
        {
          text:
            "💬 *QUOTE*\n\n" +
            randomItem(quotes)
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // FACT
    // ==================================================

    if (command === "fact") {
      return sock.sendMessage(
        jid,
        {
          text:
            "🧠 *RANDOM FACT*\n\n" +
            randomItem(facts)
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // JOKE
    // ==================================================

    if (command === "joke") {
      return sock.sendMessage(
        jid,
        {
          text:
            "😄 *JOKE*\n\n" +
            randomItem(jokes)
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // TRUTH
    // ==================================================

    if (command === "truth") {
      return sock.sendMessage(
        jid,
        {
          text:
            "🎯 *TRUTH*\n\n" +
            randomItem(truths)
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // DARE
    // ==================================================

    if (command === "dare") {
      return sock.sendMessage(
        jid,
        {
          text:
            "🔥 *DARE*\n\n" +
            randomItem(dares)
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // BOT INFO
    // ==================================================

    if (command === "botinfo") {
      return sock.sendMessage(
        jid,
        {
          text:
            `╭━━〔 *${botName}* 〕━━╮\n\n` +
            `🤖 Bot: ${botName}\n` +
            `⚡ Status: Online\n` +
            `🟢 Node: ${process.version}\n` +
            `💻 Platform: ${process.platform}\n` +
            `🏗️ Architecture: ${process.arch}\n` +
            `⏱️ Uptime: ${formatRuntime(
              process.uptime()
            )}\n` +
            `📦 Commands: PRO Mode\n\n` +
            "*Mini Bot Created by Pamoda Nethsara*\n" +
            "╰━━━━━━━━━━━━━━━━╯"
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // VERSION
    // ==================================================

    if (command === "version") {
      return sock.sendMessage(
        jid,
        {
          text:
            "📦 *VERSION INFORMATION*\n\n" +
            "OSTHAR MINI BOT: 1.0.0\n" +
            `Node.js: ${process.version}\n` +
            `Platform: ${process.platform} ${process.arch}`
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // UPTIME
    // ==================================================

    if (command === "uptime") {
      return sock.sendMessage(
        jid,
        {
          text:
            "⏱️ *BOT UPTIME*\n\n" +
            formatRuntime(
              process.uptime()
            )
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // MEMORY
    // ==================================================

    if (command === "memory") {
      const usage =
        process.memoryUsage();

      return sock.sendMessage(
        jid,
        {
          text:
            "🧠 *MEMORY USAGE*\n\n" +
            `RSS: ${formatBytes(
              usage.rss
            )}\n` +
            `Heap Used: ${formatBytes(
              usage.heapUsed
            )}\n` +
            `Heap Total: ${formatBytes(
              usage.heapTotal
            )}\n` +
            `External: ${formatBytes(
              usage.external
            )}`
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // CPU
    // ==================================================

    if (command === "cpu") {
      const cpus =
        os.cpus();

      const model =
        cpus?.[0]?.model ||
        "Unknown";

      return sock.sendMessage(
        jid,
        {
          text:
            "💻 *CPU INFORMATION*\n\n" +
            `Model: ${model}\n` +
            `Cores: ${cpus.length}\n` +
            `Architecture: ${os.arch()}\n` +
            `Platform: ${os.platform()}`
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // STATUS
    // ==================================================

    if (command === "status") {
      const usage =
        process.memoryUsage();

      return sock.sendMessage(
        jid,
        {
          text:
            "🟢 *BOT STATUS*\n\n" +
            "Status: Online ✅\n" +
            "Commands: Ready ✅\n" +
            `Uptime: ${formatRuntime(
              process.uptime()
            )}\n` +
            `Memory: ${formatBytes(
              usage.rss
            )}\n` +
            `Prefix: ${prefix}`
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // COMMANDS
    // ==================================================

    if (command === "commands") {
      return sock.sendMessage(
        jid,
        {
          text:
            "⚡ *PRO COMMANDS*\n\n" +
            `│ ${prefix}password <length>\n` +
            `│ ${prefix}uuid\n` +
            `│ ${prefix}base64 encode/decode <text>\n` +
            `│ ${prefix}hash <text>\n` +
            `│ ${prefix}random <min> <max>\n` +
            `│ ${prefix}dice\n` +
            `│ ${prefix}coin\n` +
            `│ ${prefix}quote\n` +
            `│ ${prefix}fact\n` +
            `│ ${prefix}joke\n` +
            `│ ${prefix}truth\n` +
            `│ ${prefix}dare\n` +
            `│ ${prefix}botinfo\n` +
            `│ ${prefix}version\n` +
            `│ ${prefix}uptime\n` +
            `│ ${prefix}memory\n` +
            `│ ${prefix}cpu\n` +
            `│ ${prefix}status\n` +
            `│ ${prefix}cmdinfo <command>`
        },
        { quoted: msg }
      );
    }

    // ==================================================
    // COMMAND INFO
    // ==================================================

    if (command === "cmdinfo") {
      const target =
        String(
          args?.[0] || ""
        )
          .replace(
            new RegExp(
              `^\\${prefix}`
            ),
            ""
          )
          .toLowerCase();

      if (!target) {
        return sock.sendMessage(
          jid,
          {
            text:
              "ℹ️ *COMMAND INFO*\n\n" +
              `Usage:\n${prefix}cmdinfo <command>\n\n` +
              `Example:\n${prefix}cmdinfo password`
          },
          { quoted: msg }
        );
      }

      const info =
        commandInfo[target];

      if (!info) {
        return sock.sendMessage(
          jid,
          {
            text:
              "❌ Command information was not found."
          },
          { quoted: msg }
        );
      }

      return sock.sendMessage(
        jid,
        {
          text:
            "ℹ️ *COMMAND INFORMATION*\n\n" +
            `Command: ${prefix}${target}\n` +
            `Description: ${info}`
        },
        { quoted: msg }
      );
    }
  }
};