/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  VITE_APP_PORT: string;
  VITE_APP_DISABLE_PREVENT_UNLOAD?: string;
  VITE_APP_COLLAPSE_OVERLAY: string;
  VITE_APP_ENABLE_ESLINT: string;
  VITE_APP_GIT_SHA: string;

  MODE: string;
  DEV: boolean;
  PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
