import express from "express";
import multer from "multer";
import { removeBgController } from "../controllers/removeBg.controller.js";


const removebgrouter = express.Router();
const upload = multer({ dest: "uploads/" }); // temp folder

removebgrouter.post("/remove-bg", upload.single("image"), removeBgController);

export default removebgrouter;
