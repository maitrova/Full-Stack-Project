// server/controllers/recolor.controller.js
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "../..");

// Map products to their view images
const PRODUCT_IMAGES = {
  hoodie: {
    front: "3DHoodieblackfrontview.png",
    back: "3DHoodiewhitebackview.png",
    right: "3DHoodiewhiteRightsideview.png",
    left: "3DHoodiewhiteLeftsideview.png",
  },
  sweatshirt: {
    front: "3DSweatshitWhiteFrontview.png",
    back: "3DSweatshitWhitebackview.png",
    right: "3DSweatshitWhiteRightsideview.png",
    left: "3DSweatshitWhiteLeftsideview.png",
  },
};

const runPython = (imageName, color, intensity) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(rootDir, "scripts", "03_recolor_cli.py");

    const inputPath = path.join(rootDir, "assets", "input", imageName);
    const maskPath = path.join(rootDir, "assets", "masks", imageName);

    const baseName = imageName.replace(/\.png$/i, "");

    const shadowMapPath = path.join(
      rootDir,
      "assets",
      "maps",
      `${baseName}_shadow.png`
    );

    const specMapPath = path.join(
      rootDir,
      "assets",
      "maps",
      `${baseName}_spec.png`
    );

    const pyArgs = [
      scriptPath,
      inputPath,
      maskPath,
      shadowMapPath,
      specMapPath,
      color,
      String(intensity),
    ];

    console.log("Running Python:", ["python", ...pyArgs].join(" "));

    const python = spawn("python", pyArgs);

    let stdoutData = "";
    let stderrData = "";

    python.stdout.on("data", (data) => {
      stdoutData += data.toString();
      console.log("PY STDOUT:", data.toString());
    });

    python.stderr.on("data", (data) => {
      stderrData += data.toString();
      console.error("PY STDERR:", data.toString());
    });

    python.on("close", (code) => {
      if (code !== 0) {
        return res.status(500).json({
          error: "Python script failed",
          exitCode: code,
          details: stderrData,
        });
      }

      // base name like "3DHoodieblackfrontview"
      const baseName = path.basename(imageName, path.extname(imageName));

      // "0,170,0" -> "0-170-0"
      const safeColor = color.replace(/,/g, "-");

      // make sure intensity string matches what you pass to Python
      const safeIntensity = String(intensity); // "0.18"

      // this matches: 3DHoodieblackfrontview_0-170-0_0.18_gradient_bg.png
      const outputFileName = `${baseName}_${safeColor}_${safeIntensity}_gradient_bg.png`;

      const outputUrl = `/outputs/${outputFileName}`;

      resolve({
        outputUrl,
        stdout: stdoutData.trim()
      });
    });
  });
};

export const recolorController = async (req, res) => {
  try {
    const { productId, imageName, color, intensity } = req.body;

    console.log("Recolor request:", { productId, imageName, color, intensity });

    if (!color || intensity == null) {
      return res.status(400).json({
        error: "color & intensity are required",
      });
    }

    // Ensure outputs directory exists
    const outputsDir = path.join(rootDir, "outputs");
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true });
    }

    // ⭐ MULTI-VIEW MODE (all product images)
    if (productId) {
      const product = PRODUCT_IMAGES[productId];
      if (!product) {
        return res.status(400).json({ error: "Invalid productId" });
      }

      const outputMap = {};
      const errors = [];

      // Process each view sequentially
      const views = Object.keys(product);
      
      for (const view of views) {
        try {
          const imageName = product[view];
          console.log(`Processing ${view} view: ${imageName}`);
          
          const result = await runPython(imageName, color, intensity);
          outputMap[view] = result.outputUrl;
          console.log(`Successfully processed ${view} view`);
        } catch (err) {
          console.error(`Failed to process ${view} view:`, err);
          errors.push(`${view}: ${err.message}`);
        }
      }

      if (Object.keys(outputMap).length === 0) {
        return res.status(500).json({ 
          error: "All views failed", 
          details: errors 
        });
      }

      return res.json({
        success: true,
        mode: "allViews",
        outputMap,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // ⭐ SINGLE IMAGE MODE (old behavior - for backward compatibility)
    if (!imageName) {
      return res.status(400).json({
        error: "imageName OR productId required",
      });
    }

    const result = await runPython(imageName, color, intensity);

    return res.json({
      success: true,
      mode: "single",
      outputUrl: result.outputUrl,
      stdout: result.stdout,
    });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ 
      error: "Server crashed",
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};