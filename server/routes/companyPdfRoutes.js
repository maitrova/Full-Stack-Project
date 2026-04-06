import express from "express";
import {
  uploadCompanyPdfMiddleware,
  uploadCompanyPdf,
  saveCompanyDocument,
  getCompanyDocuments,
  getCompanyDocumentByName,
} from "../controllers/companyPdfController.js";

const companypdfs = express.Router();

// POST /api/company-pdfs/upload
companypdfs.post("/upload", (req, res, next) => {
  uploadCompanyPdfMiddleware(req, res, (err) => {
    if (err) return next(err);
    return uploadCompanyPdf(req, res);
  });
});

companypdfs.post("/company-documents", saveCompanyDocument);

companypdfs.get("/company-documents", getCompanyDocuments);

companypdfs.get("/company-documents/:name", getCompanyDocumentByName);

export default companypdfs;
