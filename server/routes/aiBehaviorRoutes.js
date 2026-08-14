import express from "express";
import {
  getBehaviorSummary,
  trackBehaviorEvent,
} from "../controllers/aiBehaviorController.js";
import { optionalProtect } from "../middleware/authMiddleware.js";

const aiBehaviorRouter = express.Router();

aiBehaviorRouter.post("/behavior-events", optionalProtect, trackBehaviorEvent);
aiBehaviorRouter.get("/behavior-summary", optionalProtect, getBehaviorSummary);

export default aiBehaviorRouter;
