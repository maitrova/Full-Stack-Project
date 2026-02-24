import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

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

// Controller
export const uploadCompanyPdf = (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: "No file uploaded" });

  return res.status(200).json({
    message: "File uploaded successfully",
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    publicUrl: `/api/outputs/company_pdfs/${req.file.filename}`,
    savedPath: `outputs/company_pdfs/${req.file.filename}`,
  });
};