import express from "express";

import { getUserPreferenceSummary } from "../controllers/aiPreferenceController.js";
import { protect } from "../middleware/authMiddleware.js";

const aiPreferenceRouter = express.Router();

aiPreferenceRouter.get("/user-preferences", protect, getUserPreferenceSummary);

export default aiPreferenceRouter;
