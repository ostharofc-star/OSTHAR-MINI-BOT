const mongoose = require("mongoose");

const userSettingsSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    botName: {
      type: String,
      default: "OSTHAR MINI BOT"
    },

    prefix: {
      type: String,
      default: "."
    },

    antiDelete: {
      type: Boolean,
      default: false
    },

    antiDeleteDestination: {
      type: String,
      enum: [
        "owner",
        "same",
        "custom"
      ],
      default: "owner"
    },

    viewOnceDestination: {
      type: String,
      enum: [
        "owner",
        "same",
        "custom"
      ],
      default: "owner"
    },

    customDestinationNumber: {
      type: String,
      default: ""
    },

    antiCall: {
      type: Boolean,
      default: false
    },

    autoStatusSeen: {
      type: Boolean,
      default: false
    },

    autoReact: {
      type: Boolean,
      default: true
    },

    autoReply: {
      type: Boolean,
      default: false
    },

    autoRead: {
      type: Boolean,
      default: false
    },

    autoTyping: {
      type: Boolean,
      default: false
    },

    statusReact: {
      type: Boolean,
      default: true
    },

    statusReactEmoji: {
      type: String,
      default: "💚"
    },

    statusReply: {
      type: Boolean,
      default: false
    },

    antiLink: {
      type: Boolean,
      default: false
    },

    antiSpam: {
      type: Boolean,
      default: false
    },

    // ==========================================
    // AUTO WARN KICK
    // ==========================================

    autoWarnKick: {
      type: Boolean,
      default: false
    },

    welcome: {
      type: Boolean,
      default: false
    },

    goodbye: {
      type: Boolean,
      default: false
    },

    welcomeMessage: {
      type: String,
      default:
        "Welcome to the group."
    },

    goodbyeMessage: {
      type: String,
      default:
        "Goodbye and take care."
    },

    autoReplyMessage: {
      type: String,
      default:
        "Thank you for your message. OSTHAR MINI BOT is currently active."
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
      "user_settings"
  }
);

// ======================================================
// UPDATE DATE
// ======================================================

userSettingsSchema.pre(
  "save",
  function () {
    this.updatedAt =
      new Date();
  }
);

// ======================================================
// MODEL
// ======================================================

const UserSettings =
  mongoose.models.UserSettings ||
  mongoose.model(
    "UserSettings",
    userSettingsSchema
  );

// ======================================================
// GET SETTINGS
// ======================================================

async function getUserSettings(
  phone
) {
  let settings =
    await UserSettings.findOne({
      phone
    });

  if (!settings) {
    settings =
      await UserSettings.create({
        phone
      });
  }

  return settings;
}

// ======================================================
// UPDATE SETTINGS
// ======================================================

async function updateUserSettings(
  phone,
  updates = {}
) {
  const settings =
    await UserSettings.findOneAndUpdate(
      {
        phone
      },
      {
        $set: {
          ...updates,

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

  return settings;
}

// ======================================================
// SET ONE SETTING
// ======================================================

async function setSetting(
  phone,
  key,
  value
) {
  const allowedSettings = [
    "botName",
    "prefix",

    "antiDelete",
    "antiDeleteDestination",

    "viewOnceDestination",
    "customDestinationNumber",

    "antiCall",

    "autoStatusSeen",
    "autoReact",
    "autoReply",
    "autoRead",
    "autoTyping",

    "statusReact",
    "statusReactEmoji",
    "statusReply",

    "antiLink",
    "antiSpam",

    "autoWarnKick",

    "welcome",
    "goodbye",

    "welcomeMessage",
    "goodbyeMessage",
    "autoReplyMessage"
  ];

  if (
    !allowedSettings.includes(
      key
    )
  ) {
    throw new Error(
      `Invalid setting: ${key}`
    );
  }

  return updateUserSettings(
    phone,
    {
      [key]: value
    }
  );
}

// ======================================================
// DELETE SETTINGS
// ======================================================

async function deleteUserSettings(
  phone
) {
  return UserSettings.deleteOne({
    phone
  });
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  UserSettings,

  getUserSettings,

  updateUserSettings,

  setSetting,

  deleteUserSettings
};