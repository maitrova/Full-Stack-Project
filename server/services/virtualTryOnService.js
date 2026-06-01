import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, "..");
const OUTPUTS_ROOT = path.join(SERVER_ROOT, "outputs");
const TRY_ON_ROOT = path.join(OUTPUTS_ROOT, "virtual-tryon");
const DEFAULT_REPLICATE_IDM_VTON_VERSION =
  "0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985";
const DEFAULT_REPLICATE_IDM_VTON_REF = `cuuupid/idm-vton:${DEFAULT_REPLICATE_IDM_VTON_VERSION}`;
const CUSTOM_TRYON_OUTPUT_KEYS = ["previewImage", "image", "output", "url", "result"];

const ensureDirectory = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const slugify = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `asset-${Date.now()}`;

const toOutputUrl = (absolutePath) =>
  `/api/${path.relative(SERVER_ROOT, absolutePath).replace(/\\/g, "/")}`;

const isPrivateOrLocalHost = (host = "") => {
  const normalized = String(host || "").trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "0.0.0.0") {
    return true;
  }
  if (normalized === "::1") return true;
  if (/^192\.168\./.test(normalized)) return true;
  if (/^10\./.test(normalized)) return true;

  const match172 = normalized.match(/^172\.(\d{1,3})\./);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  return false;
};

const normalizeUsablePublicBaseUrl = (rawUrl = "") => {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    if (isPrivateOrLocalHost(parsed.hostname)) {
      return "";
    }
    return parsed.origin;
  } catch {
    return "";
  }
};

const toPublicAssetUrl = (assetUrl, publicBaseUrlOverride = "") => {
  if (!assetUrl) return "";
  if (String(assetUrl).startsWith("http")) {
    return assetUrl;
  }

  const publicBaseUrl = String(
    normalizeUsablePublicBaseUrl(process.env.PUBLIC_IMAGE_BASE_URL) ||
      normalizeUsablePublicBaseUrl(process.env.IMAGE_BASE_URL) ||
      normalizeUsablePublicBaseUrl(process.env.API_URL) ||
      normalizeUsablePublicBaseUrl(publicBaseUrlOverride) ||
      process.env.IMAGE_BASE_URL ||
      ""
  ).trim();

  if (!publicBaseUrl) {
    throw new Error(
      "PUBLIC_IMAGE_BASE_URL or API_URL must point to a public tunnel/domain, not localhost, for external try-on providers"
    );
  }

  return `${publicBaseUrl}${String(assetUrl).startsWith("/") ? "" : "/"}${assetUrl}`;
};

const getExtensionForMime = (mimeType = "", fallback = ".png") => {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("gif")) return ".gif";
  return fallback;
};

