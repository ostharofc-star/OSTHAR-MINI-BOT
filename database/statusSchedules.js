const fs = require("fs");
const mongoose = require("mongoose");

const schema =
  new mongoose.Schema(
    {
      phone: {
        type: String,
        required: true,
        index: true
      },

      runAt: {
        type: Date,
        required: true,
        index: true
      },

      text: {
        type: String,
        default: ""
      },

      type: {
        type: String,
        enum: [
          "text",
          "image",
          "video"
        ],
        default: "text"
      },

      mediaPath: {
        type: String,
        default: ""
      },

      mimetype: {
        type: String,
        default: ""
      },

      sourceJid: {
        type: String,
        default: ""
      },

      status: {
        type: String,
        enum: [
          "pending",
          "completed",
          "failed"
        ],
        default: "pending",
        index: true
      },

      attempts: {
        type: Number,
        default: 0
      },

      lastError: {
        type: String,
        default: ""
      },

      completedAt: {
        type: Date,
        default: null
      },

      backgroundColor: {
        type: String,
        default: "#111827"
      },

      font: {
        type: Number,
        default: 2
      }
    },
    {
      timestamps: true,
      collection: "status_schedules",
      strict: false
    }
  );

schema.index({
  status: 1,
  runAt: 1
});

const StatusSchedule =
  mongoose.models.OstharStatusSchedule ||
  mongoose.model(
    "OstharStatusSchedule",
    schema
  );

function cleanPhone(
  phone = ""
) {
  return String(
    phone ||
    ""
  ).replace(
    /\D/g,
    ""
  );
}

function removeMedia(
  mediaPath
) {
  if (!mediaPath) {
    return;
  }

  try {
    if (
      fs.existsSync(
        mediaPath
      )
    ) {
      fs.rmSync(
        mediaPath,
        {
          force: true
        }
      );
    }
  } catch {}
}

async function createStatusSchedule(
  data = {}
) {
  const phone =
    cleanPhone(
      data.phone
    );

  if (!phone) {
    throw new Error(
      "Invalid scheduler phone."
    );
  }

  const runAt =
    new Date(
      data.runAt
    );

  if (
    Number.isNaN(
      runAt.getTime()
    )
  ) {
    throw new Error(
      "Invalid status schedule time."
    );
  }

  return StatusSchedule.create({
    phone,
    runAt,
    text:
      String(
        data.text ||
        ""
      ),
    type:
      String(
        data.type ||
        "text"
      ),
    mediaPath:
      String(
        data.mediaPath ||
        ""
      ),
    mimetype:
      String(
        data.mimetype ||
        ""
      ),
    sourceJid:
      String(
        data.sourceJid ||
        ""
      ),
    status:
      "pending",
    attempts:
      0,
    lastError:
      "",
    backgroundColor:
      String(
        data.backgroundColor ||
        "#111827"
      ),
    font:
      Number.isFinite(
        Number(data.font)
      )
        ? Number(data.font)
        : 2
  });
}

async function getDueStatusSchedules({
  limit = 100
} = {}) {
  return StatusSchedule.find({
    status:
      "pending",
    runAt: {
      $lte:
        new Date()
    },
    $or: [
      {
        attempts: {
          $lt: 3
        }
      },
      {
        attempts: {
          $exists: false
        }
      }
    ]
  })
    .sort({
      runAt: 1
    })
    .limit(
      Math.max(
        1,
        Math.min(
          Number(limit) || 100,
          500
        )
      )
    )
    .lean();
}

async function completeStatusSchedule(
  id
) {
  return StatusSchedule.findByIdAndUpdate(
    id,
    {
      $set: {
        status:
          "completed",
        completedAt:
          new Date(),
        lastError:
          ""
      }
    },
    {
      new: true
    }
  );
}

async function recordStatusScheduleFailure(
  id,
  errorMessage = "Unknown error"
) {
  if (!id) {
    return null;
  }

  const item =
    await StatusSchedule.findById(
      id
    );

  if (!item) {
    return null;
  }

  item.attempts =
    Number(
      item.attempts ||
      0
    ) + 1;

  item.lastError =
    String(
      errorMessage ||
      "Unknown error"
    ).slice(
      0,
      1000
    );

  if (
    item.attempts >= 3
  ) {
    item.status =
      "failed";

    item.completedAt =
      new Date();
  }

  await item.save();

  return item;
}

async function listStatusSchedules(
  phone,
  {
    limit = 50
  } = {}
) {
  return StatusSchedule.find({
    phone:
      cleanPhone(
        phone
      ),
    status: {
      $in: [
        "pending",
        "failed"
      ]
    }
  })
    .sort({
      runAt: 1,
      createdAt: 1
    })
    .limit(
      Math.max(
        1,
        Math.min(
          Number(limit) || 50,
          200
        )
      )
    )
    .lean();
}

async function deleteStatusScheduleByIndex(
  phone,
  index
) {
  const list =
    await listStatusSchedules(
      phone,
      {
        limit: 200
      }
    );

  const position =
    Number(index) - 1;

  if (
    !Number.isInteger(
      position
    ) ||
    position < 0 ||
    position >= list.length
  ) {
    return null;
  }

  const item =
    list[position];

  await StatusSchedule.deleteOne({
    _id:
      item._id
  });

  removeMedia(
    item.mediaPath
  );

  return item;
}

async function clearStatusSchedules(
  phone
) {
  const clean =
    cleanPhone(
      phone
    );

  const items =
    await StatusSchedule.find({
      phone:
        clean,
      status: {
        $in: [
          "pending",
          "failed"
        ]
      }
    }).lean();

  for (
    const item
    of items
  ) {
    removeMedia(
      item.mediaPath
    );
  }

  const result =
    await StatusSchedule.deleteMany({
      phone:
        clean,
      status: {
        $in: [
          "pending",
          "failed"
        ]
      }
    });

  return Number(
    result.deletedCount ||
    0
  );
}

async function cleanCompletedStatusSchedules(
  days = 7
) {
  const cutoff =
    new Date(
      Date.now() -
      Math.max(
        1,
        Number(days) || 7
      ) *
      24 *
      60 *
      60 *
      1000
    );

  const oldItems =
    await StatusSchedule.find({
      status: {
        $in: [
          "completed",
          "failed"
        ]
      },
      completedAt: {
        $lte:
          cutoff
      }
    }).lean();

  for (
    const item
    of oldItems
  ) {
    removeMedia(
      item.mediaPath
    );
  }

  return StatusSchedule.deleteMany({
    status: {
      $in: [
        "completed",
        "failed"
      ]
    },
    completedAt: {
      $lte:
        cutoff
    }
  });
}

// Compatibility names for older scheduler command files.
async function addStatusSchedule(
  data
) {
  return createStatusSchedule(
    data
  );
}

async function getStatusSchedules(
  phone,
  options
) {
  return listStatusSchedules(
    phone,
    options
  );
}

async function deleteStatusSchedule(
  phone,
  index
) {
  return deleteStatusScheduleByIndex(
    phone,
    index
  );
}

module.exports = {
  StatusSchedule,
  createStatusSchedule,
  addStatusSchedule,
  getDueStatusSchedules,
  completeStatusSchedule,
  recordStatusScheduleFailure,
  listStatusSchedules,
  getStatusSchedules,
  deleteStatusScheduleByIndex,
  deleteStatusSchedule,
  clearStatusSchedules,
  cleanCompletedStatusSchedules
};
