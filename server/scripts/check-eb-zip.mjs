
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const serverRoot = process.cwd();
const projectRoot = path.resolve(serverRoot, "..");

const zipPath = path.join(
  projectRoot,
  "footera-server-release.zip"
);

const tempDir = path.join(
  projectRoot,
  ".zip-check-temp"
);

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function warn(message) {
  console.warn(`⚠️ ${message}`);
}

function existe(relativePath) {
  return fs.existsSync(
    path.join(tempDir, relativePath)
  );
}

function lerJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(
      path.join(tempDir, relativePath),
      "utf8"
    )
  );
}

function verificarArquivo(relativePath) {
  if (!existe(relativePath)) {
    fail(`ZIP não contém ${relativePath}`);
  }

  ok(`ZIP contém ${relativePath}`);
}

function verificarConteudoIdentico(
  origem,
  destino,
  descricao
) {
  if (
    !fs.existsSync(origem) ||
    !fs.existsSync(destino)
  ) {
    fail(`${descricao}: arquivo ausente.`);
  }

  const a = fs.readFileSync(origem);
  const b = fs.readFileSync(destino);

  if (!a.equals(b)) {
    fail(`${descricao}: conteúdo diferente.`);
  }

  ok(`${descricao}: conteúdo idêntico.`);
}

function listarMigrations(diretorio) {
  if (!fs.existsSync(diretorio)) {
    fail(`Pasta de migrations ausente: ${diretorio}`);
  }

  return fs
    .readdirSync(diretorio, {
      withFileTypes: true,
    })
    .filter(
      (item) =>
        item.isDirectory() &&
        fs.existsSync(
          path.join(
            diretorio,
            item.name,
            "migration.sql"
          )
        )
    )
    .map((item) => item.name)
    .sort();
}

function encontrarArquivosSensiveis(
  diretorio,
  relativo = ""
) {
  const encontrados = [];

  for (
    const entrada of fs.readdirSync(
      diretorio,
      { withFileTypes: true }
    )
  ) {
    const caminhoRelativo = path.join(
      relativo,
      entrada.name
    );

    const caminhoCompleto = path.join(
      diretorio,
      entrada.name
    );

    if (entrada.isSymbolicLink()) {
      encontrados.push(caminhoRelativo);
      continue;
    }

    if (entrada.isDirectory()) {
      encontrados.push(
        ...encontrarArquivosSensiveis(
          caminhoCompleto,
          caminhoRelativo
        )
      );

      continue;
    }

    const nome = entrada.name.toLowerCase();

    const sensivel =
      nome === ".env" ||
      nome.startsWith(".env.") ||
      nome.endsWith(".pem") ||
      nome.endsWith(".key") ||
      nome.endsWith(".p12") ||
      nome.endsWith(".pfx");

    if (sensivel) {
      encontrados.push(caminhoRelativo);
    }
  }

  return encontrados;
}

function validarDependencia(
  pacote,
  lock,
  dependencia
) {
  const declarada =
    pacote.dependencies?.[dependencia];

  if (!declarada) {
    fail(
      `${dependencia} não está em dependencies do package.json.`
    );
  }

  const lockRaiz = lock.packages?.[""];

  if (
    lockRaiz &&
    !lockRaiz.dependencies?.[dependencia]
  ) {
    fail(
      `${dependencia} não está nas dependências principais do package-lock.json.`
    );
  }

  const pacoteInstalado =
    lock.packages?.[
      `node_modules/${dependencia}`
    ];

  if (!pacoteInstalado?.version) {
    fail(
      `${dependencia} não está resolvida no package-lock.json.`
    );
  }

  ok(
    `${dependencia}: declarada e resolvida (${pacoteInstalado.version}).`
  );
}

