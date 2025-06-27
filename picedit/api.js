const Replicate = require("replicate");
require("dotenv").config();

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function editImage(imageUrl, prompt) {
  try {
    if (!imageUrl) throw new Error("Image URL is required");
    if (!prompt) throw new Error("Prompt is required");
    
    // Validate image URL format
    if (!imageUrl.startsWith('data:image/')) {
      throw new Error("Invalid image format. Please provide a base64 encoded image data URL");
    }

    // Validate prompt length and content
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error("Prompt must be a non-empty string");
    }
    if (prompt.length > 1000) {
      throw new Error("Prompt too long (max 1000 characters)");
    }

    const output = await replicate.run(
      "stability-ai/stable-diffusion-img2img:15a3689ee13b0d2616e98820eca31d4c3abcd36672df6afce5cb6feb1d66087d",
      {
        input: {
          image: imageUrl,
          prompt: prompt,
          num_inference_steps: 20,
          guidance_scale: 7.5,
          strength: 0.8,
        },
      }
    );

    if (!output) {
      throw new Error("No output received from Replicate API");
    }

    return output;
  } catch (error) {
    console.error("Error in editImage:", error);
    throw error; // Re-throw the error for the calling function to handle
  }
}

module.exports = editImage;
