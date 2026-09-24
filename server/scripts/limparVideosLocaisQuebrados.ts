import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { prisma } from "../prisma.js";

type CampoMidia =
  | "videoDemonstrativoUrl"
  | "videoPosterUrl";

type ModelConfig = {
  nome: string;
  delegate: any;
  campos: CampoMidia[];
};

type ArquivoIndexado = {
  fullPath: string;
  baseName: string;
};

const APPLY =
  process.argv.includes("--apply") ||
  process.argv.includes("--limpar");

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const PROJECT_ROOT =
  path.resolve(
    __dirname,
    "..",
    "..",
  );

const UPLOAD_ROOTS = [
  path.join(
    PROJECT_ROOT,
    "server",
    "uploads",
  ),

  path.join(
    PROJECT_ROOT,
    "public",
    "uploads",
  ),

  path.join(
    PROJECT_ROOT,
    "uploads",
  ),
];

function listarArquivosRecursivamente(
  dir: string,
): ArquivoIndexado[] {
  if (
    !fs.existsSync(dir)
  ) {
    return [];
  }

  const resultado:
    ArquivoIndexado[] =
    [];

  const pilha = [dir];

  while (
    pilha.length
  ) {
    const atual =
      pilha.pop()!;

    let entries:
      fs.Dirent[];

    try {
      entries =
        fs.readdirSync(
          atual,
          {
            withFileTypes:
              true,
          }
        );
    } catch {
      continue;
    }

    for (
      const entry of entries
    ) {
      const fullPath =
        path.join(
          atual,
          entry.name,
        );

      if (
        entry.isDirectory()
      ) {
        pilha.push(
          fullPath
        );

        continue;
      }

      if (
        entry.isFile()
      ) {
        resultado.push({
          fullPath,

          baseName:
            entry.name,
        });
      }
    }
  }

  return resultado;
}

function decodeVariantes(
  value: string,
): string[] {
  const values =
    new Set<string>();

  let atual =
    String(
      value || ""
    );

  for (
    let i = 0;
    i < 4;
    i++
  ) {
    values.add(
      atual
    );

    try {
      const decoded =
        decodeURIComponent(
          atual
        );

      if (
        decoded ===
        atual
      ) {
        break;
      }

      atual =
        decoded;
    } catch {
      break;
    }
  }

  return [
    ...values,
  ];
}

function hostnameLocal(
  hostname: string,
) {
  const host =
    hostname
      .toLowerCase()
      .trim();

  if (
    host ===
      "localhost" ||
    host ===
      "127.0.0.1" ||
    host ===
      "::1" ||
    host ===
      "10.0.2.2"
  ) {
    return true;
  }

  if (
    host.startsWith(
      "192.168."
    )
  ) {
    return true;
  }

  const match172 =
    host.match(
      /^172\.(\d{1,3})\./
    );

  if (match172) {
    const segundo =
      Number(
        match172[1]
      );

    return (
      segundo >= 16 &&
      segundo <= 31
    );
  }

  return /^10\./.test(
    host
  );
}

function extrairPathUploads(
  raw:
    string,
): string | null {
  const value =
    String(
      raw || ""
    ).trim();

  if (!value) {
    return null;
  }

  if (
    /^https?:\/\//i.test(
      value
    )
  ) {
    let url:
      URL;

    try {
      url =
        new URL(
          value
        );
    } catch {
      return null;
    }

    if (
      !hostnameLocal(
        url.hostname
      )
    ) {
      return null;
    }

    const pathname =
      url.pathname;

    const marker =
      "/uploads/";

    const index =
      pathname
        .toLowerCase()
        .indexOf(
          marker
        );

    if (
      index < 0
    ) {
      return null;
    }

    return pathname.slice(
      index +
        marker.length
    );
  }

  const normalized =
    value.replace(
      /\\/g,
      "/"
    );

  const lower =
    normalized
      .toLowerCase();

  if (
    lower.startsWith(
      "/uploads/"
    )
  ) {
    return normalized.slice(
      "/uploads/".length
    );
  }

  if (
    lower.startsWith(
      "uploads/"
    )
  ) {
    return normalized.slice(
      "uploads/".length
    );
  }

  return null;
}

