const {
  cleanPhoneNumber
} = require("./helpers");

function numberToJid(number = "") {
  const clean =
    cleanPhoneNumber(number);

  if (!clean) {
    return null;
  }

  return `${clean}@s.whatsapp.net`;
}

function getDestinationJid({
  mode,
  ownerPhone,
  currentJid,
  customNumber
}) {
  const selectedMode =
    String(mode || "owner")
      .toLowerCase();

  // =====================================
  // SAME CHAT
  // =====================================
  if (selectedMode === "same") {
    return currentJid || null;
  }

  // =====================================
  // CUSTOM NUMBER
  // =====================================
  if (selectedMode === "custom") {
    const customJid =
      numberToJid(
        customNumber
      );

    if (customJid) {
      return customJid;
    }

    // Custom number නැත්නම් owner fallback
    return numberToJid(
      ownerPhone
    );
  }

  // =====================================
  // OWNER INBOX - DEFAULT
  // =====================================
  return numberToJid(
    ownerPhone
  );
}

function getAntiDeleteDestination({
  settings,
  ownerPhone,
  currentJid
}) {
  return getDestinationJid({
    mode:
      settings?.antiDeleteDestination ||
      "owner",

    ownerPhone,

    currentJid,

    customNumber:
      settings?.customDestinationNumber
  });
}

function getViewOnceDestination({
  settings,
  ownerPhone,
  currentJid
}) {
  return getDestinationJid({
    mode:
      settings?.viewOnceDestination ||
      "owner",

    ownerPhone,

    currentJid,

    customNumber:
      settings?.customDestinationNumber
  });
}

module.exports = {
  numberToJid,
  getDestinationJid,
  getAntiDeleteDestination,
  getViewOnceDestination
};