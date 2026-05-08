import express from "express";
import { getImageSitemap, getRobotsTxt, getXmlSitemap } from "../controllers/sitemapController.js";

const sitemapRouter = express.Router();

sitemapRouter.get("/sitemap.xml", getXmlSitemap);
sitemapRouter.get("/image-sitemap.xml", getImageSitemap);
sitemapRouter.get("/robots.txt", getRobotsTxt);

export default sitemapRouter;
