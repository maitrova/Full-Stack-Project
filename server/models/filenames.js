import mongoose from "mongoose";

const CompanyDocumentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  filePath: {
    type: String,
    trim: true,
    default: null,
  },

  content: {
    type: String,
    default: "",
  },

  contentType: {
    type: String,
    enum: ["pdf", "html"],
    default: "html",
  },
}, {
  timestamps: true,
});

export default mongoose.model("CompanyDocument", CompanyDocumentSchema);
