
import Product from "../models/products.js"; // Fixed import - singular Product

const addProduct = async (req, res) => {
  try {
    const {
      name,
      mainCategory,
      subCategory,
      color,
      sizes,
      description,
      price,
      images
    } = req.body;
    
    console.log('Add Product Request Body:', req.body);
    
    // Validate required fields
    if (!name || !mainCategory || !subCategory || !color || !sizes || !price) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, mainCategory, subCategory, color, sizes, price'
      });
    }

    // Validate main category
    const validCategories = Product.getCategories(); // Fixed: Product instead of products
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
    if (!Array.isArray(sizes) || sizes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sizes must be a non-empty array'
      });
    }

    // Validate each size object
    const validSizes = Product.getSizes(); // Fixed: Product instead of products
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

    // Create new product
    const product = new Product({ // Fixed: Product instead of products
      name,
      mainCategory,
      subCategory,
      color,
      sizes,
      description: description || '',
      price,
      images: images || []
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

export default addProduct;