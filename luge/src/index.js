export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/submit" && request.method === "POST") {
      return handleSubmit(request, env);
    } else if (url.pathname === "/api/file" && request.method === "GET") {
      return handleFileRequest(url, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function handleSubmit(request, env) {
  try {
    const { typedName, signatureDataUrl } = await request.json();

    // Basic validation
    if (!signatureDataUrl.startsWith("data:image/png;base64,")) {
      return new Response("Invalid signature data URL", { status: 400 });
    }

    // Extract base64
    const base64 = signatureDataUrl.split(",")[1];
    if (!base64) {
      return new Response("Invalid base64 data", { status: 400 });
    }

    // Convert base64 -> Uint8Array
    const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    // Unique key (could just do Date.now() too)
    const objectKey = `signature-${Date.now()}.png`;

    // Store in R2
    await env.LUGE_BUCKET.put(objectKey, buffer, {
      httpMetadata: { contentType: "image/png" },
    });

    // KV: increment submission count
    const countKey = "submissionCount";
    let count = parseInt(await env.LUGE_CACHE.get(countKey)) || 0;
    count++;
    await env.LUGE_CACHE.put(countKey, count.toString());

    // KV: store submission data
    const submission = {
      typedName,
      signatureKey: objectKey,
      timestamp: new Date().toISOString(),
    };
    await env.LUGE_CACHE.put(`submission:${count}`, JSON.stringify(submission));

    // Return updated submissions
    const submissions = [];
    for (let i = 1; i <= count; i++) {
      const raw = await env.LUGE_CACHE.get(`submission:${i}`);
      if (raw) submissions.push(JSON.parse(raw));
    }

    return new Response(JSON.stringify({ count, submissions }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
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

  // Return as PNG
  return new Response(object.body, {
    headers: { "Content-Type": "image/png" },
  });
}
