/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ROUTING_VALIDATION_OVERLAY?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
