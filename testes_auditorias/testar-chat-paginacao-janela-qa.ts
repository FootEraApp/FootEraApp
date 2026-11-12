
import { randomUUID } from "node:crypto";
import { prisma } from "./server/prisma.js";
import {
  buscarMensagens,
  listarMensagensGrupo,
} from "./server/controllers/mensagensController.js";

const QUANTIDADE = 2050;
const PAGINA = 40;
const PREFIXO = `CHAT_JANELA_QA_${randomUUID()}`;

function exigir(
  condicao: unknown,
  descricao: string
): asserts condicao {
  if (!condicao) {
    throw new Error(`FALHOU: ${descricao}`);
  }

  console.log(`APROVADO: ${descricao}`);
}

function validarAmbiente() {
  const url = new URL(process.env.DATABASE_URL || "");

  if (
    process.env.NODE_ENV !== "test" ||
    url.protocol !== "postgresql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa" ||
    process.env.ENABLE_ACCOUNT_PURGE !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_CHAT_AUDIO_WORKER !== "false" ||
    Boolean(process.env.AWS_S3_CHAT_AUDIO_BUCKET?.trim())
  ) {
    throw new Error("BANCO_OU_AMBIENTE_QA_INCORRETO");
  }
}

type Resposta = {
  status: number;
  corpo: any;
};

async function chamarController(
  controller: (req: any, res: any) => Promise<unknown>,
  requisicao: Record<string, unknown>
): Promise<Resposta> {
  const resultado: Resposta = {
    status: 200,
    corpo: null,
  };

  const res: any = {
    status(codigo: number) {
      resultado.status = codigo;
      return this;
    },
    json(corpo: unknown) {
      resultado.corpo = corpo;
      return this;
    },
    send(corpo?: unknown) {
      resultado.corpo = corpo;
      return this;
    },
    sendStatus(codigo: number) {
      resultado.status = codigo;
      return this;
    },
  };

  await controller(requisicao as any, res);

  return resultado;
}

