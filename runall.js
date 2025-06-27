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
function loadAPI(apiName) {
  const apiPath = `./${apiName}/server.js`;
  if (fs.existsSync(apiPath)) {
    const register = require(apiPath);
    register(app, `/api/${apiName}`); // e.g. /api/picedit
    console.log(`✅ Loaded: /api/${apiName}`);
  } else {
    console.warn(`⚠️  ${apiPath} not found.`);
  }
}

//--🧩Add API's
loadAPI("picedit");
// loadAPI("bgremove");
// loadAPI("faceblur"); // Add more like this later

// Start server
app.listen(PORT, () => {
  console.log(`🚀 App running at http://localhost:${PORT}`);
});
