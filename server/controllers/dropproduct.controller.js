import Dropproduct from '../models/dropproduct.model.js';
import fs from 'fs';
import path from 'path';

const BASE_IMAGE_PATH = '/outputs/dropimages/';

export const createDropproduct = async (req, res) => {
  try {
    if (!req.files || req.files.length < 1) {
      return res.status(400).json({ message: 'At least 1 image is required' });
    }

    if (req.files.length > 6) {
      return res.status(400).json({ message: 'Maximum 6 images allowed' });
    }

    const images = req.files.map(
      (file) => BASE_IMAGE_PATH + file.filename
    );

    const product = await Dropproduct.create({
      ...req.body,
      images,
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateDropproduct = async (req, res) => {
  try {
    const product = await Dropproduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let images = product.images;

    if (req.files && req.files.length > 0) {
      product.images.forEach((img) => {
        const imagePath = path.join(
          process.cwd(),
          img.replace(/^\//, '')
        );
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      });

      images = req.files.map(
        (file) => BASE_IMAGE_PATH + file.filename
      );
    }

    const updatedProduct = await Dropproduct.findByIdAndUpdate(
      req.params.id,
      { ...req.body, images },
      { new: true }
    );

    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getAllDropproducts = async (req, res) => {
  try {
    const products = await Dropproduct.find().sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch products',
      error: error.message,
    });
  }
};

export const getDropproductById = async (req, res) => {
  try {
    const product = await Dropproduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Dropproduct not found' });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch product',
      error: error.message,
    });
  }
};

export const deleteDropproduct = async (req, res) => {
  try {
    const product = await Dropproduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Dropproduct not found' });
    }

    product.images.forEach((img) => {
      const imagePath = path.join(
        process.cwd(),
        img.replace(/^\//, '')
      );
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    });

    await product.deleteOne();

    res.status(200).json({
      message: 'Dropproduct deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to delete product',
      error: error.message,
    });
  }
};
