// googleDriveConfig.js

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Create an OAuth2 client
const oauth2Client = new OAuth2Client(
  '777795975212-6l76be7sok31kpplakj0i7kitrfbfnio.apps.googleusercontent.com',
  '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',
  'http://localhost:5000/auth/callback' // Redirect URI
);

// Initialize Google Drive API client
const drive = google.drive({ version: 'v3', auth: oauth2Client });

export { oauth2Client, drive };
