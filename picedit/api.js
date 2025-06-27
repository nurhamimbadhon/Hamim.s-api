const Replicate = require("replicate");
require("dotenv").config();

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function editImage(imageUrl, prompt) {
  try {
    // Using a more suitable model for general image editing
    const output = await replicate.run(
      "stability-ai/stable-diffusion-img2img:15a3689ee13b0d2616e98820eca31d4c3abcd36672df6afce5cb6feb1d66087d",
      {
        input: {
          image: imageUrl,
          prompt: prompt,
          num_inference_steps: 20,
          guidance_scale: 7.5,
          strength: 0.8, // How much to transform the original image
        },
      }
    );

    console.log("Replicate output:", output);
    return output;
  } catch (error) {
    console.error("Error in editImage:", error);
    throw error;
  }
}

module.exports = editImage;
