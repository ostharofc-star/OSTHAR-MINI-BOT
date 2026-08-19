const {
  generateAI
} = require("../lib/ai");

const {
  sendError,
  sendLoading,
  ai,
  usage
} = require("../lib/messages");

module.exports = {
  name: "ai-pro",

  aliases: [
    "ai",
    "define",
    "grammar",
    "summarize",
    "code"
  ],

  description:
    "AI powered commands.",

  reaction: "🤖",

  async execute({
    sock,
    msg,
    jid,
    command,
    query,
    settings
  }) {
    const prefix =
      settings?.prefix || ".";

    if (!query) {
      return sock.sendMessage(
        jid,
        {
          text: usage({
            title:
              "AI COMMAND",

            usage:
              `${prefix}${command} <text>`,

            example:
              command === "ai"
                ? `${prefix}ai What is Node.js?`
                : `${prefix}${command} Hello world`
          })
        },
        { quoted: msg }
      );
    }

    try {
      await sendLoading(
        sock,
        jid,
        msg,
        "Processing your request...",
        "OSTHAR AI"
      );

      let system =
        "You are OSTHAR MINI BOT AI. Answer clearly, accurately and concisely. Match the user's language when possible.";

      if (
        command ===
        "define"
      ) {
        system =
          "Act as a concise dictionary. Give definition, part of speech, a simple example and synonyms.";
      }

      if (
        command ===
        "grammar"
      ) {
        system =
          "Correct grammar, spelling and punctuation while preserving the original meaning. Return corrected text first.";
      }

      if (
        command ===
        "summarize"
      ) {
        system =
          "Summarize the text accurately and concisely. Keep important facts and do not invent information.";
      }

      if (
        command ===
        "code"
      ) {
        system =
          "You are a professional coding assistant. Give secure, correct and practical code. Explain briefly.";
      }

      const result =
        await generateAI(
          query,
          {
            system,
            temperature:
              command === "ai"
                ? 0.7
                : 0.25,

            maxOutputTokens:
              command === "code"
                ? 1800
                : 1000
          }
        );

      return sock.sendMessage(
        jid,
        {
          text: ai(
            result,
            command === "code"
              ? "AI CODE ASSISTANT"
              : "OSTHAR AI"
          )
        },
        { quoted: msg }
      );

    } catch (error) {
      console.error(
        "AI PRO ERROR:",
        error
      );

      return sendError(
        sock,
        jid,
        msg,
        error.message,
        "AI REQUEST FAILED"
      );
    }
  }
};