async function main() {
  validarAmbiente();
  await prisma.$connect();

  const idsPrivados = Array.from(
    { length: QUANTIDADE },
    () => randomUUID()
  );

  const idsGrupo = Array.from(
    { length: QUANTIDADE },
    () => randomUUID()
  );

  let grupoId: string | null = null;
  let houveErro = false;

  try {
    const usuarios = await prisma.usuario.findMany({
      where: { deletedAt: null },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 3,
    });

    exigir(
      usuarios.length === 3,
      "Três usuários disponíveis no QA"
    );

    const [usuarioA, usuarioB, usuarioC] =
      usuarios.map((usuario) => usuario.id);

    const grupo = await prisma.grupo.create({
      data: {
        nome: PREFIXO,
        ownerId: usuarioA,
        membros: {
          create: [
            {
              usuarioId: usuarioA,
              tipo: "ADMIN",
            },
            {
              usuarioId: usuarioB,
              tipo: "MEMBRO",
            },
          ],
        },
      },
    });

    grupoId = grupo.id;

    const inicio = Date.UTC(2099, 0, 1);

    await prisma.mensagem.createMany({
      data: idsPrivados.map((id, indice) => ({
        id,
        deId: usuarioA,
        paraId: usuarioB,
        tipo: "NORMAL" as const,
        conteudo: `${PREFIXO}_DM_${indice}`,
        lida: false,
        criadaEm: new Date(inicio + indice * 1000),
      })),
    });

    await prisma.mensagemGrupo.createMany({
      data: idsGrupo.map((id, indice) => ({
        id,
        grupoId: grupo.id,
        usuarioId: usuarioA,
        tipo: "NORMAL" as const,
        conteudo: `${PREFIXO}_GRUPO_${indice}`,
        excluida: false,
        criadaEm: new Date(inicio + indice * 1000),
      })),
    });

    exigir(
      (await prisma.mensagem.count({
        where: { id: { in: idsPrivados } },
      })) === QUANTIDADE,
      "2.050 mensagens privadas criadas"
    );

    exigir(
      (await prisma.mensagemGrupo.count({
        where: { id: { in: idsGrupo } },
      })) === QUANTIDADE,
      "2.050 mensagens de grupo criadas"
    );

    async function consultar(
      tipo: "DM" | "GRUPO",
      referencia: string,
      modo: "startAt" | "newerThan",
      usuario: string
    ): Promise<Resposta> {
      const query = {
        [modo]: referencia,
        limit: String(PAGINA),
        ...(tipo === "DM"
          ? { otherId: usuarioB }
          : {}),
      };

      if (tipo === "DM") {
        return chamarController(buscarMensagens, {
          userId: usuario,
          query,
        });
      }

      return chamarController(listarMensagensGrupo, {
        userId: usuario,
        params: { grupoId: grupo.id },
        query,
      });
    }

    async function testarJanela(
      tipo: "DM" | "GRUPO",
      ids: string[]
    ) {
      const inicial = await consultar(
        tipo,
        ids[0],
        "startAt",
        usuarioA
      );

      exigir(
        inicial.status === 200,
        `${tipo}: startAt respondeu HTTP 200`
      );

      exigir(
        inicial.corpo.items.length === PAGINA &&
        inicial.corpo.items[0].id === ids[0],
        `${tipo}: janela inicia na primeira mensagem`
      );

      const vistos = new Set<string>();
      let pagina = inicial;
      let paginas = 0;

      while (true) {
        const itens = pagina.corpo.items as Array<{
          id: string;
          criadaEm: string;
        }>;

        exigir(
          itens.length <= PAGINA,
          `${tipo}: página ${paginas + 1} respeitou limite`
        );

        for (const item of itens) {
          if (vistos.has(item.id)) {
            throw new Error(
              `${tipo}: MENSAGEM_DUPLICADA_${item.id}`
            );
          }

          vistos.add(item.id);
        }

        paginas++;

        if (!pagina.corpo.hasMoreNewer) {
          break;
        }

        const ultima = itens[itens.length - 1];

        if (!ultima || paginas > 60) {
          throw new Error(
            `${tipo}: CURSOR_NAO_AVANCOU`
          );
        }

        pagina = await consultar(
          tipo,
          ultima.id,
          "newerThan",
          usuarioA
        );

        if (pagina.status !== 200) {
          throw new Error(
            `${tipo}: NOVA_PAGINA_HTTP_${pagina.status}`
          );
        }
      }

      exigir(
        vistos.size === QUANTIDADE &&
        vistos.has(ids[0]) &&
        vistos.has(ids[QUANTIDADE - 1]),
        `${tipo}: 2.050 mensagens recuperadas sem perdas`
      );

      exigir(
        paginas === Math.ceil(QUANTIDADE / PAGINA),
        `${tipo}: total de ${paginas} páginas correto`
      );

      const meio = await consultar(
        tipo,
        ids[259],
        "startAt",
        usuarioA
      );

      exigir(
        meio.status === 200 &&
        meio.corpo.items[0].id === ids[259],
        `${tipo}: acesso direto à mensagem 260`
      );

      const ultrapassou2000 = await consultar(
        tipo,
        ids[2049],
        "startAt",
        usuarioA
      );

      exigir(
        ultrapassou2000.status === 200 &&
        ultrapassou2000.corpo.items.length === 1 &&
        ultrapassou2000.corpo.items[0].id === ids[2049] &&
        ultrapassou2000.corpo.hasMoreNewer === false,
        `${tipo}: referência após 2.000 mensagens`
      );
    }

    await testarJanela("DM", idsPrivados);
    await testarJanela("GRUPO", idsGrupo);

    const referenciaInvalida = await chamarController(
      listarMensagensGrupo,
      {
        userId: usuarioA,
        params: { grupoId: grupo.id },
        query: {
          startAt: idsPrivados[0],
          limit: "40",
        },
      }
    );

    exigir(
      referenciaInvalida.status === 404,
      "Grupo rejeita cursor de outra conversa"
    );

    const semPermissao = await chamarController(
      listarMensagensGrupo,
      {
        userId: usuarioC,
        params: { grupoId: grupo.id },
        query: {
          startAt: idsGrupo[0],
          limit: "40",
        },
      }
    );

    exigir(
      semPermissao.status === 403,
      "Terceiro não consegue consultar grupo"
    );

    console.log("CHAT_PAGINACAO_JANELA_2050_QA_OK");
  } catch (erro) {
    houveErro = true;
    throw erro;
  } finally {
    try {
      await prisma.mensagem.deleteMany({
        where: {
          id: { in: idsPrivados },
        },
      });

      await prisma.mensagemGrupo.deleteMany({
        where: {
          id: { in: idsGrupo },
        },
      });

      if (grupoId) {
        await prisma.membroGrupo.deleteMany({
          where: { grupoId },
        });

        await prisma.grupo.deleteMany({
          where: {
            id: grupoId,
            nome: PREFIXO,
          },
        });
      }

      const [restantesDM, restantesGrupo] =
        await Promise.all([
          prisma.mensagem.count({
            where: { id: { in: idsPrivados } },
          }),
          prisma.mensagemGrupo.count({
            where: { id: { in: idsGrupo } },
          }),
        ]);

      exigir(
        restantesDM === 0 &&
        restantesGrupo === 0,
        "Limpeza QA: zero mensagens de teste restantes"
      );

      if (!houveErro) {
        console.log("CHAT_PAGINACAO_QA_LIMPEZA_OK");
      }
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((erro) => {
  console.error("CHAT_PAGINACAO_JANELA_QA_FALHOU", erro);
  process.exitCode = 1;
});