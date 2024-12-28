/**
 * index.js — Cloudflare Worker
 * 
 * Handles:
 *  - POST /api/submit (stores signature in R2, metadata in KV)
 *  - GET /api/file?key=... (retrieves a signature from R2)
 *  - OPTIONS /api/submit (CORS preflight)
 */

function withCors(resp) {
  // Helper to add CORS headers to the final response.
  const newHeaders = new Headers(resp.headers);
  newHeaders.set("Access-Control-Allow-Origin", "*");
  newHeaders.set("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  newHeaders.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(resp.body, {
    status: resp.status,
    headers: newHeaders,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1) Handle CORS preflight (OPTIONS /api/submit, etc.)
    if (request.method === "OPTIONS") {
      // Return a minimal response with the CORS headers
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // 2) Normal routes
    if (url.pathname === "/api/submit" && request.method === "POST") {
      // Wrap the result in withCors() so it includes the headers
      const resp = await handleSubmit(request, env);
      return withCors(resp);
    } 
    else if (url.pathname === "/api/file" && request.method === "GET") {
      const resp = await handleFileRequest(url, env);
      return withCors(resp);
    }

    // 3) Fallback — 404 with CORS
    return withCors(new Response("Not Found", { status: 404 }));
  },
};

async function handleSubmit(request, env) {
  try {
    // Parse JSON body
    const { typedName, signatureDataUrl } = await request.json();

    // Basic validation
    if (!signatureDataUrl?.startsWith("data:image/png;base64,")) {
      return new Response("Invalid signature data URL", { status: 400 });
    }

    const base64 = signatureDataUrl.split(",")[1];
    if (!base64) {
      return new Response("Invalid base64 data", { status: 400 });
    }

    // Convert base64 -> Uint8Array
    const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    // Unique key for R2
    const objectKey = `signature-${Date.now()}.png`;

    // 1) Store in R2
    await env.LUGE_BUCKET.put(objectKey, buffer, {
      httpMetadata: { contentType: "image/png" },
    });

    // 2) Increment submission count in KV
    const countKey = "submissionCount";
    let count = parseInt(await env.LUGE_CACHE.get(countKey)) || 0;
    count++;
    await env.LUGE_CACHE.put(countKey, count.toString());

    // 3) Store submission data in KV
    const submission = {
      typedName: typedName || "Anonymous",
      signatureKey: objectKey,
      timestamp: new Date().toISOString(),
    };
    await env.LUGE_CACHE.put(`submission:${count}`, JSON.stringify(submission));

    // 4) Return updated submissions
    const submissions = [];
    for (let i = 1; i <= count; i++) {
      const raw = await env.LUGE_CACHE.get(`submission:${i}`);
      if (raw) submissions.push(JSON.parse(raw));
    }

    return new Response(JSON.stringify({ count, submissions }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Return an error with stack trace
    return new Response(err.stack, { status: 500 });
  }
}

async function handleFileRequest(url, env) {
  const key = url.searchParams.get("key");
  if (!key) {
    return new Response("Missing key", { status: 400 });
  }

  const object = await env.LUGE_BUCKET.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  // Return the PNG
  return new Response(object.body, {
    headers: { "Content-Type": "image/png" },
  });
}
