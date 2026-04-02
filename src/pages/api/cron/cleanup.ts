import type { APIRoute } from 'astro';
import { del } from '@vercel/blob';
import { pruneExpiredBlobs } from '../../../lib/manifest';

function isAuthorizedCron(request: Request): boolean {
  if (request.headers.get('x-vercel-cron') === '1') {
    return true;
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const removed = await pruneExpiredBlobs((url) => del(url));

  return new Response(JSON.stringify({ ok: true, removed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async (ctx) => GET(ctx);
