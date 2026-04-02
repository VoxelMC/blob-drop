import type { APIRoute } from 'astro';
import { del } from '@vercel/blob';
import { isAuthenticatedRequest } from '../../../lib/auth';
import { findById, removeById } from '../../../lib/manifest';

export const DELETE: APIRoute = async ({ params, request }) => {
  if (!(await isAuthenticatedRequest(request))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rec = await findById(id);
  if (!rec) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await del(rec.url);
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to delete file from storage' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await removeById(id);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