function normalizarRelativo(
  value: string,
) {
  return value
    .replace(
      /\\/g,
      "/"
    )
    .replace(
      /^\/+/,
      ""
    );
}

function criarIndiceArquivos() {
  const arquivos =
    UPLOAD_ROOTS.flatMap(
      listarArquivosRecursivamente
    );

  const byBase =
    new Map<
      string,
      string[]
    >();

  const byStamp =
    new Map<
      string,
      string[]
    >();

  for (
    const item of arquivos
  ) {
    const key =
      item.baseName
        .normalize("NFC")
        .toLowerCase();

    const existing =
      byBase.get(
        key
      ) ?? [];

    existing.push(
      item.fullPath
    );

    byBase.set(
      key,
      existing
    );

    const stamp =
      item.baseName.match(
        /^(\d{10,17})[-_]/
      )?.[1];

    if (stamp) {
      const stampItems =
        byStamp.get(
          stamp
        ) ?? [];

      stampItems.push(
        item.fullPath
      );

      byStamp.set(
        stamp,
        stampItems
      );
    }
  }

  return {
    arquivos,
    byBase,
    byStamp,
  };
}

function verificarArquivoLocal(
  rawUrl: string,
  index:
    ReturnType<
      typeof criarIndiceArquivos
    >,
):
  | {
      status:
        "FOUND";
      path:
        string;
    }
  | {
      status:
        "FOUND_ALTERNATIVE";
      paths:
        string[];
    }
  | {
      status:
        "MISSING";
    }
  | {
      status:
        "NOT_LOCAL";
    } {
  const relativoRaw =
    extrairPathUploads(
      rawUrl
    );

  if (
    relativoRaw ===
    null
  ) {
    return {
      status:
        "NOT_LOCAL",
    };
  }

  const variantes =
    decodeVariantes(
      relativoRaw
    )
      .map(
        normalizarRelativo
      )
      .filter(
        (v) =>
          v &&
          !v
            .split("/")
            .includes("..")
      );

  for (
    const variante of
      variantes
  ) {
    for (
      const root of
        UPLOAD_ROOTS
    ) {
      const candidate =
        path.join(
          root,
          ...variante.split("/")
        );

      if (
        fs.existsSync(
          candidate
        ) &&
        fs
          .statSync(
            candidate
          )
          .isFile()
      ) {
        return {
          status:
            "FOUND",

          path:
            candidate,
        };
      }
    }
  }

  for (
    const variante of
      variantes
  ) {
    const base =
      path
        .basename(
          variante
        )
        .normalize("NFC")
        .toLowerCase();

    const encontrados =
      index.byBase.get(
        base
      );

    if (
      encontrados?.length
    ) {
      return {
        status:
          "FOUND_ALTERNATIVE",

        paths:
          encontrados,
      };
    }
  }

  for (
    const variante of
      variantes
  ) {
    const base =
      path.basename(
        variante
      );

    const stamp =
      base.match(
        /^(\d{10,17})[-_]/
      )?.[1];

    if (!stamp) {
      continue;
    }

    const encontrados =
      index.byStamp.get(
        stamp
      );

    if (
      encontrados?.length
    ) {
      return {
        status:
          "FOUND_ALTERNATIVE",

        paths:
          encontrados,
      };
    }
  }

  return {
    status:
      "MISSING",
  };
}

const models:
  ModelConfig[] = [
    {
      nome:
        "Exercicio",

      delegate:
        (prisma as any)
          .exercicio,

      campos: [
        "videoDemonstrativoUrl",
      ],
    },

    {
      nome:
        "ExercicioPersonalizado",

      delegate:
        (prisma as any)
          .exercicioPersonalizado,

      campos: [
        "videoDemonstrativoUrl",
        "videoPosterUrl",
      ],
    },

    {
      nome:
        "ExercicioTemporario",

      delegate:
        (prisma as any)
          .exercicioTemporario,

      campos: [
        "videoDemonstrativoUrl",
        "videoPosterUrl",
      ],
    },
  ];

