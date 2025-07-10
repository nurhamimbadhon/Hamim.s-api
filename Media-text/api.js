const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Mock transcription function that simulates speech-to-text
function mockTranscription(lang) {
  const mockResponses = {
    en: "Hello, this is a sample transcription in English.",
    bn: "হ্যালো, এটি বাংলায় একটি নমুনা ট্রান্সক্রিপশন।",
    hi: "नमस्ते, यह हिंदी में एक नमूना ट्रांसक्रिप्शन है।",
    pt: "Olá, esta é uma transcrição de exemplo em português.",
    ko: "안녕하세요, 이것은 한국어 샘플 전사입니다.",
    banglish: "Hello, ei ekta banglish e sample transcription."
  };
  
  return mockResponses[lang] || mockResponses.en;
}

// Simple audio analysis (very basic)
function analyzeAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const duration = metadata.format.duration || 0;
        resolve(duration);
      }
    });
  });
}

// Generate transcription based on audio length and language
function generateTranscriptionByDuration(duration, lang) {
  const wordsPerSecond = 2; // Average speaking rate
  const estimatedWords = Math.floor(duration * wordsPerSecond);
  
  const sampleTexts = {
    en: [
      "Hello", "this", "is", "a", "speech", "recognition", "test",
      "please", "check", "if", "the", "audio", "is", "clear",
      "thank", "you", "for", "using", "our", "service"
    ],
    bn: [
      "হ্যালো", "এটি", "একটি", "স্পিচ", "রিকগনিশন", "টেস্ট",
      "অডিও", "স্পষ্ট", "কিনা", "চেক", "করুন", "ধন্যবাদ"
    ],
    hi: [
      "नमस्ते", "यह", "एक", "स्पीच", "रिकग्निशन", "टेस्ट", "है",
      "कृपया", "जांचें", "कि", "ऑडियो", "स्पष्ट", "है"
    ],
    pt: [
      "Olá", "este", "é", "um", "teste", "de", "reconhecimento",
      "de", "fala", "por", "favor", "verifique", "se", "o", "áudio"
    ],
    ko: [
      "안녕하세요", "이것은", "음성", "인식", "테스트입니다",
      "오디오가", "명확한지", "확인해", "주세요"
    ],
    banglish: [
      "Hello", "ei", "ekta", "speech", "recognition", "test",
      "audio", "clear", "ache", "kina", "check", "koren"
    ]
  };
  
  const words = sampleTexts[lang] || sampleTexts.en;
  const selectedWords = [];
  
  for (let i = 0; i < Math.min(estimatedWords, words.length); i++) {
    selectedWords.push(words[i % words.length]);
  }
  
  return selectedWords.join(" ");
}

router.post("/transcribe", upload.single("media"), async (req, res) => {
  const lang = req.body.lang || "en";
  const filePath = req.file.path;
  const audioPath = `${filePath}.wav`;

  try {
    // Convert to WAV format
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .audioCodec("pcm_s16le")
        .audioFrequency(16000)
        .format("wav")
        .on("end", resolve)
        .on("error", reject)
        .save(audioPath);
    });

    // Analyze audio duration
    const duration = await analyzeAudioDuration(audioPath);
    
    // Generate transcription based on duration and language
    let text;
    if (duration > 0) {
      text = generateTranscriptionByDuration(duration, lang);
    } else {
      text = mockTranscription(lang);
    }

    // Apply post-processing if needed
    let processedText = text;
    if (lang === "hi") {
      processedText = processedText
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

    res.json({ 
      lang, 
      text: processedText,
      duration: duration,
      note: "This is a mock transcription. For real transcription, please configure a speech service."
    });

  } catch (error) {
    console.error("Processing failed:", error);
    res.status(500).json({ 
      error: "Processing failed", 
      details: error.message 
    });
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }
  }
});

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    mode: "mock_transcription",
    timestamp: new Date().toISOString(),
    supported_languages: ["en", "bn", "hi", "pt", "ko", "banglish"]
  });
});

// Demo endpoint to test without audio
router.get("/demo/:lang?", (req, res) => {
  const lang = req.params.lang || "en";
  const mockText = mockTranscription(lang);
  
  res.json({
    lang,
    text: mockText,
    note: "This is a demo response"
  });
});

module.exports = router;
