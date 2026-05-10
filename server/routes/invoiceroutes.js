import express from "express";
import { downloadInvoice } from "../controllers/invoicecontroller.js";
import { protect } from "../middleware/authMiddleware.js";

const invoicerouter = express.Router();

invoicerouter.get("/orders/:id/invoice",protect, downloadInvoice);

export default invoicerouter;
