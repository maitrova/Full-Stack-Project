// routes/callbackRoutes.js
import express from 'express';
import { oauth2Client } from '../config/googleDriveConfig.js';

const callbackrouter = express.Router();

callbackrouter.get('/callback', async (req, res) => {
  const { code } = req.query; // The authorization code from Google
  console.log('Full callback URL:', req.url);  // Log the full callback URL
  console.log('Authorization code received:', code);  // Log the received code

  if (!code) {
    return res.status(400).send('Error: No authorization code received.');
  }

  try {
    // Exchange the authorization code for access and refresh tokens
    const { tokens } = await oauth2Client.getToken(code); // Fetch tokens using the authorization code
    oauth2Client.setCredentials(tokens);  // Set the credentials (access token and refresh token)

    // Log the acquired tokens
    console.log('Tokens acquired:', oauth2Client.credentials);

    // Redirect to another route and pass the token via URL
    const accessToken = tokens.access_token;
    const apiUrl = process.env.API_URL || "https://maitrova.in/backend";
    const redirectUrl = `${apiUrl}/api/drive/files?access_token=${accessToken}`;

    res.redirect(redirectUrl);  // Redirect with the token in the URL
  } catch (error) {
    console.error('Error during OAuth callback:', error);
    res.status(500).send('Error during OAuth callback');
  }
});

export default callbackrouter;
