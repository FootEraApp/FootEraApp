import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..", "..");

export const UPLOADS_ROOT = path.join(ROOT, "uploads");
export const FORMADORES_DIR = path.join(UPLOADS_ROOT, "formadores");

export function ensureUploadDirs() {
  fs.mkdirSync(FORMADORES_DIR, { recursive: true });
}