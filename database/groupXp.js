const mongoose = require("mongoose");

// ======================================================
// GROUP XP SCHEMA
// ======================================================

const groupXpSchema =
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

      xp: {
        type: Number,
        default: 0
      },

      level: {
        type: Number,
        default: 1
      },

      messages: {
        type: Number,
        default: 0
      },

      lastXpAt: {
        type: Date,
        default: null
      },

      updatedAt: {
        type: Date,
        default: Date.now
      }
    },
    {
      collection: "group_xp"
    }
  );

// One XP record per user per group per linked bot
groupXpSchema.index(
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

const GroupXP =
  mongoose.models.GroupXP ||
  mongoose.model(
    "GroupXP",
    groupXpSchema
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
// XP FORMULA
// ======================================================

function calculateLevel(
  xp
) {
  const safeXp =
    Math.max(
      0,
      Number(xp) || 0
    );

  return (
    Math.floor(
      Math.sqrt(
        safeXp / 100
      )
    ) + 1
  );
}

function xpForLevel(
  level
) {
  const safeLevel =
    Math.max(
      1,
      Number(level) || 1
    );

  return (
    Math.pow(
      safeLevel - 1,
      2
    ) * 100
  );
}

function xpForNextLevel(
  level
) {
  const safeLevel =
    Math.max(
      1,
      Number(level) || 1
    );

  return (
    Math.pow(
      safeLevel,
      2
    ) * 100
  );
}

// ======================================================
// ADD XP
// ======================================================

async function addXP({
  phone,
  groupJid,
  userJid,
  amount = 10
}) {
  const cleanGroup =
    normalizeJid(
      groupJid
    );

  const cleanUser =
    normalizeJid(
      userJid
    );

  const xpAmount =
    Math.max(
      1,
      Math.min(
        100,
        Number(amount) || 10
      )
    );

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

  const record =
    await GroupXP.findOneAndUpdate(
      {
        phone,
        groupJid:
          cleanGroup,
        userJid:
          cleanUser
      },
      {
        $inc: {
          xp:
            xpAmount,

          messages:
            1
        },

        $set: {
          lastXpAt:
            new Date(),

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

  const newLevel =
    calculateLevel(
      record.xp
    );

  const leveledUp =
    newLevel >
    Number(
      record.level || 1
    );

  if (
    newLevel !==
    record.level
  ) {
    record.level =
      newLevel;

    record.updatedAt =
      new Date();

    await record.save();
  }

  return {
    record,
    leveledUp,
    level:
      newLevel
  };
}

// ======================================================
// GET USER XP
// ======================================================

async function getUserXP({
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

  return GroupXP.findOne({
    phone,

    groupJid:
      cleanGroup,

    userJid:
      cleanUser
  });
}

// ======================================================
// GET OR CREATE USER XP
// ======================================================

async function getOrCreateUserXP({
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
    throw new Error(
      "Phone, group JID and user JID are required."
    );
  }

  let record =
    await GroupXP.findOne({
      phone,

      groupJid:
        cleanGroup,

      userJid:
        cleanUser
    });

  if (!record) {
    record =
      await GroupXP.create({
        phone,

        groupJid:
          cleanGroup,

        userJid:
          cleanUser,

        xp: 0,

        level: 1,

        messages: 0
      });
  }

  return record;
}

// ======================================================
// LEADERBOARD
// ======================================================

async function getLeaderboard({
  phone,
  groupJid,
  limit = 10
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

  const safeLimit =
    Math.max(
      1,
      Math.min(
        50,
        Number(limit) || 10
      )
    );

  return GroupXP
    .find({
      phone,

      groupJid:
        cleanGroup
    })
    .sort({
      xp: -1,
      messages: -1
    })
    .limit(
      safeLimit
    );
}

// ======================================================
// GET USER RANK
// ======================================================

async function getUserRank({
  phone,
  groupJid,
  userJid
}) {
  const user =
    await getUserXP({
      phone,
      groupJid,
      userJid
    });

  if (!user) {
    return null;
  }

  const higher =
    await GroupXP.countDocuments({
      phone,

      groupJid:
        normalizeJid(
          groupJid
        ),

      xp: {
        $gt:
          user.xp
      }
    });

  return {
    rank:
      higher + 1,

    record:
      user
  };
}

// ======================================================
// RESET USER XP
// ======================================================

async function resetUserXP({
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

  return GroupXP.findOneAndUpdate(
    {
      phone,

      groupJid:
        cleanGroup,

      userJid:
        cleanUser
    },
    {
      $set: {
        xp: 0,

        level: 1,

        messages: 0,

        lastXpAt: null,

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
// RESET WHOLE GROUP
// ======================================================

async function resetGroupXP({
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
    return {
      deletedCount: 0
    };
  }

  return GroupXP.deleteMany({
    phone,

    groupJid:
      cleanGroup
  });
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  GroupXP,

  normalizeJid,

  calculateLevel,

  xpForLevel,

  xpForNextLevel,

  addXP,

  getUserXP,

  getOrCreateUserXP,

  getLeaderboard,

  getUserRank,

  resetUserXP,

  resetGroupXP
};