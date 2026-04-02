import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'blob_drop_session';

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

function getSessionSecret(): Uint8Array {
  const s = import.meta.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET must be set (min 16 chars)');
  }
  return new TextEncoder().encode(s);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSessionSecret());
    return true;
  } catch {
    return false;
  }
}

export function getSessionTokenFromRequest(request: Request): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === SESSION_COOKIE) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export async function isAuthenticatedRequest(request: Request): Promise<boolean> {
  const token = getSessionTokenFromRequest(request);
  if (!token) return false;
  return verifySessionToken(token);
}

/** Append Set-Cookie for a new session */
export function withSessionCookie(headers: Headers, token: string): void {
  const secure = import.meta.env.PROD;
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE_SEC}`,
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  headers.append('Set-Cookie', parts.join('; '));
}

export function withClearSessionCookie(headers: Headers): void {
  const secure = import.meta.env.PROD;
  const parts = [`${SESSION_COOKIE}=`, 'HttpOnly', 'Path=/', 'Max-Age=0', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  headers.append('Set-Cookie', parts.join('; '));
}
