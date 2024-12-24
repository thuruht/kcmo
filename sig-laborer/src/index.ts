import { Env } from './types'; // Assuming you have a separate types file for environment variables

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST') {
      return handleSubmission(request, env);
    } else if (url.pathname === '/gallery') {
      return displayGallery(env);
    } else {
      return new Response('Not Found', { status: 404 });
    }
  }
};

async function handleSubmission(request: Request, env: Env): Promise<Response> {
  try {
    const formData = await request.formData();

    const name = formData.get('name')?.toString() || 'None given';
    const color = formData.get('color')?.toString() || '#000000';
    const mark = formData.get('mark')?.toString(); // Base64 encoded image data
    const agreement = formData.get('agreement') === 'on';

    if (!agreement) {
      return new Response('You must agree to the terms.', { status: 400 });
    }

    const submissionId = crypto.randomUUID(); // Unique ID for each submission

    const submissionData = {
      id: submissionId,
      name,
      color,
      mark: mark ? `${submissionId}.png` : null,
      agreement,
      timestamp: Date.now()
    };

    // Store submission data in KV
    await env.FORM_DATA_KV.put(submissionId, JSON.stringify(submissionData));

    // Store mark in R2 if provided
    if (mark) {
      const binaryMark = Uint8Array.from(atob(mark), c => c.charCodeAt(0));
      await env.R2_BUCKET.put(`${submissionId}.png`, binaryMark, {
        httpMetadata: { contentType: 'image/png' }
      });
    }

    return new Response(JSON.stringify({ message: 'Submission successful!' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error(error);
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

    let galleryHtml = `<html><head><style>
      .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
      .submission { border: 1px solid #ccc; padding: 10px; }
      .submission img { max-width: 100%; height: auto; }
    </style></head><body>`;

    galleryHtml += `<h2>Signatories Gallery</h2><div class="gallery">`;

    submissions.forEach((submission, index) => {
      galleryHtml += `<div class="submission">
        <p>#${index + 1}</p>
        <p>Name: ${submission.name}</p>
        <p>Color: <span style="color: ${submission.color}">${submission.color}</span></p>`;

      if (submission.mark) {
        const imageUrl = `${env.R2_BUCKET.url}/${submission.mark}`;
        galleryHtml += `<img src="${imageUrl}" alt="Mark">`;
      } else {
        galleryHtml += `<p>No mark provided.</p>`;
      }

      galleryHtml += `<p>Agreement: ${submission.agreement ? 'Yes' : 'No'}</p></div>`;
    });

    galleryHtml += '</div></body></html>';

    return new Response(galleryHtml, {
      headers: { 'Content-Type': 'text/html' },
      status: 200
    });
  } catch (error) {
    console.error(error);
    return new Response('Error retrieving gallery.', { status: 500 });
  }
}
