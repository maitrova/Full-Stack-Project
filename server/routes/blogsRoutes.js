import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { blogCoverUpload } from "../middleware/blogCoverUpload.js";
import {
  createBlog,
  deleteBlog,
  getPublicBlogBySlug,
  listAdminBlogs,
  listPublicBlogs,
  uploadBlogInlineImage,
  updateBlog,
} from "../controllers/blogsController.js";

const blogsRouter = express.Router();

blogsRouter.get("/", listPublicBlogs);
blogsRouter.get("/slug/:slug", getPublicBlogBySlug);
blogsRouter.get("/admin", protect, listAdminBlogs);
blogsRouter.post("/admin/upload-image", protect, blogCoverUpload.single("inlineImageFile"), uploadBlogInlineImage);
blogsRouter.post("/admin", protect, blogCoverUpload.single("coverImageFile"), createBlog);
blogsRouter.put("/admin/:id", protect, blogCoverUpload.single("coverImageFile"), updateBlog);
blogsRouter.delete("/admin/:id", protect, deleteBlog);

export default blogsRouter;
