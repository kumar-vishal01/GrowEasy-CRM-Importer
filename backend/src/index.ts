import "dotenv/config";
import { createApp } from "./app";
import { logger } from "./utils/logger";

const PORT = Number(process.env.PORT || 4000);
const app = createApp();

app.listen(PORT, () => {
  logger.info(`GrowEasy backend listening on port ${PORT}`, {
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
    maxBodySize: process.env.MAX_BODY_SIZE || "15mb",
  });
});
