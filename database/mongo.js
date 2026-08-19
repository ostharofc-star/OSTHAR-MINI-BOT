const mongoose = require("mongoose");

let isConnected = false;

async function connectMongoDB() {
  if (isConnected) {
    return mongoose.connection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured.");
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });

    isConnected = true;

    console.log("MongoDB Connected Successfully");

    mongoose.connection.on("error", (error) => {
      console.error("MongoDB Connection Error:", error.message);
    });

    mongoose.connection.on("disconnected", () => {
      isConnected = false;
      console.log("MongoDB Disconnected");
    });

    mongoose.connection.on("connected", () => {
      isConnected = true;
    });

    return mongoose.connection;
  } catch (error) {
    isConnected = false;

    console.error(
      "MongoDB Connection Failed:",
      error.message
    );

    throw error;
  }
}

function getMongoStatus() {
  return mongoose.connection.readyState;
}

module.exports = {
  connectMongoDB,
  getMongoStatus,
  mongoose
};