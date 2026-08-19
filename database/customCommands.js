const mongoose = require("mongoose");

// ======================================================
// CUSTOM COMMAND SCHEMA
// ======================================================

const customCommandSchema =
  new mongoose.Schema(
    {
      phone: {
        type: String,
        required: true,
        index: true
      },

      command: {
        type: String,
        required: true
      },

      response: {
        type: String,
        required: true
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
      collection:
        "custom_commands"
    }
  );

// One custom command name per bot/account
customCommandSchema.index(
  {
    phone: 1,
    command: 1
  },
  {
    unique: true
  }
);

// ======================================================
// UPDATE DATE
// ======================================================

customCommandSchema.pre(
  "save",
  function () {
    this.updatedAt =
      new Date();
  }
);

// ======================================================
// MODEL
// ======================================================

const CustomCommand =
  mongoose.models.CustomCommand ||
  mongoose.model(
    "CustomCommand",
    customCommandSchema
  );

// ======================================================
// NORMALIZE COMMAND
// ======================================================

function normalizeCommand(
  command
) {
  return String(
    command || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /^[.!/#]+/,
      ""
    )
    .replace(
      /\s+/g,
      ""
    );
}

// ======================================================
// ADD / UPDATE CUSTOM COMMAND
// ======================================================

async function saveCustomCommand(
  phone,
  command,
  response
) {
  const cleanCommand =
    normalizeCommand(
      command
    );

  const cleanResponse =
    String(
      response || ""
    ).trim();

  if (!phone) {
    throw new Error(
      "Phone number is required."
    );
  }

  if (!cleanCommand) {
    throw new Error(
      "Command name is required."
    );
  }

  if (!cleanResponse) {
    throw new Error(
      "Command response is required."
    );
  }

  if (
    cleanCommand.length >
    30
  ) {
    throw new Error(
      "Command name is too long."
    );
  }

  if (
    cleanResponse.length >
    4000
  ) {
    throw new Error(
      "Command response is too long."
    );
  }

  return CustomCommand
    .findOneAndUpdate(
      {
        phone,
        command:
          cleanCommand
      },
      {
        $set: {
          response:
            cleanResponse,

          updatedAt:
            new Date()
        },

        $setOnInsert: {
          phone,
          command:
            cleanCommand,

          createdAt:
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
// GET ONE CUSTOM COMMAND
// ======================================================

async function getCustomCommand(
  phone,
  command
) {
  const cleanCommand =
    normalizeCommand(
      command
    );

  if (
    !phone ||
    !cleanCommand
  ) {
    return null;
  }

  return CustomCommand.findOne({
    phone,
    command:
      cleanCommand
  });
}

// ======================================================
// GET ALL CUSTOM COMMANDS
// ======================================================

async function getCustomCommands(
  phone
) {
  if (!phone) {
    return [];
  }

  return CustomCommand
    .find({
      phone
    })
    .sort({
      command: 1
    });
}

// ======================================================
// DELETE CUSTOM COMMAND
// ======================================================

async function deleteCustomCommand(
  phone,
  command
) {
  const cleanCommand =
    normalizeCommand(
      command
    );

  if (
    !phone ||
    !cleanCommand
  ) {
    return {
      deletedCount: 0
    };
  }

  return CustomCommand.deleteOne({
    phone,
    command:
      cleanCommand
  });
}

// ======================================================
// DELETE ALL CUSTOM COMMANDS
// ======================================================

async function deleteAllCustomCommands(
  phone
) {
  if (!phone) {
    return {
      deletedCount: 0
    };
  }

  return CustomCommand.deleteMany({
    phone
  });
}

// ======================================================
// COUNT
// ======================================================

async function countCustomCommands(
  phone
) {
  if (!phone) {
    return 0;
  }

  return CustomCommand.countDocuments({
    phone
  });
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  CustomCommand,

  normalizeCommand,

  saveCustomCommand,

  getCustomCommand,

  getCustomCommands,

  deleteCustomCommand,

  deleteAllCustomCommands,

  countCustomCommands
};