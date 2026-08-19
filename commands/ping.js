module.exports = {
  name: "ping",
  aliases: [],
  description: "Check bot response speed.",
  reaction: "⚡",

  async execute({ sock, msg, jid }) {
    const start = Date.now();

    const sent = await sock.sendMessage(
      jid,
      {
        text: "⚡ Checking response speed..."
      },
      { quoted: msg }
    );

    const speed = Date.now() - start;

    await sock.sendMessage(jid, {
      text:
        "⚡ *OSTHAR MINI BOT*\n\n" +
        `Response Speed: ${speed}ms\n` +
        "Status: Online\n" +
        "Connection: Stable\n\n" +
        "The bot is running successfully.",
      edit: sent.key
    });
  }
};