require("dotenv").config();
const express = require("express");
const app = express();
const path = require("path");
const apiRoutes = require("./api");

app.use(express.json());
app.use("/api", apiRoutes);
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
