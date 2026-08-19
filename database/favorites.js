const mongoose = require("mongoose");

// ======================================================
// FAVORITES SCHEMA
// ======================================================

const favoritesSchema =
  new mongoose.Schema(
    {
      phone: {
        type: String,
        required: true,
        unique: true,
        index: true
      },

      commands: {
        type: [String],
        default: []
      },

      updatedAt: {
        type: Date,
        default: Date.now
      }
    },
    {
      collection: "user_favorites"
    }
  );

// ======================================================
// MODEL
// ======================================================

const Favorites =
  mongoose.models.Favorites ||
  mongoose.model(
    "Favorites",
    favoritesSchema
  );

// ======================================================
// NORMALIZE COMMAND
// ======================================================

function normalizeFavoriteCommand(
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
// GET FAVORITES
// ======================================================

async function getFavorites(
  phone
) {
  if (!phone) {
    return [];
  }

  const data =
    await Favorites.findOne({
      phone
    });

  return Array.isArray(
    data?.commands
  )
    ? data.commands
    : [];
}

// ======================================================
// ADD FAVORITE
// ======================================================

async function addFavorite(
  phone,
  command
) {
  const cleanCommand =
    normalizeFavoriteCommand(
      command
    );

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

  if (
    cleanCommand.length > 40
  ) {
    throw new Error(
      "Command name is too long."
    );
  }

  const data =
    await Favorites.findOneAndUpdate(
      {
        phone
      },
      {
        $addToSet: {
          commands:
            cleanCommand
        },

        $set: {
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

  return data;
}

// ======================================================
// REMOVE FAVORITE
// ======================================================

async function removeFavorite(
  phone,
  command
) {
  const cleanCommand =
    normalizeFavoriteCommand(
      command
    );

  if (
    !phone ||
    !cleanCommand
  ) {
    return null;
  }

  return Favorites.findOneAndUpdate(
    {
      phone
    },
    {
      $pull: {
        commands:
          cleanCommand
      },

      $set: {
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
// CLEAR FAVORITES
// ======================================================

async function clearFavorites(
  phone
) {
  if (!phone) {
    return null;
  }

  return Favorites.findOneAndUpdate(
    {
      phone
    },
    {
      $set: {
        commands: [],
        updatedAt:
          new Date()
      }
    },
    {
      new: true,
      upsert: true
    }
  );
}

// ======================================================
// COUNT FAVORITES
// ======================================================

async function countFavorites(
  phone
) {
  const commands =
    await getFavorites(
      phone
    );

  return commands.length;
}

// ======================================================
// CHECK FAVORITE
// ======================================================

async function isFavorite(
  phone,
  command
) {
  const cleanCommand =
    normalizeFavoriteCommand(
      command
    );

  if (
    !phone ||
    !cleanCommand
  ) {
    return false;
  }

  const data =
    await Favorites.findOne({
      phone,
      commands:
        cleanCommand
    });

  return Boolean(data);
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  Favorites,

  normalizeFavoriteCommand,

  getFavorites,

  addFavorite,

  removeFavorite,

  clearFavorites,

  countFavorites,

  isFavorite
};