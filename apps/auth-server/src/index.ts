import express from "express";
import { env } from "./config/env.js";
import { closeRedis } from "./services/redis.js";
import { logger } from "./utils/logger.js";

import { createServer } from "./routes/index.js";

const bootstrap = async (): Promise<void> => {
  const app = await createServer();

  const server = app.listen(env.port, () => {
    logger.info("Auth server started", {
      port: env.port,
      environment: env.nodeEnv,
      allowedOrigins: env.allowedOrigins,
    });
  });

  const gracefulShutdown = async (): Promise<void> => {
    logger.info("Shutting down auth-server");
    server.close(async () => {
      await closeRedis();
      process.exit(0);
    });
  };

  process.on("SIGINT", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);
};

bootstrap().catch((error) => {
  logger.error("Failed to start auth-server", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});