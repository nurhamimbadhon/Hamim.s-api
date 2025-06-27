// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  // Handle specific error types
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'File too large. Maximum size allowed is 10MB.',
        code: 'FILE_TOO_LARGE'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field. Please check your form data.',
        code: 'UNEXPECTED_FILE'
      });
    }
  }

  // Handle validation errors
  if (err.message.includes('validation') || err.message.includes('invalid')) {
    return res.status(400).json({
      success: false,
      error: err.message,
      code: 'VALIDATION_ERROR'
    });
  }

  // Handle API errors
  if (err.message.includes('API') || err.message.includes('Replicate')) {
    return res.status(502).json({
      success: false,
      error: 'Error processing image with AI service. Please try again later.',
      code: 'AI_SERVICE_ERROR'
    });
  }

  // Default error handler
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Complete the prompt suggestions endpoint
app.get(routePath + "/prompt-suggestions", (req, res) => {
  try {
    const suggestions = [
      "Make the background blurry",
      "Convert to black and white",
      "Add a vintage film effect",
      "Enhance the colors",
      "Remove the background",
      "Make it look like a painting",
      "Add dramatic lighting",
      "Change the season to winter",
      "Make it look like a cartoon",
      "Add a fantasy element"
    ];
    
    res.json({
      success: true,
      suggestions: suggestions,
      count: suggestions.length
    });
  } catch (err) {
    console.error('Error in prompt suggestions:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get prompt suggestions',
      code: 'SUGGESTIONS_ERROR'
    });
  }
});
