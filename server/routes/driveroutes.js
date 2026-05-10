// routes/productRoutes.js
import express from 'express';
import { listFiles, uploadImage } from '../controllers/driveController.js';


const filesrouter = express.Router();

// Route to upload an image to Google Drive
filesrouter.post('/upload', uploadImage);
filesrouter.get('/files', listFiles);


export default filesrouter;
