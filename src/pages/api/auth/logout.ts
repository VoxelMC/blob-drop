import type { APIRoute } from 'astro';
import { withClearSessionCookie } from '../../../lib/auth';

export const POST: APIRoute = async () => {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  withClearSessionCookie(headers);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
