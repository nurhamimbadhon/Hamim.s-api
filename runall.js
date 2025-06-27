// Fixed runall.js - Deployment-friendly version
const express = require("express");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Try to load optional dependencies safely
let helmet, rateLimit;
try {
  helmet = require("helmet");
  rateLimit = require("express-rate-limit");
} catch (error) {
  console.warn("⚠️  Optional security packages not found. Install helmet and express-rate-limit for enhanced security.");
}

// Apply security middleware only if available
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
}

// Apply rate limiting only if available
if (rateLimit) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: NODE_ENV === 'production' ? 100 : 1000,
    message: {
      error: "Too many requests from this IP, please try again later.",
      code: "RATE_LIMIT_EXCEEDED"
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);
}

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Create required directories safely
const requiredDirs = ['uploads', 'temp'];
requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  } catch (error) {
    console.warn(`⚠️  Could not create directory ${dir}:`, error.message);
  }
});

//--Serve web files--//
const webPath = path.join(__dirname, "web");
if (fs.existsSync(webPath)) {
  app.use(express.static(webPath, {
    maxAge: NODE_ENV === 'production' ? '1d' : '0',
    etag: true
  }));
  
  app.get("/", (req, res) => {
    const indexPath = path.join(webPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.json({ 
        message: "Welcome to Hamim APIs",
        status: "running",
        apis: app.locals.apiRegistry || []
      });
    }
  });
} else {
  app.get("/", (req, res) => {
    res.json({ 
      message: "Welcome to Hamim APIs",
      status: "running",
      timestamp: new Date().toISOString()
    });
  });
}

// Health check endpoints
app.get("/ping", (req, res) => res.json({ 
  status: "pong", 
  timestamp: new Date().toISOString(),
  uptime: Math.floor(process.uptime())
}));

app.get("/status", (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: "running",
    environment: NODE_ENV,
    version: "1.1.0",
    uptime: `${Math.floor(process.uptime())} seconds`,
    memory: {
      used: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      total: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`
    },
    timestamp: new Date().toISOString()
  });
});

//--🧠 Safe Dynamic API Loader--//
function loadAPI(apiName, customEndpoint = null, options = {}) {
  const apiPath = path.join(__dirname, apiName, "server.js");
  
  if (!fs.existsSync(apiPath)) {
    console.warn(`⚠️  ${apiPath} not found. Skipping ${apiName}.`);
    return false;
  }

  try {
    const register = require(apiPath);
    const routePath = customEndpoint || `/api/${apiName}`;
    
    if (typeof register !== 'function') {
      throw new Error(`${apiName}/server.js must export a function`);
    }
    
    // Apply rate limiting only if available and specified
    if (options.rateLimit && rateLimit) {
      app.use(routePath, rateLimit(options.rateLimit));
    }
    
    register(app, routePath);
    
    console.log(`✅ Loaded: ${apiName} at ${routePath}`);
    
    // Add API to registry
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

//--🧩 Load APIs--//
const apiConfigs = [
  { 
    name: "picedit", 
    endpoint: "/edit-photo",
    rateLimit: rateLimit ? {
      windowMs: 5 * 60 * 1000,
      max: 10,
      message: {
        error: "Too many image editing requests. Please wait before trying again.",
        code: "IMAGE_EDIT_RATE_LIMIT"
      }
    } : null
  },
  { 
    name: "imgbb", 
    endpoint: "/imgbb" 
  }
];

// Load APIs
const loadedApis = [];
const failedApis = [];

apiConfigs.forEach(config => {
  const loaded = loadAPI(config.name, config.endpoint, {
    rateLimit: config.rateLimit
  });
  
  if (loaded) {
    loadedApis.push(config.name);
  } else {
    failedApis.push(config.name);
  }
});

console.log(`\n📊 API Loading Summary:`);
console.log(`  ✅ Loaded: ${loadedApis.length} APIs (${loadedApis.join(', ')})`);
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

// Basic error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ 
      success: false,
      error: 'File too large. Maximum size allowed is 10MB.',
      code: 'FILE_TOO_LARGE'
    });
  }
  
  res.status(err.status || 500).json({ 
    success: false,
    error: NODE_ENV === 'development' ? err.message : 'Internal server error',
    code: err.code || 'INTERNAL_ERROR'
  });
});

// 404 handler
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

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

//--Start server--//
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server started successfully!`);
  console.log(`   📍 URL: http://localhost:${PORT}`);
  console.log(`   🌍 Environment: ${NODE_ENV}`);
  console.log(`   📊 APIs loaded: ${loadedApis.length}`);
  console.log(`   ⏰ Started at: ${new Date().toISOString()}\n`);
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Trying different port...`);
    // Try alternative port
    const altPort = PORT + 1;
    const altServer = app.listen(altPort, '0.0.0.0', () => {
      console.log(`✅ Server started on alternative port: ${altPort}`);
    });
  } else {
    console.error('❌ Server error:', err.message);
  }
});

module.exports = app;
