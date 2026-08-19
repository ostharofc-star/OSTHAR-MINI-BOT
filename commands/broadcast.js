function digits(value) {
  return String(value || "")
    .split("@")[0]
    .replace(/\D/g, "");
}

function isOwner(msg, phone) {
  if (msg?.key?.fromMe) return true;

  const sender =
    msg?.key?.participant ||
    msg?.participant ||
    msg?.key?.remoteJid ||
    "";

  return digits(sender) === digits(phone);
}

module.exports = {
  name: "broadcast",
  aliases: ["bc"],
  description: "Owner-only broadcast to supplied JIDs/numbers.",

  async execute({
    sock,
    msg,
    jid,
    phone,
    query
  }) {
    if (!isOwner(msg, phone)) {
      return sock.sendMessage(
        jid,
        { text: "❌ *OWNER ONLY*\n\nOnly the linked account owner can use broadcast." },
        { quoted: msg }
      );
    }

    const raw = String(query || "").trim();
    const split = raw.indexOf("|");

    if (split === -1) {
      return sock.sendMessage(
        jid,
        {
          text:
            "📢 *BROADCAST*\n\n" +
            "Usage:\n" +
            ".broadcast number1,number2 | message\n\n" +
            "Example:\n" +
            ".broadcast 9477xxxxxxx,9471xxxxxxx | Hello everyone"
        },
        { quoted: msg }
      );
    }

    const targetText = raw.slice(0, split).trim();
    const message = raw.slice(split + 1).trim();

    const targets = targetText
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 50)
      .map((x) => {
        if (x.includes("@")) return x;
        const n = digits(x);
        return n ? `${n}@s.whatsapp.net` : "";
      })
      .filter(Boolean);

    if (!targets.length || !message) {
      return sock.sendMessage(
        jid,
        { text: "❌ *INVALID BROADCAST*\n\nProvide targets and a message." },
        { quoted: msg }
      );
    }

    let sent = 0;
    let failed = 0;

    for (const target of targets) {
      try {
        await sock.sendMessage(target, { text: message });
        sent++;
        await new Promise((r) => setTimeout(r, 900));
      } catch {
        failed++;
      }
    }

    return sock.sendMessage(
      jid,
      {
        text:
          "📢 *BROADCAST COMPLETE*\n\n" +
          `Sent: ${sent}\n` +
          `Failed: ${failed}`
      },
      { quoted: msg }
    );
  }
};
