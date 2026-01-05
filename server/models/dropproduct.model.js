import mongoose from 'mongoose';

const dropproductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    description: String,

    images: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => v.length >= 1 && v.length <= 6,
        message: 'Images must be between 1 and 6',
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Dropproduct', dropproductSchema);