async function main() {
  console.log(
    "\nAuditoria de mídias locais legadas de exercícios"
  );

  console.log(
    APPLY
      ? "MODO: APLICAR LIMPEZA"
      : "MODO: SOMENTE AUDITORIA"
  );

  console.log(
    "\nPastas verificadas:"
  );

  for (
    const root of
      UPLOAD_ROOTS
  ) {
    console.log(
      `- ${root}`
    );
  }

  const index =
    criarIndiceArquivos();

  console.log(
    `\nArquivos locais encontrados: ${index.arquivos.length}`
  );

  let totalReferencias =
    0;

  let locaisExistentes =
    0;

  let locaisAlternativos =
    0;

  let quebradas =
    0;

  let remotasIgnoradas =
    0;

  let camposLimpados =
    0;

  for (
    const config of
      models
  ) {
    if (
      !config.delegate
        ?.findMany
    ) {
      console.log(
        `\n[${config.nome}] modelo indisponível — ignorado.`
      );

      continue;
    }

    const select:
      Record<
        string,
        boolean
      > = {
        id:
          true,
      };

    for (
      const campo of
        config.campos
    ) {
      select[campo] =
        true;
    }

    let rows:
      any[];

    try {
      rows =
        await config
          .delegate
          .findMany({
            select,
          });
    } catch (
      error
    ) {
      console.error(
        `\n[${config.nome}] não foi possível consultar os campos configurados.`,
        error
      );

      continue;
    }

    console.log(
      `\n[${config.nome}] registros: ${rows.length}`
    );

    for (
      const row of rows
    ) {
      const data:
        Record<
          string,
          null
        > = {};

      for (
        const campo of
          config.campos
      ) {
        const raw =
          row[campo];

        if (
          !raw ||
          !String(
            raw
          ).trim()
        ) {
          continue;
        }

        totalReferencias++;

        const result =
          verificarArquivoLocal(
            String(
              raw
            ),
            index,
          );

        if (
          result.status ===
          "NOT_LOCAL"
        ) {
          remotasIgnoradas++;

          continue;
        }

        if (
          result.status ===
          "FOUND"
        ) {
          locaisExistentes++;

          continue;
        }

        if (
          result.status ===
          "FOUND_ALTERNATIVE"
        ) {
          locaisAlternativos++;

          console.log(
            [
              "⚠️",
              config.nome,
              `id=${row.id}`,
              campo,
              "arquivo possivelmente existe com nome/encoding diferente:",
              String(
                raw
              ),
              "=>",
              result.paths.join(
                " | "
              ),
            ].join(
              " "
            )
          );

          continue;
        }

        quebradas++;

        console.log(
          [
            "❌",
            config.nome,
            `id=${row.id}`,
            campo,
            String(
              raw
            ),
          ].join(
            " "
          )
        );

        data[campo] =
          null;
      }

      if (
        APPLY &&
        Object.keys(
          data
        ).length
      ) {
        await config
          .delegate
          .update({
            where: {
              id:
                row.id,
            },

            data,
          });

        camposLimpados +=
          Object.keys(
            data
          ).length;
      }
    }
  }

  console.log(
    "\n=============================="
  );

  console.log(
    "Resumo"
  );

  console.log(
    `Referências de mídia analisadas: ${totalReferencias}`
  );

  console.log(
    `URLs remotas/S3 ignoradas: ${remotasIgnoradas}`
  );

  console.log(
    `Arquivos locais existentes: ${locaisExistentes}`
  );

  console.log(
    `Possíveis arquivos com encoding/nome diferente: ${locaisAlternativos}`
  );

  console.log(
    `Referências locais quebradas: ${quebradas}`
  );

  if (APPLY) {
    console.log(
      `Campos limpos no banco: ${camposLimpados}`
    );
  } else {
    console.log(
      "Nenhum dado foi alterado."
    );

    console.log(
      "\nSe a lista estiver correta, rode novamente com --apply."
    );
  }

  console.log(
    "==============================\n"
  );
}

main()
  .catch(
    (error) => {
      console.error(
        "\nErro ao auditar mídias:",
        error
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await prisma
        .$disconnect();
    }
  );