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

//--🧠 Dynamic API Loader--//
function loadAPI(apiName, customEndpoint = null) {
  const apiPath = path.join(__dirname, apiName, "server.js");
  if (fs.existsSync(apiPath)) {
    try {
      const register = require(apiPath);
      const routePath = customEndpoint || `/api/${apiName}`;
      register(app, routePath);
      console.log(`✅ Loaded: ${apiName} at ${routePath}`);
    } catch (error) {
      console.error(`❌ Error loading ${apiName}:`, error.message);
    }
  } else {
    console.warn(`⚠️  ${apiPath} not found.`);
  }
}

//--🧩Add API's--//
loadAPI("picedit", "/edit-photo");
loadAPI("imgbb", "/imgbb");
loadAPI("convert", "/Media-text");
// loadAPI("bgremove", "/api/remove-bg");
// loadAPI("faceblur"); // uses default: /api/faceblur

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

//--Start server--//
app.listen(PORT, () => {
  console.log(`🚀 App running at http://localhost:${PORT}`);
});
