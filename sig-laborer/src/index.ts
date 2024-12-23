export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'POST') {
      const formData = await request.formData();
      const name = formData.get('name') || 'Anonymous';
      const color = formData.get('color');
      const mark = formData.get('mark'); // Base64 encoded image
      const uniqueVisitorId = request.headers.get('CF-Connecting-IP'); // Using IP for simplicity

      // Check if the visitor has already submitted
      const existingSubmission = await env.FORM_DATA_KV.get(uniqueVisitorId);
      if (existingSubmission) {
        return new Response('You have already submitted.', { status: 400 });
      }

      // Store form data in KV
      await env.FORM_DATA_KV.put(uniqueVisitorId, JSON.stringify({ name, color, mark }));

      // Store the mark image in R2
      if (mark) {
        const imageBuffer = Uint8Array.from(atob(mark), c => c.charCodeAt(0));
        await env.R2_BUCKET.put(`${uniqueVisitorId}.png`, imageBuffer);
      }

      return new Response('Submission successful!', { status: 200 });
    } else if (request.method === 'GET') {
      // Retrieve and display submissions
      const keys = await env.FORM_DATA_KV.list();
      const submissions = [];
      for (const key of keys.keys) {
        const data = await env.FORM_DATA_KV.get(key.name);
        submissions.push(JSON.parse(data));
      }

      let galleryHtml = '<h2>Signatories Gallery</h2>';
      submissions.forEach(submission => {
        galleryHtml += `<div class="submission">
          <p>Name: ${submission.name}</p>
          <p>Color: ${submission.color}</p>`;
        if (submission.mark) {
          galleryHtml += `<img src="data:image/png;base64,${submission.mark}" alt="Mark"/>`;
        }
        galleryHtml += `</div>`;
      });

      return new Response(galleryHtml, {
        headers: { 'Content-Type': 'text/html' }
      });
    } else {
      return new Response('Method not allowed', { status: 405 });
    }
  }
};

interface Env {
  FORM_DATA_KV: KVNamespace;
  R2_BUCKET: R2Bucket;
}
