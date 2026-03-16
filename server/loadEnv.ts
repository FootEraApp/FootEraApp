import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nodeEnv = process.env.NODE_ENV || "development";

const candidates = [
  path.resolve(__dirname, `.env.${nodeEnv}`),
  path.resolve(__dirname, ".env"),
  path.resolve(process.cwd(), `server/.env.${nodeEnv}`),
  path.resolve(process.cwd(), "server/.env"),
  path.resolve(process.cwd(), `.env.${nodeEnv}`),
  path.resolve(process.cwd(), ".env"),
];

for (const file of candidates) {
  if (fs.existsSync(file)) {
    dotenv.config({ path: file });
    console.log(`[dotenv] carregado: ${file}`);
    break;
  }
}