import path from "path";
import fs from "fs";
import { UPLOADS_ROOT } from "./uploads.js";

function isHttpUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

export function sanitizeMediaPath(input?: string | null): string | null {
  const v = (input ?? "").trim();
  if (!v) return null;

  if (isHttpUrl(v)) return v;

  if (v.startsWith("/uploads/")) {
    const abs = path.join(UPLOADS_ROOT, v.replace("/uploads/", ""));
    return fs.existsSync(abs) ? v : null;
  }

  if (v.startsWith("/assets/")) {
    const abs = path.resolve(
      process.cwd(),
      "client",
      "public",
      v.replace(/^\//, "")
    );
    return fs.existsSync(abs) ? v : null;
  }

  return null;
}