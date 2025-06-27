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
    const response = await fetch("/edit-photo", {
      method: "POST",
      body: form,
    });

    const data = await response.json();
    if (data.result && data.result[0]) {
      resultImage.src = data.result[0];
    } else {
      alert("No image returned. Try a different prompt or image.");
    }
  } catch (err) {
    alert("Error: " + err.message);
  }

  loading.style.display = "none";
};
