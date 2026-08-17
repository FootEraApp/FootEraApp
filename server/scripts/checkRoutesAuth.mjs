import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, "..");
const ROUTES_DIR = path.join(SERVER_DIR, "routes");
const INDEX_FILE = path.join(SERVER_DIR, "index.ts");

const PUBLIC_ROUTES = {
  "status.ts": "health-check / modo manutenção, consultado antes do login",
  "googleAuth.ts": "fluxo de login com Google",
  "auth.ts": "login/registro",
  "cadastro.ts": "cadastro de novo usuário",
  "login.ts": "login",
  "legal.ts": "termos públicos",
  "termo.ts": "termos públicos",
  "learningEventos.ts": "landing pública de eventos, usa checagem de token opcional internamente",
  "billing.ts": "webhooks de pagamento (públicos por natureza) + rotas internas protegidas por router.use(authenticateToken)",
  "removerTreinosExpirados.ts": "endpoint interno de manutenção — revisar se ainda é necessário",
};

const AUTH_MARKERS = [
  "authenticateToken",
  "adminAuth",
  "requireAdmin",
  "getUserIdFromOptionalToken",
];

function extractRouteMountAuth() {
  const indexSrc = fs.readFileSync(INDEX_FILE, "utf8");

  const importMap = new Map();
  const importRe = /import\s+(\w+)\s+from\s+["']\.\/routes\/([^"']+)["']/g;
  let m;
  while ((m = importRe.exec(indexSrc))) {
    importMap.set(m[1], m[2].replace(/\.js$/, ""));
  }

  const mountedWithAuth = new Map();
  const useRe = /app\.use\(\s*["'][^"']+["']\s*,([^)]*)\)/g;
  while ((m = useRe.exec(indexSrc))) {
    const argsBlock = m[1];
    const hasAuth = /authenticateToken|adminAuth|requireAdmin/.test(argsBlock);
    for (const [varName, fileBase] of importMap) {
      if (new RegExp(`\\b${varName}\\b`).test(argsBlock)) {
        mountedWithAuth.set(fileBase, hasAuth || mountedWithAuth.get(fileBase) === true);
      }
    }
  }

  return mountedWithAuth;
}

function main() {
  const mountedWithAuth = extractRouteMountAuth();
  const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".ts"));

  const failures = [];

  for (const file of files) {
    const baseNoExt = file.replace(/\.ts$/, "");
    const mounted = mountedWithAuth.get(baseNoExt) === true;
    if (mounted) continue;

    if (PUBLIC_ROUTES[file]) continue;

    const src = fs.readFileSync(path.join(ROUTES_DIR, file), "utf8");
    const hasInlineGuard = AUTH_MARKERS.some((marker) => src.includes(marker));
    if (hasInlineGuard) continue;

    failures.push(file);
  }

  if (failures.length) {
    console.error("\n[checkRoutesAuth] Rotas sem guard de autenticação detectado:\n");
    for (const f of failures) {
      console.error(`  - server/routes/${f}`);
    }
    console.error(
      "\nAdicione authenticateToken/adminAuth/requireAdmin (no mount em server/index.ts ou dentro do arquivo),\n" +
        "ou, se a rota é pública de propósito, adicione-a em PUBLIC_ROUTES com o motivo em server/scripts/checkRoutesAuth.mjs.\n"
    );
    process.exit(1);
  }

  console.log(`[checkRoutesAuth] OK — ${files.length} arquivos de rota verificados.`);
}

main();
