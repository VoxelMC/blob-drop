import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import { upload } from '@vercel/blob/client';
import { RiDownload2Line } from '@remixicon/react';

const MAX_BYTES = 200 * 1024 * 1024;

type FileRow = {
  id: string;
  originalName: string;
  size: number;
  url: string;
  uploadedAt: number;
  expiresAt: number;
  msRemaining: number;
};

type FilesPayload = {
  files: FileRow[];
  maxFiles: number;
  slotsUsed: number;
  slotsAvailable: number;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m`;
  }
  return `${m}m ${r}s`;
}

function safePathSegment(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180);
  return base || 'file';
}

export default function DropZone() {
  const [auth, setAuth] = useState<boolean | null>(null);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [files, setFiles] = useState<FileRow[]>([]);
  const [slots, setSlots] = useState({ max: 3, available: 3 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  const [signInOpen, setSignInOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [meRes, listRes] = await Promise.all([
      fetch('/api/auth/me', { credentials: 'include' }),
      fetch('/api/files', { credentials: 'include' }),
    ]);
    const me = await meRes.json();
    setAuth(!!me.authenticated);
    const list = (await listRes.json()) as FilesPayload;
    setFiles(list.files ?? []);
    setSlots({
      max: list.maxFiles ?? 3,
      available: list.slotsAvailable ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string; }).error ?? 'Login failed');
      }
      setPass('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    setBusy(true);
    setSignInOpen(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const runUpload = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`File too large (max ${formatBytes(MAX_BYTES)})`);
      return;
    }
    if (!auth) {
      setSignInOpen(true);
      setError('Sign in to upload');
      return;
    }
    if (slots.available <= 0) {
      setError('Maximum 3 files — delete one first.');
      return;
    }
    setBusy(true);
    setUploadPct(0);
    try {
      const pathname = `drop/${crypto.randomUUID()}-${safePathSegment(file.name)}`;
      await upload(pathname, file, {
        access: 'public',
        handleUploadUrl: '/api/blob/handle-upload',
        multipart: true,
        clientPayload: JSON.stringify({
          originalName: file.name,
          size: file.size,
        }),
        onUploadProgress: ({ loaded, total }) => {
          if (total) setUploadPct(Math.round((100 * loaded) / total));
        },
      });
      setUploadPct(null);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
      setUploadPct(null);
    } finally {
      setBusy(false);
    }
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void runUpload(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (f) void runUpload(f);
  };

  const onDelete = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string; }).error ?? 'Delete failed');
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const full = slots.available <= 0;
  const canInteract = auth && !full && !busy;

  return (
    <div className="dz-root">
      <header className="dz-header glass">
        <div>
          <h1 className="dz-title">Blob Drop!</h1>
          <p className="dz-sub">
            Public downloads · up to {slots.max} files · 24 hours each · 200 MB max
          </p>
        </div>
        <div className="dz-auth">
          {loading ? (
            <span className="dz-muted">Loading…</span>
          ) : auth ? (
            <button type="button" className="dz-btn ghost" onClick={onLogout} disabled={busy}>
              Sign out
            </button>
          ) : (
            <button
              type="button"
              className="dz-btn ghost"
              onClick={() => setSignInOpen((o) => !o)}
              aria-expanded={signInOpen}
              aria-controls="sign-in-panel"
            >
              {signInOpen ? 'Hide sign in' : 'Sign in'}
            </button>
          )}
        </div>
      </header>

      {!loading && !auth && signInOpen ? (
        <section id="sign-in-panel" className="glass dz-panel dz-signin-panel">
          <h2 className="dz-h2">Sign in to upload or delete</h2>
          <form className="dz-form" onSubmit={onLogin}>
            <label className="dz-label">
              Username
              <input
                className="dz-input"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label className="dz-label">
              Password
              <input
                className="dz-input"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" className="dz-btn primary" disabled={busy}>
              Sign in
            </button>
          </form>
        </section>
      ) : null}

      <section
        className={`glass dz-drop ${canInteract ? 'active' : 'disabled'}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={onDrop}
      >
        <p className="dz-drop-title">Drop a file here</p>
        <p className="dz-muted">
          {full
            ? 'All slots full — delete a file to upload again.'
            : !auth
              ? 'Sign in to enable uploads.'
              : 'Or use the button below on mobile.'}
        </p>
        <input
          ref={inputRef}
          type="file"
          className="dz-hidden-input"
          onChange={onPick}
          disabled={!canInteract}
        />
        <button
          type="button"
          className="dz-btn primary"
          disabled={!canInteract}
          onClick={() => inputRef.current?.click()}
        >
          Choose file
        </button>
        {uploadPct !== null ? (
          <p className="dz-progress">Uploading… {uploadPct}%</p>
        ) : null}
      </section>

      {error ? <p className="dz-error">{error}</p> : null}

      <section className="glass dz-list">
        <h2 className="dz-h2">Files ({files.length}/{slots.max})</h2>
        {files.length === 0 ? (
          <p className="dz-muted">No active files.</p>
        ) : (
          <ul className="dz-ul">
            {files.map((f) => {
              const ms = Math.max(0, f.expiresAt - tick);
              return (
                <li key={f.id} className="dz-li">
                  <div className="dz-li-main">
                    <a className="dz-link" href={f.url} download={f.originalName}>
                      {f.originalName}
                    </a>
                    <span className="dz-meta">
                      {formatBytes(f.size)} · expires in {formatRemaining(ms)}
                    </span>
                  </div>
                  {/* <div> */}
                  <a className="dz-btn primary" href={`/api/files/download?url=${f.url}&filename=${f.originalName}`} target="_blank"><RiDownload2Line /></a>
                  {/* </div> */}
                  {auth ? (
                    <button
                      type="button"
                      className="dz-btn danger ghost"
                      disabled={busy}
                      onClick={() => onDelete(f.id)}
                    >
                      Delete
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
