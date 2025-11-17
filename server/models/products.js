import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  mainCategory: {
    type: String,
    required: [true, 'Main category is required'],
    enum: {
      values: ['T-shirts', 'Hoodies', 'Sweat shirts', 'Shirts', 'Women\'s'],
      message: 'Please select a valid main category'
    }
  },
  subCategory: {
    type: String,
    required: [true, 'Sub category is required']
  },
  color: {
    type: String,
    required: [true, 'Color is required'],
    trim: true
  },
  sizes: [{
    size: {
      type: String,
      required: true,
      trim: true,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  totalQuantity: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  images: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Calculate total quantity before saving
productSchema.pre('save', function(next) {
  this.totalQuantity = this.sizes.reduce((total, size) => total + size.quantity, 0);
  next();
});

// Validate subcategory based on main category
productSchema.pre('save', function(next) {
  const validSubCategories = {
    'T-shirts': ['Round neck', 'Polo', 'Oversized'],
    'Hoodies': ['Basic', 'Zipped', 'Pullover'],
    'Sweat shirts': ['Basic', 'Premium', 'Designer'],
    'Shirts': ['Checked', 'Plain', 'Printed'],
    'Women\'s': ['Croptops', 'Round neck Tshirts', 'Oversized']
  };

  if (!validSubCategories[this.mainCategory].includes(this.subCategory)) {
    return next(new Error(`Invalid subcategory '${this.subCategory}' for main category '${this.mainCategory}'`));
  }
  next();
});

// Static method to get all categories and subcategories
productSchema.statics.getCategories = function() {
  return {
    'T-shirts': ['Round neck', 'Polo', 'Oversized'],
    'Hoodies': ['Basic', 'Zipped', 'Pullover'],
    'Sweat shirts': ['Basic', 'Premium', 'Designer'],
    'Shirts': ['Checked', 'Plain', 'Printed'],
    'Women\'s': ['Croptops', 'Round neck Tshirts', 'Oversized']
  };
};

// Static method to get all available sizes
productSchema.statics.getSizes = function() {
  return ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
};

export default mongoose.model('Product', productSchema);