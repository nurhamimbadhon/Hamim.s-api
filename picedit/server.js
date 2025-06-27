const multer = require("multer");
const fs = require("fs");
const path = require("path");
const editImage = require("./api");
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary (you'll need to add these to your .env file)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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
      
      console.log("Processing image:", imagePath);
      console.log("Prompt:", prompt);

      // Upload image to Cloudinary to get a public URL
      const hostedImageUrl = await uploadToImageHost(imagePath);
      console.log("Hosted image URL:", hostedImageUrl);

      // Process image with Replicate
      const result = await editImage(hostedImageUrl, prompt);
      console.log("Replicate result:", result);
      
      // Handle different response formats from Replicate
      let imageUrl = null;
      if (Array.isArray(result)) {
        imageUrl = result[0];
      } else if (typeof result === 'string') {
        imageUrl = result;
      } else if (result && result.output) {
        imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      }

      if (!imageUrl) {
        throw new Error("No image URL returned from Replicate API");
      }
      
      res.json({ 
        success: true,
        result: [imageUrl], // Ensure it's always an array for frontend compatibility
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

// Upload image to Cloudinary
async function uploadToImageHost(imagePath) {
  try {
    const result = await cloudinary.uploader.upload(imagePath, {
      folder: 'picedit',
      resource_type: 'image'
    });
    return result.secure_url;
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    
    // Fallback: Try using a simple file hosting service
    // You can replace this with any other image hosting service
    throw new Error("Failed to upload image to hosting service");
  }
}
