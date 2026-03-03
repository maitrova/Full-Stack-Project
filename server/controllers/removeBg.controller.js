import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

const cleanupFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("Failed to clean up file:", filePath, err.message);
    }
  }
};

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

    const configuredPython = process.env.PYTHON_EXECUTABLE?.trim();
    const pythonCandidates = configuredPython
      ? [configuredPython]
      : process.platform === "win32"
      ? ["py", "python"]
      : ["python3", "python"];

    let python = null;
    let resolvedCommand = "";

    for (const cmd of pythonCandidates) {
      python = spawn(cmd, [scriptPath, inputPath, outputPath]);
      if (!python.pid) {
        continue;
      }
      resolvedCommand = cmd;
      break;
    }

    if (!python || !resolvedCommand) {
      cleanupFile(inputPath);
      return res.status(500).json({
        error: "Background removal failed",
        details: "Unable to start Python process",
      });
    }

    let stdout = "";
    let stderr = "";
    let didRespond = false;

    python.on("error", (spawnErr) => {
      if (didRespond) return;
      didRespond = true;
      cleanupFile(inputPath);
      cleanupFile(outputPath);
      return res.status(500).json({
        error: "Background removal failed",
        details: `Python spawn failed (${resolvedCommand}): ${spawnErr.message}`,
      });
    });

    python.stdout.on("data", (d) => (stdout += d.toString()));
    python.stderr.on("data", (d) => (stderr += d.toString()));

    python.on("close", (code) => {
      if (didRespond) return;
      didRespond = true;

      console.log("Python process exited with code:", code);
      console.log("Python command:", resolvedCommand);
      console.log("Python stdout:", stdout);
      console.log("Python stderr:", stderr);

      if (code !== 0) {
        cleanupFile(inputPath);
        cleanupFile(outputPath);
        return res.status(500).json({
          error: "Background removal failed",
          details: stderr,
        });
      }

      // Check if output file was created
      if (!fs.existsSync(outputPath)) {
        cleanupFile(inputPath);
        return res.status(500).json({ error: "Output file was not created" });
      }

      // Clean up uploaded file
      cleanupFile(inputPath);

      return res.json({
        success: true,
        outputUrl: `/outputs/${outputFileName}`,
      });
    });

  } catch (err) {
    // Clean up on error
    cleanupFile(req.file?.path);
    return res.status(500).json({ error: err.message });
  }
};
