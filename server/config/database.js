import mongoose from "mongoose";

let hasConnected = false;

export async function connectDatabase() {
  if (hasConnected) {
    return true;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("[db] MONGODB_URI not set. Running without persistent database.");
    return false;
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  hasConnected = true;
  console.log("[db] Connected to MongoDB");
  return true;
}
