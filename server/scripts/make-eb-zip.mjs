import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const serverRoot = process.cwd();
const projectRoot = path.resolve(serverRoot, "..");

const zipName = "footera-server-release.zip";
const zipPath = path.join(projectRoot, zipName);
const stagingDir = path.join(projectRoot, ".eb-release-staging");

function log(message) {
  console.log(message);
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function exists(relativePath) {
  return fs.existsSync(path.join(serverRoot, relativePath));
}

function copyItem(fromRelative, toRelative = fromRelative) {
  const from = path.join(serverRoot, fromRelative);
  const to = path.join(stagingDir, toRelative);

  if (!fs.existsSync(from)) return;

  fs.cpSync(from, to, {
    recursive: true,
    force: true,
  });
}

function removeIfExists(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, {
      recursive: true,
      force: true,
    });
  }
}

log("📦 Preparando ZIP do Elastic Beanstalk...");

const required = [
  "dist",
  "prisma",
  "package.json",
  "package-lock.json",
  "Procfile",
  ".platform",
];

const missing = required.filter((item) => !exists(item));

if (missing.length > 0) {
  fail(`Não dá para gerar o ZIP. Faltando: ${missing.join(", ")}`);
}

removeIfExists(zipPath);
removeIfExists(stagingDir);

fs.mkdirSync(stagingDir, { recursive: true });

copyItem(".platform");
copyItem("dist");
copyItem("prisma");
copyItem("public");
copyItem("package.json");
copyItem("package-lock.json");
copyItem("Procfile");

log("Incluindo no ZIP:");
for (const item of fs.readdirSync(stagingDir, { withFileTypes: true })) {
  log(`- ${item.name}`);
}

const command = `
$ErrorActionPreference = "Stop";
$items = Get-ChildItem -LiteralPath "${stagingDir}" -Force;
Compress-Archive -Path $items.FullName -DestinationPath "${zipPath}" -Force;
`;

const result = spawnSync(
  "powershell.exe",
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
  {
    cwd: projectRoot,
    stdio: "inherit",
  }
);

if (result.status !== 0) {
  removeIfExists(stagingDir);
  fail("Falha ao gerar ZIP com PowerShell.");
}

removeIfExists(stagingDir);

if (!fs.existsSync(zipPath)) {
  fail(`ZIP não foi criado: ${zipPath}`);
}

const sizeMb = fs.statSync(zipPath).size / 1024 / 1024;

log("");
log(`✅ ZIP gerado com sucesso: ${zipPath}`);
log(`📏 Tamanho: ${sizeMb.toFixed(2)} MB`);