const writeAssetBuffer = async ({
  buffer,
  mimeType,
  originalName,
  targetDir,
  prefix,
}) => {
  await ensureDirectory(targetDir);
  const ext = getExtensionForMime(mimeType, path.extname(originalName || "") || ".png");
  const fileName = `${Date.now()}-${slugify(prefix)}${ext}`;
  const absolutePath = path.join(targetDir, fileName);
  await fs.writeFile(absolutePath, buffer);
  return {
    absolutePath,
    relativeUrl: toOutputUrl(absolutePath),
    fileName,
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveProvider = () => {
  const explicitProvider = String(process.env.TRYON_PROVIDER || "")
    .trim()
    .toLowerCase();

  if (explicitProvider) {
    return explicitProvider;
  }

  if (process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_TRYON_VERSION) {
    return "replicate";
  }

  if (process.env.HF_TRYON_ENDPOINT_URL && process.env.HF_API_TOKEN) {
    return "huggingface";
  }

  if (process.env.CUSTOM_TRYON_ENDPOINT_URL) {
    return "custom";
  }

  return "mock";
};

const pickOutputUrl = (output) => {
  if (!output) return null;
  if (typeof output === "string") return output;

  if (Array.isArray(output)) {
    return output.find((value) => typeof value === "string") || null;
  }

  if (typeof output === "object") {
    const preferredKeys = ["image", "output", "url", "result"];
    for (const key of preferredKeys) {
      if (typeof output[key] === "string") {
        return output[key];
      }
      if (Array.isArray(output[key])) {
        const nested = output[key].find((value) => typeof value === "string");
        if (nested) return nested;
      }
    }
  }

  return null;
};

const pickCustomOutputUrl = (payload) => {
  if (!payload || typeof payload !== "object") return null;

  for (const key of CUSTOM_TRYON_OUTPUT_KEYS) {
    if (typeof payload[key] === "string") {
      return payload[key];
    }

    if (Array.isArray(payload[key])) {
      const nested = payload[key].find((value) => typeof value === "string");
      if (nested) return nested;
    }
  }

  return null;
};

const buildTryOnPrompt = (metadata = {}) => {
  const productName = metadata?.productName || "custom T-shirt";
  const colorName = metadata?.productColorName || metadata?.productColor || "selected color";
  return `Generate a realistic virtual try-on of the provided person wearing the customized ${productName} in ${colorName}, preserving the face and natural body alignment.`;
};

const generateMockPreview = async ({
  userImagePath,
  garmentImagePath,
  outputBasename,
  metadata = {},
}) => {
  const resultsDir = path.join(TRY_ON_ROOT, "results");
  await ensureDirectory(resultsDir);

  const outputAbsolutePath = path.join(resultsDir, `${outputBasename}.png`);
  const canvasWidth = 1280;
  const canvasHeight = 1600;

  const userComposite = await sharp(userImagePath)
    .resize(960, 1180, { fit: "contain", background: "#f8fafc" })
    .png()
    .toBuffer();

  const garmentComposite = await sharp(garmentImagePath)
    .resize(320, 320, { fit: "contain", background: "#ffffff" })
    .png()
    .toBuffer();

  const productName = metadata?.productName || "Customized T-Shirt";
  const colorName = metadata?.productColorName || metadata?.productColor || "Selected color";

  const svgOverlay = `
    <svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#e0f2fe"/>
          <stop offset="100%" stop-color="#ffffff"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" rx="40" ry="40" />
      <rect x="42" y="42" width="${canvasWidth - 84}" height="${canvasHeight - 84}" rx="34" ry="34" fill="#ffffff" stroke="#dbeafe" stroke-width="2" />
      <text x="82" y="122" font-size="44" font-family="Arial, sans-serif" font-weight="700" fill="#0f172a">AI Try-On Preview</text>
      <text x="82" y="170" font-size="24" font-family="Arial, sans-serif" fill="#475569">${productName} • ${colorName}</text>
      <text x="82" y="${canvasHeight - 122}" font-size="24" font-family="Arial, sans-serif" fill="#b45309">Mock preview only. Configure Replicate or Hugging Face for realistic body fitting, folds, and lighting.</text>
      <rect x="880" y="210" width="340" height="340" rx="28" ry="28" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" />
      <text x="940" y="598" font-size="20" font-family="Arial, sans-serif" fill="#64748b">Garment reference</text>
    </svg>
  `;

  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: "#ffffff",
    },
  })
    .composite([
      { input: Buffer.from(svgOverlay), top: 0, left: 0 },
      { input: userComposite, top: 230, left: 120 },
      { input: garmentComposite, top: 220, left: 890 },
    ])
    .png()
    .toFile(outputAbsolutePath);

  return {
    provider: "mock",
    mode: "mock",
    previewImage: toOutputUrl(outputAbsolutePath),
    warning:
      "This is a local placeholder preview. Configure Replicate IDM-VTON credentials to enable realistic AI try-on generation.",
  };
};

