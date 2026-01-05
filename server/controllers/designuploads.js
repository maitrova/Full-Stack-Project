import fs from "fs";
import path from "path";
import { sanitizeFolderName } from "../middleware/outputUpload.js";

const BASE_DIR = path.join(process.cwd(), "outputs", "adminuploadeddesigns");

function ensureBase() {
  if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });
}

function safeJoinFolder(folder) {
  const clean = sanitizeFolderName(folder);
  if (!clean) throw new Error("Invalid folder name");
  const full = path.join(BASE_DIR, clean);

  // extra traversal safety check
  if (!full.startsWith(BASE_DIR)) throw new Error("Invalid folder path");
  return { clean, full };
}

export const createCategoryFolder = async (req, res) => {
  try {
    ensureBase();

    const { name } = req.body; // e.g. "car designs"
    const clean = sanitizeFolderName(name);

    if (!clean) {
      return res.status(400).json({ success: false, message: "Folder name required" });
    }

    const folderPath = path.join(BASE_DIR, clean);
    if (!folderPath.startsWith(BASE_DIR)) {
      return res.status(400).json({ success: false, message: "Invalid folder name" });
    }

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    return res.json({
      success: true,
      folder: clean,
      path: `/outputs/adminuploadeddesigns/${clean}`,
    });
  } catch (err) {
    console.error("createCategoryFolder error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

export const listCategoryFolders = async (req, res) => {
  try {
    ensureBase();

    const entries = fs.readdirSync(BASE_DIR, { withFileTypes: true });
    const folders = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));

    return res.json({ success: true, folders });
  } catch (err) {
    console.error("listCategoryFolders error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const uploadImagesToFolder = async (req, res) => {
  try {
    ensureBase();

    // multer already saved files into correct folder
    const folderRaw = req.params.folder || req.body.folder;
    const { clean } = safeJoinFolder(folderRaw);

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: "No images uploaded" });
    }

    const uploaded = files.map((f) => ({
      filename: f.filename,
      originalname: f.originalname,
      size: f.size,
      mimetype: f.mimetype,
      url: `/outputs/adminuploadeddesigns/${clean}/${f.filename}`,
    }));

    return res.json({ success: true, folder: clean, files: uploaded });
  } catch (err) {
    console.error("uploadImagesToFolder error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

export const listImagesInFolder = async (req, res) => {
  try {
    ensureBase();

    const { clean, full } = safeJoinFolder(req.params.folder);

    if (!fs.existsSync(full)) {
      return res.status(404).json({ success: false, message: "Folder not found" });
    }

    const items = fs.readdirSync(full);
    const files = items
      .map((name) => {
        const fp = path.join(full, name);
        const st = fs.statSync(fp);
        if (!st.isFile()) return null;

        return {
          filename: name,
          size: st.size,
          modifiedAt: st.mtime.toISOString(),
          url: `/outputs/adminuploadeddesigns/${clean}/${name}`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

    return res.json({ success: true, folder: clean, files });
  } catch (err) {
    console.error("listImagesInFolder error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

// Optional: delete an image
export const deleteImageFromFolder = async (req, res) => {
  try {
    ensureBase();

    const { clean, full } = safeJoinFolder(req.params.folder);
    const filename = path.basename(req.params.filename || "");

    const filePath = path.join(full, filename);
    if (!filePath.startsWith(full)) {
      return res.status(400).json({ success: false, message: "Invalid filename" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    fs.unlinkSync(filePath);
    return res.json({ success: true, message: "Deleted", folder: clean, filename });
  } catch (err) {
    console.error("deleteImageFromFolder error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

// Optional: delete a folder (only if empty)
export const deleteCategoryFolder = async (req, res) => {
  try {
    ensureBase();

    const { clean, full } = safeJoinFolder(req.params.folder);

    if (!fs.existsSync(full)) {
      return res.status(404).json({ success: false, message: "Folder not found" });
    }

    const content = fs.readdirSync(full);
    if (content.length > 0) {
      return res.status(400).json({ success: false, message: "Folder not empty" });
    }

    fs.rmdirSync(full);
    return res.json({ success: true, message: "Folder deleted", folder: clean });
  } catch (err) {
    console.error("deleteCategoryFolder error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};
