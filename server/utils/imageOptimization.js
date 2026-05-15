import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, "..");
const OUTPUTS_ROOT = path.join(SERVER_ROOT, "outputs");
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

export const normalizeStoredPath = (filePath) => {
  if (!filePath) return null;

  const absolutePath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(SERVER_ROOT, String(filePath));
  const relativePath = path.relative(SERVER_ROOT, absolutePath).replace(/\\/g, "/");

  if (relativePath && !relativePath.startsWith("..")) {
    return relativePath;
  }

  return String(filePath).replace(/\\/g, "/");
};

const resolveStoredPath = (filePath) => {
  const normalizedPath = normalizeStoredPath(filePath);
  return {
    normalizedPath,
    absolutePath: path.resolve(SERVER_ROOT, normalizedPath || ""),
  };
};

const ensureDirectory = async (relativeDir) => {
  await fs.mkdir(path.resolve(SERVER_ROOT, normalizeStoredPath(relativeDir) || ""), {
    recursive: true,
  });
};

const assertManagedOutputPath = (filePath) => {
  const { normalizedPath, absolutePath } = resolveStoredPath(filePath);

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const unlinkWithRetry = async (
  absolutePath,
  { retries = 5, baseDelayMs = 120 } = {}
) => {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await fs.unlink(absolutePath);
      return;
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }

      const isRetryable = ["EBUSY", "EPERM", "EMFILE", "ENFILE"].includes(error.code);
      if (!isRetryable || attempt === retries) {
        throw error;
      }

      await sleep(baseDelayMs * (attempt + 1));
    }
  }
};

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
      .toFile(path.resolve(SERVER_ROOT, variants.small)),
    sharp(absolutePath)
      .rotate()
      .resize({
        width: widths.medium,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: qualities.medium, effort: 4 })
      .toFile(path.resolve(SERVER_ROOT, variants.medium)),
    sharp(absolutePath)
      .rotate()
      .resize({
        width: widths.blur,
        fit: "inside",
        withoutEnlargement: true,
      })
      .blur(6)
      .webp({ quality: qualities.blur, effort: 3 })
      .toFile(path.resolve(SERVER_ROOT, variants.blur)),
  ]);

  if (cleanupSource && !Object.values(variants).includes(normalizedPath)) {
    try {
      await unlinkWithRetry(absolutePath);
    } catch (error) {
      console.warn(
        `cleanupSource skipped for ${absolutePath}: ${error.code || error.message}`
      );
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
  const absolutePath = path.resolve(SERVER_ROOT, normalizedPath);

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
      await unlinkWithRetry(path.resolve(SERVER_ROOT, relativePath));
    })
  );
};
