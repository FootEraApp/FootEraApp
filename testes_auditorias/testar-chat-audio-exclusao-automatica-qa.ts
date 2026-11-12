
import ffmpegPath from "ffmpeg-static";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { prisma } from "./server/prisma.js";
import { deletarMensagem } from "./server/controllers/mensagensController.js";
import {
  gravarChatAudio,
  lerChatAudio,
  removerChatAudio,
} from "./server/services/chatAudioStorage.js";

type TipoTeste = "privado" | "grupo";

type Fixture = {
  tipo: TipoTeste;
  id: string;
  audioKey: string;
};

function exigir(
  condicao: unknown,
  descricao: string
): asserts condicao {
  if (!condicao) {
    throw new Error(`FALHOU: ${descricao}`);
  }

  console.log(`APROVADO: ${descricao}`);
}

function validarQa() {
  const banco = new URL(
    process.env.DATABASE_URL || ""
  );

  exigir(
    process.env.NODE_ENV === "test" &&
      banco.protocol === "postgresql:" &&
      banco.hostname === "127.0.0.1" &&
      banco.port === "5433" &&
      banco.pathname === "/footera_billing_qa" &&
      process.env.ENABLE_CHAT_AUDIO === "true" &&
      process.env.ENABLE_CHAT_AUDIO_LOCAL === "true" &&
      process.env.ENABLE_CHAT_AUDIO_WORKER === "false" &&
      process.env.ENABLE_ACCOUNT_PURGE === "false" &&
      process.env.ENABLE_BILLING_SCHEDULER === "false" &&
      process.env.ENABLE_MP_CONCILIACAO_SCHEDULER === "false" &&
      !process.env.AWS_S3_CHAT_AUDIO_BUCKET?.trim(),
    "Ambiente QA isolado"
  );
}

async function executarExclusao(
  mensagemId: string,
  usuarioId: string
): Promise<number> {
  let codigo = 200;

  const resposta: any = {
    status(valor: number) {
      codigo = valor;
      return this;
    },

    json(_valor: unknown) {
      return this;
    },

    send(_valor?: unknown) {
      return this;
    },

    sendStatus(valor: number) {
      codigo = valor;
      return this;
    },
  };

  const requisicao: any = {
    params: {
      id: mensagemId,
    },
    userId: usuarioId,
    user: {
      id: usuarioId,
    },
  };

  await deletarMensagem(requisicao, resposta);

  return codigo;
}

async function arquivoExiste(
  audioKey: string
): Promise<boolean> {
  try {
    await lerChatAudio(audioKey);
    return true;
  } catch (erro) {
    const codigo = (
      erro as NodeJS.ErrnoException
    )?.code;

    if (codigo === "ENOENT") {
      return false;
    }

    throw erro;
  }
}

async function verificarExclusao(
  fixture: Fixture
) {
  const registro =
    fixture.tipo === "privado"
      ? await prisma.mensagem.findUnique({
          where: { id: fixture.id },
          select: { id: true },
        })
      : await prisma.mensagemGrupo.findUnique({
          where: { id: fixture.id },
          select: { id: true },
        });

  exigir(
    registro === null,
    `${fixture.tipo}: mensagem removida do Prisma`
  );

  const pendencia =
    await prisma.exclusaoAudioMensagemPendente.findUnique({
      where: {
        audioKey: fixture.audioKey,
      },
    });

  exigir(
    pendencia === null,
    `${fixture.tipo}: nenhuma pendência restante`
  );

  exigir(
    !(await arquivoExiste(fixture.audioKey)),
    `${fixture.tipo}: arquivo físico removido`
  );
}

