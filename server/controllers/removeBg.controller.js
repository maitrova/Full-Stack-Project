import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

// In your removeBgController, add better error handling:
export const removeBgController = async (req, res) => {
  console.log("Remove BG request received");
  
  try {
    if (!req.file) {
      console.error("No file uploaded");
      return res.status(400).json({ error: "No image uploaded" });
    }

    const inputPath = req.file.path;
    const outputFileName = `${Date.now()}_transparent.png`;
    const outputPath = path.join(rootDir, "outputs", outputFileName);

    console.log("Processing file:", req.file.originalname);
    console.log("File size:", req.file.size, "bytes");

    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      console.error("Input file not found:", inputPath);
      return res.status(400).json({ error: "Uploaded file not found" });
    }

    // Ensure outputs directory exists
    const outputsDir = path.join(rootDir, "outputs");
    if (!fs.existsSync(outputsDir)) {
      console.log("Creating outputs directory");
      fs.mkdirSync(outputsDir, { recursive: true });
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(rootDir, "uploads");
    if (!fs.existsSync(uploadsDir)) {
      console.log("Creating uploads directory");
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const scriptPath = path.join(rootDir, "scripts", "remove_bg_cli.py");
    
    // Check if Python script exists
    if (!fs.existsSync(scriptPath)) {
      console.error("Python script not found:", scriptPath);
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
      return res.status(500).json({ error: "Background removal script not found" });
    }

    console.log("Input path:", inputPath);
    console.log("Output path:", outputPath);
    console.log("Script path:", scriptPath);

    // Use python3 explicitly and set timeout
    const python = spawn("python3", [scriptPath, inputPath, outputPath], {
      timeout: 300000 // 5 minutes timeout
    });

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (d) => (stdout += d.toString()));
    python.stderr.on("data", (d) => (stderr += d.toString()));

    python.on("error", (error) => {
      console.error("Failed to start Python process:", error);
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
      return res.status(500).json({
        error: "Failed to start background removal process",
        details: error.message,
      });
    });

    python.on("close", (code) => {
      console.log("Python process exited with code:", code);
      console.log("Python stdout:", stdout);
      console.log("Python stderr:", stderr);

      if (code !== 0) {
        // Clean up uploaded file
        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath);
        }
        return res.status(500).json({
          error: "Background removal failed",
          details: stderr || "Process exited with error",
        });
      }

      // Check if output file was created
      if (!fs.existsSync(outputPath)) {
        fs.unlinkSync(inputPath);
        return res.status(500).json({ error: "Output file was not created" });
      }

      // Clean up uploaded file
      fs.unlinkSync(inputPath);

      return res.json({
        success: true,
        outputUrl: `/outputs/${outputFileName}`,
      });
    });

  } catch (err) {
    // Clean up on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: err.message });
  }
};