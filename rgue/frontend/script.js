document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);

  // Get Turnstile token
  const token = document.querySelector('.cf-turnstile').dataset.token;
  formData.append('captchaToken', token);

  const response = await fetch('/api/login', {
    method: 'POST',
    body: JSON.stringify(Object.fromEntries(formData)),
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await response.json();
  if (data.error) {
    alert(`Error: ${data.error}`);
  } else {
    alert('Login successful!');
  }
});
