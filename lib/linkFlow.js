// ======================================================
// OSTHAR MINI BOT - LINK FLOW STATE
// ======================================================

const pendingLinks = new Map();

// Pending request valid time
const LINK_REQUEST_TTL =
  5 * 60 * 1000;

// ======================================================
// CLEAN JID
// ======================================================

function normalizeJid(jid = "") {
  return String(jid || "")
    .trim()
    .toLowerCase();
}

// ======================================================
// CLEAN PHONE NUMBER
// ======================================================

function normalizePhone(phone = "") {
  return String(phone || "")
    .replace(/[^0-9]/g, "")
    .trim();
}

// ======================================================
// CREATE PENDING LINK REQUEST
// ======================================================

function createPendingLink({
  requesterJid,
  phone
}) {
  const cleanJid =
    normalizeJid(requesterJid);

  const cleanPhone =
    normalizePhone(phone);

  if (!cleanJid) {
    throw new Error(
      "Invalid requester."
    );
  }

  if (!cleanPhone) {
    throw new Error(
      "Invalid phone number."
    );
  }

  const data = {
    requesterJid:
      cleanJid,

    phone:
      cleanPhone,

    createdAt:
      Date.now(),

    expiresAt:
      Date.now() +
      LINK_REQUEST_TTL
  };

  pendingLinks.set(
    cleanJid,
    data
  );

  return data;
}

// ======================================================
// GET PENDING REQUEST
// ======================================================

function getPendingLink(
  requesterJid
) {
  const cleanJid =
    normalizeJid(
      requesterJid
    );

  if (!cleanJid) {
    return null;
  }

  const data =
    pendingLinks.get(
      cleanJid
    );

  if (!data) {
    return null;
  }

  if (
    data.expiresAt <
    Date.now()
  ) {
    pendingLinks.delete(
      cleanJid
    );

    return null;
  }

  return data;
}

// ======================================================
// REMOVE PENDING REQUEST
// ======================================================

function removePendingLink(
  requesterJid
) {
  const cleanJid =
    normalizeJid(
      requesterJid
    );

  if (!cleanJid) {
    return false;
  }

  return pendingLinks.delete(
    cleanJid
  );
}

// ======================================================
// CHECK IF USER HAS PENDING REQUEST
// ======================================================

function hasPendingLink(
  requesterJid
) {
  return Boolean(
    getPendingLink(
      requesterJid
    )
  );
}

// ======================================================
// HANDLE USER NUMBER REPLY
// ======================================================

function parseLinkChoice(
  text = ""
) {
  const choice =
    String(text || "")
      .trim();

  if (choice === "1") {
    return "qr";
  }

  if (choice === "2") {
    return "code";
  }

  return null;
}

// ======================================================
// CLEANUP EXPIRED REQUESTS
// ======================================================

function cleanupExpiredLinks() {
  const now =
    Date.now();

  for (
    const [jid, data]
    of pendingLinks.entries()
  ) {
    if (
      !data ||
      data.expiresAt <
      now
    ) {
      pendingLinks.delete(
        jid
      );
    }
  }
}

// Cleanup every minute
setInterval(
  cleanupExpiredLinks,
  60 * 1000
).unref?.();

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  createPendingLink,
  getPendingLink,
  removePendingLink,
  hasPendingLink,
  parseLinkChoice,
  cleanupExpiredLinks
};