const express = require("express");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

//--Serve web--//
app.use(express.static(path.join(__dirname, "web")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "web", "index.html"));
});

app.get("/ping", (req, res) => res.send("pong"));

// Track loaded APIs for health monitoring
const loadedAPIs = new Map();

//--🧠 Enhanced Dynamic API Loader with Error Isolation--//
function loadAPI(apiName, customEndpoint = null) {
  const apiPath = path.join(__dirname, apiName, "server.js");
  const routePath = customEndpoint || `/api/${apiName}`;
  
  // Initialize API status
  loadedAPIs.set(apiName, {
    path: routePath,
    status: 'loading',
    error: null,
    lastAttempt: new Date()
  });

  if (!fs.existsSync(apiPath)) {
    console.warn(`⚠️  ${apiPath} not found.`);
    loadedAPIs.set(apiName, {
      path: routePath,
      status: 'not_found',
      error: 'API file not found',
      lastAttempt: new Date()
    });
    return false;
  }

  try {
    // Clear require cache to allow reloading if needed
    delete require.cache[require.resolve(apiPath)];
    
    const register = require(apiPath);
    
    // Validate that the required module exports a function
    if (typeof register !== 'function') {
      throw new Error('API module must export a function');
    }

    // Create isolated router for this API
    const apiRouter = express.Router();
    
    // Wrap API registration in try-catch to isolate errors
    register(apiRouter, '');
    
    // Mount the isolated router
    app.use(routePath, apiRouter);
    
    // Add error handling middleware specifically for this API
    app.use(routePath, (err, req, res, next) => {
      console.error(`❌ Error in ${apiName}:`, err.message);
      
      // Update API status
      loadedAPIs.set(apiName, {
        path: routePath,
        status: 'error',
        error: err.message,
        lastAttempt: new Date()
      });
      
      res.status(500).json({ 
        error: `API ${apiName} encountered an error`,
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });
    
    console.log(`✅ Loaded: ${apiName} at ${routePath}`);
    loadedAPIs.set(apiName, {
      path: routePath,
      status: 'active',
      error: null,
      lastAttempt: new Date()
    });
    
    return true;
    
  } catch (error) {
    console.error(`❌ Error loading ${apiName}:`, error.message);
    
    // Update API status but don't crash the server
    loadedAPIs.set(apiName, {
      path: routePath,
      status: 'failed',
      error: error.message,
      lastAttempt: new Date()
    });
    
    // Create a fallback route for the failed API
    app.use(routePath, (req, res) => {
      res.status(503).json({
        error: `API ${apiName} is currently unavailable`,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        status: 'service_unavailable'
      });
    });
    
    return false;
  }
}

// Health check endpoint to monitor API status
app.get('/health', (req, res) => {
  const health = {
    server: 'running',
    timestamp: new Date().toISOString(),
    apis: Object.fromEntries(loadedAPIs)
  };
  
  const hasFailedAPIs = Array.from(loadedAPIs.values()).some(api => 
    api.status === 'failed' || api.status === 'error'
  );
  
  res.status(hasFailedAPIs ? 206 : 200).json(health);
});

// Retry failed API loading endpoint (useful for development)
app.post('/retry-api/:apiName', (req, res) => {
  const { apiName } = req.params;
  
  if (!loadedAPIs.has(apiName)) {
    return res.status(404).json({ error: 'API not found in registry' });
  }
  
  const currentStatus = loadedAPIs.get(apiName);
  if (currentStatus.status === 'active') {
    return res.json({ message: 'API is already active', status: currentStatus });
  }
  
  console.log(`🔄 Retrying to load ${apiName}...`);
  
  // Determine the custom endpoint if it was used
  let customEndpoint = null;
  if (currentStatus.path !== `/api/${apiName}`) {
    customEndpoint = currentStatus.path;
  }
  
  const success = loadAPI(apiName, customEndpoint);
  const newStatus = loadedAPIs.get(apiName);
  
  res.json({
    message: success ? 'API loaded successfully' : 'API loading failed',
    status: newStatus
  });
});

//--🧩 Load APIs with Error Isolation--//
console.log('🔧 Loading APIs...');

// Load each API independently - failures won't stop other APIs
loadAPI("picedit", "/edit-photo");
loadAPI("imgbb", "/imgbb");
loadAPI("bgremove", "/api/remove-bg");
loadAPI("faceblur"); // uses default: /api/faceblur

// Add more APIs here as needed
// loadAPI("newapi");

console.log('📊 API Loading Summary:');
loadedAPIs.forEach((status, name) => {
  const emoji = status.status === 'active' ? '✅' : 
                status.status === 'loading' ? '⏳' : '❌';
  console.log(`${emoji} ${name}: ${status.status} (${status.path})`);
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err.stack);
  
  // Don't crash the server
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Enhanced 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    availableEndpoints: [
      '/',
      '/ping',
      '/health',
      ...Array.from(loadedAPIs.values())
        .filter(api => api.status === 'active')
        .map(api => api.path)
    ]
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions (last resort)
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  // Don't exit immediately, give time for cleanup
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit for unhandled rejections
});

//--Start server--//
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`🔧 Active APIs: ${Array.from(loadedAPIs.values()).filter(api => api.status === 'active').length}`);
  console.log(`❌ Failed APIs: ${Array.from(loadedAPIs.values()).filter(api => api.status === 'failed').length}`);
});

// Handle server startup errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});
