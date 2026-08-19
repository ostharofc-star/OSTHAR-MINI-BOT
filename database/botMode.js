const mongoose = require("mongoose");

const botModeSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    mode: {
      type: String,
      enum: ["public", "private"],
      default: "public"
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: "bot_modes"
  }
);

const BotMode =
  mongoose.models.BotMode ||
  mongoose.model(
    "BotMode",
    botModeSchema
  );

async function getBotMode(phone) {
  if (!phone) {
    return "public";
  }

  let row =
    await BotMode.findOne({
      phone
    });

  if (!row) {
    row =
      await BotMode.create({
        phone,
        mode: "public"
      });
  }

  return row.mode === "private"
    ? "private"
    : "public";
}

async function setBotMode(
  phone,
  mode
) {
  const value =
    String(mode || "")
      .trim()
      .toLowerCase();

  if (
    !["public", "private"]
      .includes(value)
  ) {
    throw new Error(
      "Mode must be public or private."
    );
  }

  return BotMode.findOneAndUpdate(
    {
      phone
    },
    {
      $set: {
        mode:
          value,

        updatedAt:
          new Date()
      }
    },
    {
      upsert:
        true,

      new:
        true,

      setDefaultsOnInsert:
        true
    }
  );
}

module.exports = {
  BotMode,
  getBotMode,
  setBotMode
};
