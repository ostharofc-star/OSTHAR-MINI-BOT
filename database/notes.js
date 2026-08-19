const mongoose = require("mongoose");

// ======================================================
// NOTE SCHEMA
// ======================================================

const noteSchema =
  new mongoose.Schema(
    {
      phone: {
        type: String,
        required: true,
        index: true
      },

      name: {
        type: String,
        required: true
      },

      content: {
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
      collection: "user_notes"
    }
  );

// One note name per WhatsApp bot account
noteSchema.index(
  {
    phone: 1,
    name: 1
  },
  {
    unique: true
  }
);

// ======================================================
// MODEL
// ======================================================

const Note =
  mongoose.models.Note ||
  mongoose.model(
    "Note",
    noteSchema
  );

// ======================================================
// NORMALIZE NOTE NAME
// ======================================================

function normalizeNoteName(name) {
  return String(
    name || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(
      /[^a-z0-9_-]/g,
      ""
    );
}

// ======================================================
// SAVE / UPDATE NOTE
// ======================================================

async function saveNote(
  phone,
  name,
  content
) {
  const cleanName =
    normalizeNoteName(
      name
    );

  const cleanContent =
    String(
      content || ""
    ).trim();

  if (!phone) {
    throw new Error(
      "Phone number is required."
    );
  }

  if (!cleanName) {
    throw new Error(
      "Note name is required."
    );
  }

  if (!cleanContent) {
    throw new Error(
      "Note content is required."
    );
  }

  if (
    cleanName.length > 40
  ) {
    throw new Error(
      "Note name is too long."
    );
  }

  if (
    cleanContent.length > 4000
  ) {
    throw new Error(
      "Note content is too long."
    );
  }

  return Note.findOneAndUpdate(
    {
      phone,
      name: cleanName
    },
    {
      $set: {
        content:
          cleanContent,

        updatedAt:
          new Date()
      },

      $setOnInsert: {
        phone,
        name:
          cleanName,

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
// GET ONE NOTE
// ======================================================

async function getNote(
  phone,
  name
) {
  const cleanName =
    normalizeNoteName(
      name
    );

  if (
    !phone ||
    !cleanName
  ) {
    return null;
  }

  return Note.findOne({
    phone,
    name:
      cleanName
  });
}

// ======================================================
// GET ALL NOTES
// ======================================================

async function getNotes(
  phone
) {
  if (!phone) {
    return [];
  }

  return Note
    .find({
      phone
    })
    .sort({
      updatedAt: -1
    });
}

// ======================================================
// DELETE NOTE
// ======================================================

async function deleteNote(
  phone,
  name
) {
  const cleanName =
    normalizeNoteName(
      name
    );

  if (
    !phone ||
    !cleanName
  ) {
    return {
      deletedCount: 0
    };
  }

  return Note.deleteOne({
    phone,
    name:
      cleanName
  });
}

// ======================================================
// COUNT NOTES
// ======================================================

async function countNotes(
  phone
) {
  if (!phone) {
    return 0;
  }

  return Note.countDocuments({
    phone
  });
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  Note,

  normalizeNoteName,

  saveNote,

  getNote,

  getNotes,

  deleteNote,

  countNotes
};