import { Router } from 'itty-router';
import bcrypt from 'bcryptjs';
import jwt from '@tsndr/cloudflare-worker-jwt';

const router = Router();

// CORS Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://kcmo.xyz",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle preflight OPTIONS request
async function handleOptions() {
  return new Response(null, { headers: corsHeaders });
}

// Proxy /rgue requests to GitHub Pages
async function handleRgueProxy(request) {
  const url = new URL(request.url);

  // Rewrite hostname to GitHub Pages
  url.hostname = "ec35b12c.rgue.pages.dev";

  // Remove /rgue from the pathname
  url.pathname = url.pathname.replace(/^\/rgue/, "");

  return fetch(url.toString(), request);
}

// API route: User login with Turnstile CAPTCHA validation
router.post('/api/login', async (request, env) => {
  const { email, password, captchaToken } = await request.json();

  // Verify Turnstile CAPTCHA
  const captchaResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: captchaToken,
    }),
  }).then((res) => res.json());

  if (!captchaResponse.success) {
    return new Response(JSON.stringify({ error: "CAPTCHA verification failed" }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  // Validate user credentials
  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return new Response(JSON.stringify({ error: "Invalid credentials" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const token = await jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET);
  return new Response(JSON.stringify({ token }), { headers: corsHeaders });
});

// Default fetch handler
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // Proxy /rgue requests to GitHub Pages
    if (url.pathname.startsWith('/rgue')) {
      return handleRgueProxy(request);
    }

    // Route API requests
    return router.handle(request, env);
  },
};