function validarArquivosDoChat() {
  const arquivos = [
    "dist/controllers/chatAudioHttp.js",
    "dist/controllers/mensagensController.js",
    "dist/routes/mensagem.js",

    "dist/services/chatAudioStorage.js",
    "dist/services/chatAudioDuracaoService.js",
    "dist/services/chatAudioExclusaoService.js",
    "dist/services/chatAudioWorkerService.js",
  ];

  console.log(
    "\n===== COMPONENTES DO CHAT DE ÁUDIO ====="
  );

  for (const arquivo of arquivos) {
    verificarArquivo(arquivo);
  }

  const index = fs.readFileSync(
    path.join(tempDir, "dist/index.js"),
    "utf8"
  );

  if (
    !index.includes(
      "iniciarWorkerChatAudio"
    )
  ) {
    fail(
      "dist/index.js não contém a chamada de inicialização do worker de áudio."
    );
  }

  ok(
    "Backend compilado contém inicialização do worker de áudio."
  );
}

function validarDependencias() {
  console.log(
    "\n===== DEPENDÊNCIAS DE PRODUÇÃO ====="
  );

  const pacoteZip = lerJson("package.json");
  const lockZip = lerJson("package-lock.json");

  const dependencias = [
    "@aws-sdk/client-s3",
    "ffmpeg-static",
    "ffprobe-static",
    "multer",
    "@prisma/client",
  ];

  for (const dependencia of dependencias) {
    validarDependencia(
      pacoteZip,
      lockZip,
      dependencia
    );
  }

  if (
    !pacoteZip.scripts?.start ||
    !pacoteZip.scripts?.postinstall
  ) {
    fail(
      "Scripts start ou postinstall ausentes."
    );
  }

  if (
    !pacoteZip.scripts.postinstall.includes(
      "prisma generate"
    )
  ) {
    fail(
      "postinstall não executa prisma generate."
    );
  }

  ok(
    "Scripts start e postinstall disponíveis."
  );

  if (
    lockZip.packages?.[""]?.name &&
    lockZip.packages[""].name !== pacoteZip.name
  ) {
    fail(
      "package-lock.json pertence a outro pacote."
    );
  }

  ok("package-lock.json corresponde ao servidor.");
}

function validarNginx() {
  console.log(
    "\n===== CONFIGURAÇÃO NGINX ====="
  );

  const arquivo =
    ".platform/nginx/conf.d/custom.conf";

  verificarArquivo(arquivo);

  const conteudo = fs.readFileSync(
    path.join(tempDir, arquivo),
    "utf8"
  );

  if (
    !conteudo.includes(
      "client_max_body_size"
    )
  ) {
    fail(
      "Configuração Nginx sem client_max_body_size."
    );
  }

  ok(
    "Configuração de limite de upload Nginx presente."
  );
}

function validarMigrations() {
  console.log(
    "\n===== MIGRATIONS E PRISMA ====="
  );

  const origem = path.join(
    serverRoot,
    "prisma",
    "migrations"
  );

  const destino = path.join(
    tempDir,
    "prisma",
    "migrations"
  );

  const originais =
    listarMigrations(origem);

  const empacotadas =
    listarMigrations(destino);

  if (
    JSON.stringify(originais) !==
    JSON.stringify(empacotadas)
  ) {
    fail(
      "Histórico de migrations do ZIP é diferente do projeto."
    );
  }

  for (const nome of originais) {
    verificarConteudoIdentico(
      path.join(
        origem,
        nome,
        "migration.sql"
      ),
      path.join(
        destino,
        nome,
        "migration.sql"
      ),
      `Migration ${nome}`
    );
  }

  ok(
    `ZIP contém ${empacotadas.length} migrations idênticas ao projeto.`
  );

  verificarConteudoIdentico(
    path.join(
      serverRoot,
      "prisma",
      "schema.prisma"
    ),
    path.join(
      tempDir,
      "prisma",
      "schema.prisma"
    ),
    "Schema Prisma"
  );
}

function validarArquivosProibidos() {
  console.log(
    "\n===== SEGURANÇA DO PACOTE ====="
  );

  const proibidos = [
    ".env",
    ".env.production",
    ".env.development",
    "node_modules",
    "uploads",
    ".footera-chat-audio-local",
    "client",
    "tests",
    "playwright-report",
    "test-results",
    ".auth",
    ".eb-release-staging",
    ".zip-check-temp",
  ];

  const encontrados = proibidos.filter(
    (item) => existe(item)
  );

  if (encontrados.length) {
    fail(
      "Arquivos ou pastas proibidas: " +
        encontrados.join(", ")
    );
  }

  const sensiveis =
    encontrarArquivosSensiveis(
      tempDir
    );

  if (sensiveis.length) {
    fail(
      "Arquivos sensíveis encontrados: " +
        sensiveis.join(", ")
    );
  }

  ok(
    "Nenhum arquivo sensível ou diretório proibido identificado."
  );
}

