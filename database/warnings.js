const mongoose = require("mongoose");

// ======================================================
// WARNING SCHEMA
// ======================================================

const warningSchema =
  new mongoose.Schema(
    {
      phone: {
        type: String,
        required: true,
        index: true
      },

      groupJid: {
        type: String,
        required: true,
        index: true
      },

      userJid: {
        type: String,
        required: true,
        index: true
      },

      warnings: {
        type: Number,
        default: 0
      },

      reasons: {
        type: [
          {
            reason: {
              type: String,
              default: "No reason provided."
            },

            warnedBy: {
              type: String,
              default: ""
            },

            createdAt: {
              type: Date,
              default: Date.now
            }
          }
        ],

        default: []
      },

      updatedAt: {
        type: Date,
        default: Date.now
      }
    },
    {
      collection: "group_warnings"
    }
  );

// One warning record per user per group per bot account
warningSchema.index(
  {
    phone: 1,
    groupJid: 1,
    userJid: 1
  },
  {
    unique: true
  }
);

// ======================================================
// MODEL
// ======================================================

const Warning =
  mongoose.models.Warning ||
  mongoose.model(
    "Warning",
    warningSchema
  );

// ======================================================
// NORMALIZE JID
// ======================================================

function normalizeJid(
  jid
) {
  return String(
    jid || ""
  )
    .trim()
    .toLowerCase();
}

// ======================================================
// ADD WARNING
// ======================================================

async function addWarning({
  phone,
  groupJid,
  userJid,
  reason = "",
  warnedBy = ""
}) {
  const cleanGroup =
    normalizeJid(
      groupJid
    );

  const cleanUser =
    normalizeJid(
      userJid
    );

  const cleanWarnedBy =
    normalizeJid(
      warnedBy
    );

  const cleanReason =
    String(
      reason || ""
    )
      .trim()
      .slice(
        0,
        500
      ) ||
    "No reason provided.";

  if (!phone) {
    throw new Error(
      "Phone number is required."
    );
  }

  if (!cleanGroup) {
    throw new Error(
      "Group JID is required."
    );
  }

  if (!cleanUser) {
    throw new Error(
      "User JID is required."
    );
  }

  const item =
    await Warning.findOneAndUpdate(
      {
        phone,
        groupJid:
          cleanGroup,
        userJid:
          cleanUser
      },
      {
        $inc: {
          warnings: 1
        },

        $push: {
          reasons: {
            reason:
              cleanReason,

            warnedBy:
              cleanWarnedBy,

            createdAt:
              new Date()
          }
        },

        $set: {
          updatedAt:
            new Date()
        },

        $setOnInsert: {
          phone,
          groupJid:
            cleanGroup,
          userJid:
            cleanUser
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert:
          true
      }
    );

  return item;
}

// ======================================================
// GET WARNINGS
// ======================================================

async function getWarnings({
  phone,
  groupJid,
  userJid
}) {
  const cleanGroup =
    normalizeJid(
      groupJid
    );

  const cleanUser =
    normalizeJid(
      userJid
    );

  if (
    !phone ||
    !cleanGroup ||
    !cleanUser
  ) {
    return null;
  }

  return Warning.findOne({
    phone,
    groupJid:
      cleanGroup,
    userJid:
      cleanUser
  });
}

// ======================================================
// RESET WARNINGS
// ======================================================

async function resetWarnings({
  phone,
  groupJid,
  userJid
}) {
  const cleanGroup =
    normalizeJid(
      groupJid
    );

  const cleanUser =
    normalizeJid(
      userJid
    );

  if (
    !phone ||
    !cleanGroup ||
    !cleanUser
  ) {
    return null;
  }

  return Warning.findOneAndUpdate(
    {
      phone,
      groupJid:
        cleanGroup,
      userJid:
        cleanUser
    },
    {
      $set: {
        warnings: 0,
        reasons: [],
        updatedAt:
          new Date()
      }
    },
    {
      new: true
    }
  );
}

// ======================================================
// REMOVE ONE WARNING
// ======================================================

async function removeOneWarning({
  phone,
  groupJid,
  userJid
}) {
  const current =
    await getWarnings({
      phone,
      groupJid,
      userJid
    });

  if (
    !current ||
    current.warnings <= 0
  ) {
    return current;
  }

  const reasons =
    Array.isArray(
      current.reasons
    )
      ? current.reasons
      : [];

  reasons.pop();

  current.warnings =
    Math.max(
      0,
      current.warnings - 1
    );

  current.reasons =
    reasons;

  current.updatedAt =
    new Date();

  await current.save();

  return current;
}

// ======================================================
// DELETE WARNING RECORD
// ======================================================

async function deleteWarningRecord({
  phone,
  groupJid,
  userJid
}) {
  const cleanGroup =
    normalizeJid(
      groupJid
    );

  const cleanUser =
    normalizeJid(
      userJid
    );

  if (
    !phone ||
    !cleanGroup ||
    !cleanUser
  ) {
    return {
      deletedCount: 0
    };
  }

  return Warning.deleteOne({
    phone,
    groupJid:
      cleanGroup,
    userJid:
      cleanUser
  });
}

// ======================================================
// GET GROUP WARNING LIST
// ======================================================

async function getGroupWarnings({
  phone,
  groupJid
}) {
  const cleanGroup =
    normalizeJid(
      groupJid
    );

  if (
    !phone ||
    !cleanGroup
  ) {
    return [];
  }

  return Warning
    .find({
      phone,
      groupJid:
        cleanGroup,
      warnings: {
        $gt: 0
      }
    })
    .sort({
      warnings: -1,
      updatedAt: -1
    });
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  Warning,

  normalizeJid,

  addWarning,

  getWarnings,

  resetWarnings,

  removeOneWarning,

  deleteWarningRecord,

  getGroupWarnings
};