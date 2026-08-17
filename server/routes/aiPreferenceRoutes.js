import express from "express";

import {
  getUserPreferenceSummary,
  refreshUserPreferenceProfile,
} from "../controllers/aiPreferenceController.js";
import { protect } from "../middleware/authMiddleware.js";

const aiPreferenceRouter = express.Router();

aiPreferenceRouter.get("/user-preferences", protect, getUserPreferenceSummary);
aiPreferenceRouter.post("/user-preferences/refresh", protect, refreshUserPreferenceProfile);

export default aiPreferenceRouter;
