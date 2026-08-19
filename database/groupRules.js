const mongoose = require("mongoose");

// ======================================================
// GROUP RULES SCHEMA
// ======================================================

const groupRulesSchema =
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

      rules: {
        type: String,
        default: ""
      },

      updatedAt: {
        type: Date,
        default: Date.now
      }
    },
    {
      collection: "group_rules"
    }
  );

groupRulesSchema.index(
  {
    phone: 1,
    groupJid: 1
  },
  {
    unique: true
  }
);

// ======================================================
// MODEL
// ======================================================

const GroupRules =
  mongoose.models.GroupRules ||
  mongoose.model(
    "GroupRules",
    groupRulesSchema
  );

// ======================================================
// SAVE RULES
// ======================================================

async function saveGroupRules(
  phone,
  groupJid,
  rules
) {
  const cleanRules =
    String(
      rules || ""
    )
      .trim()
      .slice(
        0,
        4000
      );

  if (!phone) {
    throw new Error(
      "Phone number is required."
    );
  }

  if (!groupJid) {
    throw new Error(
      "Group JID is required."
    );
  }

  if (!cleanRules) {
    throw new Error(
      "Rules are required."
    );
  }

  return GroupRules.findOneAndUpdate(
    {
      phone,
      groupJid
    },
    {
      $set: {
        rules:
          cleanRules,

        updatedAt:
          new Date()
      },

      $setOnInsert: {
        phone,
        groupJid
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
// GET RULES
// ======================================================

async function getGroupRules(
  phone,
  groupJid
) {
  if (
    !phone ||
    !groupJid
  ) {
    return null;
  }

  return GroupRules.findOne({
    phone,
    groupJid
  });
}

// ======================================================
// CLEAR RULES
// ======================================================

async function clearGroupRules(
  phone,
  groupJid
) {
  if (
    !phone ||
    !groupJid
  ) {
    return {
      deletedCount: 0
    };
  }

  return GroupRules.deleteOne({
    phone,
    groupJid
  });
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  GroupRules,

  saveGroupRules,

  getGroupRules,

  clearGroupRules
};