// ======================================================
// OSTHAR MINI BOT - INTERNET TOOLS
// .ip .whois .dns .time .currency .unit
// ======================================================

// ======================================================
// HELPERS
// ======================================================

async function fetchJson(url, options = {}) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      15000
    );

  try {
    const response =
      await fetch(
        url,
        {
          ...options,

          redirect:
            "follow",

          signal:
            controller.signal,

          headers: {
            "User-Agent":
              "OSTHAR-MINI-BOT/1.0",

            Accept:
              "application/json",

            ...(options.headers || {})
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return await response.json();

  } finally {
    clearTimeout(timer);
  }
}

async function sendText(
  sock,
  jid,
  msg,
  text
) {
  return sock.sendMessage(
    jid,
    { text },
    { quoted: msg }
  );
}

function cleanDomain(input = "") {
  let value =
    String(input)
      .trim()
      .toLowerCase();

  value =
    value.replace(
      /^https?:\/\//,
      ""
    );

  value =
    value.split("/")[0];

  value =
    value.split("?")[0];

  value =
    value.split("#")[0];

  value =
    value.replace(
      /^www\./,
      ""
    );

  return value;
}

function validDomain(domain = "") {
  return (
    domain.length <= 253 &&
    /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(
      domain
    )
  );
}

function validIP(ip = "") {
  const ipv4 =
    /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

  const ipv6 =
    /^[0-9a-f:]+$/i;

  return (
    ipv4.test(ip) ||
    (
      ip.includes(":") &&
      ipv6.test(ip)
    )
  );
}

// ======================================================
// RDAP HELPERS
// ======================================================

function getEventDate(
  data,
  action
) {
  const event =
    data?.events?.find(
      item =>
        String(
          item?.eventAction ||
          ""
        ).toLowerCase() ===
        action
    );

  return (
    event?.eventDate ||
    "Unavailable"
  );
}

function getRegistrar(data) {
  const entities =
    Array.isArray(
      data?.entities
    )
      ? data.entities
      : [];

  const registrar =
    entities.find(
      entity =>
        Array.isArray(
          entity?.roles
        ) &&
        entity.roles.includes(
          "registrar"
        )
    );

  if (!registrar) {
    return "Unavailable";
  }

  const vcard =
    registrar?.vcardArray?.[1];

  if (
    Array.isArray(vcard)
  ) {
    const fn =
      vcard.find(
        row =>
          Array.isArray(row) &&
          row[0] === "fn"
      );

    if (fn?.[3]) {
      return fn[3];
    }
  }

  return (
    registrar.handle ||
    "Unavailable"
  );
}

// ======================================================
// DNS
// ======================================================

const DNS_TYPES = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  PTR: 12,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  SRV: 33,
  CAA: 257
};

function dnsTypeName(
  number
) {
  const found =
    Object.entries(
      DNS_TYPES
    ).find(
      ([, value]) =>
        value === number
    );

  return found
    ? found[0]
    : String(number);
}

// ======================================================
// UNIT CONVERSION
// ======================================================

const unitAliases = {
  // LENGTH
  mm: "mm",
  millimeter: "mm",
  millimeters: "mm",

  cm: "cm",
  centimeter: "cm",
  centimeters: "cm",

  m: "m",
  meter: "m",
  meters: "m",

  km: "km",
  kilometer: "km",
  kilometers: "km",

  in: "inch",
  inch: "inch",
  inches: "inch",

  ft: "foot",
  foot: "foot",
  feet: "foot",

  yd: "yard",
  yard: "yard",
  yards: "yard",

  mi: "mile",
  mile: "mile",
  miles: "mile",

  // MASS
  mg: "mg",
  milligram: "mg",

  g: "g",
  gram: "g",
  grams: "g",

  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",

  oz: "oz",
  ounce: "oz",
  ounces: "oz",

  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",

  // TEMPERATURE
  c: "c",
  celcius: "c",
  celsius: "c",

  f: "f",
  fahrenheit: "f",

  k: "k",
  kelvin: "k",

  // DATA
  b: "byte",
  byte: "byte",
  bytes: "byte",

  kb: "kb",
  mb: "mb",
  gb: "gb",
  tb: "tb"
};

const lengthToMeter = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,

  inch: 0.0254,
  foot: 0.3048,
  yard: 0.9144,
  mile: 1609.344
};

