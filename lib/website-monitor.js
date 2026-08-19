const axios = require("axios");
const { normalizeHttpUrl } = require("./urlTools");

async function checkWebsite(input) {
  const url = normalizeHttpUrl(input);
  const started = Date.now();

  try {
    const response = await axios.get(url, {
      timeout: 12000,
      maxRedirects: 5,
      maxContentLength: 256 * 1024,
      validateStatus: () => true,
      headers: {
        "User-Agent": "OSTHAR-MINI-BOT-MONITOR/1.0"
      }
    });

    const statusCode = Number(response.status);
    const up = statusCode >= 200 && statusCode < 500;

    return {
      url,
      status: up ? "up" : "down",
      statusCode,
      latencyMs: Date.now() - started
    };
  } catch (error) {
    return {
      url,
      status: "down",
      statusCode: null,
      latencyMs: Date.now() - started,
      error: error?.message || "Request failed"
    };
  }
}

module.exports = {
  checkWebsite
};
