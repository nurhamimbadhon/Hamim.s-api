// picedit/server.js - Enhanced Image Editing API
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const editImage = require("./api");

// Enhanced multer configuration with better error handling
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max files for batch processing
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 
      'image/webp', 'image/gif', 'image/bmp'
    ];
    
    if (allowedMimes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPG, PNG, WEBP, GIF, BMP`), false);
    }
  }
});

// Utility function to validate and sanitize prompt
function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error("Prompt must be a non-empty string");
  }
  
  const sanitized = prompt.trim();
  if (sanitized.length === 0) {
    throw new Error("Prompt cannot be empty");
  }
  
  if (sanitized.length > 1000) {
    throw new Error("Prompt too long (max 1000 characters)");
  }
  
  return sanitized;
}

// Utility function to process Replicate API response
function processApiResponse(result) {
  let imageUrls = [];
  
  if (Array.isArray(result)) {
    imageUrls = result.filter(url => url && typeof url === 'string' && url.trim());
  } else if (typeof result === 'string' && result.trim()) {
    imageUrls = [result.trim()];
  } else if (result && result.output) {
    if (Array.isArray(result.output)) {
      imageUrls = result.output.filter(url => url && typeof url === 'string' && url.trim());
    } else if (typeof result.output === 'string' && result.output.trim()) {
      imageUrls = [result.output.trim()];
    }
  }
  
  return imageUrls;
}

// Enhanced error handler
function handleApiError(err) {
  console.error("API Error:", err);
  
  const errorMappings = {
    'rate limit': {
      message: "API rate limit exceeded. Please try again in a few moments.",
      status: 429
    },
    'insufficient credits': {
      message: "Insufficient API credits. Please check your Replicate account.",
      status: 402
    },
    'timeout': {
      message: "Request timeout. The image might be too large or complex. Try a smaller image.",
      status: 408
    },
    'invalid image': {
      message: "Invalid or corrupted image file. Please try a different image.",
      status: 400
    },
    'model unavailable': {
      message: "AI model temporarily unavailable. Please try again later.",
      status: 503
    }
  };
  
  const errorKey = Object.keys(errorMappings).find(key => 
    err.message.toLowerCase().includes(key)
  );
  
  if (errorKey) {
    return {
      message: errorMappings[errorKey].message,
      status: errorMappings[errorKey].status,
      code: errorKey.toUpperCase().replace(' ', '_')
    };
  }
  
  return {
    message: err.message || "Failed to process image. Please try again.",
    status: err.status || 500,
    code: err.code || 'PROCESSING_ERROR'
  };
}

// Enhanced runall.js - Main Server File
const express = require("express");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet"); // Add security headers
const rateLimit = require("express-rate-limit"); // Add rate limiting
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development, enable in production
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'production' ? 100 : 1000, // Limit each IP
  message: {
    error: "Too many requests from this IP, please try again later.",
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Enhanced middleware for parsing with size limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Create required directories
const requiredDirs = ['uploads', 'logs', 'temp'];
requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

//--Serve web with enhanced static file handling--//
app.use(express.static(path.join(__dirname, "web"), {
  maxAge: NODE_ENV === 'production' ? '1d' : '0',
  etag: true
}));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "web", "index.html"));
});

// Health check endpoints
app.get("/ping", (req, res) => res.json({ 
  status: "pong", 
  timestamp: new Date().toISOString(),
  uptime: process.uptime()
}));

app.get("/status", (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: "running",
    environment: NODE_ENV,
    version: process.env.npm_package_version || "1.0.0",
    uptime: `${Math.floor(process.uptime())} seconds`,
    memory: {
      used: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      total: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`
    },
    timestamp: new Date().toISOString()
  });
});

//--🧠 Enhanced Dynamic API Loader--//
function loadAPI(apiName, customEndpoint = null, options = {}) {
  const apiPath = path.join(__dirname, apiName, "server.js");
  
  if (!fs.existsSync(apiPath)) {
    console.warn(`⚠️  ${apiPath} not found. Skipping ${apiName}.`);
    return false;
  }

  try {
    const register = require(apiPath);
    const routePath = customEndpoint || `/api/${apiName}`;
    
    // Validate that the register function exists
    if (typeof register !== 'function') {
      throw new Error(`${apiName}/server.js must export a function`);
    }
    
    // Apply API-specific middleware if provided
    if (options.middleware) {
      app.use(routePath, options.middleware);
    }
    
    register(app, routePath);
    
    console.log(`✅ Loaded: ${apiName} at ${routePath}`);
    
    // Add API to the registry for health checks
    if (!app.locals.apiRegistry) {
      app.locals.apiRegistry = [];
    }
    app.locals.apiRegistry.push({
      name: apiName,
      path: routePath,
      loadedAt: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error(`❌ Error loading ${apiName}:`, error.message);
    return false;
  }
}

//--🧩 Load APIs with Enhanced Configuration--//
const apiConfigs = [
  { 
    name: "picedit", 
    endpoint: "/edit-photo",
    middleware: rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10, // Limit image editing requests
      message: {
        error: "Too many image editing requests. Please wait before trying again.",
        code: "IMAGE_EDIT_RATE_LIMIT"
      }
    })
  },
  { 
    name: "imgbb", 
    endpoint: "/imgbb" 
  }
  // Add more APIs as needed
  // { name: "bgremove", endpoint: "/api/remove-bg" },
  // { name: "faceblur" } // uses default: /api/faceblur
];

