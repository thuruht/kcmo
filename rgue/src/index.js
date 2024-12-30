import { Router } from 'itty-router';

const router = Router();

// CORS headers for API responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://rgue.kcmo.xyz",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle OPTIONS preflight requests
async function handleOptions() {
  return new Response(null, { headers: corsHeaders });
}

// API route: Hello World example
router.get('/api/hello', async () => {
  return new Response(JSON.stringify({ message: "Hello from the Worker!" }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// API route: File uploads to R2 (FILES)
router.post('/api/upload/file', async (request, env) => {
  const { fileName, fileData } = await request.json();
  await env.FILES.put(fileName, fileData);
  return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
});

// API route: Image uploads to R2 (IMAGES)
router.post('/api/upload/image', async (request, env) => {
  const { fileName, fileData } = await request.json();
  await env.IMAGES.put(fileName, fileData);
  return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return handleOptions();

    if (url.pathname.startsWith('/api')) {
      return router.handle(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};
