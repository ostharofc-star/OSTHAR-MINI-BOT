const {
  addWebsiteMonitor,
  getUserWebsiteMonitors,
  removeWebsiteMonitorByIndex
} = require("../database/websiteMonitors");

const {
  checkWebsite
} = require("../lib/website-monitor");

const {
  normalizeHttpUrl
} = require("../lib/urlTools");

function senderJid(msg, jid) {
  return (
    msg?.key?.participant ||
    msg?.participant ||
    jid ||
    ""
  );
}

module.exports = {
  name: "sitecheck",
  aliases: ["watchsite", "sitewatches", "unwatchsite"],
  description: "Check or monitor website availability.",

  async execute({
    sock,
    msg,
    jid,
    phone,
    command,
    args,
    query
  }) {
    const sender = senderJid(msg, jid);

    try {
      if (command === "sitecheck") {
        if (!query) {
          return sock.sendMessage(
            jid,
            { text: "🌐 *SITE CHECK*\n\nUsage: .sitecheck https://example.com" },
            { quoted: msg }
          );
        }

        const result = await checkWebsite(query);

        return sock.sendMessage(
          jid,
          {
            text:
              "🌐 *WEBSITE STATUS*\n\n" +
              `Status: *${result.status.toUpperCase()}*\n` +
              `HTTP: ${result.statusCode ?? "No response"}\n` +
              `Latency: ${result.latencyMs} ms\n` +
              `URL: ${result.url}`
          },
          { quoted: msg }
        );
      }

      if (command === "watchsite") {
        const urlArg = args?.[0];
        if (!urlArg) {
          return sock.sendMessage(
            jid,
            {
              text:
                "👁️ *WATCH WEBSITE*\n\n" +
                "Usage: .watchsite <url> [name]\n" +
                "Example: .watchsite https://example.com My Site"
            },
            { quoted: msg }
          );
        }

        const url = normalizeHttpUrl(urlArg);
        const name = args.slice(1).join(" ");

        await addWebsiteMonitor({
          phone,
          createdBy: sender,
          notifyJid: jid,
          url,
          name
        });

        return sock.sendMessage(
          jid,
          {
            text:
              "✅ *WEBSITE MONITOR ADDED*\n\n" +
              `Name: ${name || "Website"}\n` +
              `URL: ${url}\n\n` +
              "The bot will alert this chat when the UP/DOWN state changes."
          },
          { quoted: msg }
        );
      }

      if (command === "sitewatches") {
        const list = await getUserWebsiteMonitors({
          phone,
          createdBy: sender,
          limit: 20
        });

        if (!list.length) {
          return sock.sendMessage(
            jid,
            { text: "👁️ *WEBSITE MONITORS*\n\nNo active website monitors." },
            { quoted: msg }
          );
        }

        let text = "👁️ *WEBSITE MONITORS*\n\n";
        list.forEach((x, i) => {
          text +=
            `${i + 1}. ${x.name || "Website"}\n` +
            `   ${x.url}\n` +
            `   Last: ${String(x.lastStatus || "unknown").toUpperCase()}\n\n`;
        });

        return sock.sendMessage(
          jid,
          { text: text.trim() },
          { quoted: msg }
        );
      }

      if (command === "unwatchsite") {
        const index = Number(args?.[0]);
        const removed = await removeWebsiteMonitorByIndex({
          phone,
          createdBy: sender,
          index
        });

        if (!removed) {
          return sock.sendMessage(
            jid,
            { text: "❌ *MONITOR NOT FOUND*\n\nUse .sitewatches first." },
            { quoted: msg }
          );
        }

        return sock.sendMessage(
          jid,
          { text: `✅ *WEBSITE MONITOR REMOVED*\n\n${removed.url}` },
          { quoted: msg }
        );
      }
    } catch (error) {
      return sock.sendMessage(
        jid,
        { text: `❌ *WEBSITE TOOL ERROR*\n\n${error?.message || "Unable to process website."}` },
        { quoted: msg }
      );
    }
  }
};
