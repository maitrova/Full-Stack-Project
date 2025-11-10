import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'T-shirt recolor service is running',
        timestamp: new Date().toISOString()
    });
});

// T-shirt recolor endpoint for preview
app.post('/api/recolor-tshirt-preview', (req, res) => {
    handleRecolorRequest(req, res, false);
});

// T-shirt recolor endpoint for saving
app.post('/api/recolor-tshirt-save', (req, res) => {
    handleRecolorRequest(req, res, true);
});

function handleRecolorRequest(req, res, saveFile) {
    console.log('=== PROCESSING RECOLOR REQUEST ===');
    
    const { imageUrl, color } = req.body;

    // Validate input
    if (!imageUrl || !color) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: imageUrl and color'
        });
    }

    // Validate color format
    let colorString;
    if (Array.isArray(color) && color.length === 3) {
        colorString = color.join(',');
    } else if (typeof color === 'object' && color.r !== undefined && color.g !== undefined && color.b !== undefined) {
        colorString = `${color.r},${color.g},${color.b}`;
    } else {
        return res.status(400).json({
            success: false,
            error: 'Invalid color format. Expected {r, g, b} or [r, g, b]'
        });
    }

    console.log('Action:', saveFile ? 'SAVING' : 'PREVIEW');
    console.log('Image URL:', imageUrl);
    console.log('Color:', colorString);

    // Get Python script path
    const pythonScriptPath = path.join(__dirname, 'recolor_tshirt.py');
    console.log('Python script path:', pythonScriptPath);

    // Check if Python script exists
    if (!fs.existsSync(pythonScriptPath)) {
        console.error('❌ Python script not found');
        return res.status(500).json({
            success: false,
            error: 'Image processing service not available'
        });
    }

    console.log('✅ Python script found, starting process...');

    // Spawn Python process
    const pythonProcess = spawn('python', [
        pythonScriptPath,
        imageUrl,
        colorString,
        'tshirt_recolor_output',
        saveFile.toString()
    ]);

    let resultData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        resultData += output;
        console.log('Python output:', output);
    });

    pythonProcess.stderr.on('data', (data) => {
        const error = data.toString();
        errorData += error;
        console.error('Python error:', error);
    });

    pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code: ${code}`);
        
        try {
            const cleanData = resultData.trim();
            
            if (!cleanData) {
                throw new Error('No output from Python script');
            }

            const result = JSON.parse(cleanData);
            console.log('✅ Successfully processed request');
            res.json(result);
            
        } catch (parseError) {
            console.error('❌ Failed to parse response:', parseError.message);
            
            res.status(500).json({
                success: false,
                error: 'Image processing failed',
                details: parseError.message,
                pythonError: errorData
            });
        }
    });

    pythonProcess.on('error', (error) => {
        console.error('❌ Failed to start Python:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start image processing',
            details: error.message
        });
    });
}

// 404 handler - FIXED: Use proper route pattern
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('💥 Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 ==================================');
    console.log('✅ Server running on http://localhost:' + PORT);
    console.log('📁 Directory:', __dirname);
    
    // Check Python script
    const pythonScriptPath = path.join(__dirname, 'recolor_tshirt.py');
    if (fs.existsSync(pythonScriptPath)) {
        console.log('✅ Python script found');
    } else {
        console.log('❌ Python script missing');
    }
    console.log('🚀 ==================================');
});