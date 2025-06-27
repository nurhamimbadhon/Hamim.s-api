
// imgbb/server.js

const express = require("express");
const router = require("./api");

module.exports = function (app, routePath) {
  app.use(routePath, router);
};
