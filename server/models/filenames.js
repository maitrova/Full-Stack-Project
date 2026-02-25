import mongoose from "mongoose";

const CompanyDocumentSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
  },

  filePath: {
    type: String,
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

});

export default mongoose.model("CompanyDocument", CompanyDocumentSchema);