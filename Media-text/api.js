const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Mock transcription responses for different languages
const mockResponses = {
  en: "Hello, this is a sample transcription in English. The audio has been processed successfully.",
  bn: "হ্যালো, এটি বাংলায় একটি নমুনা ট্রান্সক্রিপশন। অডিও সফলভাবে প্রক্রিয়া করা হয়েছে।",
  hi: "नमस्ते, यह हिंदी में एक नमूना ट्रांसक्रिप्शन है। ऑडियो को सफलतापूर्वक प्रोसेस किया गया है।",
  pt: "Olá, esta é uma transcrição de exemplo em português. O áudio foi processado com sucesso.",
  ko: "안녕하세요, 이것은 한국어 샘플 전사입니다. 오디오가 성공적으로 처리되었습니다.",
  banglish: "Hello, ei ekta banglish e sample transcription. Audio successfully process kora hoyeche."
};

// Word banks for generating realistic transcriptions
const wordBanks = {
  en: [
    "Hello", "thank", "you", "please", "how", "are", "you", "today",
    "this", "is", "a", "test", "of", "speech", "recognition", "system",
    "audio", "quality", "sounds", "good", "clear", "voice", "recording"
  ],
  bn: [
    "হ্যালো", "ধন্যবাদ", "আপনি", "কেমন", "আছেন", "আজ", "এটি", "একটি",
    "স্পিচ", "রিকগনিশন", "সিস্টেম", "অডিও", "গুণমান", "ভাল", "স্পষ্ট"
  ],
  hi: [
    "नमस्ते", "धन्यवाद", "आप", "कैसे", "हैं", "आज", "यह", "एक",
    "स्पीच", "रिकग्निशन", "सिस्टम", "ऑडियो", "गुणवत्ता", "अच्छी", "स्पष्ट"
  ],
  pt: [
    "Olá", "obrigado", "você", "como", "está", "hoje", "este", "é",
    "um", "sistema", "de", "reconhecimento", "de", "fala", "áudio", "qualidade"
  ],
  ko: [
    "안녕하세요", "감사합니다", "당신", "어떻게", "오늘", "이것은", "음성",
    "인식", "시스템", "오디오", "품질", "좋은", "명확한"
  ],
  banglish: [
    "Hello", "dhonnobad", "apni", "kemon", "achen", "ajke", "ei", "ekta",
    "speech", "recognition", "system", "audio", "quality", "bhalo", "clear"
  ]
};

// Analyze audio properties
function analyzeAudioProperties(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        resolve({ duration: 5, sampleRate: 16000 }); // Default values
      } else {
        const duration = metadata.format.duration || 5;
        const sampleRate = metadata.streams[0]?.sample_rate || 16000;
        resolve({ duration, sampleRate });
      }
    });
  });
}

// Generate realistic transcription based on audio properties
function generateRealisticTranscription(audioProperties, lang) {
  const { duration } = audioProperties;
  const wordsPerSecond = 1.5; // Average speaking rate
  const estimatedWords = Math.max(3, Math.floor(duration * wordsPerSecond));
  
  const words = wordBanks[lang] || wordBanks.en;
  const selectedWords = [];
  
  // Generate words based on estimated count
  for (let i = 0; i < estimatedWords; i++) {
    const randomIndex = Math.floor(Math.random() * words.length);
    selectedWords.push(words[randomIndex]);
  }
  
  return selectedWords.join(" ");
}

// Apply language-specific post-processing
function applyPostProcessing(text, lang) {
  if (lang === "hi") {
    return text
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
  return text;
}

// Main transcription endpoint
router.post("/transcribe", upload.single("media"), async (req, res) => {
  const lang = req.body.lang || "en";
  const filePath = req.file.path;
  const audioPath = `${filePath}.wav`;

  try {
    console.log(`🎵 Processing audio file for language: ${lang}`);
    
    // Convert to WAV format
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .audioCodec("pcm_s16le")
        .audioFrequency(16000)
        .format("wav")
        .on("end", () => {
          console.log("✅ Audio conversion completed");
          resolve();
        })
        .on("error", (err) => {
          console.error("❌ Audio conversion failed:", err);
          reject(err);
        })
        .save(audioPath);
    });

    // Analyze audio properties
    const audioProperties = await analyzeAudioProperties(audioPath);
    console.log(`📊 Audio analysis: ${audioProperties.duration}s duration`);

    // Generate transcription
    let text;
    if (audioProperties.duration > 0.5) {
      text = generateRealisticTranscription(audioProperties, lang);
    } else {
      text = mockResponses[lang] || mockResponses.en;
    }

    // Apply post-processing
    const processedText = applyPostProcessing(text, lang);

    console.log(`✅ Transcription completed: ${processedText.substring(0, 50)}...`);

    res.json({
      lang,
      text: processedText,
      duration: audioProperties.duration,
      wordCount: processedText.split(" ").length,
      processingTime: new Date().toISOString(),
      note: "Mock transcription - configure a real speech service for production use"
    });

  } catch (error) {
    console.error("❌ Processing failed:", error);
    res.status(500).json({
      error: "Audio processing failed",
      details: error.message,
      lang
    });
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("🗑️ Cleaned up original file");
      }
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
        console.log("🗑️ Cleaned up converted file");
      }
    } catch (cleanupError) {
      console.error("⚠️ Cleanup error:", cleanupError);
    }
  }
});

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "✅ API is running",
    mode: "Mock Transcription",
    timestamp: new Date().toISOString(),
    supportedLanguages: Object.keys(mockResponses),
    version: "1.0.0"
  });
});

// Demo endpoint to test different languages
router.get("/demo/:lang?", (req, res) => {
  const lang = req.params.lang || "en";
  const mockText = mockResponses[lang] || mockResponses.en;
  
  res.json({
    lang,
    text: mockText,
    type: "demo",
    note: "This is a demo response without audio processing"
  });
});

// List supported languages
router.get("/languages", (req, res) => {
  res.json({
    supportedLanguages: [
      { code: "en", name: "English" },
      { code: "bn", name: "Bengali" },
      { code: "hi", name: "Hindi" },
      { code: "pt", name: "Portuguese" },
      { code: "ko", name: "Korean" },
      { code: "banglish", name: "Banglish" }
    ],
    defaultLanguage: "en"
  });
});

module.exports = router;
