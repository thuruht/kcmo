document.getElementById('upload-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.target;
  const uploadType = form.uploadType.value;
  const fileName = form.fileName.value;
  const file = form.fileData.files[0];

  if (!file) {
    alert('Please select a file to upload.');
    return;
  }

  const fileData = await file.text();
  const apiRoute = uploadType === 'image' ? '/api/upload/image' : '/api/upload/file';

  const response = await fetch(apiRoute, {
    method: 'POST',
    body: JSON.stringify({ fileName, fileData }),
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await response.json();
  alert(result.success ? 'Upload successful!' : 'Upload failed.');
});
