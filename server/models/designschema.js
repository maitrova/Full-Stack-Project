import mongoose from 'mongoose';

// Define the schema for the design model
const designSchema = new mongoose.Schema({
  // Reference to the user who created the design
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  // Reference to the product (e.g., T-shirt or hoodie) being customized
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  
  // List of color hex codes chosen for the design (e.g., shirt color, text color)
  colors: {
    type: [String], // Array of color hex codes chosen by the user
    required: true,
  },

  // Custom text added by the user to different parts of the product
  texts: [{
    content: {
      type: String,
      required: true,
    },
    position: {
      type: String, // e.g., 'front', 'back', 'sleeve_left', 'sleeve_right'
      required: true,
    },
    fontSize: {
      type: Number,
      required: true,
    },
    color: {
      type: String, // e.g., hex color code
      required: true,
    },
    alignment: {
      type: String, // e.g., 'left', 'center', 'right'
      required: true,
    },
  }],

  // Uploaded design images for different sections of the product
  images: {
    front: {
      filePath: {
        type: String, // Path to the uploaded front design image
        required: false,
      },
      size: {
        type: Number, // Size of the image (percentage or pixels)
        required: false,
      },
      transparency: {
        type: Boolean, // Whether the image has transparency
        required: false,
      },
    },
    back: {
      filePath: {
        type: String, // Path to the uploaded back design image
        required: false,
      },
      size: {
        type: Number,
        required: false,
      },
      transparency: {
        type: Boolean,
        required: false,
      },
    },
    sleeve_left: {
      filePath: {
        type: String, // Path to the uploaded left sleeve design image
        required: false,
      },
      size: {
        type: Number,
        required: false,
      },
      transparency: {
        type: Boolean,
        required: false,
      },
    },
    sleeve_right: {
      filePath: {
        type: String, // Path to the uploaded right sleeve design image
        required: false,
      },
      size: {
        type: Number,
        required: false,
      },
      transparency: {
        type: Boolean,
        required: false,
      },
    },
  },

  // The final product image with designs applied
  designPreview: {
    type: String, // URL to the final design image (full product with applied designs)
    required: true,
  },

}, { timestamps: true });

// Create and export the Design model
const Design = mongoose.model('Design', designSchema);

export default Design;
