import type { APIRoute } from 'astro';
import type { HandleUploadBody } from '@vercel/blob/client';
import { handleUpload } from '@vercel/blob/client';
import { del } from '@vercel/blob';
import { isAuthenticatedRequest } from '../../../lib/auth';
import {
  appendRecord,
  assertCanUpload,
  makeRecord,
  MAX_BYTES,
} from '../../../lib/manifest';

export const POST: APIRoute = async ({ request }) => {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const jsonResponse = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload, _multipart) => {
        if (!(await isAuthenticatedRequest(request))) {
          throw new Error('Unauthorized');
        }
        await assertCanUpload();

        let originalName = 'file';
        let size = 0;
        try {
          const p = clientPayload ? JSON.parse(clientPayload) : {};
          if (typeof p.originalName === 'string') originalName = p.originalName;
          if (typeof p.size === 'number') size = p.size;
        } catch {
          /* ignore */
        }

        return {
          maximumSizeInBytes: MAX_BYTES,
          tokenPayload: JSON.stringify({
            originalName,
            size,
            pathname,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        let originalName = 'file';
        let size = 0;
        try {
          const p = tokenPayload ? JSON.parse(String(tokenPayload)) : {};
          if (typeof p.originalName === 'string') originalName = p.originalName;
          if (typeof p.size === 'number') size = p.size;
        } catch {
          /* ignore */
        }

        const record = makeRecord({
          pathname: blob.pathname,
          url: blob.url,
          originalName,
          size,
        });

        try {
          await appendRecord(record);
        } catch {
          await del(blob.url);
          throw new Error('SLOT_LIMIT');
        }
      },
    });

    return new Response(JSON.stringify(jsonResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload error';
    let status = 400;
    if (message === 'Unauthorized') status = 401;
    if (message === 'SLOT_LIMIT' || message.includes('SLOT_LIMIT')) status = 403;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
