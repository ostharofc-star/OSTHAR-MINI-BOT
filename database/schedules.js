const mongoose = require("mongoose");

// ======================================================
// SCHEDULE SCHEMA
// ======================================================

const scheduleSchema =
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

      message: {
        type: String,
        required: true
      },

      sendAt: {
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
      collection: "scheduled_messages"
    }
  );

// ======================================================
// MODEL
// ======================================================

const Schedule =
  mongoose.models.Schedule ||
  mongoose.model(
    "Schedule",
    scheduleSchema
  );

// ======================================================
// CREATE SCHEDULE
// ======================================================

async function createSchedule({
  phone,
  chatJid,
  createdBy,
  message,
  sendAt
}) {
  const cleanMessage =
    String(
      message || ""
    )
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

  if (!cleanMessage) {
    throw new Error(
      "Scheduled message is required."
    );
  }

  const date =
    sendAt instanceof Date
      ? sendAt
      : new Date(
          sendAt
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "Invalid schedule time."
    );
  }

  if (
    date.getTime() <=
    Date.now()
  ) {
    throw new Error(
      "Schedule time must be in the future."
    );
  }

  return Schedule.create({
    phone,

    chatJid,

    createdBy,

    message:
      cleanMessage,

    sendAt:
      date,

    completed:
      false
  });
}

// ======================================================
// GET USER SCHEDULES
// ======================================================

async function getUserSchedules({
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

  return Schedule
    .find({
      phone,

      createdBy,

      completed:
        false
    })
    .sort({
      sendAt: 1
    })
    .limit(
      safeLimit
    );
}

// ======================================================
// GET CHAT SCHEDULES
// ======================================================

async function getChatSchedules({
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

  return Schedule
    .find({
      phone,

      chatJid,

      completed:
        false
    })
    .sort({
      sendAt: 1
    })
    .limit(
      safeLimit
    );
}

// ======================================================
// GET DUE SCHEDULES
// ======================================================

async function getDueSchedules({
  phone,
  limit = 100
} = {}) {
  const query = {
    completed:
      false,

    sendAt: {
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
        Number(limit) || 100
      )
    );

  return Schedule
    .find(
      query
    )
    .sort({
      sendAt: 1
    })
    .limit(
      safeLimit
    );
}

// ======================================================
// COMPLETE SCHEDULE
// ======================================================

async function completeSchedule(
  scheduleId
) {
  if (!scheduleId) {
    return null;
  }

  return Schedule.findByIdAndUpdate(
    scheduleId,
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
// DELETE SCHEDULE BY ID
// ======================================================

async function deleteSchedule({
  phone,
  createdBy,
  scheduleId
}) {
  if (
    !phone ||
    !createdBy ||
    !scheduleId
  ) {
    return {
      deletedCount: 0
    };
  }

  return Schedule.deleteOne({
    _id:
      scheduleId,

    phone,

    createdBy
  });
}

// ======================================================
// DELETE SCHEDULE BY LIST NUMBER
// ======================================================

async function deleteScheduleByIndex({
  phone,
  createdBy,
  index
}) {
  const list =
    await getUserSchedules({
      phone,

      createdBy,

      limit:
        100
    });

  const position =
    Number(
      index
    ) - 1;

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

  const schedule =
    list[position];

  await Schedule.deleteOne({
    _id:
      schedule._id
  });

  return schedule;
}

// ======================================================
// CLEAR USER SCHEDULES
// ======================================================

async function clearUserSchedules({
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

  return Schedule.deleteMany({
    phone,

    createdBy,

    completed:
      false
  });
}

// ======================================================
// COUNT USER SCHEDULES
// ======================================================

async function countUserSchedules({
  phone,
  createdBy
}) {
  if (
    !phone ||
    !createdBy
  ) {
    return 0;
  }

  return Schedule.countDocuments({
    phone,

    createdBy,

    completed:
      false
  });
}

// ======================================================
// CLEAN OLD COMPLETED SCHEDULES
// ======================================================

async function cleanCompletedSchedules(
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

  return Schedule.deleteMany({
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
  Schedule,

  createSchedule,

  getUserSchedules,

  getChatSchedules,

  getDueSchedules,

  completeSchedule,

  deleteSchedule,

  deleteScheduleByIndex,

  clearUserSchedules,

  countUserSchedules,

  cleanCompletedSchedules
};