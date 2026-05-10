import Product from "../models/Product.js";
import multer from 'multer';
import path from 'path';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Create this folder in your project
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Updated addProduct controller with file handling
export const addProduct = async (req, res) => {
  try {
    const {
      name,
      mainCategory,
      subCategory,
      color,
      sizes,
      description,
      price
    } = req.body;

    console.log('Add Product Request Body:', req.body);
    console.log('Uploaded files:', req.files);

    // Validate required fields
    if (!name || !mainCategory || !subCategory || !color || !sizes || !price) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, mainCategory, subCategory, color, sizes, price'
      });
    }

    // Parse sizes if it's a string (from form-data)
    let parsedSizes;
    try {
      parsedSizes = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sizes format. Please provide a valid JSON array for sizes.'
      });
    }

    // Validate main category
    const validCategories = Product.getCategories();
    if (!validCategories[mainCategory]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid main category. Please select from available categories.',
        availableCategories: Object.keys(validCategories)
      });
    }

    // Validate sub category
    if (!validCategories[mainCategory].includes(subCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid subcategory '${subCategory}' for main category '${mainCategory}'.`,
        availableSubCategories: validCategories[mainCategory]
      });
    }

    // Validate sizes array
    if (!Array.isArray(parsedSizes) || parsedSizes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sizes must be a non-empty array'
      });
    }

    // Validate each size object
    const validSizes = Product.getSizes();
    for (let size of parsedSizes) {
      if (!size.size || size.quantity === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Each size must have both size and quantity fields'
        });
      }
      if (size.quantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantity cannot be negative'
        });
      }
      if (!validSizes.includes(size.size)) {
        return res.status(400).json({
          success: false,
          message: `Invalid size '${size.size}'. Available sizes: ${validSizes.join(', ')}`
        });
      }
    }

    // Handle uploaded files
    const imagePaths = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        imagePaths.push(file.filename); // Store only filename, adjust path as needed
      });
    }

    // Create new product
    const product = new Product({
      name,
      mainCategory,
      subCategory,
      color,
      sizes: parsedSizes,
      description: description || '',
      price: parseFloat(price),
      images: imagePaths
    });

    const savedProduct = await product.save();

    res.status(201).json({
      success: true,
      message: 'Product added successfully',
      data: savedProduct
    });

  } catch (error) {
    console.error('Add product error:', error);
    
    if (error.message.includes('Invalid subcategory')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while adding product',
      error: error.message
    });
  }
};



// get all products 


// Get all products with optional filtering by mainCategory and subCategory
export const getProducts = async (req, res) => {
  try {
    const { mainCategory, subCategory, page = 1, limit = 10, search } = req.query;
    
    // Build filter object
    let filter = { isActive: true };
    
    if (mainCategory) {
      filter.mainCategory = mainCategory;
    }
    
    if (subCategory) {
      filter.subCategory = subCategory;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { color: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get products with pagination
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);
   
    res.status(200).json({
      success: true,
      message: 'Products retrieved successfully',
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalProducts,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving products',
      error: error.message
    });
  }
};

// main category list


// Get products by main category
export const getProductsByMainCategory = async (req, res) => {
  try {
    const { mainCategory } = req.params;
    const { page = 1, limit = 12 } = req.query;
    
    // Validate main category
    const validCategories = Product.getCategories();
    if (!validCategories[mainCategory]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid main category',
        availableCategories: Object.keys(validCategories)
      });
    }
    
    // Build filter
    const filter = { 
      mainCategory, 
      isActive: true 
    };
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get products
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);
    
    // Get subcategories available for this main category
    const availableSubCategories = validCategories[mainCategory];
    
    res.status(200).json({
      success: true,
      message: `Products in ${mainCategory} category retrieved successfully`,
      data: {
        mainCategory,
        availableSubCategories,
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalProducts,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get products by main category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving products',
      error: error.message
    });
  }
};

// get products by subcategory


export const getProductsBySubCategory = async (req, res) => {
  try {
    const { mainCategory, subCategory } = req.params;
    const { page = 1, limit = 12 } = req.query;
    
    // Validate main category
    const validCategories = Product.getCategories();
    if (!validCategories[mainCategory]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid main category',
        availableCategories: Object.keys(validCategories)
      });
    }
    
    // Validate sub category
    if (!validCategories[mainCategory].includes(subCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid subcategory '${subCategory}' for main category '${mainCategory}'`,
        availableSubCategories: validCategories[mainCategory]
      });
    }
    
    // Build filter
    const filter = { 
      mainCategory, 
      subCategory,
      isActive: true 
    };
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get products
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);
    
    res.status(200).json({
      success: true,
      message: `Products in ${mainCategory} > ${subCategory} retrieved successfully`,
      data: {
        mainCategory,
        subCategory,
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalProducts,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get products by sub category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving products',
      error: error.message
    });
  }
};

