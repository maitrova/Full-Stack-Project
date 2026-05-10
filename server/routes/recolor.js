// server/routes/recolor.route.js
import express from "express";
import { recolorController } from "../controllers/recolor.controller.js";

const recolorrouter = express.Router();

recolorrouter.post("/recolor", recolorController);

export default recolorrouter;