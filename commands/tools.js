const QRCode = require("qrcode");
const cheerio = require("cheerio");

// ======================================================
// HELPERS
// ======================================================

function cleanText(text = "", max = 3500) {
  return String(text)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function validUrl(value = "") {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 OSTHAR-MINI-BOT"
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(
      `Request failed: HTTP ${response.status}`
    );
  }

  return response.json();
}

// ======================================================
// WEATHER CODE
// ======================================================

function weatherCodeText(code) {
  const map = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",

    45: "Fog",
    48: "Rime fog",

    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",

    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",

    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",

    80: "Rain showers",
    81: "Rain showers",
    82: "Heavy rain showers",

    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Heavy thunderstorm with hail"
  };

  return map[code] || "Unknown";
}

// ======================================================
// WEATHER
// ======================================================

async function getWeather(city) {
  const geoUrl =
    "https://geocoding-api.open-meteo.com/v1/search" +
    `?name=${encodeURIComponent(city)}` +
    "&count=1&language=en&format=json";

  const geo =
    await fetchJson(geoUrl);

  const place =
    geo?.results?.[0];

  if (!place) {
    throw new Error(
      "City/location was not found."
    );
  }

  const weatherUrl =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${place.latitude}` +
    `&longitude=${place.longitude}` +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m" +
    "&timezone=auto";

  const data =
    await fetchJson(weatherUrl);

  const current =
    data?.current;

  if (!current) {
    throw new Error(
      "Weather data is unavailable."
    );
  }

  return {
    place:
      [
        place.name,
        place.admin1,
        place.country
      ]
        .filter(Boolean)
        .join(", "),

    temperature:
      current.temperature_2m,

    feelsLike:
      current.apparent_temperature,

    humidity:
      current.relative_humidity_2m,

    wind:
      current.wind_speed_10m,

    rain:
      current.precipitation,

    condition:
      weatherCodeText(
        current.weather_code
      )
  };
}

// ======================================================
// TRANSLATE
// ======================================================

async function translateText(
  target,
  text
) {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    "?client=gtx" +
    "&sl=auto" +
    `&tl=${encodeURIComponent(target)}` +
    "&dt=t" +
    `&q=${encodeURIComponent(text)}`;

  const response =
    await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0"
      }
    });

  if (!response.ok) {
    throw new Error(
      `Translation failed: HTTP ${response.status}`
    );
  }

  const data =
    await response.json();

  const translated =
    data?.[0]
      ?.map(
        (part) =>
          part?.[0] || ""
      )
      .join("");

  if (!translated) {
    throw new Error(
      "Translation result is unavailable."
    );
  }

  return translated;
}

// ======================================================
// WEB SEARCH
// ======================================================

async function webSearch(query) {
  const url =
    "https://html.duckduckgo.com/html/" +
    `?q=${encodeURIComponent(query)}`;

  const response =
    await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });

  if (!response.ok) {
    throw new Error(
      `Search failed: HTTP ${response.status}`
    );
  }

  const html =
    await response.text();

  const $ =
    cheerio.load(html);

  const results = [];

  $(".result").each(
    (index, element) => {
      if (
        results.length >= 5
      ) {
        return false;
      }

      const title =
        cleanText(
          $(element)
            .find(".result__title")
            .text(),
          200
        );

      let link =
        $(element)
          .find(".result__a")
          .attr("href");

      const snippet =
        cleanText(
          $(element)
            .find(".result__snippet")
            .text(),
          300
        );

      if (
        title &&
        link
      ) {
        results.push({
          title,
          link,
          snippet
        });
      }
    }
  );

  return results;
}

// ======================================================
// WIKIPEDIA
// ======================================================

async function wikiSearch(query) {
  const searchUrl =
    "https://en.wikipedia.org/w/api.php" +
    "?action=query" +
    "&list=search" +
    "&format=json" +
    "&utf8=1" +
    `&srsearch=${encodeURIComponent(query)}` +
    "&srlimit=1" +
    "&origin=*";

  const search =
    await fetchJson(searchUrl);

  const first =
    search?.query?.search?.[0];

  if (!first?.title) {
    throw new Error(
      "Wikipedia article was not found."
    );
  }

  const summaryUrl =
    "https://en.wikipedia.org/api/rest_v1/page/summary/" +
    encodeURIComponent(first.title);

  const summary =
    await fetchJson(summaryUrl);

  return {
    title:
      summary.title ||
      first.title,

    extract:
      cleanText(
        summary.extract ||
        "No summary available.",
        3000
      ),

    url:
      summary
        ?.content_urls
        ?.desktop
        ?.page ||
      `https://en.wikipedia.org/wiki/${encodeURIComponent(
        first.title.replace(/ /g, "_")
      )}`
  };
}

// ======================================================
// IMAGE SEARCH
// ======================================================

async function imageSearch(query) {
  const url =
    "https://commons.wikimedia.org/w/api.php" +
    "?action=query" +
    "&generator=search" +
    "&gsrnamespace=6" +
    "&gsrlimit=10" +
    `&gsrsearch=${encodeURIComponent(query)}` +
    "&prop=imageinfo" +
    "&iiprop=url" +
    "&iiurlwidth=1280" +
    "&format=json" +
    "&origin=*";

  const data =
    await fetchJson(url);

  const pages =
    Object.values(
      data?.query?.pages || {}
    );

  for (
    const page of pages
  ) {
    const info =
      page?.imageinfo?.[0];

    const imageUrl =
      info?.thumburl ||
      info?.url;

    if (
      imageUrl &&
      /\.(jpg|jpeg|png|webp)(\?|$)/i.test(
        imageUrl
      )
    ) {
      return {
        title:
          page.title
            ?.replace(
              /^File:/i,
              ""
            ) ||
          query,

        url:
          imageUrl
      };
    }
  }

  throw new Error(
    "No suitable image was found."
  );
}

// ======================================================
// CALCULATOR
// ======================================================

function calculate(expression) {
  const input =
    String(expression || "")
      .trim();

  if (!input) {
    throw new Error(
      "Please enter an expression."
    );
  }

  if (
    input.length > 150
  ) {
    throw new Error(
      "Expression is too long."
    );
  }

  // Numbers/operators only
  if (
    !/^[0-9+\-*/().%\s]+$/.test(
      input
    )
  ) {
    throw new Error(
      "Only numbers and + - * / % ( ) are allowed."
    );
  }

  let result;

  try {
    result =
      Function(
        `"use strict"; return (${input})`
      )();
  } catch {
    throw new Error(
      "Invalid mathematical expression."
    );
  }

  if (
    typeof result !== "number" ||
    !Number.isFinite(result)
  ) {
    throw new Error(
      "Invalid calculation result."
    );
  }

  return result;
}

// ======================================================
// SHORT URL
// ======================================================

async function shortenUrl(url) {
  if (!validUrl(url)) {
    throw new Error(
      "Please provide a valid URL."
    );
  }

  const response =
    await fetch(
      "https://tinyurl.com/api-create.php" +
      `?url=${encodeURIComponent(url)}`
    );

  if (!response.ok) {
    throw new Error(
      `Short URL failed: HTTP ${response.status}`
    );
  }

  const short =
    cleanText(
      await response.text(),
      500
    );

  if (
    !short.startsWith(
      "http"
    )
  ) {
    throw new Error(
      "Unable to shorten this URL."
    );
  }

  return short;
}

// ======================================================
// SCREENSHOT
// ======================================================

async function getScreenshot(url) {
  if (!validUrl(url)) {
    throw new Error(
      "Please provide a valid website URL."
    );
  }

  const endpoint =
    "https://api.microlink.io/" +
    `?url=${encodeURIComponent(url)}` +
    "&screenshot=true" +
    "&meta=false";

  const data =
    await fetchJson(endpoint);

  const screenshotUrl =
    data?.data?.screenshot?.url;

  if (!screenshotUrl) {
    throw new Error(
      "Screenshot was not generated."
    );
  }

  return screenshotUrl;
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {
  name: "tools",

  aliases: [
    "weather",
    "translate",
    "google",
    "image",
    "wiki",
    "calc",
    "shorturl",
    "qr",
    "ss"
  ],

  description:
    "Useful web and utility tools.",

  reaction: "🔎",

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

    // ==================================================
    // WEATHER
    // ==================================================

    if (
      command === "weather"
    ) {
      if (!query) {
        return sock.sendMessage(
          jid,
          {
            text:
              "🌦️ *WEATHER*\n\n" +
              `Usage: ${prefix}weather <city>\n\n` +
              `Example: ${prefix}weather Colombo`
          },
          {
            quoted: msg
          }
        );
      }

      try {
        const weather =
          await getWeather(query);

        return sock.sendMessage(
          jid,
          {
            text:
              "🌦️ *CURRENT WEATHER*\n\n" +
              `Location: ${weather.place}\n` +
              `Condition: ${weather.condition}\n` +
              `Temperature: ${weather.temperature}°C\n` +
              `Feels Like: ${weather.feelsLike}°C\n` +
              `Humidity: ${weather.humidity}%\n` +
              `Wind: ${weather.wind} km/h\n` +
              `Precipitation: ${weather.rain} mm\n\n` +
              "*Mini Bot Created by Pamoda Nethsara*"
          },
          {
            quoted: msg
          }
        );

      } catch (error) {
        return sock.sendMessage(
          jid,
          {
            text:
              "❌ *WEATHER FAILED*\n\n" +
              `Error: ${error.message}`
          },
          {
            quoted: msg
          }
        );
      }
    }

    // ==================================================
    // TRANSLATE
    // ==================================================

    if (
      command === "translate"
    ) {
      const target =
        args?.[0];

      const text =
        args
          ?.slice(1)
          .join(" ")
          .trim();

      if (
        !target ||
        !text
      ) {
        return sock.sendMessage(
          jid,
          {
            text:
              "🌐 *TRANSLATE*\n\n" +
              `Usage: ${prefix}translate <language-code> <text>\n\n` +
              `Examples:\n` +
              `${prefix}translate si Hello how are you\n` +
              `${prefix}translate en ඔයාට කොහොමද`
          },
          {
            quoted: msg
          }
        );
      }

      try {
        const translated =
          await translateText(
            target,
            text
          );

        return sock.sendMessage(
          jid,
          {
            text:
              "🌐 *TRANSLATION*\n\n" +
              `Target: ${target}\n\n` +
              `${translated}`
          },
          {
            quoted: msg
          }
        );

      } catch (error) {
        return sock.sendMessage(
          jid,
          {
            text:
              "❌ *TRANSLATION FAILED*\n\n" +
              `Error: ${error.message}`
          },
          {
            quoted: msg
          }
        );
      }
    }

    // ==================================================
    // WEB SEARCH
    // ==================================================

    if (
      command === "google"
    ) {
      if (!query) {
        return sock.sendMessage(
          jid,
          {
            text:
              "🔎 *WEB SEARCH*\n\n" +
              `Usage: ${prefix}google <query>`
          },
          {
            quoted: msg
          }
        );
      }

      try {
        const results =
          await webSearch(query);

        if (!results.length) {
          throw new Error(
            "No search results were found."
          );
        }

        let text =
          `🔎 *SEARCH RESULTS*\n\nQuery: ${query}\n\n`;

        results.forEach(
          (item, index) => {
            text +=
              `*${index + 1}. ${item.title}*\n`;

            if (
              item.snippet
            ) {
              text +=
                `${item.snippet}\n`;
            }

            text +=
              `${item.link}\n\n`;
          }
        );

        text +=
          "*Mini Bot Created by Pamoda Nethsara*";

        return sock.sendMessage(
          jid,
          {
            text
          },
          {
            quoted: msg
          }
        );

      } catch (error) {
        return sock.sendMessage(
          jid,
          {
            text:
              "❌ *WEB SEARCH FAILED*\n\n" +
              `Error: ${error.message}`
          },
          {
            quoted: msg
          }
        );
      }
    }

    // ==================================================
    // IMAGE
    // ==================================================

    if (
      command === "image"
    ) {
      if (!query) {
        return sock.sendMessage(
          jid,
          {
            text:
              "🖼️ *IMAGE SEARCH*\n\n" +
              `Usage: ${prefix}image <query>`
          },
          {
            quoted: msg
          }
        );
      }

      try {
        const result =
          await imageSearch(query);

        return sock.sendMessage(
          jid,
          {
            image: {
              url:
                result.url
            },

            caption:
              `🖼️ *IMAGE SEARCH*\n\n` +
              `Query: ${query}\n` +
              `Result: ${result.title}\n\n` +
              "*Mini Bot Created by Pamoda Nethsara*"
          },
          {
            quoted: msg
          }
        );

      } catch (error) {
        return sock.sendMessage(
          jid,
          {
            text:
              "❌ *IMAGE SEARCH FAILED*\n\n" +
              `Error: ${error.message}`
          },
          {
            quoted: msg
          }
        );
      }
    }

    // ==================================================
    // WIKI
    // ==================================================

    if (
      command === "wiki"
    ) {
      if (!query) {
        return sock.sendMessage(
          jid,
          {
            text:
              "📚 *WIKIPEDIA*\n\n" +
              `Usage: ${prefix}wiki <query>`
          },
          {
            quoted: msg
          }
        );
      }

      try {
        const result =
          await wikiSearch(query);

        return sock.sendMessage(
          jid,
          {
            text:
              `📚 *${result.title}*\n\n` +
              `${result.extract}\n\n` +
              `Read More: ${result.url}\n\n` +
              "*Mini Bot Created by Pamoda Nethsara*"
          },
          {
            quoted: msg
          }
        );

      } catch (error) {
        return sock.sendMessage(
          jid,
          {
            text:
              "❌ *WIKIPEDIA FAILED*\n\n" +
              `Error: ${error.message}`
          },
          {
            quoted: msg
          }
        );
      }
    }

    // ==================================================
    // CALCULATOR
    // ==================================================

    if (
      command === "calc"
    ) {
      if (!query) {
        return sock.sendMessage(
          jid,
          {
            text:
              "🧮 *CALCULATOR*\n\n" +
              `Usage: ${prefix}calc <expression>\n\n` +
              `Example: ${prefix}calc (25*5)+10`
          },
          {
            quoted: msg
          }
        );
      }

      try {
        const result =
          calculate(query);

        return sock.sendMessage(
          jid,
          {
            text:
              "🧮 *CALCULATOR*\n\n" +
              `${query} = *${result}*`
          },
          {
            quoted: msg
          }
        );

      } catch (error) {
        return sock.sendMessage(
          jid,
          {
            text:
              "❌ *CALCULATION FAILED*\n\n" +
              `Error: ${error.message}`
          },
          {
            quoted: msg
          }
        );
      }
    }

    // ==================================================
    // SHORT URL
    // ==================================================

    if (
      command === "shorturl"
    ) {
      if (!query) {
        return sock.sendMessage(
          jid,
          {
            text:
              "🔗 *SHORT URL*\n\n" +
              `Usage: ${prefix}shorturl <url>`
          },
          {
            quoted: msg
          }
        );
      }

      try {
        const result =
          await shortenUrl(query);

        return sock.sendMessage(
          jid,
          {
            text:
              "🔗 *SHORT URL*\n\n" +
              `${result}`
          },
          {
            quoted: msg
          }
        );

      } catch (error) {
        return sock.sendMessage(
          jid,
          {
            text:
              "❌ *SHORT URL FAILED*\n\n" +
              `Error: ${error.message}`
          },
          {
            quoted: msg
          }
        );
      }
    }

    // ==================================================
    // QR
    // ==================================================

    if (
      command === "qr"
    ) {
      if (!query) {
        return sock.sendMessage(
          jid,
          {
            text:
              "🔳 *QR GENERATOR*\n\n" +
              `Usage: ${prefix}qr <text or URL>`
          },
          {
            quoted: msg
          }
        );
      }

      try {
        const buffer =
          await QRCode.toBuffer(
            query,
            {
              width: 700,
              margin: 2
            }
          );

        return sock.sendMessage(
          jid,
          {
            image:
              buffer,

            caption:
              "🔳 *QR CODE*\n\n" +
              "*Mini Bot Created by Pamoda Nethsara*"
          },
          {
            quoted: msg
          }
        );

      } catch (error) {
        return sock.sendMessage(
          jid,
          {
            text:
              "❌ *QR GENERATION FAILED*\n\n" +
              `Error: ${error.message}`
          },
          {
            quoted: msg
          }
        );
      }
    }

    // ==================================================
    // WEBSITE SCREENSHOT
    // ==================================================

    if (
      command === "ss"
    ) {
      if (!query) {
        return sock.sendMessage(
          jid,
          {
            text:
              "📷 *WEBSITE SCREENSHOT*\n\n" +
              `Usage: ${prefix}ss <website-url>\n\n` +
              `Example: ${prefix}ss https://example.com`
          },
          {
            quoted: msg
          }
        );
      }

      try {
        await sock.sendMessage(
          jid,
          {
            text:
              "📷 Capturing website screenshot..."
          },
          {
            quoted: msg
          }
        );

        const screenshot =
          await getScreenshot(
            query
          );

        return sock.sendMessage(
          jid,
          {
            image: {
              url:
                screenshot
            },

            caption:
              `📷 *WEBSITE SCREENSHOT*\n\n` +
              `${query}\n\n` +
              "*Mini Bot Created by Pamoda Nethsara*"
          },
          {
            quoted: msg
          }
        );

      } catch (error) {
        return sock.sendMessage(
          jid,
          {
            text:
              "❌ *SCREENSHOT FAILED*\n\n" +
              `Error: ${error.message}`
          },
          {
            quoted: msg
          }
        );
      }
    }
  }
};