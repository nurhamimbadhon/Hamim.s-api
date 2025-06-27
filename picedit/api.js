const Replicate = require("replicate");
require("dotenv").config();

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function editImage(imageUrl, prompt) {
  const output = await replicate.run(
    "lllyasviel/controlnet:latest", // You can replace this with another model ID
    {
      input: {
        image: imageUrl,
        prompt: prompt,
      },
    }
  );

  return output; // Usually a list of URLs
}

module.exports = editImage;
