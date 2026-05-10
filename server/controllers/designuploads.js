import fs from "fs";
import path from "path";
import { sanitizeFolderName } from "../middleware/outputUpload.js";
import {
  deleteOptimizedImageSet,
  normalizeStoredPath,
  optimizeUploadedImage,
} from "../utils/imageOptimization.js";

const BASE_DIR = path.join(process.cwd(), "outputs", "adminuploadeddesigns");

/**
 * Ensure base directory exists
 */
function ensureBase() {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  }
}

/**
 * Safe join folder
 */
function safeJoinFolder(folder) {

  const clean = sanitizeFolderName(folder);

  if (!clean) {
    throw new Error("Invalid folder name");
  }

  const full = path.join(BASE_DIR, clean);

  if (!full.startsWith(BASE_DIR)) {
    throw new Error("Invalid folder path");
  }

  return { clean, full };
}

/**
 * CREATE FOLDER
 */
export const createCategoryFolder = async (req, res) => {

  try {

    ensureBase();

    const { name } = req.body;

    const clean = sanitizeFolderName(name);

    if (!clean) {
      return res.status(400).json({
        success: false,
        message: "Folder name required",
      });
    }

    const folderPath = path.join(BASE_DIR, clean);

    if (!folderPath.startsWith(BASE_DIR)) {
      return res.status(400).json({
        success: false,
        message: "Invalid folder name",
      });
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

    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }

};


/**
 * LIST FOLDERS
 */
export const listCategoryFolders = async (req, res) => {

  try {

    ensureBase();

    const entries = fs.readdirSync(BASE_DIR, {
      withFileTypes: true,
    });

    const folders = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b));

    res.json({
      success: true,
      folders,
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }

};


/**
 * UPLOAD IMAGES OR FOLDER
 */
export const uploadImagesToFolder = async (req, res) => {

  try {

    ensureBase();

    const folderRaw = req.params.folder || req.body.folder;

    const { clean } = safeJoinFolder(folderRaw);

    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    const uploaded = await Promise.all(
      files.map(async (file) => {
        const optimized = await optimizeUploadedImage(
          normalizeStoredPath(file.path),
          {
            outputDir: `outputs/adminuploadeddesigns/${clean}`,
            baseName: path.basename(file.filename, path.extname(file.filename)),
            cleanupSource: true,
          }
        );

        const visibleAsset = optimized.url;
        const filename = path.basename(visibleAsset);

        return {
          filename,
          originalname: file.originalname,
          size: file.size,
          mimetype: "image/webp",
          url: `/${String(visibleAsset).replace(/^\/+/, "")}`,
          variants: optimized.variants,
        };
      })
    );

    res.json({

      success: true,

      folder: clean,

      files: uploaded,

    });

  } catch (err) {

    console.error(err);

    res.status(500).json({

      success: false,

      message: err.message,

    });

  }

};


/**
 * LIST IMAGES
 */
export const listImagesInFolder = async (req, res) => {

  try {

    ensureBase();

    const { clean, full } = safeJoinFolder(req.params.folder);

    if (!fs.existsSync(full)) {

      return res.status(404).json({

        success: false,

        message: "Folder not found",

      });

    }

    const items = fs.readdirSync(full);

    const files = items
      .filter((name) => !/-blur\.webp$/i.test(name) && !/-sm\.webp$/i.test(name))
      .map(name => {

        const filePath = path.join(full, name);

        const stat = fs.statSync(filePath);

        if (!stat.isFile()) return null;

        return {

          filename: name,

          size: stat.size,

          modifiedAt: stat.mtime.toISOString(),

          url: `/outputs/adminuploadeddesigns/${clean}/${name}`,

        };

      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b.modifiedAt) -
          new Date(a.modifiedAt)
      );

    res.json({

      success: true,

      folder: clean,

      files,

    });

  } catch (err) {

    res.status(500).json({

      success: false,

      message: err.message,

    });

  }

};


/**
 * DELETE IMAGE
 */
export const deleteImageFromFolder = async (req, res) => {

  try {

    const { clean, full } = safeJoinFolder(req.params.folder);

    const filename = path.basename(req.params.filename);

    const filePath = path.join(full, filename);

    if (!filePath.startsWith(full)) {

      return res.status(400).json({

        success: false,

        message: "Invalid filename",

      });

    }

    if (!fs.existsSync(filePath)) {

      return res.status(404).json({

        success: false,

        message: "File not found",

      });

    }

    const relativeFilePath = normalizeStoredPath(filePath);
    if (/-md\.webp$/i.test(filename) || /-(blur|sm|md)\.webp$/i.test(filename)) {
      await deleteOptimizedImageSet(relativeFilePath);
    } else {
      fs.unlinkSync(filePath);
    }

    res.json({

      success: true,

      message: "Deleted",

    });

  } catch (err) {

    res.status(500).json({

      success: false,

      message: err.message,

    });

  }

};


/**
 * DELETE FOLDER
 */
export const deleteCategoryFolder = async (req, res) => {
  try {
    const { clean, full } = safeJoinFolder(req.params.folder);

    if (!fs.existsSync(full)) {
      return res.status(404).json({
        success: false,
        message: "Folder not found",
      });
    }

    // 🔥 Delete folder with all contents
    fs.rmSync(full, { recursive: true, force: true });

    res.json({
      success: true,
      message: "Folder and all files deleted successfully",
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
