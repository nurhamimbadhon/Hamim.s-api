const router = require("./api");

module.exports = function (app, routePath) {
  // Use the router for all routes under this path
  app.use(routePath, router);
  
  // Health check endpoint
  app.get(routePath + "/health", (req, res) => {
    res.json({ status: "OK", service: "imgbb" });
  });
};
