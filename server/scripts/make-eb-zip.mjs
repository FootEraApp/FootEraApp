
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const serverRoot = process.cwd();
const projectRoot = path.resolve(serverRoot, "..");

const zipPath = path.join(
  projectRoot,
  "footera-server-release.zip"
);

const stagingDir = path.join(
  projectRoot,
  ".eb-release-staging"
);

function falhar(mensagem) {
  throw new Error(mensagem);
}

function log(mensagem) {
  console.log(mensagem);
}

function origemExiste(relativo) {
  return fs.existsSync(
    path.join(serverRoot, relativo)
  );
}

function stagingExiste(relativo) {
  return fs.existsSync(
    path.join(stagingDir, relativo)
  );
}

function copiar(origemRelativa, destinoRelativo = origemRelativa) {
  const origem = path.join(serverRoot, origemRelativa);
  const destino = path.join(stagingDir, destinoRelativo);

  if (!fs.existsSync(origem)) {
    falhar(`Arquivo de origem ausente: ${origemRelativa}`);
  }

  fs.mkdirSync(path.dirname(destino), {
    recursive: true,
  });

  fs.cpSync(origem, destino, {
    recursive: true,
    force: true,
  });

  if (!fs.existsSync(destino)) {
    falhar(`Falha ao copiar: ${destinoRelativo}`);
  }

  log(`OK: ${destinoRelativo}`);
}

function validarStaging() {
  const obrigatorios = [
    "dist/index.js",
    "dist/controllers/chatAudioHttp.js",
    "dist/controllers/mensagensController.js",
    "dist/routes/mensagem.js",
    "dist/services/chatAudioStorage.js",
    "dist/services/chatAudioDuracaoService.js",
    "dist/services/chatAudioExclusaoService.js",
    "dist/services/chatAudioWorkerService.js",
    "prisma/schema.prisma",
    "prisma/migrations",
    "package.json",
    "package-lock.json",
    "Procfile",
    ".platform",
  ];

  for (const item of obrigatorios) {
    if (!stagingExiste(item)) {
      falhar(`Arquivo ausente no staging: ${item}`);
    }
  }

  const migrations = fs
    .readdirSync(
      path.join(stagingDir, "prisma", "migrations"),
      { withFileTypes: true }
    )
    .filter((item) => item.isDirectory());

  if (migrations.length === 0) {
    falhar("Nenhuma migration no staging.");
  }

  log(`OK: ${migrations.length} diretórios de migrations`);
}

function criarZipLinuxCompativel() {
  const script = `
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$origem = '${stagingDir.replace(/'/g, "''")}'
$destino = '${zipPath.replace(/'/g, "''")}'

$origem = [System.IO.Path]::GetFullPath($origem)

if (Test-Path -LiteralPath $destino) {
    Remove-Item -LiteralPath $destino -Force
}

$prefixo = $origem.TrimEnd([char]'\\', [char]'/') + [System.IO.Path]::DirectorySeparatorChar

$arquivos = @(
    Get-ChildItem -LiteralPath $origem -Recurse -File -Force
)

if ($arquivos.Count -eq 0) {
    throw "STAGING_VAZIO"
}

$arquivoZip = [System.IO.Compression.ZipFile]::Open(
    $destino,
    [System.IO.Compression.ZipArchiveMode]::Create
)

try {
    foreach ($arquivo in $arquivos) {
        if (
            ($arquivo.Attributes -band
             [System.IO.FileAttributes]::ReparsePoint) -ne 0
        ) {
            throw "LINK_SIMBOLICO_NAO_PERMITIDO: $($arquivo.FullName)"
        }

        $relativo = $arquivo.FullName.Substring(
            $prefixo.Length
        )

        # Caminho padronizado para Linux e Elastic Beanstalk.
        $relativo = $relativo.Replace('\\', '/')

        $entrada = $arquivoZip.CreateEntry(
            $relativo,
            [System.IO.Compression.CompressionLevel]::Optimal
        )

        $entradaStream = $entrada.Open()
        $origemStream = [System.IO.File]::OpenRead(
            $arquivo.FullName
        )

        try {
            $origemStream.CopyTo($entradaStream)
        }
        finally {
            $origemStream.Dispose()
            $entradaStream.Dispose()
        }
    }
}
finally {
    $arquivoZip.Dispose()
}

$zipLeitura = [System.IO.Compression.ZipFile]::OpenRead(
    $destino
)

try {
    $entradas = @(
        $zipLeitura.Entries | ForEach-Object {
            $_.FullName
        }
    )

    $obrigatorios = @(
        "dist/index.js",
        "prisma/schema.prisma",
        "package.json",
        "package-lock.json",
        "Procfile",
        "dist/services/chatAudioStorage.js",
        "dist/services/chatAudioWorkerService.js"
    )

    foreach ($item in $obrigatorios) {
        if ($entradas -cnotcontains $item) {
            throw "ZIP_INCOMPLETO: $item"
        }
    }

    $caminhosInvalidos = @(
        $entradas | Where-Object {
            $_.Contains('\\')
        }
    )

    if ($caminhosInvalidos.Count -gt 0) {
        throw "ZIP_CONTEM_CAMINHOS_WINDOWS"
    }

    Write-Host "ZIP_CONTEUDO_ESSENCIAL_OK"
    Write-Host "ZIP_CAMINHOS_LINUX_OK"
}
finally {
    $zipLeitura.Dispose()
}
`;

  const encoded = Buffer.from(
    script,
    "utf16le"
  ).toString("base64");

  const resultado = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      encoded,
    ],
    {
      cwd: projectRoot,
      stdio: "inherit",
    }
  );

  if (resultado.status !== 0) {
    falhar("Falha ao criar ZIP compatível com Linux.");
  }
}

function main() {
  log("\nPreparando ZIP para Elastic Beanstalk...");

  const obrigatoriosOrigem = [
    "dist",
    "prisma/schema.prisma",
    "prisma/migrations",
    "package.json",
    "package-lock.json",
    "Procfile",
    ".platform",
  ];

  for (const item of obrigatoriosOrigem) {
    if (!origemExiste(item)) {
      falhar(`Origem ausente: ${item}`);
    }
  }

  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, {
      recursive: true,
      force: true,
    });
  }

  fs.mkdirSync(stagingDir, {
    recursive: true,
  });

  try {
    copiar("dist");
    copiar("prisma/schema.prisma");
    copiar("prisma/migrations");
    copiar("package.json");
    copiar("package-lock.json");
    copiar("Procfile");
    copiar(".platform");

    if (origemExiste(".ebextensions")) {
      copiar(".ebextensions");
    }

    if (origemExiste("public")) {
      copiar("public");
    }

    validarStaging();
    criarZipLinuxCompativel();

    const tamanhoMB =
      fs.statSync(zipPath).size / 1024 / 1024;

    log(`ZIP gerado: ${zipPath}`);
    log(`Tamanho: ${tamanhoMB.toFixed(2)} MB`);
    log("CHAT_AUDIO_ZIP_GERADO_OK");
  } finally {
    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, {
        recursive: true,
        force: true,
      });
    }
  }
}

try {
  main();
} catch (erro) {
  console.error(
    "ERRO_GERAR_ZIP:",
    erro instanceof Error
      ? erro.message
      : String(erro)
  );
  process.exitCode = 1;
}
