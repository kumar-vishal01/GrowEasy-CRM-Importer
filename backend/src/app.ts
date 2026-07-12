import express from "express";
import cors from "cors";
import helmet from "helmet";
import importRouter from "./routes/import";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";

export function createApp() {
  const app = express();
  const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
  const MAX_BODY_SIZE = process.env.MAX_BODY_SIZE || "15mb";

  if (process.env.CORS_ORIGIN === undefined) {
    logger.warn(
      "CORS_ORIGIN not set — defaulting to http://localhost:3000. Set this explicitly in production."
    );
  }

  app.disable("x-powered-by");
  app.use(helmet());

  app.use(
    cors({
      origin: ALLOWED_ORIGIN,
      methods: ["GET", "POST"],
    })
  );

  app.use(express.json({ limit: MAX_BODY_SIZE }));

  app.use("/api", importRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
