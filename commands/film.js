// ======================================================
// OSTHAR MINI BOT - LEGAL FILM DOWNLOADER
// Sinhala + English title search
// Public-domain / open-license content only
// ======================================================

function cleanText(value = "") {
  if (Array.isArray(value)) {
    return value.join(" ");
  }

  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

// ======================================================
// FETCH JSON
// ======================================================

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "OSTHAR-MINI-BOT/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }

  return response.json();
}

// ======================================================
// TEXT HELPERS
// ======================================================

function hasSinhalaText(value = "") {
  return /[\u0D80-\u0DFF]/.test(
    String(value || "")
  );
}

function normalizeTitle(value = "") {
  return cleanText(value)
    .toLowerCase()
    .replace(
      /[\(\)\[\]\{\}"'`~!@#$%^&*_=+|\\/:;,.?<>-]/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values = []) {
  const seen =
    new Set();

  const output = [];

  for (const value of values) {
    const text =
      cleanText(value);

    if (!text) {
      continue;
    }

    const key =
      text.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(text);
  }

  return output;
}

function escapeArchiveTerm(value = "") {
  return cleanText(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

// ======================================================
// WIKIDATA TITLE ALIASES
// Helps Sinhala title -> English title and vice versa.
// ======================================================

async function searchWikidata(
  query,
  language
) {
  const url =
    "https://www.wikidata.org/w/api.php" +
    "?action=wbsearchentities" +
    `&search=${encodeURIComponent(query)}` +
    `&language=${encodeURIComponent(language)}` +
    `&uselang=${encodeURIComponent(language)}` +
    "&type=item" +
    "&limit=5" +
    "&format=json" +
    "&origin=*";

  try {
    const data =
      await fetchJson(url);

    return Array.isArray(
      data?.search
    )
      ? data.search
      : [];

  } catch (error) {
    console.log(
      "FILM WIKIDATA SEARCH ERROR:",
      error?.message || error
    );

    return [];
  }
}

async function getWikidataEntityAliases(
  ids = []
) {
  if (!ids.length) {
    return [];
  }

  const url =
    "https://www.wikidata.org/w/api.php" +
    "?action=wbgetentities" +
    `&ids=${encodeURIComponent(
      ids.join("|")
    )}` +
    "&props=labels|aliases|descriptions" +
    "&languages=si|en" +
    "&format=json" +
    "&origin=*";

  try {
    const data =
      await fetchJson(url);

    const entities =
      data?.entities || {};

    const values = [];

    for (
      const entity
      of Object.values(entities)
    ) {
      const descriptionText =
        [
          entity?.descriptions?.en?.value,
          entity?.descriptions?.si?.value
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

      // Prefer movie/film related Wikidata entities.
      // If description is absent, keep it as a fallback.
      const likelyFilm =
        !descriptionText ||
        /film|movie|cinema|motion picture|චිත්‍රපට/.test(
          descriptionText
        );

      if (!likelyFilm) {
        continue;
      }

      if (
        entity?.labels?.si?.value
      ) {
        values.push(
          entity.labels.si.value
        );
      }

      if (
        entity?.labels?.en?.value
      ) {
        values.push(
          entity.labels.en.value
        );
      }

      const sinhalaAliases =
        entity?.aliases?.si || [];

      for (
        const alias
        of sinhalaAliases
      ) {
        if (alias?.value) {
          values.push(alias.value);
        }
      }

      const englishAliases =
        entity?.aliases?.en || [];

      for (
        const alias
        of englishAliases
      ) {
        if (alias?.value) {
          values.push(alias.value);
        }
      }
    }

    return uniqueStrings(values);

  } catch (error) {
    console.log(
      "FILM WIKIDATA ENTITY ERROR:",
      error?.message || error
    );

    return [];
  }
}

async function buildSearchAliases(
  query
) {
  const original =
    cleanText(query);

  const aliases = [
    original
  ];

  const languages =
    hasSinhalaText(original)
      ? ["si", "en"]
      : ["en", "si"];

  const ids = [];

  for (const language of languages) {
    const results =
      await searchWikidata(
        original,
        language
      );

    for (
      const result
      of results
    ) {
      if (result?.id) {
        ids.push(result.id);
      }

      if (result?.label) {
        aliases.push(
          result.label
        );
      }

      if (result?.match?.text) {
        aliases.push(
          result.match.text
        );
      }
    }
  }

  const entityAliases =
    await getWikidataEntityAliases(
      [...new Set(ids)]
        .slice(0, 8)
    );

  aliases.push(
    ...entityAliases
  );

  return uniqueStrings(aliases)
    .slice(0, 12);
}

// ======================================================
// LICENSE CHECK
// ======================================================

function isLegalOpenItem(
  metadata = {}
) {
  const data = [
    metadata.licenseurl,
    metadata.rights,
    metadata.subject,
    metadata.description,
    metadata.notes
  ]
    .map(cleanText)
    .join(" ")
    .toLowerCase();

  const allowed = [
    "public domain",
    "publicdomain",
    "creativecommons.org/publicdomain",
    "creativecommons.org/licenses/by/",
    "creativecommons.org/licenses/by-sa/",
    "creativecommons.org/licenses/by-nc/",
    "creativecommons.org/licenses/by-nc-sa/",
    "cc0",
    "creative commons attribution",
    "creative commons by"
  ];

  return allowed.some(
    item =>
      data.includes(item)
  );
}

// ======================================================
// INTERNET ARCHIVE SEARCH
// ======================================================

async function archiveSearch(
  searchQuery,
  rows = 30
) {
  const url =
    "https://archive.org/advancedsearch.php" +
    `?q=${encodeURIComponent(searchQuery)}` +
    "&fl[]=identifier,title,year,creator,description,subject,licenseurl,rights" +
    `&rows=${rows}` +
    "&page=1" +
    "&output=json";

  const data =
    await fetchJson(url);

  return data?.response?.docs || [];
}

function createArchiveQueries(
  aliases = []
) {
  const queries = [];

  for (
    const alias
    of aliases.slice(0, 8)
  ) {
    const safe =
      escapeArchiveTerm(alias);

    if (!safe) {
      continue;
    }

    // Strong title match
    queries.push(
      `title:("${safe}") AND mediatype:movies`
    );

    // Broader metadata match
    queries.push(
      `("${safe}") AND mediatype:movies`
    );
  }

  return uniqueStrings(queries);
}

// ======================================================
// SIZE / QUALITY / VIDEO
// ======================================================

function getSize(file) {
  const size =
    Number(file?.size || 0);

  return Number.isFinite(size)
    ? size
    : 0;
}

function formatSize(bytes) {
  if (!bytes) {
    return "Unknown";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB"
  ];

  let value =
    bytes;

  let unit =
    0;

  while (
    value >= 1024 &&
    unit <
      units.length - 1
  ) {
    value /= 1024;
    unit++;
  }

  return `${value.toFixed(
    unit >= 2 ? 2 : 0
  )} ${units[unit]}`;
}

function detectQuality(
  file = {}
) {
  const name =
    String(
      file.name || ""
    ).toLowerCase();

  const height =
    Number(
      file.height ||
      file?.video_height ||
      0
    );

  if (height >= 2160) {
    return "2160p / 4K";
  }

  if (height >= 1440) {
    return "1440p";
  }

  if (height >= 1080) {
    return "1080p Full HD";
  }

  if (height >= 720) {
    return "720p HD";
  }

  if (height >= 480) {
    return "480p";
  }

  if (height >= 360) {
    return "360p";
  }

  const qualities = [
    ["2160p", "2160p / 4K"],
    ["4k", "2160p / 4K"],
    ["1440p", "1440p"],
    ["1080p", "1080p Full HD"],
    ["720p", "720p HD"],
    ["480p", "480p"],
    ["360p", "360p"]
  ];

  for (
    const [
      search,
      label
    ] of qualities
  ) {
    if (
      name.includes(search)
    ) {
      return label;
    }
  }

  return "Unknown";
}

function qualityScore(file) {
  const quality =
    detectQuality(file);

  if (
    quality.includes("2160")
  ) {
    return 2160;
  }

  if (
    quality.includes("1440")
  ) {
    return 1440;
  }

  if (
    quality.includes("1080")
  ) {
    return 1080;
  }

  if (
    quality.includes("720")
  ) {
    return 720;
  }

  if (
    quality.includes("480")
  ) {
    return 480;
  }

  if (
    quality.includes("360")
  ) {
    return 360;
  }

  return 0;
}

function findBestVideo(
  files = []
) {
  const videos =
    files.filter(file => {
      const name =
        String(
          file?.name || ""
        ).toLowerCase();

      if (
        !/\.(mp4|m4v|webm|mkv)$/i
          .test(name)
      ) {
        return false;
      }

      const size =
        getSize(file);

      if (
        size &&
        size <
          10 * 1024 * 1024
      ) {
        return false;
      }

      return true;
    });

  if (!videos.length) {
    return null;
  }

  const mp4 =
    videos.filter(file =>
      /\.mp4$/i.test(
        file.name
      )
    );

  const candidates =
    mp4.length
      ? mp4
      : videos;

  candidates.sort(
    (a, b) => {
      const qa =
        qualityScore(a);

      const qb =
        qualityScore(b);

      if (qa !== qb) {
        return qb - qa;
      }

      return (
        getSize(b) -
        getSize(a)
      );
    }
  );

  return candidates[0];
}

// ======================================================
// SINHALA SUBTITLE
// ======================================================

function findSinhalaSubtitle(
  files = []
) {
  const subtitles =
    files.filter(file =>
      /\.(srt|vtt)$/i.test(
        String(
          file?.name || ""
        )
      )
    );

  const patterns = [
    "sinhala",
    "sinhalese",
    ".si.",
    "_si.",
    "-si.",
    ".sin.",
    "_sin.",
    "-sin."
  ];

  return (
    subtitles.find(file => {
      const name =
        String(file.name)
          .toLowerCase();

      return patterns.some(
        word =>
          name.includes(word)
      );
    }) ||
    null
  );
}

// ======================================================
// RESULT SCORING
// ======================================================

function scoreTitleMatch(
  title,
  aliases
) {
  const normalizedTitle =
    normalizeTitle(title);

  if (!normalizedTitle) {
    return 0;
  }

  let score = 0;

  for (
    const alias
    of aliases
  ) {
    const normalizedAlias =
      normalizeTitle(alias);

    if (!normalizedAlias) {
      continue;
    }

    if (
      normalizedTitle ===
      normalizedAlias
    ) {
      score =
        Math.max(
          score,
          1000
        );

      continue;
    }

    if (
      normalizedTitle.includes(
        normalizedAlias
      ) ||
      normalizedAlias.includes(
        normalizedTitle
      )
    ) {
      score =
        Math.max(
          score,
          700
        );

      continue;
    }

    const titleWords =
      new Set(
        normalizedTitle
          .split(" ")
          .filter(Boolean)
      );

    const aliasWords =
      normalizedAlias
        .split(" ")
        .filter(Boolean);

    if (!aliasWords.length) {
      continue;
    }

    const matching =
      aliasWords.filter(
        word =>
          titleWords.has(word)
      ).length;

    const ratio =
      matching /
      aliasWords.length;

    score =
      Math.max(
        score,
        Math.round(
          ratio * 500
        )
      );
  }

  return score;
}

function sriLankaBonus(
  metadata = {}
) {
  const data = [
    metadata.title,
    metadata.subject,
    metadata.description,
    metadata.creator,
    metadata.collection
  ]
    .map(cleanText)
    .join(" ")
    .toLowerCase();

  if (
    /sri lanka|srilanka|ceylon|sinhala|sinhalese|ශ්‍රී ලංකා|සිංහල/.test(
      data
    )
  ) {
    return 100;
  }

  return 0;
}

// ======================================================
// FIND LEGAL OPEN FILM
// ======================================================

async function findLegalFilm(
  query
) {
  const aliases =
    await buildSearchAliases(
      query
    );

  const searchQueries =
    createArchiveQueries(
      aliases
    );

  const docsById =
    new Map();

  for (
    const searchQuery
    of searchQueries
  ) {
    try {
      const docs =
        await archiveSearch(
          searchQuery,
          20
        );

      for (
        const doc
        of docs
      ) {
        if (
          doc?.identifier &&
          !docsById.has(
            doc.identifier
          )
        ) {
          docsById.set(
            doc.identifier,
            doc
          );
        }
      }

      // Avoid too many metadata requests.
      if (
        docsById.size >= 35
      ) {
        break;
      }

    } catch (error) {
      console.log(
        "FILM ARCHIVE SEARCH ERROR:",
        error?.message || error
      );
    }
  }

  const candidates = [];

  for (
    const result
    of [...docsById.values()]
      .slice(0, 35)
  ) {
    try {
      const item =
        await fetchJson(
          "https://archive.org/metadata/" +
          encodeURIComponent(
            result.identifier
          )
        );

      const metadata =
        item?.metadata || {};

      if (
        !isLegalOpenItem(metadata)
      ) {
        continue;
      }

      const files =
        Array.isArray(item?.files)
          ? item.files
          : [];

      const video =
        findBestVideo(files);

      if (!video) {
        continue;
      }

      const title =
        cleanText(
          metadata.title ||
          result.title ||
          query
        );

      const score =
        scoreTitleMatch(
          title,
          aliases
        ) +
        sriLankaBonus(
          metadata
        ) +
        Math.min(
          qualityScore(video),
          2160
        ) / 20;

      candidates.push({
        result,
        item,
        video,
        score
      });

    } catch (error) {
      console.log(
        "FILM ITEM ERROR:",
        error?.message || error
      );
    }
  }

  candidates.sort(
    (a, b) =>
      b.score -
      a.score
  );

  if (!candidates.length) {
    const tried =
      aliases
        .slice(0, 6)
        .join(", ");

    throw new Error(
      "No legal public-domain/open-license copy was found." +
      (
        tried
          ? ` Search names tried: ${tried}`
          : ""
      )
    );
  }

  return {
    ...candidates[0],
    aliases
  };
}

// ======================================================
// URL
// ======================================================

function getArchiveUrl(
  identifier,
  filename
) {
  return (
    "https://archive.org/download/" +
    `${encodeURIComponent(identifier)}/` +
    `${encodeURIComponent(filename)}`
  );
}

// ======================================================
// MESSAGE TEXT
// ======================================================

function getMessageText(message) {
  if (!message) {
    return "";
  }

  return (
    message.conversation ||
    message
      .extendedTextMessage
      ?.text ||
    message
      .imageMessage
      ?.caption ||
    message
      .videoMessage
      ?.caption ||
    ""
  ).trim();
}

// ======================================================
// WAIT FOR "1" REPLY
// ======================================================

function waitForConfirmation({
  sock,
  jid,
  requester,
  messageId,
  timeout = 120000
}) {
  return new Promise(resolve => {
    let finished = false;

    const cleanup = () => {
      if (finished) {
        return;
      }

      finished = true;

      try {
        if (
          typeof sock.ev.off ===
          "function"
        ) {
          sock.ev.off(
            "messages.upsert",
            listener
          );

        } else if (
          typeof sock.ev
            .removeListener ===
          "function"
        ) {
          sock.ev.removeListener(
            "messages.upsert",
            listener
          );
        }
      } catch {}
    };

    const timer =
      setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeout);

    const listener =
      async update => {
        try {
          const messages =
            update?.messages || [];

          for (
            const reply
            of messages
          ) {
            if (
              reply.key.remoteJid !==
              jid
            ) {
              continue;
            }

            const replySender =
              reply.key.participant ||
              reply.key.remoteJid;

            if (
              requester &&
              replySender !== requester
            ) {
              continue;
            }

            const context =
              reply.message
                ?.extendedTextMessage
                ?.contextInfo ||
              reply.message
                ?.imageMessage
                ?.contextInfo ||
              reply.message
                ?.videoMessage
                ?.contextInfo;

            if (
              context?.stanzaId !==
              messageId
            ) {
              continue;
            }

            const text =
              getMessageText(
                reply.message
              );

            if (text === "1") {
              clearTimeout(timer);
              cleanup();
              resolve(true);
              return;
            }
          }

        } catch (error) {
          console.error(
            "FILM CONFIRM ERROR:",
            error
          );
        }
      };

    sock.ev.on(
      "messages.upsert",
      listener
    );
  });
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {
  name: "film",

  aliases: [
    "film",
    "movie"
  ],

  description:
    "Search Sinhala or English film titles and download legal public-domain/open-license copies.",

  reaction: "🎬",

  async execute({
    sock,
    msg,
    jid,
    query,
    settings
  }) {
    const prefix =
      settings?.prefix || ".";

    if (!query) {
      return sock.sendMessage(
        jid,
        {
          text:
            "🎬 *FILM DOWNLOADER*\n\n" +
            "Search using a Sinhala or English movie title.\n\n" +
            `Examples:\n` +
            `${prefix}film Gamperaliya\n` +
            `${prefix}film ගම්පෙරළිය\n` +
            `${prefix}film Rekava\n` +
            `${prefix}film රේඛාව\n\n` +
            "Only public-domain/open-license copies are supported."
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
            "🔎 *SEARCHING FILM*\n\n" +
            `Searching Sinhala + English title matches for:\n*${cleanText(query)}*\n\n` +
            "Checking legal public-domain/open-license sources..."
        },
        {
          quoted: msg
        }
      );

      const {
        result,
        item,
        video,
        aliases
      } =
        await findLegalFilm(
          query
        );

      const metadata =
        item.metadata || {};

      const identifier =
        metadata.identifier ||
        result.identifier;

      const title =
        cleanText(
          metadata.title ||
          result.title ||
          query
        );

      const year =
        cleanText(
          metadata.year ||
          metadata.date ||
          result.year ||
          "Unknown"
        );

      const creator =
        cleanText(
          metadata.creator ||
          "Unknown"
        );

      const files =
        Array.isArray(
          item.files
        )
          ? item.files
          : [];

      const subtitle =
        findSinhalaSubtitle(
          files
        );

      const quality =
        detectQuality(
          video
        );

      const size =
        formatSize(
          getSize(video)
        );

      const extension =
        String(
          video.name
            .split(".")
            .pop() ||
          "Unknown"
        ).toUpperCase();

      const matchedNames =
        aliases
          .filter(
            alias =>
              normalizeTitle(alias) !==
              normalizeTitle(query)
          )
          .slice(0, 3);

      const aliasText =
        matchedNames.length
          ? (
              "\n🔤 *Alternate Titles:* " +
              matchedNames.join(" • ")
            )
          : "";

      const details =
        await sock.sendMessage(
          jid,
          {
            text:
              "╭━━━〔 🎬 *FILM FOUND* 〕━━━╮\n\n" +

              `🎞️ *Name:* ${title}\n` +
              `📅 *Year:* ${year}\n` +
              `🎥 *Quality:* ${quality}\n` +
              `📦 *Size:* ${size}\n` +
              `📁 *Format:* ${extension}\n` +
              `🎬 *Creator:* ${creator}\n` +
              `🇱🇰 *Sinhala Subtitle:* ${
                subtitle
                  ? "Available ✅"
                  : "Not Available ❌"
              }` +
              aliasText +
              "\n\n━━━━━━━━━━━━━━━━━━\n\n" +

              "⬇️ *DOWNLOAD FILM*\n\n" +
              "Reply to this message with:\n\n" +
              "*1*\n\n" +

              "⏱️ This request expires in 2 minutes.\n\n" +
              "╰━━━━━━━━━━━━━━━━━━━━╯"
          },
          {
            quoted: msg
          }
        );

      const requester =
        msg.key.participant ||
        msg.key.remoteJid;

      const confirmed =
        await waitForConfirmation({
          sock,
          jid,
          requester,
          messageId:
            details.key.id,
          timeout:
            120000
        });

      if (!confirmed) {
        return sock.sendMessage(
          jid,
          {
            text:
              "⌛ *DOWNLOAD EXPIRED*\n\n" +
              "The film download request expired.\n\n" +
              `Search again using:\n${prefix}film ${query}`
          },
          {
            quoted: msg
          }
        );
      }

      await sock.sendMessage(
        jid,
        {
          text:
            "⬇️ *DOWNLOADING FILM*\n\n" +
            `${title}\n` +
            `${quality} • ${size}\n\n` +
            "Please wait while the film is being prepared..."
        }
      );

      const filmUrl =
        getArchiveUrl(
          identifier,
          video.name
        );

      // ==================================================
      // SEND FILM
      // ==================================================

      try {
        if (
          /\.mp4$/i.test(
            video.name
          )
        ) {
          await sock.sendMessage(
            jid,
            {
              video: {
                url: filmUrl
              },

              mimetype:
                "video/mp4",

              caption:
                "🎬 *FILM DOWNLOAD*\n\n" +
                `${title}\n` +
                `Quality: ${quality}\n` +
                `Size: ${size}\n\n` +
                "Legal public-domain/open-license source."
            }
          );

        } else {
          await sock.sendMessage(
            jid,
            {
              document: {
                url: filmUrl
              },

              fileName:
                video.name,

              mimetype:
                "application/octet-stream",

              caption:
                `🎬 ${title}`
            }
          );
        }

      } catch (sendError) {
        console.error(
          "FILM SEND ERROR:",
          sendError
        );

        await sock.sendMessage(
          jid,
          {
            text:
              "⚠️ *FILM FILE TOO LARGE OR UPLOAD FAILED*\n\n" +
              "Download the film directly from this legal source:\n\n" +
              `${filmUrl}`
          }
        );
      }

      // ==================================================
      // SEND SINHALA SUBTITLE
      // ==================================================

      if (subtitle) {
        const subtitleUrl =
          getArchiveUrl(
            identifier,
            subtitle.name
          );

        try {
          await sock.sendMessage(
            jid,
            {
              document: {
                url:
                  subtitleUrl
              },

              fileName:
                subtitle.name,

              mimetype:
                /\.vtt$/i.test(
                  subtitle.name
                )
                  ? "text/vtt"
                  : "application/x-subrip",

              caption:
                "🇱🇰 *SINHALA SUBTITLE*\n\n" +
                title
            }
          );

        } catch (error) {
          console.error(
            "SUBTITLE ERROR:",
            error
          );
        }
      }

    } catch (error) {
      console.error(
        "FILM ERROR:",
        error
      );

      return sock.sendMessage(
        jid,
        {
          text:
            "❌ *FILM SEARCH FAILED*\n\n" +
            `${
              error?.message ||
              "Unknown error"
            }\n\n` +
            "Try the Sinhala title or English title.\n" +
            "Only public-domain/open-license films are supported."
        },
        {
          quoted: msg
        }
      );
    }
  }
};
