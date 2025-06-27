const express = require("express");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

//--Serve web--//
app.use(express.static(path.join(__dirname, "web")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "web", "index.html"));
});

app.get("/ping", (req, res) => res.send("pong"));

//--🧠 Dynamic API Loader--//
function loadAPI(apiName, customEndpoint = null) {
  const apiPath = `./${apiName}/server.js`;
  if (fs.existsSync(apiPath)) {
    const register = require(apiPath);
    const routePath = customEndpoint || `/api/${apiName}`;
    register(app, routePath); // e.g. /api/picedit or custom
    console.log(`✅ Loaded: ${apiName} at ${routePath}`);
  } else {
    console.warn(`⚠️  ${apiPath} not found.`);
  }
}

//--🧩Add API's--//
loadAPI("picedit", "/edit-photo");
// loadAPI("bgremove", "/api/remove-bg");
// loadAPI("faceblur"); // uses default: /api/faceblur

//--Start server--//
app.listen(PORT, () => {
  console.log(`🚀 App running at http://localhost:${PORT}`);
});
