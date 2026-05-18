import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";

async function bootstrap() {
  await connectDatabase();

  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log(`[api] Govinda AI API running on port ${env.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[api] ${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  console.error("[api] failed to start:", err);
  process.exit(1);
});
