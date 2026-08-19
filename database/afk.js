const mongoose = require("mongoose");

// ======================================================
// AFK SCHEMA
// ======================================================

const afkSchema =
  new mongoose.Schema(
    {
      phone: {
        type: String,
        required: true,
        unique: true,
        index: true
      },

      enabled: {
        type: Boolean,
        default: false
      },

      reason: {
        type: String,
        default: "Away from keyboard."
      },

      since: {
        type: Date,
        default: null
      },

      updatedAt: {
        type: Date,
        default: Date.now
      }
    },
    {
      collection: "afk_status"
    }
  );

// ======================================================
// MODEL
// ======================================================

const AFK =
  mongoose.models.AFK ||
  mongoose.model(
    "AFK",
    afkSchema
  );

// ======================================================
// ENABLE AFK
// ======================================================

async function enableAFK(
  phone,
  reason = ""
) {
  const cleanReason =
    String(
      reason || ""
    )
      .trim()
      .slice(
        0,
        500
      );

  const now =
    new Date();

  return AFK.findOneAndUpdate(
    {
      phone
    },
    {
      $set: {
        enabled: true,

        reason:
          cleanReason ||
          "Away from keyboard.",

        since:
          now,

        updatedAt:
          now
      },

      $setOnInsert: {
        phone
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert:
        true
    }
  );
}

// ======================================================
// DISABLE AFK
// ======================================================

async function disableAFK(
  phone
) {
  return AFK.findOneAndUpdate(
    {
      phone
    },
    {
      $set: {
        enabled: false,

        updatedAt:
          new Date()
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert:
        true
    }
  );
}

// ======================================================
// GET AFK STATUS
// ======================================================

async function getAFK(
  phone
) {
  if (!phone) {
    return null;
  }

  return AFK.findOne({
    phone
  });
}

// ======================================================
// CHECK AFK
// ======================================================

async function isAFK(
  phone
) {
  const data =
    await getAFK(
      phone
    );

  return Boolean(
    data?.enabled
  );
}

// ======================================================
// DELETE AFK DATA
// ======================================================

async function deleteAFK(
  phone
) {
  return AFK.deleteOne({
    phone
  });
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  AFK,

  enableAFK,

  disableAFK,

  getAFK,

  isAFK,

  deleteAFK
};