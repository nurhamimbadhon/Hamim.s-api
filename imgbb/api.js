const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();
const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 32 * 1024 * 1024 // 32MB limit (ImgBB's max)
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, BMP, WebP) are allowed!'), false);
    }
  }
});

// 📤 ImgBB upload endpoint
router.post('/', upload.single('image'), async (req, res) => {
  let filePath = null;
  
  try {
    // Validate API key
    if (!process.env.IMGBB_API_KEY) {
      return res.status(500).json({ 
        success: false,
        error: 'ImgBB API key not configured' 
      });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No image file provided' 
      });
    }

    filePath = req.file.path;

    // Verify file exists and is readable
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ 
        success: false,
        error: 'Uploaded file not found' 
      });
    }

    // Create form data for ImgBB API
    const formData = new FormData();
    formData.append('image', fs.createReadStream(filePath));

    // Add optional parameters if provided
    if (req.body.name) {
      formData.append('name', req.body.name);
    }
    if (req.body.expiration) {
      formData.append('expiration', req.body.expiration);
    }

    // Upload to ImgBB
    const response = await axios.post(
      `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
      formData,
      { 
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // Check if upload was successful
    if (response.data && response.data.success) {
      res.json({
        success: true,
        result: response.data.data.url,
        data: {
          id: response.data.data.id,
          title: response.data.data.title,
          url_viewer: response.data.data.url_viewer,
          url: response.data.data.url,
          display_url: response.data.data.display_url,
          size: response.data.data.size,
          time: response.data.data.time,
          expiration: response.data.data.expiration,
          image: {
            filename: response.data.data.image.filename,
            name: response.data.data.image.name,
            mime: response.data.data.image.mime,
            extension: response.data.data.image.extension,
            url: response.data.data.image.url
          },
          thumb: response.data.data.thumb,
          medium: response.data.data.medium,
          delete_url: response.data.data.delete_url
        }
      });
    } else {
      throw new Error('ImgBB API returned unsuccessful response');
    }

  } catch (error) {
    console.error('ImgBB upload error:', error.message);
    
    // Handle specific error types
    let errorMessage = 'Failed to upload image to ImgBB';
    let statusCode = 500;

    if (error.response) {
      // ImgBB API error
      statusCode = error.response.status;
      if (error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error.message || errorMessage;
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Upload timeout - please try again';
    } else if (error.message.includes('ENOENT')) {
      errorMessage = 'File not found or corrupted';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });

  } finally {
    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError.message);
      }
    }
  }
});

// 📋 Get upload info endpoint (optional)
router.get('/info', (req, res) => {
  res.json({
    service: 'ImgBB Image Upload',
    maxFileSize: '32MB',
    supportedFormats: ['JPEG', 'PNG', 'GIF', 'BMP', 'WebP'],
    endpoint: 'POST /',
    parameters: {
      required: ['image (file)'],
      optional: ['name (string)', 'expiration (seconds)']
    }
  });
});

module.exports = router;
