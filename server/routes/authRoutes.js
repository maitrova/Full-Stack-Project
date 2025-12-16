// routes/authRoutes.js
import express from 'express';
import { oauth2Client } from '../config/googleDriveConfig.js';

const driverouter = express.Router();

// Step 1: Redirect to Google OAuth consent screen
driverouter.get('/api/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Offline access to get a refresh token
    scope: ['https://www.googleapis.com/auth/drive.file'], // Scopes for Google Drive
  });

  res.redirect(authUrl);
});

export default driverouter;
