import express from 'express';
import addProduct from '../controllers/products.js';

const productrouter = express.Router();

productrouter.post('/', addProduct);

export default productrouter;