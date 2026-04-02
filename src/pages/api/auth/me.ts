import type { APIRoute } from 'astro';
import { isAuthenticatedRequest } from '../../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  const authenticated = await isAuthenticatedRequest(request);
  return new Response(JSON.stringify({ authenticated }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
