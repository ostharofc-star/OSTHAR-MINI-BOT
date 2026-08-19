const axios = require("axios");
const cheerio = require("cheerio");
const net = require("net");

function normalizeHttpUrl(input) {
  let value = String(input || "").trim();
  if (!value) throw new Error("URL is required.");

  if (!/^https?:\/\//i.test(value)) {
    value = "https://" + value;
  }

  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP/HTTPS URLs are supported.");
  }

  return url.toString();
}

function heuristicUrlSafety(input) {
  const url = new URL(normalizeHttpUrl(input));
  const host = url.hostname.toLowerCase();

  const reasons = [];
  let score = 0;

  if (url.protocol !== "https:") {
    reasons.push("Connection is not HTTPS.");
    score += 2;
  }

  if (net.isIP(host)) {
    reasons.push("Uses a raw IP address instead of a domain.");
    score += 2;
  }

  if (host.includes("xn--")) {
    reasons.push("Contains an internationalized/punycode domain.");
    score += 2;
  }

  if ((host.match(/\./g) || []).length >= 4) {
    reasons.push("Uses many subdomain levels.");
    score += 1;
  }

  const suspiciousWords = [
    "verify", "login", "secure", "account",
    "wallet", "gift", "bonus", "free",
    "password", "bank", "paypal"
  ];

  const lower = url.toString().toLowerCase();
  const matches = suspiciousWords.filter((x) => lower.includes(x));
  if (matches.length >= 3) {
    reasons.push("Contains several phishing-style keywords.");
    score += 2;
  }

  if (url.username || url.password) {
    reasons.push("Contains credentials in the URL.");
    score += 3;
  }

  const level =
    score >= 5 ? "HIGH RISK" :
    score >= 2 ? "CAUTION" :
    "LOW HEURISTIC RISK";

  return {
    url: url.toString(),
    host,
    score,
    level,
    reasons
  };
}

async function fetchPreview(input) {
  const url = normalizeHttpUrl(input);

  const response = await axios.get(url, {
    timeout: 15000,
    maxRedirects: 5,
    maxContentLength: 2 * 1024 * 1024,
    headers: {
      "User-Agent": "Mozilla/5.0 OSTHAR-MINI-BOT/1.0",
      "Accept": "text/html,application/xhtml+xml"
    },
    validateStatus: (s) => s >= 200 && s < 400
  });

  const contentType = String(response.headers["content-type"] || "");
  if (!contentType.includes("text/html")) {
    return {
      url: response.request?.res?.responseUrl || url,
      title: "",
      description: "",
      image: "",
      contentType,
      status: response.status
    };
  }

  const $ = cheerio.load(String(response.data || ""));
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").first().text() ||
    "";

  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    "";

  const image =
    $('meta[property="og:image"]').attr("content") ||
    "";

  return {
    url: response.request?.res?.responseUrl || url,
    title: title.trim().slice(0, 300),
    description: description.trim().slice(0, 1000),
    image: image.trim().slice(0, 1500),
    contentType,
    status: response.status
  };
}

module.exports = {
  normalizeHttpUrl,
  heuristicUrlSafety,
  fetchPreview
};
