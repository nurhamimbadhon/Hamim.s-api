router.post('/', upload.single('image'), async (req, res) => {
  let filePath = null;
  
  try {
    // Validate API key
    if (!process.env.IMGBB_API_KEY) {
      return res.status(500).json({ 
        success: false,
        error: 'ImgBB API key not configured' 
      });
    }

    // Debug log
    console.log('API Key present:', !!process.env.IMGBB_API_KEY);

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No image file provided' 
      });
    }

    filePath = req.file.path;
    console.log('File uploaded to:', filePath);

    // Verify file exists and is readable
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ 
        success: false,
        error: 'Uploaded file not found' 
      });
    }

    // Method 1: Using base64 encoding (often more reliable)
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');

    const formData = new FormData();
    formData.append('image', base64Image);
    
    // Add optional parameters if provided
    if (req.body.name) {
      formData.append('name', req.body.name);
    }
    if (req.body.expiration) {
      formData.append('expiration', req.body.expiration);
    }

    console.log('Uploading to ImgBB...');

    // Upload to ImgBB
    const response = await axios.post(
      `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
      formData,
      { 
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000 // 30 second timeout
      }
    );

    console.log('ImgBB Response:', response.status, response.data?.success);

    // Check if upload was successful
    if (response.data && response.data.success) {
      res.json({
        success: true,
        result: response.data.data.url,
        data: {
          id: response.data.data.id,
          title: response.data.data.title,
          url_viewer: response.data.data.url_viewer,
          url: response.data.data.url,
          display_url: response.data.data.display_url,
          size: response.data.data.size,
          time: response.data.data.time,
          expiration: response.data.data.expiration,
          image: {
            filename: response.data.data.image.filename,
            name: response.data.data.image.name,
            mime: response.data.data.image.mime,
            extension: response.data.data.image.extension,
            url: response.data.data.image.url
          },
          thumb: response.data.data.thumb,
          medium: response.data.data.medium,
          delete_url: response.data.data.delete_url
        }
      });
    } else {
      throw new Error('ImgBB API returned unsuccessful response');
    }

  } catch (error) {
    console.error('ImgBB upload error:', error.message);
    console.error('Error details:', error.response?.data || 'No additional details');
    
    // Handle specific error types
    let errorMessage = 'Failed to upload image to ImgBB';
    let statusCode = 500;

    if (error.response) {
      // ImgBB API error
      statusCode = error.response.status;
      console.error('ImgBB API Response:', error.response.data);
      
      if (error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error.message || errorMessage;
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Upload timeout - please try again';
    } else if (error.message.includes('ENOENT')) {
      errorMessage = 'File not found or corrupted';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: error.response?.data || error.message
    });

  } finally {
    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log('Temporary file cleaned up');
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError.message);
      }
    }
  }
});
