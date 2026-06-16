import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const serverRoot = process.cwd();
const projectRoot = path.resolve(serverRoot, "..");
const clientRoot = path.join(projectRoot, "client");

const checks = [];
let hasError = false;
let hasWarning = false;

function ok(name, detail = "") {
  checks.push({ status: "OK", name, detail });
}

function warn(name, detail = "") {
  hasWarning = true;
  checks.push({ status: "WARN", name, detail });
}

function fail(name, detail = "") {
  hasError = true;
  checks.push({ status: "FAIL", name, detail });
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function commandExists(command) {
  try {
    execSync(`${command} --version`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function formatBytes(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

function walkFiles(dir, files = []) {
  if (!exists(dir)) return files;

  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      walkFiles(full, files);
    } else {
      files.push({ path: full, size: stat.size });
    }
  }

  return files;
}

function checkFileExists(label, filePath, required = true) {
  if (exists(filePath)) {
    ok(label, filePath);
  } else if (required) {
    fail(label, `Não encontrado: ${filePath}`);
  } else {
    warn(label, `Não encontrado: ${filePath}`);
  }
}

console.log("\n🚀 FootEra release:check\n");

const serverPackagePath = path.join(serverRoot, "package.json");
const clientPackagePath = path.join(clientRoot, "package.json");
const serverIndexPath = path.join(serverRoot, "index.ts");
const clientRoutesPath = path.join(clientRoot, "src", "routes.tsx");
const rootPackagePath = path.join(projectRoot, "package.json");
const playwrightConfigPath = path.join(projectRoot, "playwright.config.ts");
const gitignorePath = path.join(projectRoot, ".gitignore");
const testsE2eRoot = path.join(projectRoot, "tests", "e2e");

checkFileExists("package.json do server", serverPackagePath);
checkFileExists("package.json do client", clientPackagePath);
checkFileExists("server/index.ts", serverIndexPath);
checkFileExists("client/src/routes.tsx", clientRoutesPath);
checkFileExists("package.json da raiz", rootPackagePath);
checkFileExists("playwright.config.ts", playwrightConfigPath);
checkFileExists("tests/e2e existe", testsE2eRoot);

if (commandExists("node")) ok("Node disponível");
else fail("Node disponível", "Comando node não encontrado.");

if (commandExists("npm")) ok("NPM disponível");
else fail("NPM disponível", "Comando npm não encontrado.");

let serverPackage = null;
let clientPackage = null;

if (exists(serverPackagePath)) {
  serverPackage = readJson(serverPackagePath);

  if (serverPackage.scripts?.build) ok("server tem script build", serverPackage.scripts.build);
  else fail("server tem script build");

  if (serverPackage.scripts?.start) ok("server tem script start", serverPackage.scripts.start);
  else fail("server tem script start");

  if (serverPackage.scripts?.["migrate:prod"]) ok("server tem script migrate:prod", serverPackage.scripts["migrate:prod"]);
  else warn("server tem script migrate:prod", "Recomendado para deploy com Prisma.");

  if (serverPackage.scripts?.postinstall?.includes("prisma generate")) {
    ok("server roda prisma generate no postinstall", serverPackage.scripts.postinstall);
  } else {
    warn("server roda prisma generate no postinstall", "Recomendado manter prisma generate no deploy.");
  }

  if (serverPackage.engines?.node) ok("server define versão mínima do Node", serverPackage.engines.node);
  else warn("server define versão mínima do Node");
}

if (exists(clientPackagePath)) {
  clientPackage = readJson(clientPackagePath);

  if (clientPackage.scripts?.build) ok("client tem script build", clientPackage.scripts.build);
  else fail("client tem script build");

  if (clientPackage.dependencies?.["@capacitor/android"]) {
    ok("client tem Capacitor Android", clientPackage.dependencies["@capacitor/android"]);
  } else {
    warn("client tem Capacitor Android", "Não achei @capacitor/android.");
  }

  if (clientPackage.dependencies?.["@capawesome/capacitor-google-sign-in"]) {
    ok("client usa plugin Google Sign-In do app", clientPackage.dependencies["@capawesome/capacitor-google-sign-in"]);
  } else {
    warn("client usa plugin Google Sign-In do app", "Não achei @capawesome/capacitor-google-sign-in.");
  }
}

if (exists(rootPackagePath)) {
  const rootPackage = readJson(rootPackagePath);

  const requiredRootScripts = [
    "test:routes",
    "test:admin",
    "test:users",
    "test:creators",
    "test:predeploy",
  ];

  for (const script of requiredRootScripts) {
    if (rootPackage.scripts?.[script]) {
      ok(`root tem script ${script}`, rootPackage.scripts[script]);
    } else {
      fail(`root tem script ${script}`, "Script obrigatório para validar Playwright/predeploy.");
    }
  }

  const hasPlaywright =
    rootPackage.devDependencies?.["@playwright/test"] ||
    rootPackage.dependencies?.["@playwright/test"];

  if (hasPlaywright) {
    ok("root tem @playwright/test", hasPlaywright);
  } else {
    fail("root tem @playwright/test", "Instale @playwright/test para E2E.");
  }
}

if (exists(serverIndexPath)) {
  const index = read(serverIndexPath);

  if (index.includes('app.get("/api/health"')) ok("backend tem /api/health");
  else fail("backend tem /api/health", "Crie GET /api/health para monitoramento.");

  if (index.includes("cors(")) ok("backend usa CORS");
  else fail("backend usa CORS");

  if (index.includes("helmet(")) ok("backend usa helmet");
  else warn("backend usa helmet", "Recomendado em produção.");

  if (index.includes("express.json({ limit:")) ok("backend configura limite JSON");
  else warn("backend configura limite JSON");

  if (index.includes("express.urlencoded({ limit:")) ok("backend configura limite URL encoded");
  else warn("backend configura limite URL encoded");

  const requiredApiMounts = [
    "/api/auth",
    "/api/auth/google",
    "/api/upload",
    "/api/treinos",
    "/api/aulas-ao-vivo",
    "/api/metodologias",
    "/api/creator",
    "/api/billing",
    "/api/perfil",
    "/api/admin",
  ];

  for (const route of requiredApiMounts) {
    if (index.includes(`app.use("${route}"`) || index.includes(`app.use('${route}'`)) {
      ok(`backend monta ${route}`);
    } else {
      fail(`backend monta ${route}`, "Rota crítica não encontrada no index.ts.");
    }
  }

  const dangerousLogs = [
    "console.log(\"[ENV] GOOGLE_CLIENT_ID:\", process.env.GOOGLE_CLIENT_ID",
    "console.log('[ENV] GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID",
    "console.log(\"[ENV] JWT_SECRET:\", process.env.JWT_SECRET",
    "console.log('[ENV] JWT_SECRET:', process.env.JWT_SECRET",
    "console.log(process.env.JWT_SECRET",
  ];

  for (const log of dangerousLogs) {
   if (index.includes(log)) {
        warn("logs de ambiente sensível no server/index.ts", `Encontrado: ${log}`);
   }
  }
}

if (exists(clientRoutesPath)) {
  const routes = read(clientRoutesPath);

  const requiredClientRoutes = [
    "/login",
    "/cadastro",
    "/admin",
    "/perfil",
    "/treinos",
    "/learning",
    "/learning/create",
    "/learning/live",
    "/learning/live-studio",
    "/creator/dashboard",
    "/creator/profile",
    "/creator/eventos",
    "/pagamentos",
  ];

  for (const route of requiredClientRoutes) {
    if (routes.includes(`path="${route}"`)) {
      ok(`frontend tem rota ${route}`);
    } else {
      fail(`frontend tem rota ${route}`, "Rota crítica não encontrada no routes.tsx.");
    }
  }

  if (routes.includes("../../../server/") || routes.includes("../../server/") || routes.includes("../server/")) {
    fail("frontend não importa arquivos do server", "Tem import apontando para server dentro do client.");
  } else {
    ok("frontend não importa arquivos do server");
  }

  if (routes.includes("localhost") || routes.includes("10.0.2.2")) {
    warn("routes.tsx tem host local hardcoded", "Evite localhost/10.0.2.2 direto em rotas.");
  } else {
    ok("routes.tsx sem host local hardcoded");
  }
}

const requiredE2eFiles = [
  "routes-public.spec.ts",
  "auth.setup.ts",
  "admin.smoke.spec.ts",
  "user.setup.ts",
  "user.smoke.spec.ts",
  "creator.smoke.spec.ts",
  "tsconfig.json",
];

if (exists(testsE2eRoot)) {
  for (const file of requiredE2eFiles) {
    checkFileExists(
      `tests/e2e/${file}`,
      path.join(testsE2eRoot, file)
    );
  }

const authDir = path.join(testsE2eRoot, ".auth");
if (exists(authDir)) {
  const gitignore = exists(gitignorePath) ? read(gitignorePath) : "";

  if (gitignore.includes("tests/e2e/.auth/")) {
    ok(
      "tests/e2e/.auth existe localmente e está ignorado",
      "Tokens locais do Playwright não devem ir para o Git."
    );
  } else {
    fail(
      "tests/e2e/.auth existe mas não está no .gitignore",
      "Adicione tests/e2e/.auth/ no .gitignore para não commitar tokens."
    );
  }
} else {
  ok("tests/e2e/.auth não existe no projeto limpo");
}
}

const prismaSchemaPath = path.join(serverRoot, "prisma", "schema.prisma");
checkFileExists("Prisma schema existe", prismaSchemaPath);

const procfilePath = path.join(serverRoot, "Procfile");
checkFileExists("Procfile existe para Elastic Beanstalk", procfilePath, false);

const platformPath = path.join(serverRoot, ".platform");
checkFileExists(".platform existe para configs do Elastic Beanstalk/Nginx", platformPath, false);

const clientPublicAssets = path.join(clientRoot, "public", "assets");
if (exists(clientPublicAssets)) {
  const files = walkFiles(clientPublicAssets);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const bigFiles = files.filter((file) => file.size > 2 * 1024 * 1024);

  if (total > 50 * 1024 * 1024) {
    warn("assets públicos do client estão grandes", `Total: ${formatBytes(total)}. Isso aumenta o AAB/site.`);
  } else {
    ok("tamanho total de assets públicos do client", formatBytes(total));
  }

  for (const file of bigFiles) {
    warn("arquivo grande em client/public/assets", `${path.relative(clientRoot, file.path)} - ${formatBytes(file.size)}`);
  }
} else {
  warn("client/public/assets não encontrado", "Tudo bem se seus assets estiverem em outro lugar.");
}

if (exists(gitignorePath)) {
  const gitignore = read(gitignorePath);

  const requiredIgnores = [
    "tests/e2e/.auth/",
    "playwright-report/",
    "test-results/",
    "footera-server-release.zip",
    ".eb-release-staging/",
    ".zip-check-temp/",
  ];

  for (const item of requiredIgnores) {
    if (gitignore.includes(item)) {
      ok(`.gitignore ignora ${item}`);
    } else {
      warn(`.gitignore deveria ignorar ${item}`);
    }
  }
} else {
  warn(".gitignore não encontrado", "Recomendado criar .gitignore na raiz.");
}

const productionEnvFiles = [
  path.join(clientRoot, ".env.production"),
  path.join(serverRoot, ".env.production"),
];

for (const envPath of productionEnvFiles) {
  if (!exists(envPath)) {
    warn("arquivo .env.production não encontrado", envPath);
    continue;
  }

  const env = read(envPath);

  if (env.includes("localhost") || env.includes("10.0.2.2")) {
    fail(".env.production não pode apontar para localhost/10.0.2.2", envPath);
  } else {
    ok(`${path.relative(projectRoot, envPath)} sem localhost/10.0.2.2`);
  }
}

console.log("");

for (const check of checks) {
  const icon =
    check.status === "OK" ? "✅" :
    check.status === "WARN" ? "⚠️ " :
    "❌";

  console.log(`${icon} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
}

console.log("");

if (hasError) {
  console.log("❌ release:check encontrou erros que devem ser corrigidos antes do release.");
  process.exit(1);
}

if (hasWarning) {
  console.log("⚠️  release:check passou, mas encontrou avisos importantes.");
  process.exit(0);
}

console.log("✅ release:check passou sem erros nem avisos.");