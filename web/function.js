
//--photo edit api--//

document.getElementById("editForm").onsubmit = async function (e) {
  e.preventDefault();
  const loading = document.getElementById("loading");
  const resultImage = document.getElementById("resultImage");
  loading.style.display = "block";
  resultImage.src = "";

  const form = new FormData();
  form.append("image", document.getElementById("image").files[0]);
  form.append("prompt", document.getElementById("prompt").value);

  try {
    const response = await fetch("https://hamim-s-api.onrender.com/edit-photo", {
      method: "POST",
      body: form,
      // Note: When sending FormData, don't set Content-Type header
      // The browser will set it automatically with the correct boundary
    });

    const data = await response.json();
    if (data.result && data.result[0]) {
      resultImage.src = data.result[0];
    } else {
      alert("No image returned. Try a different prompt or image.");
    }
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    loading.style.display = "none";
  }
};

//--imgbb api--//

document.getElementById("imgbbForm").onsubmit = async function (e) {
  e.preventDefault();
  const loading = document.getElementById("imgbbLoading");
  const resultImage = document.getElementById("imgbbResultImage");
  const resultLink = document.getElementById("imgbbResultLink");

  loading.style.display = "block";
  resultImage.src = "";
  resultLink.href = "";
  resultLink.textContent = "";

  const form = new FormData();
  form.append("image", document.getElementById("imgbbImage").files[0]);

  try {
    // FIXED: Changed from "/upload-img" to "/imgbb" to match your API endpoint
    const response = await fetch("/imgbb", {
      method: "POST",
      body: form,
    });
    
    const data = await response.json();
    console.log("ImgBB Response:", data); // Debug log to see response

    // FIXED: Check for success first, then use result
    if (data.success && data.result) {
      resultImage.src = data.result;
      resultLink.href = data.result;
      resultLink.textContent = data.result;
      console.log("Upload successful:", data.result);
    } else {
      console.error("Upload failed:", data);
      alert("Upload failed: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    console.error("Network error:", err);
    alert("Error: " + err.message);
  }

  loading.style.display = "none";
};

// Alternative version if you want to use the full URL
document.getElementById("imgbbFormAlt").onsubmit = async function (e) {
  e.preventDefault();
  const loading = document.getElementById("imgbbLoading");
  const resultImage = document.getElementById("imgbbResultImage");
  const resultLink = document.getElementById("imgbbResultLink");

  loading.style.display = "block";
  resultImage.src = "";
  resultLink.href = "";
  resultLink.textContent = "";

  const form = new FormData();
  form.append("image", document.getElementById("imgbbImage").files[0]);

  try {
    // Using your full API URL
    const response = await fetch("https://hamim-s-api.onrender.com/imgbb", {
      method: "POST",
      body: form,
    });
    
    const data = await response.json();
    console.log("ImgBB Response:", data);

    if (data.success && data.result) {
      resultImage.src = data.result;
      resultLink.href = data.result;
      resultLink.textContent = data.result;
      console.log("Upload successful:", data.result);
    } else {
      console.error("Upload failed:", data);
      alert("Upload failed: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    console.error("Network error:", err);
    alert("Error: " + err.message);
  }

  loading.style.display = "none";
};

// Debug function to test the API
async function testImgBBAPI() {
  try {
    const response = await fetch("/imgbb/debug");
    const data = await response.json();
    console.log("ImgBB Debug Info:", data);
    return data;
  } catch (err) {
    console.error("Debug test failed:", err);
    return null;
  }
}
