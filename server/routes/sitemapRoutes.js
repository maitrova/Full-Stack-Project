import express from "express";
import { getImageSitemap, getXmlSitemap } from "../controllers/sitemapController.js";

const sitemapRouter = express.Router();

sitemapRouter.get("/sitemap.xml", getXmlSitemap);
sitemapRouter.get("/image-sitemap.xml", getImageSitemap);

export default sitemapRouter;
