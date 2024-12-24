export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'POST') {
      try {
        const formData = await request.formData();
        const name = formData.get('name') || 'Anonymous';
        const color = formData.get('color');
        const mark = formData.get('mark'); // Base64 encoded image
        const agreement = formData.get('agreement') === 'true'; // Checkbox for agreement

        // Store form data in KV
        const submission = { name, color, mark, agreement, timestamp: Date.now() };
        const submissionId = `${submission.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
        await env.FORM_DATA_KV.put(submissionId, JSON.stringify(submission));

        // Retrieve all submissions
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

        return new Response(JSON.stringify({ submissions, counter: submissionCounter }), {
          headers: { 'Content-Type': 'application/json' }
        });
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

        return new Response(JSON.stringify({ submissions, counter: submissionCounter }), {
          headers: { 'Content-Type': 'application/json' }
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
}
