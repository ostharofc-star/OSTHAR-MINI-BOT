const axios = require("axios");

module.exports = {
  name: "crypto",
  aliases: ["stock"],
  description: "Get cryptocurrency or stock market information.",

  async execute({
    sock,
    msg,
    jid,
    command,
    query
  }) {
    const q = String(query || "").trim();

    if (!q) {
      return sock.sendMessage(
        jid,
        {
          text:
            command === "crypto"
              ? "💰 *CRYPTO*\n\nUsage: .crypto bitcoin\nExample: .crypto ethereum"
              : "📈 *STOCK*\n\nUsage: .stock AAPL"
        },
        { quoted: msg }
      );
    }

    try {
      if (command === "crypto") {
        const id = q.toLowerCase().replace(/\s+/g, "-");

        const { data } = await axios.get(
          "https://api.coingecko.com/api/v3/simple/price",
          {
            timeout: 15000,
            params: {
              ids: id,
              vs_currencies: "usd",
              include_24hr_change: "true"
            }
          }
        );

        const item = data?.[id];
        if (!item) throw new Error("Crypto asset not found.");

        return sock.sendMessage(
          jid,
          {
            text:
              "💰 *CRYPTO PRICE*\n\n" +
              `Asset: ${id}\n` +
              `USD: $${Number(item.usd).toLocaleString("en-US")}\n` +
              `24h: ${Number(item.usd_24h_change || 0).toFixed(2)}%`
          },
          { quoted: msg }
        );
      }

      const symbol = q.toUpperCase().replace(/[^A-Z0-9.^=-]/g, "");

      const { data } = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
        {
          timeout: 15000,
          params: { interval: "1d", range: "5d" },
          headers: { "User-Agent": "Mozilla/5.0" }
        }
      );

      const result = data?.chart?.result?.[0];
      if (!result) throw new Error("Stock symbol not found.");

      const meta = result.meta || {};
      const price = meta.regularMarketPrice;
      const previous = meta.chartPreviousClose;
      const change =
        Number.isFinite(price) && Number.isFinite(previous) && previous !== 0
          ? ((price - previous) / previous) * 100
          : null;

      return sock.sendMessage(
        jid,
        {
          text:
            "📈 *STOCK INFO*\n\n" +
            `Symbol: ${meta.symbol || symbol}\n` +
            `Price: ${price ?? "N/A"} ${meta.currency || ""}\n` +
            `Previous Close: ${previous ?? "N/A"}\n` +
            `Change: ${change == null ? "N/A" : change.toFixed(2) + "%"}\n` +
            `Exchange: ${meta.exchangeName || "Unknown"}`
        },
        { quoted: msg }
      );
    } catch (error) {
      return sock.sendMessage(
        jid,
        { text: `❌ *MARKET ERROR*\n\n${error?.message || "Unable to fetch market data."}` },
        { quoted: msg }
      );
    }
  }
};
