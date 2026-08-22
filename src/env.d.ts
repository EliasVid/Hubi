/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type D1Database = import('@cloudflare/workers-types').D1Database;
type R2Bucket = import('@cloudflare/workers-types').R2Bucket;

interface Env {
  DB: D1Database;
  AVATARS_BUCKET: R2Bucket;
}

declare module 'cloudflare:workers' {
  const env: Env;
  export { env };
}

interface ImportMetaEnv {}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}