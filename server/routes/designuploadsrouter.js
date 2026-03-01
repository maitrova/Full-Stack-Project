import express from "express";
import { adminDesignUpload } from "../middleware/outputUpload.js";
import {
  createCategoryFolder,
  listCategoryFolders,
  uploadImagesToFolder,
  listImagesInFolder,
  deleteImageFromFolder,
  deleteCategoryFolder,
} from "../controllers/designuploads.js";

const designuploadsrouter = express.Router();

// base: /api/admin-designs

// Create folder: { "name": "car designs" }
designuploadsrouter.post("/folders", createCategoryFolder);

// List all folders
designuploadsrouter.get("/folders", listCategoryFolders);

// Upload single/multiple images to a folder (field name: "images")
designuploadsrouter.post("/:folder/upload", adminDesignUpload.array("images", 2000), uploadImagesToFolder);

// List images inside folder
designuploadsrouter.get("/:folder/files", listImagesInFolder);

// Optional: delete a file
designuploadsrouter.delete("/:folder/files/:filename", deleteImageFromFolder);

// Optional: delete folder (only if empty)
designuploadsrouter.delete("/folders/:folder", deleteCategoryFolder);

export default designuploadsrouter;
