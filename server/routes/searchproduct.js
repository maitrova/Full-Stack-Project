import express from "express";
import searchOrders from "../controllers/searchproductcontroller.js";


const searchproductroute = express.Router();

// 🔹 GET product by ID
searchproductroute.get("/search", searchOrders);

export default searchproductroute;