// Load APIs
const loadedApis = [];
const failedApis = [];

apiConfigs.forEach(config => {
  const loaded = loadAPI(config.name, config.endpoint, {
    middleware: config.middleware
  });
  
  if (loaded) {
    loadedApis.push(config.name);
  } else {
    failedApis.push(config.name);
  }
});

console.log(`\n📊 API Loading Summary:`);
console.log(`  ✅ Loaded: ${loadedApis.length} APIs`);
if (failedApis.length > 0) {
  console.log(`  ❌ Failed: ${failedApis.length} APIs (${failedApis.join(', ')})`);
}

// API registry endpoint
app.get("/api", (req, res) => {
  res.json({
    message: "API Registry",
    totalApis: app.locals.apiRegistry ? app.locals.apiRegistry.length : 0,
    apis: app.locals.apiRegistry || [],
    server: {
      status: "running",
      environment: NODE_ENV,
      uptime: `${Math.floor(process.uptime())} seconds`
    }
  });
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] Error:`, err.stack);
  
  // Handle specific error types
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ 
      success: false,
      error: 'File too large. Maximum size allowed is 10MB.',
      code: 'FILE_TOO_LARGE'
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ 
      success: false,
      error: 'Unexpected file field. Please check your form data.',
      code: 'UNEXPECTED_FILE'
    });
  }
  
  // Generic error response
  const isDevelopment = NODE_ENV === 'development';
  res.status(err.status || 500).json({ 
    success: false,
    error: isDevelopment ? err.message : 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Enhanced 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    code: 'ROUTE_NOT_FOUND',
    availableEndpoints: {
      "GET /": "Web interface",
      "GET /ping": "Health check",
      "GET /status": "Server status",
      "GET /api": "API registry"
    }
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

//--Start server with enhanced logging--//
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server started successfully!`);
  console.log(`   📍 URL: http://localhost:${PORT}`);
  console.log(`   🌍 Environment: ${NODE_ENV}`);
  console.log(`   📊 APIs loaded: ${loadedApis.length}`);
  console.log(`   ⏰ Started at: ${new Date().toISOString()}\n`);
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please try a different port.`);
  } else {
    console.error('❌ Server error:', err.message);
  }
  process.exit(1);
});

module.exports = function (app, routePath) {
  // Input validation middleware
  const validateRequest = (req, res, next) => {
    try {
      if (req.body.prompt) {
        req.body.prompt = validatePrompt(req.body.prompt);
      }
      next();
    } catch (error) {
      return res.status(400).json({ 
        success: false,
        error: error.message,
        code: 'VALIDATION_ERROR'
      });
    }
  };

  // Main image editing endpoint with enhanced error handling
  app.post(routePath, validateRequest, upload.single("image"), async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Validate required fields
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: "No image file provided. Please upload an image file.",
          code: 'NO_FILE'
        });
      }
      
      if (!req.body.prompt) {
        return res.status(400).json({ 
          success: false,
          error: "No prompt provided. Please provide a description of how you want to edit the image.",
          code: 'NO_PROMPT'
        });
      }

      const prompt = req.body.prompt;
      const imageBuffer = req.file.buffer;
      
      // Enhanced logging
      console.log(`[${new Date().toISOString()}] Processing image editing request`);
      console.log(`  - Image size: ${Math.round(imageBuffer.length / 1024)} KB`);
      console.log(`  - Image type: ${req.file.mimetype}`);
      console.log(`  - Original filename: ${req.file.originalname}`);
      console.log(`  - Prompt length: ${prompt.length} characters`);

      // Convert buffer to base64 data URL
      const base64Image = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;

      // Process image with timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 60 seconds')), 60000);
      });
      
      const result = await Promise.race([
        editImage(base64Image, prompt),
        timeoutPromise
      ]);
      
      const imageUrls = processApiResponse(result);

      if (imageUrls.length === 0) {
        throw new Error("No valid image was generated. The AI might not have understood your prompt. Please try rephrasing it.");
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] Image editing completed in ${processingTime}ms`);
      
      res.json({ 
        success: true,
        results: imageUrls,
        count: imageUrls.length,
        message: "Image edited successfully!",
        originalPrompt: prompt,
        processingTime: `${processingTime}ms`,
        metadata: {
          originalSize: `${Math.round(imageBuffer.length / 1024)} KB`,
          originalType: req.file.mimetype,
          originalName: req.file.originalname
        }
      });

    } catch (err) {
      const errorInfo = handleApiError(err);
      const processingTime = Date.now() - startTime;
      
      console.error(`[${new Date().toISOString()}] Error after ${processingTime}ms:`, err.message);
      
      res.status(errorInfo.status).json({ 
        success: false,
        error: errorInfo.message,
        code: errorInfo.code,
        processingTime: `${processingTime}ms`
      });
    }
  });

  // Enhanced batch processing endpoint
  app.post(routePath + "/batch", validateRequest, upload.array("images", 5), async (req, res) => {
    const startTime = Date.now();
    
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: "No image files provided. Please upload 1-5 image files.",
          code: 'NO_FILES'
        });
      }
      
      if (!req.body.prompt) {
        return res.status(400).json({ 
          success: false,
          error: "No prompt provided. Please provide a description of how you want to edit the images.",
          code: 'NO_PROMPT'
        });
      }

      const prompt = req.body.prompt;
      const results = [];
      const errors = [];
      const totalSize = req.files.reduce((sum, file) => sum + file.size, 0);

      console.log(`[${new Date().toISOString()}] Processing ${req.files.length} images in batch`);
      console.log(`  - Total size: ${Math.round(totalSize / 1024)} KB`);
      console.log(`  - Prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);

      // Process images concurrently with controlled concurrency
      const processImage = async (file, index) => {
        try {
          const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
          
          const result = await editImage(base64Image, prompt);
          const imageUrls = processApiResponse(result);
          
          return {
            index,
            success: true,
            results: imageUrls,
            originalFilename: file.originalname,
            size: `${Math.round(file.size / 1024)} KB`
          };
          
        } catch (error) {
          const errorInfo = handleApiError(error);
          return {
            index,
            success: false,
            error: errorInfo.message,
            code: errorInfo.code,
            originalFilename: file.originalname
          };
        }
      };

      // Process with limited concurrency to avoid overwhelming the API
      const concurrency = Math.min(req.files.length, 2);
      const batches = [];
      
      for (let i = 0; i < req.files.length; i += concurrency) {
        const batch = req.files.slice(i, i + concurrency).map((file, idx) => 
          processImage(file, i + idx)
        );
        batches.push(batch);
      }

      // Execute batches sequentially
      for (const batch of batches) {
        const batchResults = await Promise.all(batch);
        batchResults.forEach(result => {
          if (result.success) {
            results.push(result);
          } else {
            errors.push(result);
          }
        });
      }

      const processingTime = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] Batch processing completed in ${processingTime}ms`);
      console.log(`  - Success: ${results.length}, Errors: ${errors.length}`);

      res.json({
        success: true,
        totalProcessed: req.files.length,
        successCount: results.length,
        errorCount: errors.length,
        results: results,
        errors: errors.length > 0 ? errors : undefined,
        prompt: prompt,
        processingTime: `${processingTime}ms`,
        metadata: {
          totalSize: `${Math.round(totalSize / 1024)} KB`,
          averageTimePerImage: `${Math.round(processingTime / req.files.length)}ms`
        }
      });

    } catch (err) {
      const errorInfo = handleApiError(err);
      const processingTime = Date.now() - startTime;
      
      console.error(`[${new Date().toISOString()}] Batch error after ${processingTime}ms:`, err.message);
      
      res.status(errorInfo.status).json({ 
        success: false,
        error: errorInfo.message,
        code: errorInfo.code,
        processingTime: `${processingTime}ms`
      });
    }
  });

  // Enhanced health check with system info
  app.get(routePath + "/health", (req, res) => {
    const memUsage = process.memoryUsage();
    
    res.json({ 
      status: "OK", 
      service: "AI Image Editing API",
      timestamp: new Date().toISOString(),
      version: "1.1.0",
      uptime: `${Math.floor(process.uptime())} seconds`,
      memory: {
        used: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
        total: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`
      },
      node_version: process.version
    });
  });

  // Enhanced API information endpoint
  app.get(routePath + "/info", (req, res) => {
    res.json({
      service: "AI Image Editing API",
      description: "Edit images using AI with natural language prompts in any language",
      version: "1.1.0",
      endpoints: {
        "POST /": {
          description: "Edit a single image",
          parameters: {
            image: "Image file (multipart/form-data)",
            prompt: "Description of desired edits (string)"
          }
        },
        "POST /batch": {
          description: "Edit multiple images (max 5)",
          parameters: {
            images: "Array of image files (multipart/form-data)",
            prompt: "Description of desired edits (string)"
          }
        },
        "GET /health": "Health check with system info",
        "GET /info": "API information and documentation"
      },
      limits: {
        maxFileSize: "10MB per file",
        maxBatchSize: "5 files",
        maxPromptLength: "1000 characters",
        timeout: "60 seconds per request"
      },
      supportedFormats: ["JPG", "JPEG", "PNG", "WEBP", "GIF", "BMP"],
      features: [
        "Multi-language prompt support",
        "Batch processing with controlled concurrency",
        "High-quality AI image editing",
        "Comprehensive error handling",
        "Processing time tracking",
        "File metadata preservation",
        "Rate limiting protection"
      ],
      examples: {
        prompts: [
          "Make the sky more dramatic and colorful",
          "Add snow to this landscape",
          "Change the hair color to blonde",
          "Remove the background and make it transparent",
          "Make this photo look like a painting"
        ]
      }
    });
  });

  // New endpoint for prompt suggestions
  app.get(rout