const runReplicateTryOn = async ({ userImageUrl, garmentImageUrl, metadata = {} }) => {
  const token = String(process.env.REPLICATE_API_TOKEN || "").trim();
  const version = String(process.env.REPLICATE_TRYON_VERSION || "").trim();
  const modelRef = String(
    process.env.REPLICATE_TRYON_MODEL_REF ||
      (version ? `cuuupid/idm-vton:${version}` : DEFAULT_REPLICATE_IDM_VTON_REF)
  ).trim();

  if (!token) {
    throw new Error("Replicate try-on is not configured");
  }

  const personField = String(process.env.TRYON_PERSON_IMAGE_FIELD || "human_img").trim();
  const garmentField = String(process.env.TRYON_GARMENT_IMAGE_FIELD || "garm_img").trim();
  const garmentDescription = String(
    metadata?.garmentDescription ||
      metadata?.productName ||
      "Short Sleeve Round Neck T-shirt"
  ).trim();
  const category = String(
    process.env.REPLICATE_TRYON_CATEGORY || metadata?.garmentCategory || "upper_body"
  ).trim();
  const crop = String(process.env.REPLICATE_TRYON_CROP || "true").trim().toLowerCase() === "true";
  const forceDc =
    String(process.env.REPLICATE_TRYON_FORCE_DC || "false").trim().toLowerCase() === "true";
  const steps = Number(process.env.REPLICATE_TRYON_STEPS || 30);
  const seed = process.env.REPLICATE_TRYON_SEED
    ? Number(process.env.REPLICATE_TRYON_SEED)
    : undefined;

  const input = {
    [personField]: userImageUrl,
    [garmentField]: garmentImageUrl,
    garment_des: garmentDescription,
    category,
    crop,
    force_dc: forceDc,
    steps: Number.isFinite(steps) ? Math.min(Math.max(steps, 1), 40) : 30,
  };

  if (Number.isFinite(seed)) {
    input.seed = seed;
  }

  const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: modelRef,
      input,
    }),
  });

  const createPayload = await createResponse.json();
  if (!createResponse.ok) {
    const errorDetail =
      createPayload?.detail || createPayload?.error || "Failed to start Replicate try-on";

    if (String(errorDetail).includes("specified version does not exist")) {
      throw new Error(
        `Replicate rejected the configured model reference (${modelRef}). Check REPLICATE_API_TOKEN and REPLICATE_TRYON_MODEL_REF/REPLICATE_TRYON_VERSION.`
      );
    }

    throw new Error(errorDetail);
  }

  const predictionId = createPayload?.id;
  if (!predictionId) {
    throw new Error("Replicate prediction id missing");
  }

  const maxAttempts = Number(process.env.TRYON_POLL_ATTEMPTS || 60);
  const pollIntervalMs = Number(process.env.TRYON_POLL_INTERVAL_MS || 3000);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(pollIntervalMs);

    const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        Authorization: `Token ${token}`,
      },
    });
    const statusPayload = await statusResponse.json();

    if (!statusResponse.ok) {
      throw new Error(statusPayload?.detail || "Failed to poll Replicate prediction");
    }

    if (statusPayload?.status === "succeeded") {
      const outputUrl = pickOutputUrl(statusPayload?.output);
      if (!outputUrl) {
        throw new Error("Replicate finished without an output image");
      }

      return {
        provider: "replicate",
        mode: "ai",
        remoteOutputUrl: outputUrl,
        providerJobId: predictionId,
      };
    }

    if (statusPayload?.status === "failed" || statusPayload?.status === "canceled") {
      throw new Error(statusPayload?.error || `Replicate prediction ${statusPayload.status}`);
    }
  }

  throw new Error("Replicate try-on timed out");
};

const runHuggingFaceTryOn = async ({ userImageUrl, garmentImageUrl, metadata = {} }) => {
  const endpointUrl = String(process.env.HF_TRYON_ENDPOINT_URL || "").trim();
  const token = String(process.env.HF_API_TOKEN || "").trim();

  if (!endpointUrl || !token) {
    throw new Error("Hugging Face try-on is not configured");
  }

  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: {
        user_image_url: userImageUrl,
        garment_image_url: garmentImageUrl,
        metadata,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Hugging Face try-on request failed");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json();
    const remoteOutputUrl = pickOutputUrl(payload);
    if (!remoteOutputUrl) {
      throw new Error("Hugging Face response did not include an output image");
    }

    return {
      provider: "huggingface",
      mode: "ai",
      remoteOutputUrl,
      providerJobId: payload?.id || null,
    };
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    provider: "huggingface",
    mode: "ai",
    inlineBuffer: Buffer.from(arrayBuffer),
    providerJobId: null,
  };
};

