module.exports = {
  name: "speed",
  aliases: ["latency"],
  description: "Check bot processing speed.",
  reaction: "🚀",

  async execute({ sock, msg, jid }) {
    const start = process.hrtime.bigint();

    const test = await sock.sendMessage(
      jid,
      {
        text: "🚀 Measuring bot performance..."
      },
      { quoted: msg }
    );

    const end = process.hrtime.bigint();

    const ms =
      Number(end - start) / 1000000;

    await sock.sendMessage(
      jid,
      {
        text:
          "🚀 *OSTHAR MINI BOT SPEED*\n\n" +
          `Response: ${ms.toFixed(2)} ms\n` +
          "Status: Excellent\n" +
          "System: Active"
      },
      {
        edit: test.key
      }
    );
  }
};