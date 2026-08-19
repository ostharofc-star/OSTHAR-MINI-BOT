const fs = require("fs");
const path = require("path");

const SESSION_ROOT =
  process.env.SESSION_DIR ||
  path.join(
    __dirname,
    "..",
    "sessions"
  );

const recipientCache =
  new Map();

const saveTimers =
  new Map();

function cleanPhone(
  phone = ""
) {
  return String(
    phone ||
    ""
  ).replace(
    /\D/g,
    ""
  );
}

function normalizeStatusJid(
  value = ""
) {
  const raw =
    String(
      value ||
      ""
    ).trim();

  if (!raw) {
    return null;
  }

  // IMPORTANT:
  // Baileys statusJidList is safest with PN JIDs only.
  // Do NOT persist @lid entries here.
  if (
    !raw.endsWith(
      "@s.whatsapp.net"
    )
  ) {
    return null;
  }

  let user =
    raw.slice(
      0,
      raw.lastIndexOf("@")
    );

  // Strip a device suffix like 9477...:2@s.whatsapp.net.
  user =
    user.split(":")[0]
      .replace(/\D/g, "");

  if (!user) {
    return null;
  }

  return `${user}@s.whatsapp.net`;
}

function fileForPhone(
  phone
) {
  return path.join(
    SESSION_ROOT,
    cleanPhone(phone),
    "status-recipients.json"
  );
}

function loadSet(
  phone
) {
  const clean =
    cleanPhone(phone);

  if (
    recipientCache.has(clean)
  ) {
    return recipientCache.get(clean);
  }

  const set =
    new Set();

  try {
    const file =
      fileForPhone(clean);

    if (fs.existsSync(file)) {
      const parsed =
        JSON.parse(
          fs.readFileSync(
            file,
            "utf8"
          )
        );

      for (
        const jid of
        (Array.isArray(parsed) ? parsed : [])
      ) {
        const normalized =
          normalizeStatusJid(jid);

        if (normalized) {
          set.add(normalized);
        }
      }
    }
  } catch (error) {
    console.log(
      `[${clean}] Status Recipient Load Error:`,
      error?.message || error
    );
  }

  recipientCache.set(
    clean,
    set
  );

  return set;
}

function saveNow(
  phone
) {
  const clean =
    cleanPhone(phone);

  const set =
    loadSet(clean);

  try {
    const file =
      fileForPhone(clean);

    fs.mkdirSync(
      path.dirname(file),
      {
        recursive: true
      }
    );

    fs.writeFileSync(
      file,
      JSON.stringify(
        Array.from(set),
        null,
        2
      )
    );
  } catch (error) {
    console.log(
      `[${clean}] Status Recipient Save Error:`,
      error?.message || error
    );
  }
}

function scheduleSave(
  phone
) {
  const clean =
    cleanPhone(phone);

  if (saveTimers.has(clean)) {
    clearTimeout(
      saveTimers.get(clean)
    );
  }

  const timer =
    setTimeout(
      () => {
        saveTimers.delete(clean);
        saveNow(clean);
      },
      500
    );

  if (
    typeof timer.unref ===
    "function"
  ) {
    timer.unref();
  }

  saveTimers.set(
    clean,
    timer
  );
}

function rememberStatusRecipient(
  phone,
  jid
) {
  const normalized =
    normalizeStatusJid(jid);

  if (!normalized) {
    return false;
  }

  const set =
    loadSet(phone);

  const before =
    set.size;

  set.add(normalized);

  if (set.size !== before) {
    scheduleSave(phone);
  }

  return true;
}

async function resolveAndRemember(
  sock,
  phone,
  jid
) {
  const raw =
    String(
      jid ||
      ""
    ).trim();

  if (!raw) {
    return null;
  }

  const direct =
    normalizeStatusJid(raw);

  if (direct) {
    rememberStatusRecipient(
      phone,
      direct
    );

    return direct;
  }

  if (!raw.endsWith("@lid")) {
    return null;
  }

  try {
    const mapper =
      sock?.signalRepository
        ?.lidMapping;

    if (
      mapper &&
      typeof mapper.getPNForLID ===
        "function"
    ) {
      const pn =
        await mapper.getPNForLID(
          raw
        );

      const normalized =
        normalizeStatusJid(pn);

      if (normalized) {
        rememberStatusRecipient(
          phone,
          normalized
        );

        return normalized;
      }
    }
  } catch (error) {
    console.log(
      `[${cleanPhone(phone)}] LID -> PN resolve error:`,
      error?.message || error
    );
  }

  return null;
}

