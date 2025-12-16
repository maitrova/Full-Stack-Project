// controllers/driveController.js
import fs from 'fs'; // For reading file
import path from 'path'; // For file path resolution
import { drive, oauth2Client } from '../config/googleDriveConfig.js';

export const uploadImage = async (req, res) => {
  const filePath = path.join(__dirname, 'path_to_your_file', 'file_name.jpg');
  const fileMetadata = {
    name: 'custom-tshirt-design.jpg', // Name of the uploaded file in Google Drive
    mimeType: 'image/jpeg', // Mime type of the image
  };

  const media = {
    mimeType: 'image/jpeg',
    body: fs.createReadStream(filePath), // The file you want to upload
  };

  try {
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id', // Fields to return (file ID in this case)
    });

    res.status(200).send(`File uploaded successfully! File ID: ${response.data.id}`);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send('Error uploading file to Google Drive');
  }
};

// controllers/driveController.js (updated error logging)
// controllers/driveController.js


export const listFiles = async (req, res) => {
  try {
    const { access_token } = req.query; // Get the access token from the URL query parameter
    console.log('Access token received:', access_token);

    if (!access_token) {
      return res.status(400).send('Error: No access token provided.');
    }

    // Set the credentials on oauth2Client with the provided access token
    oauth2Client.setCredentials({ access_token });

    // Ensure oauth2Client credentials are set before making any requests
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      throw new Error('No access token set');
    }

    // Make API request to list files
    const response = await drive.files.list({
      pageSize: 10,  // Adjust the number of files to list
       // Exclude folders
    });

    const files = response.data.files;
    if (files.length) {
      res.status(200).json({ files });
    } else {
      res.status(404).send('No files found.');
    }
  } catch (error) {
    console.error('Error fetching files from Google Drive:', error.message);
    res.status(500).send('Error fetching files from Google Drive');
  }
};

