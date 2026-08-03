import express from "express";
import {
  getImageSitemap,
  getProductFeed,
  getRobotsTxt,
  getXmlSitemap,
} from "../controllers/sitemapController.js";

const sitemapRouter = express.Router();

sitemapRouter.get("/sitemap.xml", getXmlSitemap);
sitemapRouter.get("/image-sitemap.xml", getImageSitemap);
sitemapRouter.get("/product-feed.xml", getProductFeed);
sitemapRouter.get("/robots.txt", getRobotsTxt);

export default sitemapRouter;
