import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const OUTPUTS_ROOT = path.resolve("outputs");
const READYMADE_THUMBNAIL_DIR = path.join(
  "outputs",
  "readymade-products",
  "thumbnails"
);

const normalizeStoredPath = (filePath) => filePath?.replace(/\\/g, "/") || null;

const ensureDirectory = async (relativeDir) => {
  await fs.mkdir(path.resolve(relativeDir), { recursive: true });
};

export const createReadymadeThumbnail = async (
  sourcePath,
  { width = 480, height = 480, quality = 72 } = {}
) => {
  const normalizedSourcePath = normalizeStoredPath(sourcePath);
  if (!normalizedSourcePath || /^https?:\/\//i.test(normalizedSourcePath)) {
    return normalizedSourcePath;
  }

  const absoluteSourcePath = path.resolve(normalizedSourcePath);
  if (!absoluteSourcePath.startsWith(OUTPUTS_ROOT)) {
    throw new Error("Thumbnail source must be inside outputs/");
  }

  await ensureDirectory(READYMADE_THUMBNAIL_DIR);

  const fileName = path.basename(
    normalizedSourcePath,
    path.extname(normalizedSourcePath)
  );
  const thumbnailRelativePath = normalizeStoredPath(
    path.join(READYMADE_THUMBNAIL_DIR, `${fileName}-thumb.webp`)
  );
  const thumbnailAbsolutePath = path.resolve(thumbnailRelativePath);

  await sharp(absoluteSourcePath)
    .rotate()
    .resize(width, height, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 })
    .toFile(thumbnailAbsolutePath);

  return thumbnailRelativePath;
};

