import { Router } from "express";
import { handleImport, handleHealth } from "../controllers/importController";
import { validateImportRequest } from "../middleware/validateImportRequest";
import { rateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post("/import", rateLimiter, validateImportRequest, handleImport);
router.get("/health", handleHealth);

export default router;
