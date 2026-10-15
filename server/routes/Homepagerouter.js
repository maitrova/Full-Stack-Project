// routes/homepageRoutes.js
import express from "express";
import { getEligibleBestSellers, getEligibleNewArrivals, getHomepageBestSellers, getHomepageNewArrivals, setHomepageBestSellers, setHomepageNewArrivals } from "../controllers/homepageController.js";
import { protect, requireAdmin } from "../middleware/authMiddleware.js";

const homepagerouter = express.Router();

// Fetch eligible items for new arrivals
homepagerouter.get("/new-arrivals/eligible", getEligibleNewArrivals);

// Set selected items for homepage
homepagerouter.post("/new-arrivals/select", protect, requireAdmin, setHomepageNewArrivals);

// Get selected new arrivals for frontend
homepagerouter.get("/new-arrivals", getHomepageNewArrivals);
// Fetch eligible items for best sellers
homepagerouter.get("/best-sellers/eligible", getEligibleBestSellers);

// Set selected items for homepage best sellers
homepagerouter.post("/best-sellers/select", protect, requireAdmin, setHomepageBestSellers);

// Get selected best sellers for frontend
homepagerouter.get("/best-sellers", getHomepageBestSellers);
export default homepagerouter;
