const express = require('express');
const multer = require('multer');
const editImage = require('./api');

// Create a router instance instead of using app directly
const router = express.Router();

// Multer configuration
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Image edit endpoint
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    if (!req.body.prompt) {
      return res.status(400).json({ error: 'No prompt provided' });
    }

    const imageBuffer = req.file.buffer;
    const base64Image = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;
    
    const result = await editImage(base64Image, req.body.prompt);
    
    res.json({ 
      success: true,
      result: result 
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Export the router to be used by the main app
module.exports = (app, routePath) => {
  app.use(routePath, router);
  console.log(`✅ picedit API mounted at ${routePath}`);
};
