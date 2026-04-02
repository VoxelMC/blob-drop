/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly KV_REST_API_URL: string;
  readonly KV_REST_API_TOKEN: string;
  readonly ADMIN_USERNAME: string;
  readonly ADMIN_PASSWORD_HASH: string;
  readonly SESSION_SECRET: string;
  /** Optional manual cron trigger */
  readonly CRON_SECRET?: string;
  readonly PUBLIC_APP_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