function rememberMessagePNs(
  sock,
  phone,
  msg
) {
  const key =
    msg?.key ||
    {};

  // v7 status/broadcast messages can expose the real phone JID in
  // remoteJidAlt while participant is @lid. Store the PN directly.
  const immediate = [
    key.remoteJidAlt,
    key.participantAlt
  ];

  for (
    const jid of immediate
  ) {
    rememberStatusRecipient(
      phone,
      jid
    );
  }

  const maybeLidOrPn = [
    key.remoteJid,
    key.participant
  ];

  for (
    const jid of maybeLidOrPn
  ) {
    resolveAndRemember(
      sock,
      phone,
      jid
    ).catch(() => {});
  }
}

function registerStatusRecipientTracking(
  sock,
  phone
) {
  loadSet(phone);

  // Own PN is deliberately not added as a recipient automatically.
  // statusJidList should describe viewers/recipients.

  sock.ev.on(
    "contacts.upsert",
    (contacts = []) => {
      for (
        const contact of
        (Array.isArray(contacts) ? contacts : [])
      ) {
        resolveAndRemember(
          sock,
          phone,
          contact?.id
        ).catch(() => {});
      }
    }
  );

  sock.ev.on(
    "contacts.update",
    (contacts = []) => {
      for (
        const contact of
        (Array.isArray(contacts) ? contacts : [])
      ) {
        resolveAndRemember(
          sock,
          phone,
          contact?.id
        ).catch(() => {});
      }
    }
  );

  sock.ev.on(
    "chats.upsert",
    (chats = []) => {
      for (
        const chat of
        (Array.isArray(chats) ? chats : [])
      ) {
        resolveAndRemember(
          sock,
          phone,
          chat?.id
        ).catch(() => {});
      }
    }
  );

  sock.ev.on(
    "messaging-history.set",
    (data = {}) => {
      for (
        const contact of
        (Array.isArray(data.contacts) ? data.contacts : [])
      ) {
        resolveAndRemember(
          sock,
          phone,
          contact?.id
        ).catch(() => {});
      }

      for (
        const chat of
        (Array.isArray(data.chats) ? data.chats : [])
      ) {
        resolveAndRemember(
          sock,
          phone,
          chat?.id
        ).catch(() => {});
      }

      for (
        const msg of
        (Array.isArray(data.messages) ? data.messages : [])
      ) {
        rememberMessagePNs(
          sock,
          phone,
          msg
        );
      }
    }
  );

  sock.ev.on(
    "messages.upsert",
    ({ messages } = {}) => {
      for (
        const msg of
        (Array.isArray(messages) ? messages : [])
      ) {
        rememberMessagePNs(
          sock,
          phone,
          msg
        );
      }
    }
  );
}

function getStatusRecipients(
  phone,
  extraJids = []
) {
  const set =
    loadSet(phone);

  for (
    const jid of
    (Array.isArray(extraJids) ? extraJids : [])
  ) {
    const normalized =
      normalizeStatusJid(jid);

    if (normalized) {
      set.add(normalized);
    }
  }

  return Array.from(set)
    .filter(
      jid =>
        jid.endsWith(
          "@s.whatsapp.net"
        )
    );
}

function forgetStatusRecipient(
  phone,
  jid
) {
  const normalized =
    normalizeStatusJid(jid);

  if (!normalized) {
    return false;
  }

  const set =
    loadSet(phone);

  const deleted =
    set.delete(normalized);

  if (deleted) {
    saveNow(phone);
  }

  return deleted;
}

function clearStatusRecipients(
  phone
) {
  const set =
    loadSet(phone);

  set.clear();
  saveNow(phone);
}

module.exports = {
  normalizeStatusJid,
  rememberStatusRecipient,
  registerStatusRecipientTracking,
  getStatusRecipients,
  forgetStatusRecipient,
  clearStatusRecipients,
  resolveAndRemember
};
