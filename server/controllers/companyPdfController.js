import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
// Controller
import CompanyDocument from "../models/filenames.js";
// ESM dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server root
const serverRoot = path.join(__dirname, "..");

// Save to: server/outputs/company_pdfs
const uploadDir = path.join(serverRoot, "outputs", "company_pdfs");
fs.mkdirSync(uploadDir, { recursive: true });

// No file type restriction
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);

    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_");

    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    cb(null, `${safeBase}-${unique}${ext}`);
  },
});

export const uploadCompanyPdfMiddleware = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
}).single("file");  // 🔥 changed field name

export const uploadCompanyPdf = async (req, res) => {

  try {

    if (!req.file)
      return res.status(400).json({ error: "No file uploaded" });

    const { name } = req.body;

    if (!name)
      return res.status(400).json({ error: "Document name required" });

    // relative path to save in DB
    const filePath = `outputs/company_pdfs/${req.file.filename}`;

    // save in DB
    const document = await CompanyDocument.create({
      name,
      filePath,
    });

    res.status(200).json({
      message: "Document uploaded successfully",
      document,
      publicUrl: `/api/${filePath}`,
    });

  } catch (error) {

    res.status(500).json({
      error: error.message,
    });

  }

};


export const getCompanyDocuments = async (req, res) => {

  try {

    const documents = await CompanyDocument.find().sort({ createdAt: -1 });

    res.status(200).json(documents);

  } catch (error) {

    res.status(500).json({
      error: error.message,
    });

  }

};


export const getCompanyDocumentByName = async (req, res) => {

  try {

    const { name } = req.params;

    const document = await CompanyDocument.findOne({ name });

    if (!document) {

      return res.status(404).json({
        error: "Document not found",
      });

    }

    res.status(200).json(document);

  } catch (error) {

    res.status(500).json({
      error: error.message,
    });

  }

};