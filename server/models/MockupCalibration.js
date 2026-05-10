import mongoose from "mongoose";

const ZoneBoundarySchema = new mongoose.Schema(
  {
    minX: { type: Number, required: true },
    minY: { type: Number, required: true },
    maxX: { type: Number, required: true },
    maxY: { type: Number, required: true },
  },
  { _id: false }
);

const ZoneMetaSchema = new mongoose.Schema(
  {
    label: { type: String, default: "" },
    maxW: { type: Number, default: 0 },
    maxH: { type: Number, default: 0 },
  },
  { _id: false }
);

const MockupCalibrationSchema = new mongoose.Schema(
  {
    // optionally store owner
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    productKey: { type: String, required: true },
    view: { type: String, enum: ["front", "back"], required: true },

    // identify mockup/mask pair
    mockupUrl: { type: String, default: "" },
    maskUrl: { type: String, default: "" },

    // payload (same structure you already use)
    zones: { type: Map, of: ZoneBoundarySchema, required: true },
    zoneOrder: { type: [String], default: [] },
    zoneMeta: { type: Map, of: ZoneMetaSchema, default: {} },

    updatedAtIso: { type: String, default: "" },
  },
  { timestamps: true }
);

// prevent duplicates; one calibration per unique key (per user if you want)
MockupCalibrationSchema.index(
  { user: 1, productKey: 1, view: 1, mockupUrl: 1, maskUrl: 1 },
  { unique: true }
);

export default mongoose.model("MockupCalibration", MockupCalibrationSchema);
