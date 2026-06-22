import cron from "node-cron";
import { NotificacaoTipo } from "@prisma/client";
import { prisma } from "../prisma.js";
import { criarNotificacaoEEnviarPush } from "../controllers/notificacoesController.js";

let schedulerStarted = false;

const MINUTO = 60 * 1000;

function getJanelaMinutos(minutosAntes: number, tamanhoJanelaMin = 5) {
  const agora = new Date();

  agora.setSeconds(0, 0);

  const inicio = new Date(agora.getTime() + minutosAntes * MINUTO);

  const fim = new Date(
    inicio.getTime() + tamanhoJanelaMin * MINUTO + 59_999
  );

  return { inicio, fim };
}

async function registrarLembreteSeAindaNaoEnviado(params: {
  usuarioId: string;
  tipo: string;
  alvoId: string;
  janela: string;
}) {
  try {
    await prisma.lembreteNotificacaoEnviado.create({
      data: {
        usuarioId: params.usuarioId,
        tipo: params.tipo,
        alvoId: params.alvoId,
        janela: params.janela,
      },
    });

    return true;
  } catch {
    return false;
  }
}

function dataHoraPtBr(value?: Date | null) {
  if (!value) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function dataHoraSpLog(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(value);
}

async function getDestinatariosAulaAoVivo(aula: any) {
  const ids = new Set<string>();

  if (aula.criadorUsuarioId) {
    ids.add(String(aula.criadorUsuarioId));
  }

  if (aula.metodologia?.criadorUsuarioId) {
    ids.add(String(aula.metodologia.criadorUsuarioId));
  }

  if (aula.metodologiaAvulsa?.criadorUsuarioId) {
    ids.add(String(aula.metodologiaAvulsa.criadorUsuarioId));
  }

  if (aula.convidadoUsuarioId) {
    ids.add(String(aula.convidadoUsuarioId));
  }

  if (Array.isArray(aula.convidados)) {
    for (const convidado of aula.convidados) {
      if (convidado?.usuarioId) ids.add(String(convidado.usuarioId));
      if (convidado?.usuario?.id) ids.add(String(convidado.usuario.id));
    }
  }

  if (aula.metodologiaId) {
    const assinantes = await prisma.metodologiaAssinante.findMany({
      where: {
        metodologiaId: aula.metodologiaId,
        status: "ATIVA",
      },
      select: { usuarioId: true },
    });

    for (const assinante of assinantes) {
      if (assinante.usuarioId) ids.add(String(assinante.usuarioId));
    }
  }

  if (aula.metodologiaAvulsaId) {
    const assinantes = await prisma.metodologiaAssinante.findMany({
      where: {
        metodologiaAvulsaId: aula.metodologiaAvulsaId,
        status: "ATIVA",
      },
      select: { usuarioId: true },
    });

    for (const assinante of assinantes) {
      if (assinante.usuarioId) ids.add(String(assinante.usuarioId));
    }
  }

  return Array.from(ids);
}

async function getDestinatariosTreinoAgendado(treino: any) {
  const ids = new Set<string>();

  if (treino.atleta?.usuarioId) {
    ids.add(String(treino.atleta.usuarioId));
  }

  const tp = treino.treinoProgramado;

  if (tp?.criadorProfessor?.usuarioId) {
    ids.add(String(tp.criadorProfessor.usuarioId));
  }

  if (tp?.Professor?.usuarioId) {
    ids.add(String(tp.Professor.usuarioId));
  }

  if (tp?.clube?.usuarioId) {
    ids.add(String(tp.clube.usuarioId));
  }

  if (tp?.escolinha?.usuarioId) {
    ids.add(String(tp.escolinha.usuarioId));
  }

  if (Array.isArray(tp?.professores)) {
    for (const item of tp.professores) {
      if (item?.professor?.usuarioId) {
        ids.add(String(item.professor.usuarioId));
      }
    }
  }

  return Array.from(ids);
}

function getResponsaveisTreinoAgendado(treino: any) {
  const ids = new Set<string>();
  const tp = treino.treinoProgramado;

  if (tp?.criadorProfessor?.usuarioId) {
    ids.add(String(tp.criadorProfessor.usuarioId));
  }

  if (tp?.Professor?.usuarioId) {
    ids.add(String(tp.Professor.usuarioId));
  }

  if (tp?.clube?.usuarioId) {
    ids.add(String(tp.clube.usuarioId));
  }

  if (tp?.escolinha?.usuarioId) {
    ids.add(String(tp.escolinha.usuarioId));
  }

  if (Array.isArray(tp?.professores)) {
    for (const item of tp.professores) {
      if (item?.professor?.usuarioId) {
        ids.add(String(item.professor.usuarioId));
      }
    }
  }

  return Array.from(ids);
}

async function enviarLembretesTreinos15Min() {
  const { inicio, fim } = getJanelaMinutos(15, 5);
  const treinos = await prisma.treinoAgendado.findMany({
    where: {
      status: "AGENDADO",
      dataTreino: {
        gte: inicio,
        lt: fim,
      },
    },
    select: {
      id: true,
      titulo: true,
      dataTreino: true,
      turmaId: true,
      atleta: {
        select: {
          usuarioId: true,
          nome: true,
        },
      },
      treinoProgramado: {
        select: {
          nome: true,
          criadorProfessor: {
            select: {
              usuarioId: true,
            },
          },
          Professor: {
            select: {
              usuarioId: true,
            },
          },
          clube: {
            select: {
              usuarioId: true,
            },
          },
          escolinha: {
            select: {
              usuarioId: true,
            },
          },
          professores: {
            select: {
              professor: {
                select: {
                  usuarioId: true,
                },
              },
            },
          },
        },
      },
    },
    take: 200,
  });

  const lembretesTurma = new Map<
    string,
    {
      alvoId: string;
      tituloTreino: string;
      usuarioIds: Set<string>;
    }
  >();

  let enviadosOuVerificados = 0;

  for (const treino of treinos) {
    const tituloTreino =
      treino.titulo ||
      treino.treinoProgramado?.nome ||
      "Treino";

    const atletaUsuarioId = treino.atleta?.usuarioId
      ? String(treino.atleta.usuarioId)
      : "";

    if (atletaUsuarioId) {
      const podeEnviarAtleta = await registrarLembreteSeAindaNaoEnviado({
        usuarioId: atletaUsuarioId,
        tipo: "TREINO_15_MIN",
        alvoId: treino.id,
        janela: "15_MIN",
      });

      if (podeEnviarAtleta) {
        enviadosOuVerificados++;

        await criarNotificacaoEEnviarPush({
          usuarioId: atletaUsuarioId,
          tipo: NotificacaoTipo.TREINO,
          titulo: "Treino começando em breve",
          mensagem: treino.turmaId
            ? `${tituloTreino} da turma começa em cerca de 15 minutos.`
            : `${tituloTreino} começa em cerca de 15 minutos.`,
          link: "/treinos",
        });
      }
    }

    const responsaveis = getResponsaveisTreinoAgendado(treino);

    if (!responsaveis.length) continue;

    if (treino.turmaId) {
      const horarioKey = treino.dataTreino
        ? new Date(treino.dataTreino).toISOString().slice(0, 16)
        : "sem-data";

      const turmaKey = `turma:${treino.turmaId}:${tituloTreino}:${horarioKey}`;

      const atual =
        lembretesTurma.get(turmaKey) ||
        {
          alvoId: turmaKey,
          tituloTreino,
          usuarioIds: new Set<string>(),
        };

      for (const usuarioId of responsaveis) {
        if (usuarioId && usuarioId !== atletaUsuarioId) {
          atual.usuarioIds.add(usuarioId);
        }
      }

      lembretesTurma.set(turmaKey, atual);
      continue;
    }

    for (const usuarioId of responsaveis) {
      if (!usuarioId || usuarioId === atletaUsuarioId) continue;

      const podeEnviarResponsavel = await registrarLembreteSeAindaNaoEnviado({
        usuarioId,
        tipo: "TREINO_15_MIN_RESPONSAVEL",
        alvoId: treino.id,
        janela: "15_MIN",
      });

      if (!podeEnviarResponsavel) continue;

      enviadosOuVerificados++;

      await criarNotificacaoEEnviarPush({
        usuarioId,
        tipo: NotificacaoTipo.TREINO,
        titulo: "Treino começando em breve",
        mensagem: `${tituloTreino} começa em cerca de 15 minutos.`,
        link: "/treinos",
      });
    }
  }

  for (const grupo of lembretesTurma.values()) {
    for (const usuarioId of grupo.usuarioIds) {
      const podeEnviarResponsavelTurma =
        await registrarLembreteSeAindaNaoEnviado({
          usuarioId,
          tipo: "TREINO_TURMA_15_MIN_RESPONSAVEL",
          alvoId: grupo.alvoId,
          janela: "15_MIN",
        });

      if (!podeEnviarResponsavelTurma) continue;

      enviadosOuVerificados++;

      await criarNotificacaoEEnviarPush({
        usuarioId,
        tipo: NotificacaoTipo.TREINO,
        titulo: "Treino da turma começando em breve",
        mensagem: `${grupo.tituloTreino} da turma começa em cerca de 15 minutos.`,
        link: "/treinos",
      });
    }
  }

  if (treinos.length) {
    console.log(
      `[notificationScheduler] lembretes de treino enviados/verificados: ${enviadosOuVerificados} em ${lembretesTurma.size} turma(s)`
    );
  }
}

async function enviarLembretesAulasAoVivo15Min() {
  const { inicio, fim } = getJanelaMinutos(15, 5);

  const aulas = await prisma.aulaAoVivo.findMany({
    where: {
      status: "AGENDADA",
      dataInicio: {
        gte: inicio,
        lt: fim,
      },
    },
    include: {
      convidados: {
        include: {
          usuario: {
            select: {
              id: true,
            },
          },
        },
      },
      metodologia: {
        select: {
          id: true,
          titulo: true,
          criadorUsuarioId: true,
        },
      },
      metodologiaAvulsa: {
        select: {
          id: true,
          titulo: true,
          criadorUsuarioId: true,
        },
      },
    },
    take: 100,
  });

  for (const aula of aulas) {
    const destinatarios = await getDestinatariosAulaAoVivo(aula);
    const tituloAula =
      aula.titulo ||
      aula.metodologia?.titulo ||
      aula.metodologiaAvulsa?.titulo ||
      "Aula ao vivo";

    for (const usuarioId of destinatarios) {
      const podeEnviar = await registrarLembreteSeAindaNaoEnviado({
        usuarioId,
        tipo: "AULA_AO_VIVO_15_MIN",
        alvoId: aula.id,
        janela: "15_MIN",
      });

      if (!podeEnviar) continue;

      await criarNotificacaoEEnviarPush({
        usuarioId,
        tipo: NotificacaoTipo.EVENTO,
        titulo: "Aula ao vivo começando em breve",
        mensagem: `${tituloAula} começa em cerca de 15 minutos.`,
        link: `/learning/live?aulaId=${aula.id}`,
      });
    }
  }

  if (aulas.length) {
    console.log(`[notificationScheduler] lembretes de aula ao vivo verificados: ${aulas.length}`);
  }
}

async function getDestinatariosEvento(evento: any) {
  const ids = new Set<string>();

  if (evento.creatorUsuarioId) {
    ids.add(String(evento.creatorUsuarioId));
  }

  if (evento.clube?.usuarioId) {
    ids.add(String(evento.clube.usuarioId));
  }

  if (evento.escolinha?.usuarioId) {
    ids.add(String(evento.escolinha.usuarioId));
  }

  if (Array.isArray(evento.inscricoes)) {
    for (const inscricao of evento.inscricoes) {
      if (inscricao?.usuarioId) ids.add(String(inscricao.usuarioId));
    }
  }

  const convocados = await prisma.eventoConvocado.findMany({
    where: {
      eventoId: evento.id,
    },
    select: {
      atletaId: true,
    },
  });

  const atletaIds = convocados
    .map((item) => item.atletaId)
    .filter(Boolean);

  if (atletaIds.length) {
    const atletas = await prisma.atleta.findMany({
      where: {
        id: {
          in: atletaIds,
        },
      },
      select: {
        usuarioId: true,
      },
    });

    for (const atleta of atletas) {
      if (atleta.usuarioId) ids.add(String(atleta.usuarioId));
    }
  }

  return Array.from(ids);
}

async function enviarLembretesEventos(params: {
  minutosAntes: number;
  janela: string;
  titulo: string;
  tamanhoJanelaMin?: number;
}) {
  const { inicio, fim } = getJanelaMinutos(
    params.minutosAntes,
    params.tamanhoJanelaMin || 5
  );

  const eventos = await prisma.evento.findMany({
    where: {
      status: "ABERTO",
      dataEvento: {
        gte: inicio,
        lt: fim,
      },
    },
    include: {
      clube: {
        select: {
          usuarioId: true,
          nome: true,
        },
      },
      escolinha: {
        select: {
          usuarioId: true,
          nome: true,
        },
      },
      inscricoes: {
        select: {
          usuarioId: true,
        },
      },
    },
    take: 100,
  });

  for (const evento of eventos) {
    const destinatarios = await getDestinatariosEvento(evento);
    const horario = dataHoraPtBr(evento.dataEvento);
    const mensagem = horario
      ? `${evento.titulo} está chegando. Horário: ${horario}.`
      : `${evento.titulo} está chegando.`;

    for (const usuarioId of destinatarios) {
      const podeEnviar = await registrarLembreteSeAindaNaoEnviado({
        usuarioId,
        tipo: `EVENTO_${params.janela}`,
        alvoId: evento.id,
        janela: params.janela,
      });

      if (!podeEnviar) continue;

      await criarNotificacaoEEnviarPush({
        usuarioId,
        tipo: NotificacaoTipo.EVENTO,
        titulo: params.titulo,
        mensagem,
        link: `/eventos/${evento.id}`,
      });
    }
  }

  if (eventos.length) {
    console.log(
      `[notificationScheduler] lembretes de evento ${params.janela} verificados: ${eventos.length}`
    );
  }
}

async function executarLembretesDeHorario() {
  try {
    await enviarLembretesTreinos15Min();
  } catch (e) {
    console.error("[notificationScheduler] erro em treinos 15min:", e);
  }

  try {
    await enviarLembretesAulasAoVivo15Min();
  } catch (e) {
    console.error("[notificationScheduler] erro em aulas ao vivo 15min:", e);
  }

  try {
    await enviarLembretesEventos({
      minutosAntes: 60,
      janela: "1_HORA",
      titulo: "Evento começando em breve",
      tamanhoJanelaMin: 5,
    });
  } catch (e) {
    console.error("[notificationScheduler] erro em eventos 1h:", e);
  }

  try {
    await enviarLembretesEventos({
      minutosAntes: 24 * 60,
      janela: "24_HORAS",
      titulo: "Evento amanhã",
      tamanhoJanelaMin: 10,
    });
  } catch (e) {
    console.error("[notificationScheduler] erro em eventos 24h:", e);
  }
}

export function startNotificationScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  cron.schedule("*/5 * * * *", async () => {
    await executarLembretesDeHorario();
  });

  if (process.env.RUN_NOTIFICATION_SCHEDULER_ON_BOOT === "true") {
    executarLembretesDeHorario().catch((e) => {
      console.error("[notificationScheduler] erro no boot:", e);
    });
  }
}