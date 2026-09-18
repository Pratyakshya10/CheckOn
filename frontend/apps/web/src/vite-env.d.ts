/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DEMO_LOGIN_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
