import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const OUTPUTS_ROOT = path.resolve("outputs");
const DEFAULT_WIDTHS = {
  small: 300,
  medium: 600,
  blur: 24,
};
const DEFAULT_QUALITIES = {
  small: 68,
  medium: 74,
  blur: 42,
};

export const normalizeStoredPath = (filePath) =>
  filePath?.replace(/\\/g, "/") || null;

const ensureDirectory = async (relativeDir) => {
  await fs.mkdir(path.resolve(relativeDir), { recursive: true });
};

const assertManagedOutputPath = (filePath) => {
  const normalizedPath = normalizeStoredPath(filePath);
  const absolutePath = path.resolve(normalizedPath || "");

  if (!normalizedPath || !absolutePath.startsWith(OUTPUTS_ROOT)) {
    throw new Error("Image path must be inside outputs/");
  }

  return { normalizedPath, absolutePath };
};

const sanitizeBaseName = (value) =>
  String(value || "image")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || `image-${Date.now()}`;

const buildVariantPath = (relativeDir, baseName, suffix) =>
  normalizeStoredPath(path.join(relativeDir, `${baseName}-${suffix}.webp`));

const buildVariantGroup = (relativeDir, baseName) => ({
  blur: buildVariantPath(relativeDir, baseName, "blur"),
  small: buildVariantPath(relativeDir, baseName, "sm"),
  medium: buildVariantPath(relativeDir, baseName, "md"),
});

export const optimizeUploadedImage = async (
  sourcePath,
  {
    outputDir,
    baseName,
    cleanupSource = false,
    widths = DEFAULT_WIDTHS,
    qualities = DEFAULT_QUALITIES,
  } = {}
) => {
  const { normalizedPath, absolutePath } = assertManagedOutputPath(sourcePath);
  const relativeDir =
    normalizeStoredPath(outputDir) || normalizeStoredPath(path.dirname(normalizedPath));
  const fileBaseName =
    sanitizeBaseName(baseName || path.basename(normalizedPath, path.extname(normalizedPath)));
  const variants = buildVariantGroup(relativeDir, fileBaseName);

  await ensureDirectory(relativeDir);

  await Promise.all([
    sharp(absolutePath)
      .rotate()
      .resize({
        width: widths.small,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: qualities.small, effort: 4 })
      .toFile(path.resolve(variants.small)),
    sharp(absolutePath)
      .rotate()
      .resize({
        width: widths.medium,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: qualities.medium, effort: 4 })
      .toFile(path.resolve(variants.medium)),
    sharp(absolutePath)
      .rotate()
      .resize({
        width: widths.blur,
        fit: "inside",
        withoutEnlargement: true,
      })
      .blur(6)
      .webp({ quality: qualities.blur, effort: 3 })
      .toFile(path.resolve(variants.blur)),
  ]);

  if (cleanupSource && !Object.values(variants).includes(normalizedPath)) {
    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return {
    url: variants.medium,
    variants,
  };
};

export const createReadymadeThumbnail = async (
  sourcePath,
  { outputDir, baseName, cleanupSource = false } = {}
) => {
  const optimized = await optimizeUploadedImage(sourcePath, {
    outputDir,
    baseName,
    cleanupSource,
  });
  return optimized.url;
};

export const deleteOptimizedImageSet = async (filePath) => {
  if (!filePath) return;

  const normalizedPath = normalizeStoredPath(filePath);
  const absolutePath = path.resolve(normalizedPath);

  if (!absolutePath.startsWith(OUTPUTS_ROOT)) {
    return;
  }

  const variantMatch = normalizedPath.match(/^(.*?)-(blur|sm|md)\.webp$/i);
  const pathsToDelete = variantMatch
    ? [
        `${variantMatch[1]}-blur.webp`,
        `${variantMatch[1]}-sm.webp`,
        `${variantMatch[1]}-md.webp`,
      ]
    : [normalizedPath];

  await Promise.all(
    [...new Set(pathsToDelete)].map(async (relativePath) => {
      try {
        await fs.unlink(path.resolve(relativePath));
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
    })
  );
};
