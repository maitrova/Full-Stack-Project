import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

// In your removeBgController, add better error handling:
export const removeBgController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const inputPath = req.file.path;
    const outputFileName = `${Date.now()}_transparent.png`;
    const outputPath = path.join(rootDir, "outputs", outputFileName);

    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      return res.status(400).json({ error: "Uploaded file not found" });
    }

    // Ensure outputs directory exists
    const outputsDir = path.join(rootDir, "outputs");
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true });
    }

    const scriptPath = path.join(rootDir, "scripts", "remove_bg_cli.py");

    console.log("Input path:", inputPath);
    console.log("Output path:", outputPath);
    console.log("Script path:", scriptPath);

    // Use virtual environment Python
    const pythonPath = path.join(rootDir, "venv", "bin", "python3");
    const python = spawn(pythonPath, [scriptPath, inputPath, outputPath]);

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (d) => (stdout += d.toString()));
    python.stderr.on("data", (d) => (stderr += d.toString()));

    python.on("close", (code) => {
      console.log("Python process exited with code:", code);
      console.log("Python stdout:", stdout);
      console.log("Python stderr:", stderr);

      if (code !== 0) {
        // Clean up uploaded file
        fs.unlinkSync(inputPath);
        return res.status(500).json({
          error: "Background removal failed",
          details: stderr,
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