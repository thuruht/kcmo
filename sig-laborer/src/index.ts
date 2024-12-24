export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'POST') {
      try {
        const formData = await request.formData();
        const name = formData.get('name') || 'Anonymous';
        const color = formData.get('color');
        const mark = formData.get('mark'); // Base64 encoded image
        const agreement = formData.get('agreement') === 'on'; // Checkbox for agreement
        const uniqueVisitorId = request.headers.get('CF-Connecting-IP'); // Using IP for simplicity

        // Check if the visitor has already submitted
        const existingSubmission = await env.FORM_DATA_KV.get(uniqueVisitorId);
        if (existingSubmission) {
          return new Response('You have already submitted.', { status: 400 });
        }

        // Store form data in KV
        await env.FORM_DATA_KV.put(uniqueVisitorId, JSON.stringify({ name, color, mark, agreement }));

        // Store the mark image in R2
        if (mark) {
          const imageBuffer = Uint8Array.from(atob(mark), c => c.charCodeAt(0));
          await env.R2_BUCKET.put(`${uniqueVisitorId}.png`, imageBuffer);
        }

        return new Response('Submission successful!', { status: 200 });
      } catch (error) {
        return new Response('Error processing submission.', { status: 500 });
      }
    } else if (request.method === 'GET') {
      try {
        // Retrieve and display submissions
        const keys = await env.FORM_DATA_KV.list();
        const submissions = [];
        for (const key of keys.keys) {
          const data = await env.FORM_DATA_KV.get(key.name);
          if (data) {
            submissions.push(JSON.parse(data));
          }
        }

        // Sort submissions by latest first
        submissions.sort((a, b) => b.timestamp - a.timestamp);

        // Count the number of unique submissions
        const submissionCounter = submissions.length;

        let galleryHtml = `<h2>Signatories Gallery</h2><p>Number of unique submissions: ${submissionCounter}</p>`;
        submissions.forEach((submission, index) => {
          galleryHtml += `<div class="submission">
            <p>${index + 1}. Name: ${submission.name}</p>
            <p>Color: ${submission.color}</p>`;
          if (submission.mark) {
            galleryHtml += `<img src="data:image/png;base64,${submission.mark}" alt="Mark"/>`;
          }
          galleryHtml += `<p>Agreement: ${submission.agreement ? 'Yes' : 'No'}</p>`;
          galleryHtml += `</div>`;
        });

        return new Response(galleryHtml, {
          headers: { 'Content-Type': 'text/html' }
        });
      } catch (error) {
        return new Response('Error retrieving submissions.', { status: 500 });
      }
    } else {
      return new Response('Method not allowed', { status: 405 });
    }
  }
};

interface Env {
  FORM_DATA_KV: KVNamespace;
  R2_BUCKET: R2Bucket;
}
