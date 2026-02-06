// routes/addressRoutes.js
import express from "express";

import {
  upsertDeliveryBilling,
  getMyAddresses,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../controllers/useraddress.js";
import { protect } from "../middleware/authMiddleware.js";

const addressroute = express.Router();

addressroute.post("/createaddress", protect, upsertDeliveryBilling);
addressroute.get("/createaddress", protect, getMyAddresses);
addressroute.put("/updateaddress/:id", protect, updateAddress);
addressroute.delete("/deleteaddress/:id", protect, deleteAddress);
addressroute.patch("/defaultaddress/:id/default", protect, setDefaultAddress);
export default addressroute;