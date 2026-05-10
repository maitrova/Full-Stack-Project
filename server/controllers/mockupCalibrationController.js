import MockupCalibration from "../models/MockupCalibration.js";

function normalizeStr(v) {
  return (v || "").toString().trim();
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return "Invalid payload";
  if (!payload.view) return "view is required";
  if (!payload.zones || typeof payload.zones !== "object") return "zones is required";

  // basic boundary validation
  for (const [k, b] of Object.entries(payload.zones)) {
    if (!b) return `zones.${k} is invalid`;
    const nums = ["minX", "minY", "maxX", "maxY"].map((p) => b[p]);
    if (nums.some((n) => typeof n !== "number" || Number.isNaN(n))) {
      return `zones.${k} boundary must be numbers`;
    }
  }
  return null;
}

// GET /api/mockup-calibrations?productKey=hoodie_basic&view=front&mockupUrl=...&maskUrl=...
export const getMockupCalibration = async (req, res) => {
  try {
    const userId = req.user?._id || null; // if auth present
    const productKey = normalizeStr(req.query.productKey);
    const view = normalizeStr(req.query.view);
    const mockupUrl = normalizeStr(req.query.mockupUrl);
    const maskUrl = normalizeStr(req.query.maskUrl);

    if (!productKey || !view) {
      return res.status(400).json({ success: false, message: "productKey and view are required" });
    }

    const doc = await MockupCalibration.findOne({
      user: userId,
      productKey,
      view,
      mockupUrl,
      maskUrl,
    }).lean();

    return res.json({ success: true, data: doc || null });
  } catch (err) {
    console.error("getMockupCalibration error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/mockup-calibrations
export const upsertMockupCalibration = async (req, res) => {
  try {
    const userId = req.user?._id || null; // if auth present

    const productKey = normalizeStr(req.body.productKey);
    const view = normalizeStr(req.body.view);
    const mockupUrl = normalizeStr(req.body.mockupUrl);
    const maskUrl = normalizeStr(req.body.maskUrl);
    const payload = req.body.payload;

    if (!productKey || !view) {
      return res.status(400).json({ success: false, message: "productKey and view are required" });
    }

    const error = validatePayload(payload);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const update = {
      user: userId,
      productKey,
      view,
      mockupUrl,
      maskUrl,
      zones: payload.zones,
      zoneOrder: payload.zoneOrder || [],
      zoneMeta: payload.zoneMeta || {},
      updatedAtIso: payload.updatedAt || new Date().toISOString(),
    };

    const doc = await MockupCalibration.findOneAndUpdate(
      { user: userId, productKey, view, mockupUrl, maskUrl },
      { $set: update },
      { new: true, upsert: true }
    ).lean();

    return res.json({ success: true, data: doc });
  } catch (err) {
    console.error("upsertMockupCalibration error:", err);
    // duplicate index edge case
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "Calibration already exists (conflict)" });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