function validarPacote() {
  console.log(
    "\n===== ESTRUTURA PRINCIPAL ====="
  );

  const obrigatorios = [
    "dist/index.js",
    "dist/controllers/documentosNascimentoController.js",
    "dist/controllers/correcaoNascimentoController.js",

    "dist/routes/correcaoNascimento.js",
    "dist/routes/adminCorrecaoNascimento.js",

    "dist/services/documentosNascimentoStorage.js",
    "dist/services/documentosNascimentoRecuperacaoService.js",
    "dist/services/documentosNascimentoRetencaoService.js",
    "dist/services/analiseDocumentoNascimentoService.js",
    "dist/services/documentosNascimentoWorkerService.js",
    "dist/services/correcaoNascimentoService.js",

    "prisma/schema.prisma",
    "package.json",
    "package-lock.json",
    "Procfile",
    ".platform",
  ];

  for (const arquivo of obrigatorios) {
    verificarArquivo(arquivo);
  }

  const procfile = fs.readFileSync(
    path.join(tempDir, "Procfile"),
    "utf8"
  ).trim();

  if (
    procfile !==
    "web: npm run start"
  ) {
    fail(
      `Procfile inesperado: ${procfile}`
    );
  }

  ok(
    "Procfile inicia o backend sem migrations automáticas."
  );

  const ebextensionsOrigem = path.join(
    serverRoot,
    ".ebextensions"
  );

  if (
    fs.existsSync(ebextensionsOrigem) &&
    !existe(".ebextensions")
  ) {
    fail(
      ".ebextensions existe no projeto, mas não está no ZIP."
    );
  }

  verificarConteudoIdentico(
    path.join(serverRoot, "package.json"),
    path.join(tempDir, "package.json"),
    "package.json do servidor"
  );

  verificarConteudoIdentico(
    path.join(serverRoot, "package-lock.json"),
    path.join(tempDir, "package-lock.json"),
    "package-lock.json do servidor"
  );

  validarArquivosDoChat();
  validarDependencias();
  validarNginx();
  validarMigrations();
  validarArquivosProibidos();
}

function extrairZip() {
  const script = `
$ErrorActionPreference = "Stop"
Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${tempDir.replace(/'/g, "''")}' -Force
`;

  const comando = Buffer.from(
    script,
    "utf16le"
  ).toString("base64");

  const resultado = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      comando,
    ],
    {
      stdio: "inherit",
    }
  );

  if (resultado.status !== 0) {
    fail(
      "Não foi possível extrair o ZIP."
    );
  }
}

function main() {
  if (
    !fs.existsSync(
      path.join(serverRoot, "package.json")
    )
  ) {
    fail(
      "Execute este script dentro da pasta server."
    );
  }

  if (!fs.existsSync(zipPath)) {
    fail(
      `ZIP não encontrado: ${zipPath}`
    );
  }

  if (fs.existsSync(tempDir)) {
    fs.rmSync(
      tempDir,
      {
        recursive: true,
        force: true,
      }
    );
  }

  fs.mkdirSync(tempDir, {
    recursive: true,
  });

  try {
    console.log(
      "\n🔍 Verificando ZIP do Elastic Beanstalk..."
    );

    console.log("ZIP:", zipPath);

    extrairZip();

    validarPacote();

    console.log(
      "\n✅ CHAT_AUDIO_ZIP_VALIDADO_OK"
    );
  } finally {
    if (
      fs.existsSync(tempDir)
    ) {
      fs.rmSync(
        tempDir,
        {
          recursive: true,
          force: true,
        }
      );
    }
  }
}

try {
  main();
} catch (erro) {
  console.error(
    "\n❌ CHAT_AUDIO_ZIP_VALIDACAO_FALHOU"
  );

  console.error(
    erro instanceof Error
      ? erro.message
      : String(erro)
  );

  process.exitCode = 1;
}