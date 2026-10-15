import express from "express";
import {
  uploadCompanyPdfMiddleware,
  uploadCompanyPdf,
  saveCompanyDocument,
  getCompanyDocuments,
  getCompanyDocumentByName,
} from "../controllers/companyPdfController.js";
import { protect, requireAdmin } from "../middleware/authMiddleware.js";

const companypdfs = express.Router();

// Policy pages are public to read but only store staff may change them:
// the storefront and the AI assistant both show this content to customers.
// POST /api/company-pdfs/upload
companypdfs.post("/upload", protect, requireAdmin, (req, res, next) => {
  uploadCompanyPdfMiddleware(req, res, (err) => {
    if (err) return next(err);
    return uploadCompanyPdf(req, res);
  });
});

companypdfs.post("/company-documents", protect, requireAdmin, saveCompanyDocument);

companypdfs.get("/company-documents", getCompanyDocuments);

companypdfs.get("/company-documents/:name", getCompanyDocumentByName);

export default companypdfs;
