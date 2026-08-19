const mongoose = require("mongoose");

// ======================================================
// REMINDER SCHEMA
// ======================================================

const reminderSchema =
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

      userJid: {
        type: String,
        required: true,
        index: true
      },

      message: {
        type: String,
        required: true
      },

      remindAt: {
        type: Date,
        required: true,
        index: true
      },

      completed: {
        type: Boolean,
        default: false,
        index: true
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
      collection: "reminders"
    }
  );

// ======================================================
// MODEL
// ======================================================

const Reminder =
  mongoose.models.Reminder ||
  mongoose.model(
    "Reminder",
    reminderSchema
  );

// ======================================================
// CREATE REMINDER
// ======================================================

async function createReminder({
  phone,
  chatJid,
  userJid,
  message,
  remindAt
}) {
  const cleanMessage =
    String(
      message || ""
    )
      .trim()
      .slice(
        0,
        2000
      );

  if (
    !phone ||
    !chatJid ||
    !userJid
  ) {
    throw new Error(
      "Phone, chat JID and user JID are required."
    );
  }

  if (!cleanMessage) {
    throw new Error(
      "Reminder message is required."
    );
  }

  const date =
    remindAt instanceof Date
      ? remindAt
      : new Date(remindAt);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "Invalid reminder time."
    );
  }

  if (
    date.getTime() <=
    Date.now()
  ) {
    throw new Error(
      "Reminder time must be in the future."
    );
  }

  return Reminder.create({
    phone,

    chatJid,

    userJid,

    message:
      cleanMessage,

    remindAt:
      date,

    completed:
      false
  });
}

// ======================================================
// GET USER REMINDERS
// ======================================================

async function getUserReminders({
  phone,
  userJid,
  limit = 20
}) {
  if (
    !phone ||
    !userJid
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

  return Reminder
    .find({
      phone,

      userJid,

      completed:
        false
    })
    .sort({
      remindAt: 1
    })
    .limit(
      safeLimit
    );
}

// ======================================================
// GET CHAT REMINDERS
// ======================================================

async function getChatReminders({
  phone,
  chatJid,
  limit = 50
}) {
  if (
    !phone ||
    !chatJid
  ) {
    return [];
  }

  const safeLimit =
    Math.max(
      1,
      Math.min(
        100,
        Number(limit) || 50
      )
    );

  return Reminder
    .find({
      phone,

      chatJid,

      completed:
        false
    })
    .sort({
      remindAt: 1
    })
    .limit(
      safeLimit
    );
}

// ======================================================
// GET DUE REMINDERS
// ======================================================

async function getDueReminders({
  phone,
  limit = 50
} = {}) {
  const query = {
    completed:
      false,

    remindAt: {
      $lte:
        new Date()
    }
  };

  if (phone) {
    query.phone =
      phone;
  }

  const safeLimit =
    Math.max(
      1,
      Math.min(
        200,
        Number(limit) || 50
      )
    );

  return Reminder
    .find(query)
    .sort({
      remindAt: 1
    })
    .limit(
      safeLimit
    );
}

// ======================================================
// COMPLETE REMINDER
// ======================================================

async function completeReminder(
  reminderId
) {
  if (!reminderId) {
    return null;
  }

  return Reminder.findByIdAndUpdate(
    reminderId,
    {
      $set: {
        completed:
          true,

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
// DELETE REMINDER
// ======================================================

async function deleteReminder({
  phone,
  userJid,
  reminderId
}) {
  if (
    !phone ||
    !userJid ||
    !reminderId
  ) {
    return {
      deletedCount: 0
    };
  }

  return Reminder.deleteOne({
    _id:
      reminderId,

    phone,

    userJid
  });
}

// ======================================================
// DELETE USER REMINDER BY LIST NUMBER
// ======================================================

async function deleteReminderByIndex({
  phone,
  userJid,
  index
}) {
  const list =
    await getUserReminders({
      phone,
      userJid,
      limit: 100
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

  const reminder =
    list[position];

  await Reminder.deleteOne({
    _id:
      reminder._id
  });

  return reminder;
}

// ======================================================
// CLEAR USER REMINDERS
// ======================================================

async function clearUserReminders({
  phone,
  userJid
}) {
  if (
    !phone ||
    !userJid
  ) {
    return {
      deletedCount: 0
    };
  }

  return Reminder.deleteMany({
    phone,

    userJid,

    completed:
      false
  });
}

// ======================================================
// COUNT USER REMINDERS
// ======================================================

async function countUserReminders({
  phone,
  userJid
}) {
  if (
    !phone ||
    !userJid
  ) {
    return 0;
  }

  return Reminder.countDocuments({
    phone,

    userJid,

    completed:
      false
  });
}

// ======================================================
// CLEAN COMPLETED REMINDERS
// ======================================================

async function cleanCompletedReminders(
  olderThanDays = 7
) {
  const days =
    Math.max(
      1,
      Number(
        olderThanDays
      ) || 7
    );

  const before =
    new Date(
      Date.now() -
      days *
        24 *
        60 *
        60 *
        1000
    );

  return Reminder.deleteMany({
    completed:
      true,

    updatedAt: {
      $lt:
        before
    }
  });
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  Reminder,

  createReminder,

  getUserReminders,

  getChatReminders,

  getDueReminders,

  completeReminder,

  deleteReminder,

  deleteReminderByIndex,

  clearUserReminders,

  countUserReminders,

  cleanCompletedReminders
};