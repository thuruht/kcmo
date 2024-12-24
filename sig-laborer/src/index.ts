import { Env } from './worker-configuration';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST') {
      return handleSubmission(request, env);
    } else if (url.pathname === '/gallery') {
      return displayGallery(env);
    } else if (url.pathname === '/') {
      return new Response('Welcome to the Signature Worker API. Use /gallery to view submissions.', {
        headers: { 'Content-Type': 'text/plain' },
      });
    } else {
      return new Response('Not Found', { status: 404 });
    }
  },
};

async function handleSubmission(request: Request, env: Env): Promise<Response> {
  try {
    const formData = await request.json();

    const { name = 'None given', color = '#000000', mark = null, agreement } = formData;

    if (!agreement) {
      return new Response('Agreement is required.', { status: 400 });
    }

    const submissionId = crypto.randomUUID();
    const submissionData = {
      id: submissionId,
      name,
      color,
      mark: mark ? `${submissionId}.png` : null,
      agreement,
      timestamp: Date.now()
    };

    await env.FORM_DATA_KV.put(submissionId, JSON.stringify(submissionData));

    if (mark) {
      try {
        const binaryMark = Uint8Array.from(atob(mark.split(",")[1]), c => c.charCodeAt(0));
        await env.R2_BUCKET.put(`${submissionId}.png`, binaryMark, {
          httpMetadata: { contentType: 'image/png' },
        });
      } catch (e) {
        return new Response('Invalid mark data.', { status: 400 });
      }
    }

    return new Response(JSON.stringify({ message: 'Submission successful!' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    return new Response('Error processing submission.', { status: 500 });
  }
}

async function displayGallery(env: Env): Promise<Response> {
  try {
    const keys = await env.FORM_DATA_KV.list();
    const submissions = await Promise.all(
      keys.keys.map(async key => {
        const data = await env.FORM_DATA_KV.get(key.name);
        return data ? JSON.parse(data) : null;
      })
    );

    submissions.sort((a, b) => b.timestamp - a.timestamp);

    const galleryData = {
      counter: submissions.length,
      submissions: submissions.map(submission => ({
        name: submission.name,
        color: submission.color,
        mark: submission.mark ? `https://images.kcmo.xyz/${submission.mark}` : null
      }))
    };

    return new Response(JSON.stringify(galleryData), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    return new Response('Error retrieving gallery.', { status: 500 });
  }
}
