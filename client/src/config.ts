const viteUrl =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env &&
    (import.meta as any).env.VITE_API_URL) as string | undefined;

const nodeUrl =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.VITE_API_URL) as string | undefined;

const base = viteUrl ?? nodeUrl ?? "http://localhost:3001";

export const API = {
  BASE_URL: base,
  UPLOADS_URL: `${base}/uploads`,
};