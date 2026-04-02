import type { APIRoute } from 'astro';
import { getActiveFiles, MAX_FILES } from '../../../lib/manifest';

export const GET: APIRoute = async () => {
  const now = Date.now();
  const files = await getActiveFiles(now);
  const body = files.map((f) => ({
    id: f.id,
    originalName: f.originalName,
    size: f.size,
    url: f.url,
    uploadedAt: f.uploadedAt,
    expiresAt: f.expiresAt,
    msRemaining: Math.max(0, f.expiresAt - now),
  }));

  return new Response(
    JSON.stringify({
      files: body,
      maxFiles: MAX_FILES,
      slotsUsed: body.length,
      slotsAvailable: Math.max(0, MAX_FILES - body.length),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};
