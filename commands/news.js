const axios = require("axios");
const cheerio = require("cheerio");

function decode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

module.exports = {
  name: "news",
  aliases: ["latestnews"],
  description: "Get recent Google News RSS headlines.",

  async execute({
    sock,
    msg,
    jid,
    query
  }) {
    try {
      const q = String(query || "").trim();

      const url = q
        ? `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`
        : "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en";

      const { data } = await axios.get(url, {
        timeout: 15000,
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      const $ = cheerio.load(data, { xmlMode: true });
      const items = [];

      $("item").slice(0, 6).each((_, el) => {
        items.push({
          title: decode($(el).find("title").text()),
          link: $(el).find("link").text(),
          pubDate: $(el).find("pubDate").text()
        });
      });

      if (!items.length) {
        throw new Error("No headlines found.");
      }

      let text =
        `📰 *LATEST NEWS${q ? ` — ${q}` : ""}*\n\n`;

      items.forEach((item, i) => {
        text +=
          `${i + 1}. ${item.title}\n` +
          `${item.pubDate}\n` +
          `${item.link}\n\n`;
      });

      return sock.sendMessage(
        jid,
        { text: text.trim().slice(0, 12000) },
        { quoted: msg }
      );
    } catch (error) {
      return sock.sendMessage(
        jid,
        { text: `❌ *NEWS ERROR*\n\n${error?.message || "Unable to load news."}` },
        { quoted: msg }
      );
    }
  }
};
