const multer = require("multer");
const fs = require("fs");
const path = require("path");
const editImage = require("./api");

// Configure multer for file uploads with memory storage (no local files)
const upload = multer({ 
  storage: multer.memoryStorage(), // Store in memory instead of disk
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed! Supported formats: JPG, PNG, WEBP, GIF'), false);
    }
  }
});

module.exports = function (app, routePath) {
  // Main image editing endpoint
  app.post(routePath, upload.single("image"), async (req, res) => {
    try {
      // Validate required fields
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: "No image file provided. Please upload an image file." 
        });
      }
      
      if (!req.body.prompt || req.body.prompt.trim() === '') {
        return res.status(400).json({ 
          success: false,
          error: "No prompt provided. Please provide a description of how you want to edit the image." 
        });
      }

      const prompt = req.body.prompt.trim();
      const imageBuffer = req.file.buffer;
      
      console.log("Processing image editing request...");
      console.log("Image size:", Math.round(imageBuffer.length / 1024), "KB");
      console.log("Image type:", req.file.mimetype);
      console.log("Prompt:", prompt);

      // Convert buffer to base64 data URL for Replicate
      const base64Image = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;

      // Process image with Replicate API
      const result = await editImage(base64Image, prompt);
      console.log("Image editing completed successfully");
      
      // Handle different response formats from Replicate
      let imageUrls = [];
      if (Array.isArray(result)) {
        imageUrls = result.filter(url => url && typeof url === 'string');
      } else if (typeof result === 'string') {
        imageUrls = [result];
      } else if (result && result.output) {
        if (Array.isArray(result.output)) {
          imageUrls = result.output.filter(url => url && typeof url === 'string');
        } else if (typeof result.output === 'string') {
          imageUrls = [result.output];
        }
      }

      if (imageUrls.length === 0) {
        throw new Error("No valid image was generated. Please try again with a different prompt.");
      }
      
      res.json({ 
        success: true,
        results: imageUrls,
        count: imageUrls.length,
        message: "Image edited successfully!",
        originalPrompt: prompt
      });

    } catch (err) {
      console.error("Error processing image:", err);
      
      // Provide more specific error messages
      let errorMessage = "Failed to process image";
      if (err.message.includes('rate limit')) {
        errorMessage = "API rate limit exceeded. Please try again in a few moments.";
      } else if (err.message.includes('insufficient credits')) {
        errorMessage = "Insufficient API credits. Please check your Replicate account.";
      } else if (err.message.includes('timeout')) {
        errorMessage = "Request timeout. The image might be too large or complex.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      const statusCode = err.status || 500;
      res.status(statusCode).json({ 
        success: false,
        error: errorMessage,
        code: err.code || 'PROCESSING_ERROR'
      });
    }
  });

  // Batch processing endpoint (multiple images)
  app.post(routePath + "/batch", upload.array("images", 5), async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: "No image files provided" 
        });
      }
      
      if (!req.body.prompt || req.body.prompt.trim() === '') {
        return res.status(400).json({ 
          success: false,
          error: "No prompt provided" 
        });
      }

      const prompt = req.body.prompt.trim();
      const results = [];
      const errors = [];

      console.log(`Processing ${req.files.length} images in batch...`);

      // Process each image
      for (let i = 0; i < req.files.length; i++) {
        try {
          const file = req.files[i];
          const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
          
          const result = await editImage(base64Image, prompt);
          
          let imageUrls = [];
          if (Array.isArray(result)) {
            imageUrls = result.filter(url => url && typeof url === 'string');
          } else if (typeof result === 'string') {
            imageUrls = [result];
          }
          
          results.push({
            index: i,
            success: true,
            results: imageUrls,
            originalFilename: file.originalname
          });
          
        } catch (error) {
          errors.push({
            index: i,
            error: error.message,
            originalFilename: req.files[i].originalname
          });
        }
      }

      res.json({
        success: true,
        totalProcessed: req.files.length,
        successCount: results.length,
        errorCount: errors.length,
        results: results,
        errors: errors.length > 0 ? errors : undefined,
        prompt: prompt
      });

    } catch (err) {
      console.error("Error in batch processing:", err);
      res.status(500).json({ 
        success: false,
        error: err.message || "Failed to process batch request"
      });
    }
  });

  // Health check endpoint
  app.get(routePath + "/health", (req, res) => {
    res.json({ 
      status: "OK", 
      service: "Image Editing API",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });
  });

  // API information endpoint
  app.get(routePath + "/info", (req, res) => {
    res.json({
      service: "AI Image Editing API",
      description: "Edit images using AI with natural language prompts in any language",
      endpoints: {
        "POST /": "Edit a single image",
        "POST /batch": "Edit multiple images (max 5)",
        "GET /health": "Health check",
        "GET /info": "API information"
      },
      supportedFormats: ["JPG", "JPEG", "PNG", "WEBP", "GIF"],
      maxFileSize: "10MB",
      maxBatchSize: 5,
      features: [
        "Multi-language prompt support",
        "Batch processing",
        "High-quality AI image editing",
        "Multiple output formats"
      ]
    });
  });
};
