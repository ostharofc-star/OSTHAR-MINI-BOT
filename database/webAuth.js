const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// ======================================================
// SCHEMA
// ======================================================

const WebAuthSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    pinHash: {
      type: String,
      default: ""
    },

    pinCreatedAt: {
      type: Date,
      default: null
    },

    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// ======================================================
// MODEL
// ======================================================

const WebAuth =
  mongoose.models.WebAuth ||
  mongoose.model(
    "WebAuth",
    WebAuthSchema
  );

// ======================================================
// NORMALIZE PHONE
// ======================================================

function normalizePhone(phone = "") {
  return String(phone)
    .replace(/[^0-9]/g, "")
    .trim();
}

// ======================================================
// GENERATE 5 DIGIT PIN
// ======================================================

function generatePin() {
  return String(
    crypto.randomInt(
      10000,
      100000
    )
  );
}

// ======================================================
// CREATE / REPLACE PERMANENT PIN
// ======================================================

async function createWebPin(phone) {
  const cleanPhone =
    normalizePhone(phone);

  if (!cleanPhone) {
    throw new Error(
      "Invalid phone number."
    );
  }

  // Generate new permanent PIN
  const pin =
    generatePin();

  // Store only hashed PIN
  const pinHash =
    await bcrypt.hash(
      pin,
      12
    );

  const now =
    new Date();

  await WebAuth.findOneAndUpdate(
    {
      phone:
        cleanPhone
    },
    {
      $set: {
        pinHash,
        pinCreatedAt:
          now
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  return {
    success: true,

    phone:
      cleanPhone,

    pin,

    createdAt:
      now
  };
}

// ======================================================
// VERIFY PERMANENT PIN
// ======================================================

async function verifyWebPin(
  phone,
  pin
) {
  const cleanPhone =
    normalizePhone(phone);

  const cleanPin =
    String(pin || "")
      .trim();

  // ===============================================
  // VALIDATE INPUT
  // ===============================================

  if (
    !cleanPhone ||
    !/^\d{5}$/.test(
      cleanPin
    )
  ) {
    return {
      success: false,
      reason:
        "INVALID_INPUT"
    };
  }

  // ===============================================
  // FIND USER
  // ===============================================

  const record =
    await WebAuth.findOne({
      phone:
        cleanPhone
    });

  if (!record) {
    return {
      success: false,
      reason:
        "NOT_FOUND"
    };
  }

  // ===============================================
  // CHECK PIN EXISTS
  // ===============================================

  if (!record.pinHash) {
    return {
      success: false,
      reason:
        "NO_PIN"
    };
  }

  // ===============================================
  // VERIFY HASH
  // ===============================================

  const valid =
    await bcrypt.compare(
      cleanPin,
      record.pinHash
    );

  if (!valid) {
    return {
      success: false,
      reason:
        "WRONG_PIN"
    };
  }

  // ===============================================
  // LOGIN SUCCESS
  // ===============================================

  record.lastLoginAt =
    new Date();

  await record.save();

  return {
    success: true,

    phone:
      cleanPhone
  };
}

// ======================================================
// GET AUTH INFO
// ======================================================

async function getWebAuth(phone) {
  const cleanPhone =
    normalizePhone(phone);

  if (!cleanPhone) {
    return null;
  }

  return WebAuth.findOne({
    phone:
      cleanPhone
  });
}

// ======================================================
// CHECK IF PIN EXISTS
// ======================================================

async function hasWebPin(phone) {
  const cleanPhone =
    normalizePhone(phone);

  if (!cleanPhone) {
    return false;
  }

  const record =
    await WebAuth.findOne({
      phone:
        cleanPhone
    });

  return Boolean(
    record?.pinHash
  );
}

// ======================================================
// REMOVE PIN
// ======================================================

async function removeWebPin(phone) {
  const cleanPhone =
    normalizePhone(phone);

  if (!cleanPhone) {
    return false;
  }

  await WebAuth.updateOne(
    {
      phone:
        cleanPhone
    },
    {
      $set: {
        pinHash: "",
        pinCreatedAt:
          null,
        lastLoginAt:
          null
      }
    }
  );

  return true;
}

// ======================================================
// DELETE WEB AUTH COMPLETELY
// ======================================================

async function deleteWebAuth(phone) {
  const cleanPhone =
    normalizePhone(phone);

  if (!cleanPhone) {
    return false;
  }

  await WebAuth.deleteOne({
    phone:
      cleanPhone
  });

  return true;
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  WebAuth,

  normalizePhone,

  generatePin,

  createWebPin,

  verifyWebPin,

  getWebAuth,

  hasWebPin,

  removeWebPin,

  deleteWebAuth
};