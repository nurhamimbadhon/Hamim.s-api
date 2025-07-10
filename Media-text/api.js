const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { Model, KaldiRecognizer } = require("vosk");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const MODEL_DIR = path.join(__dirname, "models");

const modelMap = {
  en: "vosk-model-small-en-us-0.15",
  bn: "vosk-model-small-bn-0.22",
  hi: "vosk-model-small-hi-0.22",
  pt: "vosk-model-small-pt-0.3",
  ko: "vosk-model-small-ko-0.22",
  banglish: "vosk-model-small-en-us-0.15"
};

function getModel(langCode) {
  const folder = modelMap[langCode];
  const modelPath = path.join(MODEL_DIR, folder || "");
  if (!folder || !fs.existsSync(modelPath)) return null;
  return new Model(modelPath);
}

router.post("/transcribe", upload.single("media"), async (req, res) => {
  const lang = req.body.lang || "en";
  const model = getModel(lang);

  if (!model) {
    return res.status(400).json({ error: `Model not found for language: ${lang}` });
  }

  const filePath = req.file.path;
  const audioPath = `${filePath}.wav`;

  // Convert to WAV
  ffmpeg(filePath)
    .audioCodec("pcm_s16le")
    .format("wav")
    .on("end", () => {
      const recognizer = new KaldiRecognizer(model, 16000);
      recognizer.setWords(true);

      let resultText = "";

      ffmpeg(audioPath)
        .audioFrequency(16000)
        .format("s16le")
        .on("error", (err) => {
          console.error("FFmpeg error:", err);
          return res.status(500).json({ error: "Audio processing error" });
        })
        .pipe()
        .on("data", (chunk) => {
          recognizer.acceptWaveform(chunk);
        })
        .on("end", () => {
          const result = JSON.parse(recognizer.finalResult());
          let text = result.text || "";

          // Hindi transliteration (optional improvements)
          if (lang === "hi") {
            text = text
              .replace(/ā/g, "aa")
              .replace(/ī/g, "ee")
              .replace(/ū/g, "oo")
              .replace(/ṅ/g, "n")
              .replace(/ṭ/g, "t")
              .replace(/ḍ/g, "d")
              .replace(/ṇ/g, "n")
              .replace(/ś/g, "sh")
              .replace(/ṣ/g, "sh")
              .replace(/ḥ/g, "h");
          }

          res.json({ lang, text });
          fs.unlinkSync(filePath);
          fs.unlinkSync(audioPath);
        });
    })
    .on("error", (err) => {
      console.error("FFmpeg convert error:", err);
      res.status(500).json({ error: "Conversion failed" });
    })
    .save(audioPath);
});

module.exports = router;