const massToKg = {
  mg: 0.000001,
  g: 0.001,
  kg: 1,
  oz: 0.028349523125,
  lb: 0.45359237
};

const dataToByte = {
  byte: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4
};

function normalizeUnit(unit) {
  return unitAliases[
    String(unit || "")
      .toLowerCase()
  ];
}

function convertTemperature(
  value,
  from,
  to
) {
  let celsius;

  if (from === "c") {
    celsius = value;

  } else if (
    from === "f"
  ) {
    celsius =
      (value - 32) *
      5 / 9;

  } else if (
    from === "k"
  ) {
    celsius =
      value - 273.15;

  } else {
    throw new Error(
      "Unsupported temperature unit."
    );
  }

  if (to === "c") {
    return celsius;
  }

  if (to === "f") {
    return (
      celsius *
      9 / 5 +
      32
    );
  }

  if (to === "k") {
    return (
      celsius +
      273.15
    );
  }

  throw new Error(
    "Unsupported temperature unit."
  );
}

function convertUnit(
  value,
  fromRaw,
  toRaw
) {
  const from =
    normalizeUnit(
      fromRaw
    );

  const to =
    normalizeUnit(
      toRaw
    );

  if (!from || !to) {
    throw new Error(
      "Unknown unit."
    );
  }

  if (
    lengthToMeter[from] &&
    lengthToMeter[to]
  ) {
    return (
      value *
      lengthToMeter[from] /
      lengthToMeter[to]
    );
  }

  if (
    massToKg[from] &&
    massToKg[to]
  ) {
    return (
      value *
      massToKg[from] /
      massToKg[to]
    );
  }

  if (
    dataToByte[from] &&
    dataToByte[to]
  ) {
    return (
      value *
      dataToByte[from] /
      dataToByte[to]
    );
  }

  const tempUnits =
    ["c", "f", "k"];

  if (
    tempUnits.includes(from) &&
    tempUnits.includes(to)
  ) {
    return convertTemperature(
      value,
      from,
      to
    );
  }

  throw new Error(
    "These two unit types cannot be converted."
  );
}

function niceNumber(value) {
  if (
    !Number.isFinite(value)
  ) {
    return "Invalid";
  }

  if (
    Math.abs(value) >= 1000000
  ) {
    return value.toLocaleString(
      "en-US",
      {
        maximumFractionDigits: 4
      }
    );
  }

  return Number(
    value.toFixed(8)
  ).toString();
}

// ======================================================
// MODULE
// ======================================================

