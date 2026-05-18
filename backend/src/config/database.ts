import mongoose from "mongoose";
import { env } from "./env";

export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => {
    console.log("[mongodb] connected");
  });

  mongoose.connection.on("error", (err) => {
    console.error("[mongodb] connection error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[mongodb] disconnected");
  });

  await mongoose.connect(env.mongodbUri);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
