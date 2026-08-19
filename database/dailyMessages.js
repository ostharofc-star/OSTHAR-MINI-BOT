const mongoose = require("mongoose");

// ======================================================
// DAILY MESSAGE SCHEMA
// ======================================================

const dailyMessageSchema =
  new mongoose.Schema(
    {
      phone: {
        type: String,
        required: true,
        index: true
      },

      chatJid: {
        type: String,
        required: true,
        index: true
      },

      createdBy: {
        type: String,
        required: true,
        index: true
      },

      time: {
        type: String,
        required: true
      },

      message: {
        type: String,
        required: true
      },

      enabled: {
        type: Boolean,
        default: true,
        index: true
      },

      lastSentDate: {
        type: String,
        default: null
      },

      createdAt: {
        type: Date,
        default: Date.now
      },

      updatedAt: {
        type: Date,
        default: Date.now
      }
    },
    {
      collection: "daily_messages"
    }
  );

// ======================================================
// MODEL
// ======================================================

const DailyMessage =
  mongoose.models.DailyMessage ||
  mongoose.model(
    "DailyMessage",
    dailyMessageSchema
  );

// ======================================================
// VALIDATE TIME
// ======================================================

function isValidTime(value) {
  const text =
    String(value || "")
      .trim();

  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(
    text
  );
}

// ======================================================
// CREATE DAILY MESSAGE
// ======================================================

async function createDailyMessage({
  phone,
  chatJid,
  createdBy,
  time,
  message
}) {
  const cleanTime =
    String(time || "")
      .trim();

  const cleanMessage =
    String(message || "")
      .trim()
      .slice(
        0,
        4000
      );

  if (
    !phone ||
    !chatJid ||
    !createdBy
  ) {
    throw new Error(
      "Phone, chat JID and creator JID are required."
    );
  }

  if (
    !isValidTime(
      cleanTime
    )
  ) {
    throw new Error(
      "Invalid time format. Use HH:MM."
    );
  }

  if (!cleanMessage) {
    throw new Error(
      "Daily message is required."
    );
  }

  return DailyMessage.create({
    phone,

    chatJid,

    createdBy,

    time:
      cleanTime,

    message:
      cleanMessage,

    enabled:
      true,

    lastSentDate:
      null
  });
}

// ======================================================
// GET USER DAILY MESSAGES
// ======================================================

async function getUserDailyMessages({
  phone,
  createdBy,
  limit = 20
}) {
  if (
    !phone ||
    !createdBy
  ) {
    return [];
  }

  const safeLimit =
    Math.max(
      1,
      Math.min(
        100,
        Number(limit) || 20
      )
    );

  return DailyMessage
    .find({
      phone,

      createdBy
    })
    .sort({
      time: 1,
      createdAt: 1
    })
    .limit(
      safeLimit
    );
}

// ======================================================
// GET ENABLED DAILY MESSAGES
// ======================================================

async function getEnabledDailyMessages({
  phone,
  limit = 200
} = {}) {
  const query = {
    enabled:
      true
  };

  if (phone) {
    query.phone =
      phone;
  }

  const safeLimit =
    Math.max(
      1,
      Math.min(
        500,
        Number(limit) || 200
      )
    );

  return DailyMessage
    .find(
      query
    )
    .sort({
      time: 1
    })
    .limit(
      safeLimit
    );
}

// ======================================================
// MARK DAILY MESSAGE AS SENT
// ======================================================

async function markDailyMessageSent({
  id,
  dateString
}) {
  if (
    !id ||
    !dateString
  ) {
    return null;
  }

  return DailyMessage.findByIdAndUpdate(
    id,
    {
      $set: {
        lastSentDate:
          String(
            dateString
          ),

        updatedAt:
          new Date()
      }
    },
    {
      new:
        true
    }
  );
}

// ======================================================
// DELETE DAILY MESSAGE BY INDEX
// ======================================================

async function deleteDailyMessageByIndex({
  phone,
  createdBy,
  index
}) {
  const list =
    await getUserDailyMessages({
      phone,

      createdBy,

      limit:
        100
    });

  const position =
    Number(index) - 1;

  if (
    !Number.isInteger(
      position
    ) ||
    position < 0 ||
    position >=
      list.length
  ) {
    return null;
  }

  const item =
    list[position];

  await DailyMessage.deleteOne({
    _id:
      item._id
  });

  return item;
}

// ======================================================
// CLEAR USER DAILY MESSAGES
// ======================================================

async function clearUserDailyMessages({
  phone,
  createdBy
}) {
  if (
    !phone ||
    !createdBy
  ) {
    return {
      deletedCount: 0
    };
  }

  return DailyMessage.deleteMany({
    phone,

    createdBy
  });
}

// ======================================================
// TOGGLE DAILY MESSAGE
// ======================================================

async function setDailyMessageEnabled({
  phone,
  createdBy,
  index,
  enabled
}) {
  const list =
    await getUserDailyMessages({
      phone,

      createdBy,

      limit:
        100
    });

  const position =
    Number(index) - 1;

  if (
    !Number.isInteger(
      position
    ) ||
    position < 0 ||
    position >=
      list.length
  ) {
    return null;
  }

  const item =
    list[position];

  return DailyMessage.findByIdAndUpdate(
    item._id,
    {
      $set: {
        enabled:
          Boolean(
            enabled
          ),

        updatedAt:
          new Date()
      }
    },
    {
      new:
        true
    }
  );
}

// ======================================================
// COUNT USER DAILY MESSAGES
// ======================================================

async function countUserDailyMessages({
  phone,
  createdBy
}) {
  if (
    !phone ||
    !createdBy
  ) {
    return 0;
  }

  return DailyMessage.countDocuments({
    phone,

    createdBy
  });
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  DailyMessage,

  isValidTime,

  createDailyMessage,

  getUserDailyMessages,

  getEnabledDailyMessages,

  markDailyMessageSent,

  deleteDailyMessageByIndex,

  clearUserDailyMessages,

  setDailyMessageEnabled,

  countUserDailyMessages
};