module.exports = {
  name:
    "internet-tools",

  aliases: [
    "ip",
    "whois",
    "dns",
    "time",
    "currency",
    "unit"
  ],

  description:
    "Internet and conversion tools.",

  reaction:
    "🌐",

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
    // IP LOOKUP
    // ==================================================

    if (command === "ip") {
      const ip =
        String(
          args?.[0] || ""
        ).trim();

      if (!ip) {
        return sendText(
          sock,
          jid,
          msg,
          "🌐 *IP LOOKUP*\n\n" +
          `Usage:\n${prefix}ip <IP address>\n\n` +
          `Example:\n${prefix}ip 8.8.8.8`
        );
      }

      if (!validIP(ip)) {
        return sendText(
          sock,
          jid,
          msg,
          "❌ Invalid IP address."
        );
      }

      try {
        const data =
          await fetchJson(
            `https://ipwho.is/${encodeURIComponent(
              ip
            )}`
          );

        if (
          data?.success ===
          false
        ) {
          throw new Error(
            data?.message ||
            "IP lookup failed."
          );
        }

        const connection =
          data?.connection || {};

        const timezone =
          data?.timezone || {};

        return sendText(
          sock,
          jid,
          msg,
          "╭━━〔 🌐 *IP INFORMATION* 〕━━╮\n\n" +

          `IP: ${data.ip || ip}\n` +
          `Type: ${data.type || "Unknown"}\n` +
          `Country: ${data.country || "Unknown"} ${data?.flag?.emoji || ""}\n` +
          `Region: ${data.region || "Unknown"}\n` +
          `City: ${data.city || "Unknown"}\n` +
          `Postal Code: ${data.postal || "Unknown"}\n` +
          `Latitude: ${data.latitude ?? "Unknown"}\n` +
          `Longitude: ${data.longitude ?? "Unknown"}\n\n` +

          `ISP: ${connection.isp || "Unknown"}\n` +
          `Organization: ${connection.org || "Unknown"}\n` +
          `ASN: ${connection.asn || "Unknown"}\n\n` +

          `Timezone: ${timezone.id || "Unknown"}\n` +
          `UTC: ${timezone.utc || "Unknown"}\n\n` +

          "╰━━━━━━━━━━━━━━━━━━━━╯"
        );

      } catch (error) {
        console.error(
          "IP ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ *IP LOOKUP FAILED*\n\n" +
          (
            error?.message ||
            "Unable to retrieve IP information."
          )
        );
      }
    }

    // ==================================================
    // WHOIS / RDAP
    // ==================================================

    if (
      command ===
      "whois"
    ) {
      const domain =
        cleanDomain(
          args?.[0] || ""
        );

      if (!domain) {
        return sendText(
          sock,
          jid,
          msg,
          "🔎 *DOMAIN LOOKUP*\n\n" +
          `Usage:\n${prefix}whois <domain>\n\n` +
          `Example:\n${prefix}whois google.com`
        );
      }

      if (
        !validDomain(domain)
      ) {
        return sendText(
          sock,
          jid,
          msg,
          "❌ Invalid domain name."
        );
      }

      try {
        const data =
          await fetchJson(
            `https://rdap.org/domain/${encodeURIComponent(
              domain
            )}`
          );

        const registrar =
          getRegistrar(data);

        const created =
          getEventDate(
            data,
            "registration"
          );

        const updated =
          getEventDate(
            data,
            "last changed"
          );

        const expires =
          getEventDate(
            data,
            "expiration"
          );

        const nameservers =
          Array.isArray(
            data?.nameservers
          )
            ? data.nameservers
                .map(
                  ns =>
                    ns.ldhName
                )
                .filter(Boolean)
                .slice(0, 6)
            : [];

        const statuses =
          Array.isArray(
            data?.status
          )
            ? data.status
                .slice(0, 6)
                .join(", ")
            : "Unavailable";

        return sendText(
          sock,
          jid,
          msg,
          "╭━━〔 🔎 *DOMAIN INFORMATION* 〕━━╮\n\n" +

          `Domain: ${data.ldhName || domain}\n` +
          `Registrar: ${registrar}\n` +
          `Created: ${created}\n` +
          `Updated: ${updated}\n` +
          `Expires: ${expires}\n\n` +

          `Status:\n${statuses}\n\n` +

          `Nameservers:\n${
            nameservers.length
              ? nameservers.join("\n")
              : "Unavailable"
          }\n\n` +

          "╰━━━━━━━━━━━━━━━━━━━━╯"
        );

      } catch (error) {
        console.error(
          "WHOIS ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ *DOMAIN LOOKUP FAILED*\n\n" +
          "The domain may not support public RDAP lookup, or the service may be temporarily unavailable."
        );
      }
    }

    // ==================================================
    // DNS
    // ==================================================

    if (
      command ===
      "dns"
    ) {
      const domain =
        cleanDomain(
          args?.[0] || ""
        );

      const type =
        String(
          args?.[1] ||
          "A"
        ).toUpperCase();

      if (!domain) {
        return sendText(
          sock,
          jid,
          msg,
          "🌍 *DNS LOOKUP*\n\n" +
          `Usage:\n${prefix}dns <domain> [type]\n\n` +
          `Examples:\n${prefix}dns google.com\n${prefix}dns google.com MX\n${prefix}dns google.com NS\n${prefix}dns google.com TXT`
        );
      }

      if (
        !validDomain(domain)
      ) {
        return sendText(
          sock,
          jid,
          msg,
          "❌ Invalid domain name."
        );
      }

      if (
        !DNS_TYPES[type]
      ) {
        return sendText(
          sock,
          jid,
          msg,
          "❌ Unsupported DNS type.\n\n" +
          "Supported: A, AAAA, MX, NS, TXT, CNAME, SOA, SRV, CAA"
        );
      }

      try {
        const url =
          "https://dns.google/resolve" +
          `?name=${encodeURIComponent(
            domain
          )}` +
          `&type=${encodeURIComponent(
            type
          )}`;

        const data =
          await fetchJson(url);

        const answers =
          Array.isArray(
            data?.Answer
          )
            ? data.Answer
            : [];

        if (
          !answers.length
        ) {
          return sendText(
            sock,
            jid,
            msg,
            "🌍 *DNS LOOKUP*\n\n" +
            `Domain: ${domain}\n` +
            `Type: ${type}\n\n` +
            "No DNS records were found."
          );
        }

        let text =
          "╭━━〔 🌍 *DNS RECORDS* 〕━━╮\n\n" +
          `Domain: ${domain}\n` +
          `Query Type: ${type}\n\n`;

        answers
          .slice(0, 15)
          .forEach(
            (
              answer,
              index
            ) => {
              text +=
                `${index + 1}. [${dnsTypeName(
                  answer.type
                )}] ${answer.data}\n`;
            }
          );

        text +=
          "\n╰━━━━━━━━━━━━━━━━━━━━╯";

        return sendText(
          sock,
          jid,
          msg,
          text
        );

      } catch (error) {
        console.error(
          "DNS ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ DNS lookup failed."
        );
      }
    }

    // ==================================================
    // TIME
    // ==================================================

    if (
      command ===
      "time"
    ) {
      const city =
        String(
          query || ""
        ).trim();

      if (!city) {
        return sendText(
          sock,
          jid,
          msg,
          "🕒 *WORLD TIME*\n\n" +
          `Usage:\n${prefix}time <city>\n\n` +
          `Examples:\n${prefix}time Colombo\n${prefix}time Tokyo\n${prefix}time New York`
        );
      }

      try {
        const url =
          "https://geocoding-api.open-meteo.com/v1/search" +
          `?name=${encodeURIComponent(
            city
          )}` +
          "&count=1" +
          "&language=en" +
          "&format=json";

        const data =
          await fetchJson(url);

        const place =
          data?.results?.[0];

        if (!place) {
          throw new Error(
            "City was not found."
          );
        }

        const timezone =
          place.timezone;

        if (!timezone) {
          throw new Error(
            "Timezone unavailable."
          );
        }

        const now =
          new Date();

        const date =
          new Intl.DateTimeFormat(
            "en-US",
            {
              timeZone:
                timezone,

              weekday:
                "long",

              year:
                "numeric",

              month:
                "long",

              day:
                "numeric"
            }
          ).format(now);

        const time =
          new Intl.DateTimeFormat(
            "en-US",
            {
              timeZone:
                timezone,

              hour:
                "2-digit",

              minute:
                "2-digit",

              second:
                "2-digit",

              hour12:
                true
            }
          ).format(now);

        return sendText(
          sock,
          jid,
          msg,
          "🕒 *WORLD TIME*\n\n" +

          `Location: ${place.name}${
            place.admin1
              ? `, ${place.admin1}`
              : ""
          }\n` +

          `Country: ${place.country || "Unknown"}\n` +
          `Timezone: ${timezone}\n` +
          `Date: ${date}\n` +
          `Time: ${time}`
        );

      } catch (error) {
        console.error(
          "TIME ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ *TIME LOOKUP FAILED*\n\n" +
          (
            error?.message ||
            "Unable to retrieve the local time."
          )
        );
      }
    }

    // ==================================================
    // CURRENCY
    // ==================================================

    if (
      command ===
      "currency"
    ) {
      const from =
        String(
          args?.[0] || ""
        ).toUpperCase();

      const to =
        String(
          args?.[1] || ""
        ).toUpperCase();

      const amount =
        Number(
          args?.[2]
        );

      if (
        !/^[A-Z]{3}$/.test(
          from
        ) ||
        !/^[A-Z]{3}$/.test(
          to
        ) ||
        !Number.isFinite(
          amount
        )
      ) {
        return sendText(
          sock,
          jid,
          msg,
          "💱 *CURRENCY CONVERTER*\n\n" +
          `Usage:\n${prefix}currency <FROM> <TO> <amount>\n\n` +
          `Example:\n${prefix}currency USD LKR 10`
        );
      }

      if (
        amount < 0 ||
        amount > 1000000000000
      ) {
        return sendText(
          sock,
          jid,
          msg,
          "❌ Invalid currency amount."
        );
      }

      if (from === to) {
        return sendText(
          sock,
          jid,
          msg,
          "💱 *CURRENCY CONVERSION*\n\n" +
          `${amount} ${from} = ${amount} ${to}`
        );
      }

      try {
        const url =
          "https://api.frankfurter.dev/v2/rates" +
          `?base=${encodeURIComponent(
            from
          )}` +
          `&quotes=${encodeURIComponent(
            to
          )}`;

        const data =
          await fetchJson(url);

        let rate = null;
        let date = "Latest";

        // Frankfurter v2 array format
        if (
          Array.isArray(data)
        ) {
          const item =
            data.find(
              row =>
                String(
                  row?.quote ||
                  ""
                ).toUpperCase() ===
                to
            ) ||
            data[0];

          rate =
            Number(
              item?.rate
            );

          date =
            item?.date ||
            date;
        }

        // Flexible fallback
        if (
          !rate &&
          data?.rates?.[to]
        ) {
          rate =
            Number(
              data.rates[to]
            );

          date =
            data.date ||
            date;
        }

        if (
          !Number.isFinite(rate)
        ) {
          throw new Error(
            "Exchange rate unavailable."
          );
        }

        const result =
          amount * rate;

        return sendText(
          sock,
          jid,
          msg,
          "💱 *CURRENCY CONVERSION*\n\n" +

          `${amount} ${from}\n` +
          "↓\n" +
          `${niceNumber(
            result
          )} ${to}\n\n` +

          `Rate: 1 ${from} = ${niceNumber(
            rate
          )} ${to}\n` +

          `Rate Date: ${date}\n\n` +

          "ℹ️ Reference exchange rate. Banks and payment services may use different rates and fees."
        );

      } catch (error) {
        console.error(
          "CURRENCY ERROR:",
          error
        );

        return sendText(
          sock,
          jid,
          msg,
          "❌ *CURRENCY CONVERSION FAILED*\n\n" +
          "Check the currency codes and try again."
        );
      }
    }

    // ==================================================
    // UNIT
    // ==================================================

    if (
      command ===
      "unit"
    ) {
      const value =
        Number(
          args?.[0]
        );

      const from =
        args?.[1];

      const to =
        args?.[2];

      if (
        !Number.isFinite(value) ||
        !from ||
        !to
      ) {
        return sendText(
          sock,
          jid,
          msg,
          "📐 *UNIT CONVERTER*\n\n" +

          `Usage:\n${prefix}unit <value> <from> <to>\n\n` +

          "Examples:\n" +
          `${prefix}unit 10 km mile\n` +
          `${prefix}unit 100 cm m\n` +
          `${prefix}unit 70 kg lb\n` +
          `${prefix}unit 30 c f\n` +
          `${prefix}unit 1 gb mb`
        );
      }

      try {
        const result =
          convertUnit(
            value,
            from,
            to
          );

        return sendText(
          sock,
          jid,
          msg,
          "📐 *UNIT CONVERSION*\n\n" +
          `${value} ${from}\n` +
          "↓\n" +
          `${niceNumber(
            result
          )} ${to}`
        );

      } catch (error) {
        return sendText(
          sock,
          jid,
          msg,
          "❌ *UNIT CONVERSION FAILED*\n\n" +
          `${error.message}\n\n` +
          "Supported categories: length, weight, temperature and digital storage."
        );
      }
    }
  }
};