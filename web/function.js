
//--edit photo api--//


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
    const response = await fetch("/upload-img", {
      method: "POST",
      body: form,
    });
    const data = await response.json();

    if (data.result) {
      resultImage.src = data.result;
      resultLink.href = data.result;
      resultLink.textContent = data.result;
    } else {
      alert("Upload failed. Try again.");
    }
  } catch (err) {
    alert("Error: " + err.message);
  }

  loading.style.display = "none";
};
