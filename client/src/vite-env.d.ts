/// <reference types="vite/client" />

declare module "*.png" {
  const value: string;
  export default value;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_FRONTEND_URL: string;
  readonly VITE_APP_URL?: string; // opcional se você nem sempre usa
  // NÃO declare PROD/DEV aqui — o Vite já fornece via vite/client
}