//  get product by id


export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findOne({ _id: id, isActive: true });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Product retrieved successfully',
      data: product
    });

  } catch (error) {
    console.error('Get product by ID error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving product',
      error: error.message
    });
  }
};


// Update product by ID
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      mainCategory,
      subCategory,
      color,
      sizes,
      description,
      price,
      isActive
    } = req.body;

    console.log('Update Product Request Body:', req.body);
    console.log('Product ID:', id);

    // Find product first
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Build update object
    const updateFields = {};
    
    if (name !== undefined) updateFields.name = name;
    if (mainCategory !== undefined) updateFields.mainCategory = mainCategory;
    if (subCategory !== undefined) updateFields.subCategory = subCategory;
    if (color !== undefined) updateFields.color = color;
    if (description !== undefined) updateFields.description = description;
    if (price !== undefined) updateFields.price = price;
    if (isActive !== undefined) updateFields.isActive = isActive;

    // Handle sizes update
    if (sizes !== undefined) {
      if (!Array.isArray(sizes) || sizes.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Sizes must be a non-empty array'
        });
      }

      // Validate each size object
      const validSizes = Product.getSizes();
      for (let size of sizes) {
        if (!size.size || size.quantity === undefined) {
          return res.status(400).json({
            success: false,
            message: 'Each size must have both size and quantity fields'
          });
        }
        if (size.quantity < 0) {
          return res.status(400).json({
            success: false,
            message: 'Quantity cannot be negative'
          });
        }
        if (!validSizes.includes(size.size)) {
          return res.status(400).json({
            success: false,
            message: `Invalid size '${size.size}'. Available sizes: ${validSizes.join(', ')}`
          });
        }
      }
      
      updateFields.sizes = sizes;
    }

    // Handle images update if files are uploaded
    if (req.files && req.files.length > 0) {
      const imagePaths = req.files.map(file => file.filename);
      updateFields.images = imagePaths;
    }

    // Validate main category if being updated
    if (mainCategory !== undefined) {
      const validCategories = Product.getCategories();
      if (!validCategories[mainCategory]) {
        return res.status(400).json({
          success: false,
          message: 'Invalid main category. Please select from available categories.',
          availableCategories: Object.keys(validCategories)
        });
      }
    }

    // Validate sub category if being updated
    if (subCategory !== undefined && mainCategory !== undefined) {
      const validCategories = Product.getCategories();
      if (!validCategories[mainCategory].includes(subCategory)) {
        return res.status(400).json({
          success: false,
          message: `Invalid subcategory '${subCategory}' for main category '${mainCategory}'.`,
          availableSubCategories: validCategories[mainCategory]
        });
      }
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updateFields,
      { 
        new: true, // Return updated document
        runValidators: true // Run model validators
      }
    );

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });

  } catch (error) {
    console.error('Update product error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating product',
      error: error.message
    });
  }
};



// Delete product by ID (delete)
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Delete Product ID:', id);

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: {
        deletedProduct: {
          id: product._id,
          name: product.name,
          mainCategory: product.mainCategory
        }
      }
    });

  } catch (error) {
    console.error('Delete product error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while deleting product',
      error: error.message
    });
  }
};

