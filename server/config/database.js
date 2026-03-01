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
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 100,
    minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE) || 10,
    maxIdleTimeMS: Number(process.env.MONGO_MAX_IDLE_TIME_MS) || 30000,
    waitQueueTimeoutMS: Number(process.env.MONGO_WAIT_QUEUE_TIMEOUT_MS) || 10000,
  });

  hasConnected = true;
  console.log("[db] Connected to MongoDB");
  return true;
}
