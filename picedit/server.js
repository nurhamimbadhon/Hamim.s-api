const multer = require("multer");
const fs = require("fs");
const path = require("path");
const editImage = require("./api");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "..", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

module.exports = function (app, routePath) {
  app.post(routePath, upload.single("image"), async (req, res) => {
    try {
      // Validate required fields
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }
      
      if (!req.body.prompt) {
        return res.status(400).json({ error: "No prompt provided" });
      }

      const prompt = req.body.prompt;
      const imagePath = req.file.path;

      // For deployment, you'll need to upload to a proper image hosting service
      // This is a placeholder - replace with actual image hosting logic
      const hostedImageUrl = await uploadToImageHost(imagePath);

      const result = await editImage(hostedImageUrl, prompt);
      
      res.json({ 
        success: true,
        result: result,
        message: "Image processed successfully"
      });

    } catch (err) {
      console.error("Error processing image:", err);
      res.status(500).json({ 
        success: false,
        error: err.message || "Failed to process image"
      });
    } finally {
      // Cleanup uploaded file
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupErr) {
          console.error("Error cleaning up file:", cleanupErr);
        }
      }
    }
  });

  // Health check endpoint
  app.get(routePath + "/health", (req, res) => {
    res.json({ status: "OK", service: "picedit" });
  });
};

// Placeholder function - implement actual image hosting
async function uploadToImageHost(imagePath) {
  // TODO: Implement actual image hosting (e.g., Cloudinary, AWS S3, etc.)
  // For now, return a placeholder URL
  const filename = path.basename(imagePath);
  return `https://your-image-host.com/uploads/${filename}`;
  }
