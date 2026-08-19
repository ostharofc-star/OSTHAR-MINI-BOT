const mongoose = require("mongoose");

const commandControlSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true },
  disabledCommands: { type: [String], default: [] },
  updatedAt: { type: Date, default: Date.now }
}, { collection: "command_controls" });

const CommandControl =
  mongoose.models.CommandControl ||
  mongoose.model("CommandControl", commandControlSchema);

const PROTECTED = new Set([
  "enablecmd", "disablecmd", "cmdstatus",
  "menu", "alive", "owner", "ping"
]);

function normalizeCommand(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^[.!/#]+/, "");
}

async function getControl(phone) {
  if (!phone) return { phone: "", disabledCommands: [] };

  let row = await CommandControl.findOne({ phone });
  if (!row) {
    row = await CommandControl.create({
      phone,
      disabledCommands: []
    });
  }
  return row;
}

async function isCommandEnabled(phone, command) {
  const name = normalizeCommand(command);
  if (!name || PROTECTED.has(name)) return true;

  const row = await getControl(phone);
  return !row.disabledCommands.includes(name);
}

async function disableCommand(phone, command) {
  const name = normalizeCommand(command);
  if (!name) throw new Error("Command name is required.");
  if (PROTECTED.has(name)) {
    throw new Error("This command is protected and cannot be disabled.");
  }

  return CommandControl.findOneAndUpdate(
    { phone },
    {
      $addToSet: { disabledCommands: name },
      $set: { updatedAt: new Date() }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function enableCommand(phone, command) {
  const name = normalizeCommand(command);
  if (!name) throw new Error("Command name is required.");

  return CommandControl.findOneAndUpdate(
    { phone },
    {
      $pull: { disabledCommands: name },
      $set: { updatedAt: new Date() }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function getDisabledCommands(phone) {
  const row = await getControl(phone);
  return [...row.disabledCommands].sort();
}

module.exports = {
  CommandControl,
  normalizeCommand,
  isCommandEnabled,
  disableCommand,
  enableCommand,
  getDisabledCommands
};
