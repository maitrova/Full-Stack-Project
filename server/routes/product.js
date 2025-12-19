import express from 'express';
import { addProduct, deleteProduct, getProductById, getProducts, getProductsByMainCategory, getProductsBySubCategory, updateProduct, upload } from '../controllers/products.js';


const productrouter = express.Router();

// Use multer middleware for multiple file uploads (max 5 images)
productrouter.post('/add-product', upload.array('images', 5), addProduct);
productrouter.get('/', getProducts);

// Get products by main category
productrouter.get('/category/:mainCategory', getProductsByMainCategory);
// Get products by main category and sub category
productrouter.get('/category/:mainCategory/:subCategory', getProductsBySubCategory);

// Get single product by ID
productrouter.get('/:id', getProductById);

// Update product with optional file upload
productrouter.put('/update/:id', upload.array('images', 5), updateProduct);


productrouter.delete('/delete/:id', deleteProduct); 



export default productrouter;