import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const serverRoot = process.cwd();
const projectRoot = path.resolve(serverRoot, "..");
const zipPath = path.join(projectRoot, "footera-server-release.zip");
const tempDir = path.join(projectRoot, ".zip-check-temp");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function warn(message) {
  console.log(`⚠️  ${message}`);
}

if (!fs.existsSync(zipPath)) {
  fail(`ZIP não encontrado: ${zipPath}`);
}

if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

fs.mkdirSync(tempDir, { recursive: true });

console.log("🔍 Verificando conteúdo do ZIP...");
console.log("ZIP:", zipPath);

const ps = spawnSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    `Expand-Archive -Path "${zipPath}" -DestinationPath "${tempDir}" -Force`
  ],
  { stdio: "inherit" }
);

if (ps.status !== 0) {
  fail("Não consegui extrair o ZIP para validar.");
}

function existsInside(relativePath) {
  return fs.existsSync(path.join(tempDir, relativePath));
}

const required = [
  "dist/index.js",
  "prisma/schema.prisma",
  "package.json",
  "package-lock.json",
  "Procfile",
  ".platform",
];

for (const item of required) {
  if (existsInside(item)) ok(`ZIP contém ${item}`);
  else fail(`ZIP não contém ${item}`);
}

const forbidden = [
  ".env",
  ".env.production",
  ".env.development",
  "node_modules",
  "uploads",
  "client",
  "tests",
  "playwright-report",
  "test-results",
  ".auth",
  ".eb-release-staging",
  ".zip-check-temp",
];

for (const item of forbidden) {
  if (existsInside(item)) {
    warn(`ZIP contém ${item}. Verifique se isso é intencional.`);
  }
}

fs.rmSync(tempDir, { recursive: true, force: true });

ok("ZIP validado com sucesso.");