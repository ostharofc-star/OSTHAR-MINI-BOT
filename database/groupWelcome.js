const mongoose = require("mongoose");

// ======================================================
// GROUP WELCOME SCHEMA
// ======================================================

const groupWelcomeSchema =
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

      welcomeMessage: {
        type: String,
        default:
          "Welcome {user} to {group}."
      },

      goodbyeMessage: {
        type: String,
        default:
          "Goodbye {user}. Take care."
      },

      updatedAt: {
        type: Date,
        default: Date.now
      }
    },
    {
      collection:
        "group_welcome_settings"
    }
  );

// One record per group per bot account
groupWelcomeSchema.index(
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

const GroupWelcome =
  mongoose.models.GroupWelcome ||
  mongoose.model(
    "GroupWelcome",
    groupWelcomeSchema
  );

// ======================================================
// GET SETTINGS
// ======================================================

async function getGroupWelcome(
  phone,
  groupJid
) {
  if (
    !phone ||
    !groupJid
  ) {
    return null;
  }

  return GroupWelcome.findOne({
    phone,
    groupJid
  });
}

// ======================================================
// GET OR CREATE SETTINGS
// ======================================================

async function getOrCreateGroupWelcome(
  phone,
  groupJid
) {
  if (
    !phone ||
    !groupJid
  ) {
    throw new Error(
      "Phone and group JID are required."
    );
  }

  let data =
    await GroupWelcome.findOne({
      phone,
      groupJid
    });

  if (!data) {
    data =
      await GroupWelcome.create({
        phone,
        groupJid
      });
  }

  return data;
}

// ======================================================
// SET WELCOME MESSAGE
// ======================================================

async function setWelcomeMessage(
  phone,
  groupJid,
  message
) {
  const cleanMessage =
    String(
      message || ""
    )
      .trim()
      .slice(
        0,
        2000
      );

  if (!cleanMessage) {
    throw new Error(
      "Welcome message is required."
    );
  }

  return GroupWelcome.findOneAndUpdate(
    {
      phone,
      groupJid
    },
    {
      $set: {
        welcomeMessage:
          cleanMessage,

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
// SET GOODBYE MESSAGE
// ======================================================

async function setGoodbyeMessage(
  phone,
  groupJid,
  message
) {
  const cleanMessage =
    String(
      message || ""
    )
      .trim()
      .slice(
        0,
        2000
      );

  if (!cleanMessage) {
    throw new Error(
      "Goodbye message is required."
    );
  }

  return GroupWelcome.findOneAndUpdate(
    {
      phone,
      groupJid
    },
    {
      $set: {
        goodbyeMessage:
          cleanMessage,

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
// RESET GROUP WELCOME SETTINGS
// ======================================================

async function resetGroupWelcome(
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

  return GroupWelcome.deleteOne({
    phone,
    groupJid
  });
}

// ======================================================
// FORMAT MESSAGE VARIABLES
// ======================================================

function formatGroupMessage({
  template,
  userJid,
  groupName
}) {
  const userNumber =
    String(
      userJid || ""
    )
      .split("@")[0]
      .replace(
        /\D/g,
        ""
      );

  return String(
    template || ""
  )
    .replace(
      /\{user\}/gi,
      `@${userNumber}`
    )
    .replace(
      /\{number\}/gi,
      userNumber
    )
    .replace(
      /\{group\}/gi,
      groupName || "this group"
    );
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  GroupWelcome,

  getGroupWelcome,

  getOrCreateGroupWelcome,

  setWelcomeMessage,

  setGoodbyeMessage,

  resetGroupWelcome,

  formatGroupMessage
};