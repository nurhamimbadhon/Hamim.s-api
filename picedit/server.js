const multer = require("multer");
const fs = require("fs");
const path = require("path");
const editImage = require("./api");

const upload = multer({ dest: "uploads/" });

module.exports = function (app, routePath) {
  app.post(routePath, upload.single("image"), async (req, res) => {
    const prompt = req.body.prompt;
    const imagePath = req.file.path;

    // Fake a public URL — Replicate models usually require externally hosted images
    const hostedImageUrl = `https://telegra.ph/file/${req.file.filename}.jpg`;

    try {
      const result = await editImage(hostedImageUrl, prompt);
      res.json({ result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }

    // Cleanup
    fs.unlinkSync(path.resolve(imagePath));
  });
};