async function main() {
  validarQa();

  const nomeGrupo =
    `CHAT_AUDIO_EXCLUSAO_QA_${randomUUID()}`;

  const fixtures: Fixture[] = [];

  let grupoId: string | null = null;

  const caminhoAudio = join(
    tmpdir(),
    `footera-audio-qa-${randomUUID()}.m4a`
  );

  await prisma.$connect();

  try {
    const usuarios =
      await prisma.usuario.findMany({
        select: {
          id: true,
        },
        orderBy: {
          id: "asc",
        },
        take: 3,
      });

    exigir(
      usuarios.length === 3,
      "Três contas existentes no QA"
    );

    const [usuarioA, usuarioB, usuarioC] =
      usuarios.map((usuario) => usuario.id);

    console.log(
      "CONTAS_QA_SELECIONADAS_AUTOMATICAMENTE"
    );

    const binario = ffmpegPath as string;

    exigir(
      Boolean(binario),
      "FFmpeg disponível"
    );

    execFileSync(binario, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=3",
      "-c:a",
      "aac",
      "-y",
      caminhoAudio,
    ]);

    const bytes = await readFile(caminhoAudio);

    exigir(
      bytes.length > 0,
      "Áudio sintético gerado"
    );

    // Grupo temporário, criado só para este teste.
    const grupo = await prisma.grupo.create({
      data: {
        nome: nomeGrupo,
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

    console.log("GRUPO_QA_TEMPORARIO_CRIADO");

    // 1. Áudio privado descartável.
    const audioPrivado = await gravarChatAudio(
      "privadas",
      bytes,
      "audio/mp4"
    );

    const idPrivado = randomUUID();

    fixtures.push({
      tipo: "privado",
      id: idPrivado,
      audioKey: audioPrivado.key,
    });

    await prisma.mensagem.create({
      data: {
        id: idPrivado,
        deId: usuarioA,
        paraId: usuarioB,
        tipo: "AUDIO",
        conteudo: "Áudio automático QA",
        audioKey: audioPrivado.key,
        audioMime: audioPrivado.mime,
        audioDuracaoMs: 3000,
        audioTamanhoBytes: audioPrivado.bytes,
      },
    });

    // 2. Áudio de grupo descartável.
    const audioGrupo = await gravarChatAudio(
      "grupos",
      bytes,
      "audio/mp4"
    );

    const idGrupoMensagem = randomUUID();

    fixtures.push({
      tipo: "grupo",
      id: idGrupoMensagem,
      audioKey: audioGrupo.key,
    });

    await prisma.mensagemGrupo.create({
      data: {
        id: idGrupoMensagem,
        grupoId: grupo.id,
        usuarioId: usuarioA,
        tipo: "AUDIO",
        conteudo: "Áudio automático QA",
        audioKey: audioGrupo.key,
        audioMime: audioGrupo.mime,
        audioDuracaoMs: 3000,
        audioTamanhoBytes: audioGrupo.bytes,
      },
    });

    exigir(
      await arquivoExiste(audioPrivado.key),
      "Arquivo privado criado"
    );

    exigir(
      await arquivoExiste(audioGrupo.key),
      "Arquivo de grupo criado"
    );

    // 3. Conta C não pode apagar mensagens de A.
    const negadoPrivado = await executarExclusao(
      idPrivado,
      usuarioC
    );

    exigir(
      negadoPrivado === 403,
      "Terceiro bloqueado na exclusão privada"
    );

    const negadoGrupo = await executarExclusao(
      idGrupoMensagem,
      usuarioC
    );

    exigir(
      negadoGrupo === 403,
      "Terceiro bloqueado na exclusão de grupo"
    );

    // Confirma que as mensagens sobreviveram
    // às duas tentativas proibidas.
    exigir(
      Boolean(
        await prisma.mensagem.findUnique({
          where: { id: idPrivado },
          select: { id: true },
        })
      ),
      "Tentativa proibida preservou áudio privado"
    );

    exigir(
      Boolean(
        await prisma.mensagemGrupo.findUnique({
          where: { id: idGrupoMensagem },
          select: { id: true },
        })
      ),
      "Tentativa proibida preservou áudio do grupo"
    );

    // 4. Autor A pode apagar suas mensagens.
    const excluidoPrivado = await executarExclusao(
      idPrivado,
      usuarioA
    );

    exigir(
      excluidoPrivado === 204,
      "Autor excluiu mensagem privada"
    );

    await verificarExclusao(fixtures[0]);

    const excluidoGrupo = await executarExclusao(
      idGrupoMensagem,
      usuarioA
    );

    exigir(
      excluidoGrupo === 204,
      "Autor excluiu mensagem do grupo"
    );

    await verificarExclusao(fixtures[1]);

    console.log(
      "CHAT_AUDIO_EXCLUSAO_AUTOMATICA_QA_OK"
    );
  } finally {
    // Limpa somente IDs criados por este teste.
    // Não toca nas conversas anteriores.
    for (const fixture of fixtures) {
      if (fixture.tipo === "privado") {
        await prisma.mensagem.deleteMany({
          where: { id: fixture.id },
        });
      } else {
        await prisma.mensagemGrupo.deleteMany({
          where: { id: fixture.id },
        });
      }

      // Limpa arquivos criados pelo teste
      // se algum passo anterior falhar.
      const vinculadoPrivado =
        await prisma.mensagem.count({
          where: {
            audioKey: fixture.audioKey,
          },
        });

      const vinculadoGrupo =
        await prisma.mensagemGrupo.count({
          where: {
            audioKey: fixture.audioKey,
          },
        });

      if (
        vinculadoPrivado === 0 &&
        vinculadoGrupo === 0
      ) {
        await removerChatAudio(fixture.audioKey);

        await prisma.exclusaoAudioMensagemPendente.deleteMany({
          where: {
            audioKey: fixture.audioKey,
          },
        });
      }
    }

    if (grupoId) {
      await prisma.membroGrupo.deleteMany({
        where: { grupoId },
      });

      await prisma.grupo.deleteMany({
        where: {
          id: grupoId,
          nome: nomeGrupo,
        },
      });
    }

    await unlink(caminhoAudio).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(
    "CHAT_AUDIO_EXCLUSAO_AUTOMATICA_QA_FALHOU",
    erro
  );

  process.exitCode = 1;
});