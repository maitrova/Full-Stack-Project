import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import CompanyDocument from "../models/filenames.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.join(__dirname, "..");
const uploadDir = path.join(serverRoot, "outputs", "company_pdfs");

fs.mkdirSync(uploadDir, { recursive: true });

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
  limits: { fileSize: 20 * 1024 * 1024 },
}).single("file");

export const uploadCompanyPdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const name = req.body?.name?.trim();
    if (!name) {
      return res.status(400).json({ error: "Document name required" });
    }

    const filePath = `outputs/company_pdfs/${req.file.filename}`;
    let document = await CompanyDocument.findOne({ name }).sort({ updatedAt: -1, createdAt: -1 });

    if (document) {
      document.name = name;
      document.filePath = filePath;
      document.content = "";
      document.contentType = "pdf";
      await document.save();
    } else {
      document = await CompanyDocument.create({
        name,
        filePath,
        content: "",
        contentType: "pdf",
      });
    }

    return res.status(200).json({
      message: "Document uploaded successfully",
      document,
      publicUrl: `/api/${filePath}`,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
};

export const saveCompanyDocument = async (req, res) => {
  try {
    const name = req.body?.name?.trim();
    const content = typeof req.body?.content === "string" ? req.body.content : "";

    if (!name) {
      return res.status(400).json({ error: "Document name required" });
    }

    if (!content.trim()) {
      return res.status(400).json({ error: "Document content required" });
    }

    let document = await CompanyDocument.findOne({ name }).sort({ updatedAt: -1, createdAt: -1 });

    if (document) {
      document.name = name;
      document.content = content;
      document.contentType = "html";
      document.filePath = null;
      await document.save();
    } else {
      document = await CompanyDocument.create({
        name,
        content,
        contentType: "html",
        filePath: null,
      });
    }

    return res.status(200).json({
      message: "Document saved successfully",
      document,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
};

export const getCompanyDocuments = async (req, res) => {
  try {
    const documents = await CompanyDocument.find().sort({ updatedAt: -1, createdAt: -1 });
    return res.status(200).json(documents);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
};

export const getCompanyDocumentByName = async (req, res) => {
  try {
    const { name } = req.params;
    const document = await CompanyDocument.findOne({ name }).sort({ updatedAt: -1, createdAt: -1 });

    if (!document) {
      return res.status(404).json({
        error: "Document not found",
      });
    }

    return res.status(200).json(document);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
};
