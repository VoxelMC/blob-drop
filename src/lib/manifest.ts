import { Redis } from '@upstash/redis';

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
if (!url || !token) {
  throw new Error('KV_REST_API_URL and KV_REST_API_TOKEN are required');
}
const redis = new Redis({ url, token });
const MANIFEST_KEY = 'manifest:files';

export const MAX_FILES = 3;
export const MAX_BYTES = 200 * 1024 * 1024;
export const TTL_MS = 60 * 60 * 1000; // 1 hour

export type FileRecord = {
  id: string;
  pathname: string;
  url: string;
  originalName: string;
  size: number;
  uploadedAt: number;
  expiresAt: number;
};

export async function getManifest(): Promise<FileRecord[]> {
  const data = await redis.get<FileRecord[]>(MANIFEST_KEY);
  return Array.isArray(data) ? data : [];
}

export async function setManifest(files: FileRecord[]): Promise<void> {
  await redis.set(MANIFEST_KEY, files);
}

export function filterActive(files: FileRecord[], now = Date.now()): FileRecord[] {
  return files.filter((f) => f.expiresAt > now);
}

/** Non-expired entries only (for slot counting) */
export async function getActiveFiles(now = Date.now()): Promise<FileRecord[]> {
  return filterActive(await getManifest(), now);
}

export async function assertCanUpload(now = Date.now()): Promise<void> {
  const active = await getActiveFiles(now);
  if (active.length >= MAX_FILES) {
    const err = new Error('SLOT_LIMIT');
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}

export function makeRecord(input: {
  pathname: string;
  url: string;
  originalName: string;
  size: number;
  now?: number;
}): FileRecord {
  const now = input.now ?? Date.now();
  return {
    id: crypto.randomUUID(),
    pathname: input.pathname,
    url: input.url,
    originalName: input.originalName,
    size: input.size,
    uploadedAt: now,
    expiresAt: now + TTL_MS,
  };
}

export async function appendRecord(record: FileRecord): Promise<void> {
  const all = await getManifest();
  const active = filterActive(all);
  if (active.length >= MAX_FILES) {
    const err = new Error('SLOT_LIMIT');
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  all.push(record);
  await setManifest(all);
}

export async function findById(id: string): Promise<FileRecord | null> {
  const all = await getManifest();
  return all.find((f) => f.id === id) ?? null;
}

export async function removeById(id: string): Promise<FileRecord | null> {
  const all = await getManifest();
  const idx = all.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  const [removed] = all.splice(idx, 1);
  await setManifest(all);
  return removed ?? null;
}

export async function pruneExpiredBlobs(
  delBlob: (url: string) => Promise<void>,
): Promise<number> {
  const all = await getManifest();
  const now = Date.now();
  const keep: FileRecord[] = [];
  let removed = 0;
  for (const f of all) {
    if (f.expiresAt <= now) {
      try {
        await delBlob(f.url);
      } catch {
        // best-effort delete
      }
      removed++;
    } else {
      keep.push(f);
    }
  }
  if (keep.length !== all.length) {
    await setManifest(keep);
  }
  return removed;
}
