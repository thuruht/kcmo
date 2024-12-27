export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST') {
      return handleSubmission(request, env);
    } else if (url.pathname === '/gallery') {
      return displayGallery(env);
    } else if (request.method === 'OPTIONS') {
      return handleOptions();
    } else {
      return new Response('Not Found', {
        status: 404,
        headers: { 'Access-Control-Allow-Origin': 'https://kcmo.xyz' },
      });
    }
  },
};

function handleOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': 'https://kcmo.xyz',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

async function handleSubmission(request, env) {
  try {
    const formData = await request.json();

    const { name = 'Anonymous', mark = null, agreement } = formData;

    if (!agreement) {
      return new Response('Agreement is required.', { status: 400 });
    }

    const submissionId = crypto.randomUUID();
    const submissionData = {
      id: submissionId,
      name,
      mark: mark ? `${submissionId}.png` : null,
      agreement,
      timestamp: Date.now(),
    };

    await env.FORM_DATA_KV.put(submissionId, JSON.stringify(submissionData));

    if (mark) {
      const binaryMark = Uint8Array.from(atob(mark.split(',')[1]), c => c.charCodeAt(0));
      await env.R2_BUCKET.put(`${submissionId}.png`, binaryMark, {
        httpMetadata: { contentType: 'image/png' },
      });
    }

    return new Response(JSON.stringify({ message: 'Submission successful!' }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://kcmo.xyz',
      },
    });
  } catch (error) {
    console.error('Error processing submission:', error);
    return new Response('Error processing submission.', {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': 'https://kcmo.xyz',
      },
    });
  }
}

async function displayGallery(env) {
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
        mark: submission.mark ? `https://images.kcmo.xyz/${submission.mark}` : null,
      })),
    };

    return new Response(JSON.stringify(galleryData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://kcmo.xyz',
      },
    });
  } catch (error) {
    console.error('Error retrieving gallery:', error);
    return new Response('Error retrieving gallery.', {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': 'https://kcmo.xyz',
      },
    });
  }
}