const runCustomEndpointTryOn = async ({ userImageUrl, garmentImageUrl, metadata = {} }) => {
  const endpointUrl = String(process.env.CUSTOM_TRYON_ENDPOINT_URL || "").trim();
  const authToken = String(process.env.CUSTOM_TRYON_AUTH_TOKEN || "").trim();

  if (!endpointUrl) {
    throw new Error("Custom try-on endpoint is not configured");
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(endpointUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      userImageUrl,
      garmentImageUrl,
      metadata,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Custom try-on endpoint request failed");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json();
    const remoteOutputUrl = pickCustomOutputUrl(payload);
    if (!remoteOutputUrl) {
      throw new Error("Custom try-on endpoint response did not include an output image");
    }

    return {
      provider: "custom",
      mode: "ai",
      remoteOutputUrl,
      providerJobId: payload?.id || payload?.jobId || null,
    };
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    provider: "custom",
    mode: "ai",
    inlineBuffer: Buffer.from(arrayBuffer),
    providerJobId: null,
  };
};

const persistResultBuffer = async ({ buffer, basename, extension = ".png" }) => {
  const resultsDir = path.join(TRY_ON_ROOT, "results");
  await ensureDirectory(resultsDir);
  const absolutePath = path.join(resultsDir, `${basename}${extension}`);
  await fs.writeFile(absolutePath, buffer);
  return toOutputUrl(absolutePath);
};

const downloadRemoteResult = async ({ remoteOutputUrl, basename }) => {
  const response = await fetch(remoteOutputUrl);
  if (!response.ok) {
    throw new Error("Failed to download generated try-on image");
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "image/png";
  const extension = getExtensionForMime(contentType, ".png");

  return persistResultBuffer({
    buffer: Buffer.from(arrayBuffer),
    basename,
    extension,
  });
};

export const generateVirtualTryOnPreview = async ({
  userImageFile,
  garmentImageFile,
  metadata = {},
  publicBaseUrl = "",
}) => {
  const inputsUserDir = path.join(TRY_ON_ROOT, "inputs", "user");
  const inputsGarmentDir = path.join(TRY_ON_ROOT, "inputs", "garment");

  const savedUserImage = await writeAssetBuffer({
    buffer: userImageFile.buffer,
    mimeType: userImageFile.mimetype,
    originalName: userImageFile.originalname,
    targetDir: inputsUserDir,
    prefix: "user",
  });

  const savedGarmentImage = await writeAssetBuffer({
    buffer: garmentImageFile.buffer,
    mimeType: garmentImageFile.mimetype,
    originalName: garmentImageFile.originalname,
    targetDir: inputsGarmentDir,
    prefix: "garment",
  });

  const provider = resolveProvider();
  const outputBasename = `${Date.now()}-${slugify(metadata?.productSlug || metadata?.productName || "try-on")}`;

  let providerResult;
  if (provider === "replicate") {
    providerResult = await runReplicateTryOn({
      userImageUrl: toPublicAssetUrl(savedUserImage.relativeUrl, publicBaseUrl),
      garmentImageUrl: toPublicAssetUrl(savedGarmentImage.relativeUrl, publicBaseUrl),
      metadata,
    });
  } else if (provider === "huggingface") {
    providerResult = await runHuggingFaceTryOn({
      userImageUrl: toPublicAssetUrl(savedUserImage.relativeUrl, publicBaseUrl),
      garmentImageUrl: toPublicAssetUrl(savedGarmentImage.relativeUrl, publicBaseUrl),
      metadata,
    });
  } else if (provider === "custom") {
    providerResult = await runCustomEndpointTryOn({
      userImageUrl: toPublicAssetUrl(savedUserImage.relativeUrl, publicBaseUrl),
      garmentImageUrl: toPublicAssetUrl(savedGarmentImage.relativeUrl, publicBaseUrl),
      metadata,
    });
  } else {
    providerResult = await generateMockPreview({
      userImagePath: savedUserImage.absolutePath,
      garmentImagePath: savedGarmentImage.absolutePath,
      outputBasename,
      metadata,
    });
  }

  let previewImage = providerResult.previewImage || null;
  if (!previewImage && providerResult.remoteOutputUrl) {
    previewImage = await downloadRemoteResult({
      remoteOutputUrl: providerResult.remoteOutputUrl,
      basename: outputBasename,
    });
  } else if (!previewImage && providerResult.inlineBuffer) {
    previewImage = await persistResultBuffer({
      buffer: providerResult.inlineBuffer,
      basename: outputBasename,
    });
  }

  if (!previewImage) {
    throw new Error("Try-on provider returned no preview image");
  }

  return {
    status: "succeeded",
    provider: providerResult.provider || provider,
    mode: providerResult.mode || "ai",
    providerJobId: providerResult.providerJobId || null,
    previewImage,
    userImage: savedUserImage.relativeUrl,
    garmentImage: savedGarmentImage.relativeUrl,
    metadata,
    generatedAt: new Date().toISOString(),
    warning: providerResult.warning || null,
  };
};
