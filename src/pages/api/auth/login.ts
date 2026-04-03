import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';
import { createSessionToken, withSessionCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  const username = import.meta.env.ADMIN_USERNAME;
  const hash = import.meta.env.ADMIN_PASSWORD_HASH;
  if (!username || !hash) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { username?: string; password?: string; };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const u = typeof body.username === 'string' ? body.username : '';
  const p = typeof body.password === 'string' ? body.password : '';

  const okUser = u === username;
  let okPass = false;
  if (okUser && p) {
    try {
      okPass = await bcrypt.compare(p, hash);
    } catch {
      okPass = false;
    }
  }

  if (!okUser || !okPass) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = await createSessionToken();
  const headers = new Headers({ 'Content-Type': 'application/json' });
  withSessionCookie(headers, token);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
