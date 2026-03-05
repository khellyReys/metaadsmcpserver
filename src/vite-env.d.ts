/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_MCP_URL: string;
  readonly VITE_APP_URL: string;
  readonly VITE_FACEBOOK_APP_ID: string;
  readonly [key: string]: string | undefined;
}

interface Window {
  __getEnv__?: (key: string) => string | undefined;
}
