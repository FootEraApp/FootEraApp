// server/controllers/metodologiasController
import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { startOfMonth, addMonths } from "date-fns";
import {
  MetodologiaAssinaturaStatus,
  MetodologiaAssinaturaOrigem,
  MetodologiaPublicoAlvo,
  MetodologiaConteudoTipo,
  MetodologiaTipo,
  MetodologiaEstruturaTipo,
  MetodologiaModoExecucao,
  MetodologiaItemTipo,
  MetodologiaProgressoStatus,
  SentimentoAvaliacao,
} from "@prisma/client";
import {
  ensureConquistaTemplateMetodologia,
  unlockConquistaMetodologia,
  syncTemplatesMetodologiasProfissionais,
  emitirCertificadoMetodologia,
} from "../services/conquistasMetodologia.js";
import { deleteFromS3 } from "../middlewares/s3Upload.js";

function calcularDatasExecucao(estrutura: any, assinatura: any) {
  const modo = estrutura?.modoExecucao;

  // MODULO: usa o prazo final fixo, se existir
  if (estrutura?.tipo === "MODULO") {
    return {
      inicio: null,
      fim: estrutura?.prazoFinal ?? null,
    };
  }

  if (!modo) {
    return { inicio: null, fim: null };
  }

  if (modo === "DESAFIO_FECHADO") {
    if (assinatura?.iniciouEm && estrutura?.duracaoSemanas) {
      const inicio = new Date(assinatura.iniciouEm);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + Number(estrutura.duracaoSemanas) * 7);

      return { inicio, fim };
    }

    return {
      inicio: estrutura?.prazoInicio ?? null,
      fim: estrutura?.prazoFinal ?? null,
    };
  }

  if (modo === "PRAZO_SUGERIDO") {
    if (assinatura?.iniciouEm && estrutura?.duracaoSemanas) {
      const inicio = new Date(assinatura.iniciouEm);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + Number(estrutura.duracaoSemanas) * 7);

      return { inicio, fim };
    }

    return {
      inicio: null,
      fim: estrutura?.prazoFinal ?? null,
    };
  }

  return { inicio: null, fim: null };
}

function getUserId(req: Request): string | null {
  const r: any = req;
  return r.userId || r.user?.id || r.usuarioId || null;
}

async function isAdminUser(userId: string | null | undefined) {
  if (!userId) return false;

  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { tipo: true },
  });

  return String(usuario?.tipo || "").toLowerCase().trim() === "admin";
}

function asNullableString(v: any): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function asNullableNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asBool(v: any, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "sim", "yes"].includes(s)) return true;
    if (["false", "0", "nao", "não", "no"].includes(s)) return false;
  }
  return fallback;
}

function isValidEnumValue<T extends Record<string, string>>(enumObj: T, value: any): value is T[keyof T] {
  return Object.values(enumObj).includes(value);
}

function calcularPontuacaoVideoOuAula(duracaoMin: number | null | undefined) {
  const minutos = Number(duracaoMin || 0);

  if (!Number.isFinite(minutos) || minutos <= 0) return 15;

  return 15 + Math.floor(Math.max(minutos - 0.000001, 0) / 5) * 3;
}

function calcularPontuacaoItemBackend(params: {
  tipo: MetodologiaItemTipo;
  duracaoMin?: number | null;
  treinoPontuacao?: number | null;
}) {
  const { tipo, duracaoMin, treinoPontuacao } = params;

  if (tipo === MetodologiaItemTipo.TREINO) {
    return treinoPontuacao ?? 0;
  }

  if (
    tipo === MetodologiaItemTipo.VIDEO ||
    tipo === MetodologiaItemTipo.AULA ||
    tipo === MetodologiaItemTipo.AULA_AO_VIVO
  ) {
    return calcularPontuacaoVideoOuAula(duracaoMin);
  }

  if (tipo === MetodologiaItemTipo.MATERIAL) {
    return 10;
  }

  if (tipo === MetodologiaItemTipo.DESAFIO) {
    return 10;
  }

  return 0;
}

function parseDataAulaAoVivo(value: any, label: string) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    throw new Error(`${label} é obrigatória para aula ao vivo.`);
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} inválida para aula ao vivo.`);
  }

  const agora = new Date();

  if (date.getTime() <= agora.getTime()) {
    throw new Error(`${label} não pode estar no passado.`);
  }

  if (date.getFullYear() > 2050) {
    throw new Error(`${label} não pode passar do ano 2050.`);
  }

  return date;
}

async function criarAulaAoVivoParaItem(params: {
  tx: any;
  userId: string;
  itemPayload: any;
  itemCriadoId: string;
  tituloItem: string;
  descricaoItem: string | null;
  duracaoMin: number | null;
  thumbUrl: string | null;

  metodologiaId?: string | null;
  estruturaId?: string | null;

  metodologiaAvulsaId?: string | null;
  estruturaAvulsaId?: string | null;
}) {
  const {
    tx,
    userId,
    itemPayload,
    itemCriadoId,
    tituloItem,
    descricaoItem,
    duracaoMin,
    thumbUrl,
    metodologiaId,
    estruturaId,
    metodologiaAvulsaId,
    estruturaAvulsaId,
  } = params;

  const aulaPayload = itemPayload?.aulaAoVivo || {};

  const dataInicio = parseDataAulaAoVivo(
    aulaPayload.dataInicio,
    `A aula ao vivo "${tituloItem}" precisa ter data de início`
  );

  const dataFim = aulaPayload.dataFim ? new Date(aulaPayload.dataFim) : null;

  const inscricaoInicio = aulaPayload.inscricaoInicio
    ? new Date(aulaPayload.inscricaoInicio)
    : null;

  const inscricaoFim = aulaPayload.inscricaoFim
    ? new Date(aulaPayload.inscricaoFim)
    : null;

  if (inscricaoInicio && Number.isNaN(inscricaoInicio.getTime())) {
    throw new Error(`O início das inscrições da aula ao vivo "${tituloItem}" é inválido.`);
  }

  if (inscricaoFim && Number.isNaN(inscricaoFim.getTime())) {
    throw new Error(`O fim das inscrições da aula ao vivo "${tituloItem}" é inválido.`);
  }

  if (inscricaoInicio && inscricaoFim && inscricaoFim <= inscricaoInicio) {
    throw new Error(`O fim das inscrições da aula ao vivo "${tituloItem}" precisa ser depois do início.`);
  }

  if (inscricaoFim && dataInicio <= inscricaoFim) {
    throw new Error(`A aula ao vivo "${tituloItem}" precisa começar depois do fim das inscrições.`);
  }

  if (dataFim && Number.isNaN(dataFim.getTime())) {
    throw new Error(`A data final da aula ao vivo "${tituloItem}" é inválida.`);
  }

  if (dataFim && dataFim <= dataInicio) {
    throw new Error(`A data final da aula ao vivo "${tituloItem}" precisa ser maior que a data de início.`);
  }

  const baseData: any = {
    titulo: asNullableString(aulaPayload.titulo) || tituloItem,
    descricao:
      asNullableString(aulaPayload.descricao) ||
      descricaoItem ||
      null,

    dataInicio,
    dataFim,
    inscricaoInicio,
    inscricaoFim,

    status: "AGENDADA",

    chatAtivo: aulaPayload.chatAtivo !== false,
    gravacaoAtiva: aulaPayload.gravacaoAtiva !== false,
    replayDisponivel: aulaPayload.replayDisponivel === true,

    duracaoMin,
    thumbUrl,

    criadorUsuarioId: userId,

    convidadoUsuarioId: asNullableString(aulaPayload.convidadoUsuarioId),
    convidadoNome: asNullableString(aulaPayload.convidadoNome),
    convidadoDescricao: asNullableString(aulaPayload.convidadoDescricao),
  };

  if (metodologiaId && estruturaId) {
    baseData.metodologiaId = metodologiaId;
    baseData.estruturaId = estruturaId;
    baseData.itemId = itemCriadoId;
  }

  if (metodologiaAvulsaId && estruturaAvulsaId) {
    baseData.metodologiaAvulsaId = metodologiaAvulsaId;
    baseData.estruturaAvulsaId = estruturaAvulsaId;
    baseData.itemAvulsaId = itemCriadoId;
  }

  const aulaCriada = await tx.aulaAoVivo.create({
    data: baseData,
  });

  const convidadosPayload = Array.isArray(aulaPayload.convidados)
    ? aulaPayload.convidados
    : [];

  const convidadosNormalizados = convidadosPayload
    .map((c: any, index: number) => ({
      aulaAoVivoId: aulaCriada.id,
      usuarioId: asNullableString(c.usuarioId),
      nome: asNullableString(c.nome),
      descricao: asNullableString(c.descricao),
      ordem: Number.isFinite(Number(c.ordem)) ? Number(c.ordem) : index + 1,
    }))
    .filter((c: any) => c.usuarioId || c.nome);

  if (convidadosNormalizados.length) {
    await tx.aulaAoVivoConvidado.createMany({
      data: convidadosNormalizados,
    });
  }

  return aulaCriada;
}

async function upsertAulaAoVivoParaItem(params: {
  tx: any;
  userId: string;
  itemPayload: any;
  itemCriadoId: string;
  tituloItem: string;
  descricaoItem: string | null;
  duracaoMin: number | null;
  thumbUrl: string | null;
  metodologiaId?: string | null;
  estruturaId?: string | null;
  metodologiaAvulsaId?: string | null;
  estruturaAvulsaId?: string | null;
}) {
  const {
    tx,
    userId,
    itemPayload,
    itemCriadoId,
    tituloItem,
    descricaoItem,
    duracaoMin,
    thumbUrl,
    metodologiaId,
    estruturaId,
    metodologiaAvulsaId,
    estruturaAvulsaId,
  } = params;

  const aulaPayload = itemPayload?.aulaAoVivo || {};

  const aulaExistentePorId = aulaPayload.id
    ? await tx.aulaAoVivo.findUnique({
        where: { id: String(aulaPayload.id) },
        select: {
          id: true,
          dataInicio: true,
          dataFim: true,
          inscricaoInicio: true,
          inscricaoFim: true,
        },
      })
    : null;

  const dataInicioRaw =
    aulaPayload.dataInicio ||
    aulaExistentePorId?.dataInicio ||
    null;

  const dataInicio = parseDataAulaAoVivo(
    dataInicioRaw,
    `A aula ao vivo "${tituloItem}" precisa ter data de início`
  );

  const dataFimRaw =
    aulaPayload.dataFim !== undefined && aulaPayload.dataFim !== null && aulaPayload.dataFim !== ""
      ? aulaPayload.dataFim
      : aulaExistentePorId?.dataFim || null;

  const dataFim = dataFimRaw ? new Date(dataFimRaw) : null;

  if (dataFim && Number.isNaN(dataFim.getTime())) {
    throw new Error(`A data final da aula ao vivo "${tituloItem}" é inválida.`);
  }

  if (dataFim && dataFim <= dataInicio) {
    throw new Error(`A data final da aula ao vivo "${tituloItem}" precisa ser maior que a data de início.`);
  }

  const inscricaoInicioRaw =
    aulaPayload.inscricaoInicio !== undefined &&
    aulaPayload.inscricaoInicio !== null &&
    aulaPayload.inscricaoInicio !== ""
      ? aulaPayload.inscricaoInicio
      : aulaExistentePorId?.inscricaoInicio || null;

  const inscricaoFimRaw =
    aulaPayload.inscricaoFim !== undefined &&
    aulaPayload.inscricaoFim !== null &&
    aulaPayload.inscricaoFim !== ""
      ? aulaPayload.inscricaoFim
      : aulaExistentePorId?.inscricaoFim || null;

  const inscricaoInicio = inscricaoInicioRaw
    ? new Date(inscricaoInicioRaw)
    : null;

  const inscricaoFim = inscricaoFimRaw
    ? new Date(inscricaoFimRaw)
    : null;

  if (inscricaoInicio && Number.isNaN(inscricaoInicio.getTime())) {
    throw new Error(`O início das inscrições da aula ao vivo "${tituloItem}" é inválido.`);
  }

  if (inscricaoFim && Number.isNaN(inscricaoFim.getTime())) {
    throw new Error(`O fim das inscrições da aula ao vivo "${tituloItem}" é inválido.`);
  }

  if (inscricaoInicio && inscricaoFim && inscricaoFim <= inscricaoInicio) {
    throw new Error(`O fim das inscrições da aula ao vivo "${tituloItem}" precisa ser depois do início.`);
  }

  if (inscricaoFim && dataInicio <= inscricaoFim) {
    throw new Error(`A aula ao vivo "${tituloItem}" precisa começar depois do fim das inscrições.`);
  }

  if (inscricaoInicio && !inscricaoFim) {
    throw new Error(`Informe também o fim das inscrições da aula ao vivo "${tituloItem}".`);
  }

  if (!inscricaoInicio && inscricaoFim) {
    throw new Error(`Informe também o início das inscrições da aula ao vivo "${tituloItem}".`);
  }

  const data: any = {
    titulo: asNullableString(aulaPayload.titulo) || tituloItem,
    descricao: asNullableString(aulaPayload.descricao) || descricaoItem || null,
    dataInicio,
    dataFim,
    inscricaoInicio,
    inscricaoFim,
    status: asNullableString(aulaPayload.status) || "AGENDADA",
    chatAtivo: aulaPayload.chatAtivo !== false,
    gravacaoAtiva: aulaPayload.gravacaoAtiva !== false,
    replayDisponivel: aulaPayload.replayDisponivel === true,
    duracaoMin,
    thumbUrl,
    criadorUsuarioId: userId,

    convidadoUsuarioId: asNullableString(aulaPayload.convidadoUsuarioId),
    convidadoNome: asNullableString(aulaPayload.convidadoNome),
    convidadoDescricao: asNullableString(aulaPayload.convidadoDescricao),
  };

  if (metodologiaId && estruturaId) {
    data.metodologiaId = metodologiaId;
    data.estruturaId = estruturaId;
    data.itemId = itemCriadoId;
  }

  if (metodologiaAvulsaId && estruturaAvulsaId) {
    data.metodologiaAvulsaId = metodologiaAvulsaId;
    data.estruturaAvulsaId = estruturaAvulsaId;
    data.itemAvulsaId = itemCriadoId;
  }

  let aula = null;

  // 1) Só atualiza pelo ID se esse ID realmente existir no banco.
  // Em edição, o front pode mandar um aulaPayload.id antigo de uma aula
  // que foi apagada junto com o item anterior.
  if (aulaPayload.id && aulaExistentePorId?.id) {
    aula = await tx.aulaAoVivo.update({
      where: { id: aulaExistentePorId.id },
      data,
    });
  }

  // 2) Se não atualizou por ID, tenta achar aula ligada ao item atual.
  if (!aula) {
    const aulaExistentePorItem = await tx.aulaAoVivo.findFirst({
      where: metodologiaAvulsaId
        ? { itemAvulsaId: itemCriadoId }
        : { itemId: itemCriadoId },
      select: { id: true },
    });

    if (aulaExistentePorItem?.id) {
      aula = await tx.aulaAoVivo.update({
        where: { id: aulaExistentePorItem.id },
        data,
      });
    }
  }

  // 3) Se não achou nenhuma, cria uma nova aula ao vivo.
  if (!aula) {
    aula = await tx.aulaAoVivo.create({
      data,
    });
  }

  const convidadosPayload = Array.isArray(aulaPayload.convidados)
    ? aulaPayload.convidados
    : [];

  await tx.aulaAoVivoConvidado.deleteMany({
    where: { aulaAoVivoId: aula.id },
  });

  const convidadosNormalizados = convidadosPayload
    .map((c: any, index: number) => ({
      aulaAoVivoId: aula.id,
      usuarioId: asNullableString(c.usuarioId),
      nome: asNullableString(c.nome),
      descricao: asNullableString(c.descricao),
      ordem: Number.isFinite(Number(c.ordem)) ? Number(c.ordem) : index + 1,
    }))
    .filter((c: any) => c.usuarioId || c.nome);

  if (convidadosNormalizados.length) {
    await tx.aulaAoVivoConvidado.createMany({
      data: convidadosNormalizados,
    });
  }

  return aula;
}

async function validarMetodologiaDoCriador(metodologiaId: string, userId: string) {
  const metodologia = await prisma.metodologia.findUnique({
    where: { id: metodologiaId },
    select: {
      id: true,
      criadorUsuarioId: true,
      tipo: true,
      estruturaTipo: true,
      ativo: true,
      geraBadge: true,
      geraCertificado: true,
    },
  });

  if (!metodologia) {
    return { erro: { status: 404, message: "Metodologia não encontrada." } };
  }

  const isAdmin = await isAdminUser(userId);

  if (
    metodologia.criadorUsuarioId !== userId &&
    !isAdmin
  ) {
    return { erro: { status: 403, message: "Sem permissão." } };
  }

  return { metodologia };
}

async function recalcularStatusMetodologiaAssinante(metodologiaId: string, usuarioId: string) {
  const assinatura = await prisma.metodologiaAssinante.findUnique({
    where: {
      metodologiaId_usuarioId: {
        metodologiaId,
        usuarioId,
      },
    },
    select: {
      id: true,
      progresso: true,
      status: true,
      concluiuEm: true,
    },
  });

  if (!assinatura) return null;

  const [totalItens, totalConcluidos] = await Promise.all([
    prisma.metodologiaEstruturaItem.count({
      where: {
        estrutura: {
          metodologiaId,
        },
        publicado: true,
      },
    }),
    prisma.metodologiaProgressoEstrutura.count({
      where: {
        metodologiaAssinanteId: assinatura.id,
        status: MetodologiaProgressoStatus.CONCLUIDA,
      },
    }),
  ]);

  const payload: any = assinatura.progresso && typeof assinatura.progresso === "object"
    ? { ...(assinatura.progresso as any) }
    : {};

  payload.totalItens = totalItens;
  payload.estruturasConcluidas = totalConcluidos;

  const todasEstruturas = await prisma.metodologiaEstrutura.count({
    where: { metodologiaId, ativo: true },
  });

  const concluiuTudo = todasEstruturas > 0 && totalConcluidos >= todasEstruturas;

  const pontosGanhosFinal = Number(payload.pontosGanhos ?? 0);

  const updated = await prisma.metodologiaAssinante.update({
    where: { id: assinatura.id },
    data: {
      progresso: payload,
      pontosGanhos: pontosGanhosFinal,
      status: concluiuTudo ? MetodologiaAssinaturaStatus.CONCLUIDA : assinatura.status,
      concluiuEm: concluiuTudo ? (assinatura.concluiuEm ?? new Date()) : assinatura.concluiuEm,
    },
  });

  if (concluiuTudo) {
    const metodologia = await prisma.metodologia.findUnique({
      where: { id: metodologiaId },
      select: {
        id: true,
        titulo: true,
        capaUrl: true,
        geraBadge: true,
        geraCertificado: true,
      },
    });

    if (metodologia?.geraBadge) {
      await unlockConquistaMetodologia(usuarioId, metodologiaId).catch(() => null);
    }

    if (metodologia?.geraCertificado) {
      await emitirCertificadoMetodologia({
        usuarioId,
        metodologiaId,
      }).catch(() => null);
    }
    if (!assinatura.concluiuEm) {
      await prisma.atividadeRecente.create({
        data: {
          usuarioId,
          tipo: "Metodologia",
          titulo: `Metodologia concluída: ${metodologia?.titulo || "Metodologia"}`,
          imagemUrl: metodologia?.capaUrl ?? null,
          link: `/learning/${metodologiaId}`,
        },
      }).catch(() => null);
    }
  }
  return updated;
}

function assinaturaDaAcesso(a: any) {
  if (!a) return false;

  const statusOk =
    a.status === MetodologiaAssinaturaStatus.ATIVA ||
    a.status === MetodologiaAssinaturaStatus.CONCLUIDA;

  if (!statusOk) return false;
  if (a.expiraEm && new Date(a.expiraEm) <= new Date()) return false;

  return true;
}

function isPlanoMetodologiaAvulsa(plano: string | null | undefined) {
  const p = String(plano || "").toUpperCase();
  return p.startsWith("METODOLOGIA_AVULSA:");
}

function isPlanoMetodologiaLearning(plano: string | null | undefined) {
  const p = String(plano || "").toUpperCase();
  return p.startsWith("METODOLOGIA:");
}

function metodologiaLimitFromPlano(plano: string | null | undefined): number {
  const p = String(plano || "").toUpperCase();

  // se o cara comprou uma metodologia avulsa, isso NÃO é "quota mensal"
  // (é acesso àquela metodologia específica via MetodologiaAssinante)
  if (isPlanoMetodologiaAvulsa(p)) return 0;

  // 1 por mês
  if (p === "ATLETA_LEARNING_1") return 1;
  if (p === "PROFESSOR_LEARNING_1") return 1;

  // 3 por mês
  if (p === "ATLETA_LEARNING_3") return 3;
  if (p === "PROFESSOR_LEARNING_3") return 3;
  if (p === "ORGANIZACOES_LEARNING_3") return 3;

  // Pro e outros: zero
  return 0;
}

function pickPrincipalAssinatura(
  assinaturas: Array<{ plano?: string | null; status?: string | null; ativo?: boolean | null }>
) {
  const isAtiva = (a: any) =>
    (a?.status === "ATIVA" || a?.status === "TRIAL") && a?.ativo === true;

  const isMetodo = (a: any) =>
    isPlanoMetodologiaLearning(a?.plano) || isPlanoMetodologiaAvulsa(a?.plano);

  const ativa = assinaturas.find((a) => !isMetodo(a) && isAtiva(a));
  if (ativa) return ativa as any;

  const primeiraNaoMetodo = assinaturas.find((a) => !isMetodo(a));
  return (primeiraNaoMetodo ?? null) as any;
}

async function getPermissaoCriacaoMetodologia(userId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      id: true,
      tipo: true,
      parceiro: true,
      creator: {
        select: {
          id: true,
          ativo: true,
        },
      },
    },
  });

  const tipo = String(usuario?.tipo || "").toLowerCase().trim();

  const tiposPermitidos = [
    "professor",
    "clube",
    "escolinha",
    "admin",
    "profissional",
    "federação",
    "federacao",
    "marca",
  ];

  const temCreatorAtivo = usuario?.creator?.ativo === true;
  const podeCriar = tiposPermitidos.includes(tipo) || temCreatorAtivo;
  
  return {
    podeCriar,
    ehProfessorParceiro: tipo === "professor" ? usuario?.parceiro === true : false,
    temPlanoElegivel: false,
    planoPrincipal: null,
    motivoBloqueio: podeCriar
      ? null
      : "Apenas perfis autorizados ou usuários com Creator ativo podem criar metodologias.",
    planosPermitidos: [],
  };
}

async function anexarCountsEstruturaPorMetodologia(ids: string[]) {
  const out: Record<
    string,
    {
      treinoCount: number;
      videoCount: number;
      aulaCount: number;
      materialCount: number;
      desafioCount: number;
      estruturaCount: number;
    }
  > = {};

  if (!ids.length) return out;

  const [estruturas, itens] = await Promise.all([
    prisma.metodologiaEstrutura.findMany({
      where: {
        metodologiaId: { in: ids },
        ativo: true,
      },
      select: { id: true, metodologiaId: true },
    }),
    prisma.metodologiaEstruturaItem.findMany({
      where: {
        publicado: true,
        estrutura: {
          metodologiaId: { in: ids },
          ativo: true,
        },
      },
      select: {
        tipo: true,
        estrutura: {
          select: {
            metodologiaId: true,
          },
        },
      },
    }),
  ]);

  for (const id of ids) {
    out[id] = {
      treinoCount: 0,
      videoCount: 0,
      aulaCount: 0,
      materialCount: 0,
      desafioCount: 0,
      estruturaCount: 0,
    };
  }

  for (const e of estruturas) {
    if (!out[e.metodologiaId]) continue;
    out[e.metodologiaId].estruturaCount++;
  }

  for (const it of itens) {
    const metodologiaId = it.estrutura.metodologiaId;
    if (!out[metodologiaId]) continue;

    if (it.tipo === MetodologiaItemTipo.TREINO) out[metodologiaId].treinoCount++;
    if (it.tipo === MetodologiaItemTipo.VIDEO) out[metodologiaId].videoCount++;
    if (it.tipo === MetodologiaItemTipo.AULA) out[metodologiaId].aulaCount++;
    if (it.tipo === MetodologiaItemTipo.MATERIAL) out[metodologiaId].materialCount++;
    if (it.tipo === MetodologiaItemTipo.DESAFIO) out[metodologiaId].desafioCount++;
  }

  return out;
}

export async function listMetodologias(req: Request, res: Response) {
  try {
    const criadorUsuarioId = (req.query.criadorUsuarioId as string) || undefined;

    const items = await prisma.metodologia.findMany({
      where: criadorUsuarioId ? { criadorUsuarioId } : undefined,
      orderBy: { criadoEm: "desc" },
      include: {
        criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
        _count: { select: { assinantes: true, estruturas: true } },
      },
    });

    return res.json({ items });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao listar metodologias.", detail: e?.message });
  }
}

export async function getMetodologiaById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const userId = getUserId(req);

    const assinatura = userId
      ? await prisma.metodologiaAssinante.findUnique({
          where: {
            metodologiaId_usuarioId: {
              metodologiaId: id,
              usuarioId: userId,
            },
          },
        })
      : null;

    const item = await prisma.metodologia.findUnique({
      where: { id },
      include: {
        criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
        estruturas: {
          orderBy: { ordem: "asc" },
          include: {
            itens: {
              orderBy: { ordem: "asc" },
              include: {
                treinoProgramado: {
                  select: {
                    id: true,
                    nome: true,
                    codigo: true,
                    imagemUrl: true,
                    nivel: true,
                    categoria: true,
                    pontuacao: true,
                    duracao: true,
                    objetivo: true,
                    tipoTreino: true,
                  },
                },

                aulaAoVivo: {
                  include: {
                    convidados: {
                      orderBy: { ordem: "asc" },
                      include: {
                        usuario: {
                          select: {
                            id: true,
                            nome: true,
                            foto: true,
                            tipo: true,
                            nomeDeUsuario: true,
                          },
                        },
                      },
                    },
                    convidadoUsuario: {
                      select: {
                        id: true,
                        nome: true,
                        foto: true,
                        tipo: true,
                        nomeDeUsuario: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        _count: { select: { assinantes: true, estruturas: true } },
      },
    });

    if (!item) return res.status(404).json({ message: "Metodologia não encontrada." });
        item.estruturas = item.estruturas.map((e: any) => {
      const { inicio, fim } = calcularDatasExecucao(e, assinatura);

      return {
        ...e,
        dataInicioCalculada: inicio,
        dataFimCalculada: fim,
      };
    });
    return res.json({ item });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao buscar metodologia.", detail: e?.message });
  }
}

export async function createMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const permissaoCriacao = await getPermissaoCriacaoMetodologia(userId);

    if (!permissaoCriacao.podeCriar) {
      return res.status(403).json({
        code: "CRIACAO_METODOLOGIA_BLOQUEADA",
        message: "Apenas professor, clube, escolinha ou admin podem criar metodologias.",
        detalhes: permissaoCriacao,
      });
    }

    const {
      titulo,
      descricao,
      capaUrl,
      publicoAlvo,
      categorias,
      nivel,
      tipo,
      estruturaTipo,
      area,
      geraBadge,
      geraCertificado,
      totalSemanas,
    } = req.body || {};

    if (!titulo || typeof titulo !== "string") {
      return res.status(400).json({ message: "Título é obrigatório." });
    }

    const tituloTrim = titulo.trim();

    const metodologiaComMesmoNome = await prisma.metodologia.findFirst({
      where: {
        titulo: {
          equals: tituloTrim,
          mode: "insensitive",
        },
        criadorUsuarioId: userId,
      },
      select: { id: true, titulo: true },
    });

    if (metodologiaComMesmoNome) {
      return res.status(400).json({
        message: `Você já possui uma metodologia com o nome "${tituloTrim}". Escolha outro nome.`,
      });
    }

    if (!tipo || !Object.values(MetodologiaTipo).includes(tipo)) {
      return res.status(400).json({ message: "tipo inválido." });
    }

    if (!estruturaTipo || !Object.values(MetodologiaEstruturaTipo).includes(estruturaTipo)) {
      return res.status(400).json({ message: "estruturaTipo inválido." });
    }

    if (
      tipo === MetodologiaTipo.TRILHAS_TREINO &&
      estruturaTipo !== MetodologiaEstruturaTipo.TRILHA
    ) {
      return res.status(400).json({
        message: "Metodologia de trilhas de treino deve usar estruturaTipo=TRILHA.",
      });
    }

    if (
      tipo === MetodologiaTipo.CURSO_FORMACAO &&
      estruturaTipo !== MetodologiaEstruturaTipo.MODULO
    ) {
      return res.status(400).json({
        message: "Metodologia de curso/formação deve usar estruturaTipo=MODULO.",
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        tipo: true,
        professor: { select: { id: true } },
        clube: { select: { id: true } },
        escolinha: { select: { id: true } },
      },
    });

    const professorId =
      usuario?.tipo === "Professor" ? usuario?.professor?.id ?? null : null;

    const clubeId =
      usuario?.tipo === "Clube" ? usuario?.clube?.id ?? null : null;

    const escolinhaId =
      usuario?.tipo === "Escolinha" ? usuario?.escolinha?.id ?? null : null;

    let publicoAlvoFinal: MetodologiaPublicoAlvo = MetodologiaPublicoAlvo.AMBOS;

    if (publicoAlvo !== undefined && publicoAlvo !== null && String(publicoAlvo).trim() !== "") {
      const raw = String(publicoAlvo).toUpperCase().trim();
      const ok = (Object.values(MetodologiaPublicoAlvo) as string[]).includes(raw);
      if (!ok) {
        return res.status(400).json({
          message: "publicoAlvo inválido",
          recebido: publicoAlvo,
          esperado: Object.values(MetodologiaPublicoAlvo),
        });
      }
      publicoAlvoFinal = raw as MetodologiaPublicoAlvo;
    }

    const created = await prisma.metodologia.create({
      data: {
        titulo: titulo.trim(),
        descricao: typeof descricao === "string" ? descricao.trim() : null,
        capaUrl: typeof capaUrl === "string" ? capaUrl.trim() : null,
        nivel: nivel ?? undefined,
        categorias: Array.isArray(categorias) ? categorias : undefined,
        publicoAlvo: publicoAlvoFinal,
        criadorUsuarioId: userId,
        professorId: professorId ?? undefined,
        clubeId: clubeId ?? undefined,
        escolinhaId: escolinhaId ?? undefined,
        ativo: false,
        tipo,
        estruturaTipo,
        area: area ?? null,
        geraBadge: !!geraBadge,
        geraCertificado: !!geraCertificado,
        totalSemanas: totalSemanas ?? null, // legado, enquanto existir
      },
      include: { _count: { select: { assinantes: true, estruturas: true } } },
    });

    try {
      await ensureConquistaTemplateMetodologia(created.id);
      await syncTemplatesMetodologiasProfissionais();
    } catch (e) {
      console.error("Falha ao sync template de conquista da metodologia:", e);
    }

    // ✅ ADICIONA NA ATIVIDADE RECENTE
    try {
      await prisma.atividadeRecente.create({
        data: {
          usuarioId: userId,
          tipo: "Metodologia",
          titulo: `Nova metodologia: ${created.titulo}`,
          imagemUrl: created.capaUrl ?? null,
          link: `/metodologias/${created.id}`,
          // createdAt: NÃO precisa (default now())
        },
      });
    } catch (e) {
      console.error("Falha ao criar AtividadeRecente da metodologia:", e);
    }

    return res.status(201).json({ item: created });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao criar metodologia.", detail: e?.message });
  }
}

export async function updateMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { id } = req.params;
    const {
      titulo,
      descricao,
      capaUrl,
      totalSemanas,
      ativo,
      nivel,
      categorias,
      publicoAlvo,
      tipo,
      estruturaTipo,
      area,
      geraBadge,
      geraCertificado,
      estruturas
    } = req.body || {};

    const current = await prisma.metodologia.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: "Metodologia não encontrada." });

    if (current.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Você não tem permissão para editar esta metodologia." });
    }

    let publicoAlvoUpdate: MetodologiaPublicoAlvo | undefined = undefined;

    if (publicoAlvo !== undefined) {
      const raw = String(publicoAlvo).toUpperCase().trim();
      const ok = (Object.values(MetodologiaPublicoAlvo) as string[]).includes(raw);
      if (!ok) {
        return res.status(400).json({
          message: "publicoAlvo inválido",
          recebido: publicoAlvo,
          esperado: Object.values(MetodologiaPublicoAlvo),
        });
      }
      publicoAlvoUpdate = raw as MetodologiaPublicoAlvo;
    }

    const capaUrlUpdate =
      capaUrl === null
        ? null
        : typeof capaUrl === "string"
          ? (capaUrl.trim() ? capaUrl.trim() : null)
          : undefined;

    // ✅ NOVIDADE: Se a capa está sendo atualizada/removida, apaga a antiga do S3
    if (capaUrlUpdate !== undefined && current.capaUrl && current.capaUrl !== capaUrlUpdate && current.capaUrl.includes("amazonaws.com")) {
      await deleteFromS3(current.capaUrl);
    }

    if (typeof titulo === "string" && titulo.trim()) {
      const tituloTrim = titulo.trim();

      const metodologiaComMesmoNome = await prisma.metodologia.findFirst({
        where: {
          id: { not: id },
          titulo: {
            equals: tituloTrim,
            mode: "insensitive",
          },
          criadorUsuarioId: userId,
        },
        select: { id: true, titulo: true },
      });

      if (metodologiaComMesmoNome) {
        return res.status(400).json({
          message: `Você já possui uma metodologia com o nome "${tituloTrim}". Escolha outro nome.`,
        });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const metodologiaAtualizada = await tx.metodologia.update({
        where: { id },
        data: {
          titulo: typeof titulo === "string" ? titulo.trim() : undefined,
          descricao: typeof descricao === "string" ? descricao.trim() : undefined,
          capaUrl: capaUrlUpdate,
          totalSemanas: typeof totalSemanas === "number" ? totalSemanas : undefined,
          ativo: false,
          nivel: nivel ?? undefined,
          categorias: Array.isArray(categorias) ? categorias : undefined,
          ...(publicoAlvoUpdate !== undefined ? { publicoAlvo: publicoAlvoUpdate } : {}),
          ...(tipo !== undefined ? { tipo } : {}),
          ...(estruturaTipo !== undefined ? { estruturaTipo } : {}),
          ...(area !== undefined ? { area } : {}),
          ...(geraBadge !== undefined ? { geraBadge: !!geraBadge } : {}),
          ...(geraCertificado !== undefined ? { geraCertificado: !!geraCertificado } : {}),
        },
      });

      if (Array.isArray(estruturas)) {
        const estruturasAtuais = await tx.metodologiaEstrutura.findMany({
          where: { metodologiaId: id },
          select: { id: true },
        });

        const idsEstruturasAtuais = estruturasAtuais.map((e) => e.id);
        const idsEstruturasPayload = estruturas
          .map((e: any) => e.id)
          .filter(Boolean);

        const estruturasRemover = idsEstruturasAtuais.filter(
          (oldId) => !idsEstruturasPayload.includes(oldId)
        );

        if (estruturasRemover.length) {
          await tx.metodologiaEstrutura.deleteMany({
            where: {
              id: { in: estruturasRemover },
              metodologiaId: id,
            },
          });
        }

        for (let i = 0; i < estruturas.length; i++) {
          const estrutura = estruturas[i];

          let estruturaId = estrutura?.id;

          if (estruturaId) {
            await tx.metodologiaEstrutura.update({
              where: { id: estruturaId },
              data: {
                titulo: String(estrutura?.titulo ?? "").trim(),
                descricao: asNullableString(estrutura?.descricao),
                objetivo: asNullableString(estrutura?.objetivo),
                tipo: estruturaTipo ?? current.estruturaTipo,
                ordem: Number(estrutura?.ordem ?? i + 1),
                duracaoSemanas: asNullableNumber(estrutura?.duracaoSemanas),
                treinosPorSemana: asNullableNumber(estrutura?.treinosPorSemana),
                quantidadeMinConclusao: asNullableNumber(estrutura?.quantidadeMinConclusao),
                modoExecucao: estrutura?.modoExecucao ?? null,
                pontosPorItem: (estruturaTipo ?? current.estruturaTipo) === "TRILHA" ? 5 : null,
                bonusConsistencia: (estruturaTipo ?? current.estruturaTipo) === "TRILHA" ? 10 : null,
                bonusFinal: (estruturaTipo ?? current.estruturaTipo) === "TRILHA" ? 15 : null,
                prazoInicio: estrutura?.prazoInicio ? new Date(estrutura.prazoInicio) : null,
                prazoFinal: estrutura?.prazoFinal ? new Date(estrutura.prazoFinal) : null,
                percentualPerdaAtraso: asNullableNumber(estrutura?.percentualPerdaAtraso),
                permiteAtraso: asBool(estrutura?.permiteAtraso, true),
                ativo: asBool(estrutura?.ativo, true),
              },
            });
          } else {
            const novaEstrutura = await tx.metodologiaEstrutura.create({
              data: {
                metodologiaId: id,
                titulo: String(estrutura?.titulo ?? "").trim(),
                descricao: asNullableString(estrutura?.descricao),
                objetivo: asNullableString(estrutura?.objetivo),
                tipo: estruturaTipo ?? current.estruturaTipo,
                ordem: Number(estrutura?.ordem ?? i + 1),
                duracaoSemanas: asNullableNumber(estrutura?.duracaoSemanas),
                treinosPorSemana: asNullableNumber(estrutura?.treinosPorSemana),
                quantidadeMinConclusao: asNullableNumber(estrutura?.quantidadeMinConclusao),
                modoExecucao: estrutura?.modoExecucao ?? null,
                pontosPorItem: (estruturaTipo ?? current.estruturaTipo) === "TRILHA" ? 5 : null,
                bonusConsistencia: (estruturaTipo ?? current.estruturaTipo) === "TRILHA" ? 10 : null,
                bonusFinal: (estruturaTipo ?? current.estruturaTipo) === "TRILHA" ? 15 : null,
                prazoInicio: estrutura?.prazoInicio ? new Date(estrutura.prazoInicio) : null,
                prazoFinal: estrutura?.prazoFinal ? new Date(estrutura.prazoFinal) : null,
                percentualPerdaAtraso: asNullableNumber(estrutura?.percentualPerdaAtraso),
                permiteAtraso: asBool(estrutura?.permiteAtraso, true),
                ativo: asBool(estrutura?.ativo, true),
              },
            });

            estruturaId = novaEstrutura.id;
          }

          const itensExistentes = await tx.metodologiaEstruturaItem.findMany({
            where: { estruturaId },
            select: { id: true },
          });

          const idsItensExistentes = itensExistentes.map((it) => it.id);
          const itensPayload = Array.isArray(estrutura?.itens) ? estrutura.itens : [];
          const idsItensPayload = itensPayload.map((it: any) => it.id).filter(Boolean);

          const itensRemover = idsItensExistentes.filter(
            (oldId) => !idsItensPayload.includes(oldId)
          );

          if (itensRemover.length) {
            await tx.metodologiaEstruturaItem.deleteMany({
              where: {
                id: { in: itensRemover },
                estruturaId,
              },
            });
          }

          for (let j = 0; j < itensPayload.length; j++) {
            const item = itensPayload[j];
            const tipoItem = item?.tipo as MetodologiaItemTipo;
            const treinoProgramadoId = asNullableString(item?.treinoProgramadoId);

            let treinoPontuacao: number | null = null;

            if (treinoProgramadoId) {
              const treino = await tx.treinoProgramado.findUnique({
                where: { id: treinoProgramadoId },
                select: { id: true, pontuacao: true },
              });

              if (!treino) {
                throw new Error(`Treino não encontrado para o item "${item?.titulo ?? ""}".`);
              }

              treinoPontuacao = treino.pontuacao ?? 0;
            }

            const duracaoMinFinal =
              tipoItem === MetodologiaItemTipo.VIDEO ||
              tipoItem === MetodologiaItemTipo.AULA ||
              tipoItem === MetodologiaItemTipo.AULA_AO_VIVO
                ? asNullableNumber(item?.duracaoMin)
                : null;

            const pontosFinais = calcularPontuacaoItemBackend({
              tipo: tipoItem,
              duracaoMin: duracaoMinFinal,
              treinoPontuacao,
            });

            let itemSalvo: any;

            if (item?.id) {
              itemSalvo = await tx.metodologiaEstruturaItem.update({
                where: { id: item.id },
                data: {
                  tipo: tipoItem,
                  titulo: String(item?.titulo ?? "").trim(),
                  descricao: asNullableString(item?.descricao),
                  ordem: Number(item?.ordem ?? j + 1),
                  videoUrl:
                    tipoItem === MetodologiaItemTipo.AULA_AO_VIVO
                      ? null
                      : asNullableString(item?.videoUrl),
                  thumbUrl: asNullableString(item?.thumbUrl),
                  arquivoUrl: asNullableString(item?.arquivoUrl),
                  materialUrl: asNullableString(item?.materialUrl),
                  treinoProgramadoId,
                  pontos: pontosFinais,
                  duracaoMin: duracaoMinFinal,
                  obrigatorio: asBool(item?.obrigatorio, true),
                  publicado: asBool(item?.publicado, true),
                },
              });
            } else {
              itemSalvo = await tx.metodologiaEstruturaItem.create({
                data: {
                  estruturaId,
                  tipo: tipoItem,
                  titulo: String(item?.titulo ?? "").trim(),
                  descricao: asNullableString(item?.descricao),
                  ordem: Number(item?.ordem ?? j + 1),
                  videoUrl:
                    tipoItem === MetodologiaItemTipo.AULA_AO_VIVO
                      ? null
                      : asNullableString(item?.videoUrl),
                  thumbUrl: asNullableString(item?.thumbUrl),
                  arquivoUrl: asNullableString(item?.arquivoUrl),
                  materialUrl: asNullableString(item?.materialUrl),
                  treinoProgramadoId,
                  pontos: pontosFinais,
                  duracaoMin: duracaoMinFinal,
                  obrigatorio: asBool(item?.obrigatorio, true),
                  publicado: asBool(item?.publicado, true),
                },
              });
            }

            if (tipoItem === MetodologiaItemTipo.AULA_AO_VIVO) {
              await upsertAulaAoVivoParaItem({
                tx,
                userId,
                itemPayload: item,
                itemCriadoId: itemSalvo.id,
                tituloItem: String(item?.titulo ?? "").trim(),
                descricaoItem: asNullableString(item?.descricao),
                duracaoMin: duracaoMinFinal,
                thumbUrl: asNullableString(item?.thumbUrl),
                metodologiaId: id,
                estruturaId,
              });
            }
          }
        }
      }

      return tx.metodologia.findUnique({
        where: { id },
        include: {
          _count: { select: { assinantes: true, estruturas: true } },
          estruturas: {
            orderBy: { ordem: "asc" },
            include: {
              itens: {
                orderBy: { ordem: "asc" },
                include: {
                  aulaAoVivo: true,
                },
              },
            },
          },
        },
      });
    });

    if (!updated) {
      return res.status(404).json({
        message: "Metodologia não encontrada após atualização.",
      });
    }

    try {
      await ensureConquistaTemplateMetodologia(updated.id);
      await syncTemplatesMetodologiasProfissionais();
    } catch (e) {
      console.error("Falha ao sync template de conquista da metodologia:", e);
    }

    return res.json({ item: updated });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao editar metodologia.", detail: e?.message });
  }
}

/** =========================
 * DELETE /api/metodologias/:id
 * Exclui (somente criador)
 * ========================= */
export const deleteMetodologia = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = getUserId(req);

  try {
    // 1. Busca a metodologia incluindo os itens de vídeo
    const metodologia = await prisma.metodologia.findUnique({
      where: { id },
      select: { 
        capaUrl: true, 
        criadorUsuarioId: true,
        estruturas: {
          select: {
            itens: {
              select: { videoUrl: true },
            },
          },
        },
      }
    });

    if (!metodologia) {
      return res.status(404).json({ error: "Metodologia não encontrada." });
    }

    // Segurança extra
    if (metodologia.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Sem permissão para deletar." });
    }

    // 2. Deleta do Banco de Dados (Os itens são deletados por CASCADE no Prisma)
    await prisma.metodologia.delete({
      where: { id },
    });

    // 3. Limpeza do S3
    // 3.1 Apaga a capa
    if (metodologia.capaUrl && metodologia.capaUrl.includes("amazonaws.com")) {
      await deleteFromS3(metodologia.capaUrl);
    }

    if (metodologia) {
      for (const estrutura of metodologia.estruturas) {
        for (const item of estrutura.itens) {
          if (item.videoUrl && item.videoUrl.includes("amazonaws.com")) {
            await deleteFromS3(item.videoUrl);
          }
        }
      }
    }

    return res.json({ ok: true, message: "Metodologia e mídia removidas com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar metodologia:", error);
    return res.status(500).json({ error: "Erro interno ao deletar." });
  }
};

export async function listMinhasMetodologiasAssinadas(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const assinaturasPrincipais = await (prisma as any).assinatura.findMany({
      where: { usuarioId: userId },
      orderBy: { startsAt: "desc" },
    });

    const assinaturaPrincipal = pickPrincipalAssinatura(assinaturasPrincipais as any[]);
    const limite = metodologiaLimitFromPlano(assinaturaPrincipal?.plano);

    const inicioMes = startOfMonth(new Date());

    const usadasNoMes =
      limite > 0
        ? await prisma.metodologiaAssinante.count({
            where: {
              usuarioId: userId,
              status: MetodologiaAssinaturaStatus.ATIVA,
              origem: MetodologiaAssinaturaOrigem.LEARNING,
              iniciouEm: { gte: inicioMes },
            },
          })
        : 0;

    const rows = await prisma.metodologiaAssinante.findMany({
      where: {
        usuarioId: userId,
        status: {
          in: [
            MetodologiaAssinaturaStatus.ATIVA,
            MetodologiaAssinaturaStatus.CONCLUIDA,
          ],
        },
      },
      orderBy: { iniciouEm: "desc" },
      include: {
        metodologia: {
          include: {
            criadorUsuario: {
              select: { id: true, nome: true, foto: true, parceiro: true },
            },
            _count: { select: { assinantes: true, estruturas: true } },
          },
        },
        metodologiaAvulsa: {
          include: {
            criadorUsuario: {
              select: { id: true, nome: true, foto: true, parceiro: true },
            },
            estruturas: {
              include: {
                itens: true,
              },
            },
          },
        },
      },
    });

    const metodologiasLearning = rows
      .map((r) => r.metodologia)
      .filter(Boolean) as any[];

    const learningIds = metodologiasLearning.map((m) => m.id);
    const countsById = await anexarCountsEstruturaPorMetodologia(learningIds);

    const items = rows
      .map((r) => {
        if (r.metodologiaAvulsaId && r.metodologiaAvulsa) {
          const m = r.metodologiaAvulsa;
          const itens = (m.estruturas || []).flatMap((e: any) => e.itens || []);

          return {
            id: m.id,
            titulo: m.titulo,
            descricao: m.descricao,
            capaUrl: m.capaUrl ?? null,
            logoUrl: m.capaUrl ?? null,
            publicoAlvo: m.publicoAlvo,
            tipo: m.tipo,
            estruturaTipo: m.estruturaTipo,
            area: m.area ?? null,
            ativo: m.ativo,
            geraCertificado: !!m.geraCertificado,
            geraBadge: !!m.geraBadge,
            precoAssinaturaMensal: m.precoAssinaturaMensal ?? null,
            criadorUsuario: m.criadorUsuario,
            criadorNome: m.criadorUsuario?.nome ?? null,
            origemRegistro: "AVULSA" as const,
            assinada: true,
            iniciouEm: r.iniciouEm,
            status: r.status,
            concluiuEm: r.concluiuEm,
            mediaAvaliacao: Number(m.mediaAvaliacao ?? 0),
            totalReviews: Number(m.totalReviews ?? 0),
            videoCount: itens.filter((it: any) => it.tipo === "VIDEO").length,
            aulaCount: itens.filter((it: any) => it.tipo === "AULA").length,
            treinoCount: itens.filter((it: any) => it.tipo === "TREINO").length,
            materialCount: itens.filter((it: any) => it.tipo === "MATERIAL").length,
            desafioCount: itens.filter((it: any) => it.tipo === "DESAFIO").length,
            estruturaCount: m.estruturas.length,
            _count: {
              assinantes: 0,
              estruturas: m.estruturas.length,
            },
          };
        }

        if (r.metodologia) {
          const m = r.metodologia;

          return {
            id: m.id,
            titulo: m.titulo,
            descricao: m.descricao,
            capaUrl: m.capaUrl ?? null,
            logoUrl: m.capaUrl ?? null,
            categorias: m.categorias ?? [],
            publicoAlvo: m.publicoAlvo,
            tipo: m.tipo,
            estruturaTipo: m.estruturaTipo,
            area: m.area ?? null,
            ativo: m.ativo,
            geraCertificado: !!m.geraCertificado,
            geraBadge: !!m.geraBadge,
            criadorUsuario: m.criadorUsuario,
            criadorNome: m.criadorUsuario?.nome ?? null,
            _count: m._count,
            origemRegistro: "LEARNING" as const,
            mediaAvaliacao: Number(m.mediaAvaliacao ?? 0),
            totalReviews: Number(m.totalReviews ?? 0),
            videoCount: countsById[m.id]?.videoCount ?? 0,
            aulaCount: countsById[m.id]?.aulaCount ?? 0,
            treinoCount: countsById[m.id]?.treinoCount ?? 0,
            materialCount: countsById[m.id]?.materialCount ?? 0,
            desafioCount: countsById[m.id]?.desafioCount ?? 0,
            estruturaCount: countsById[m.id]?.estruturaCount ?? 0,
            assinada: true,
            iniciouEm: r.iniciouEm,
            status: r.status,
            concluiuEm: r.concluiuEm,
          };
        }

        return null;
      })
      .filter(Boolean);

    return res.json({
      items,
      quota: {
        limite,
        usadasNoMes,
        restantes: Math.max(0, limite - usadasNoMes),
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao listar assinadas.",
      detail: e?.message,
    });
  }
}

export async function listMinhasMetodologiasCriadas(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const permissaoCriacao = await getPermissaoCriacaoMetodologia(userId);

    const [learningItems, avulsasItems] = await Promise.all([
      prisma.metodologia.findMany({
        where: { criadorUsuarioId: userId },
        orderBy: { criadoEm: "desc" },
        include: {
          criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
          _count: { select: { assinantes: true, estruturas: true } },
        },
      }),

      prisma.metodologiaAvulsa.findMany({
        where: { criadorUsuarioId: userId },
        orderBy: { criadoEm: "desc" },
        include: {
          criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
          estruturas: {
            include: { itens: true },
          },
        },
      }),
    ]);

    const learningIds = learningItems.map((m) => m.id);
    const learningCountsById = await anexarCountsEstruturaPorMetodologia(learningIds);

    const avulsasMapeadas = avulsasItems.map((m) => {
      const itens = m.estruturas.flatMap((e) => e.itens || []);
      return {
        ...m,
        logoUrl: m.capaUrl ?? null,
        criadorNome: m.criadorUsuario?.nome ?? null,
        origemRegistro: "AVULSA" as const,
        videoCount: itens.filter((it) => it.tipo === "VIDEO").length,
        aulaCount: itens.filter((it) => it.tipo === "AULA").length,
        treinoCount: itens.filter((it) => it.tipo === "TREINO").length,
        materialCount: itens.filter((it) => it.tipo === "MATERIAL").length,
        desafioCount: itens.filter((it) => it.tipo === "DESAFIO").length,
        estruturaCount: m.estruturas.length,
        _count: {
          assinantes: 0,
          estruturas: m.estruturas.length,
        },
      };
    });

    const learningMapeadas = learningItems.map((m) => ({
      ...m,
      logoUrl: m.capaUrl ?? null,
      criadorNome: m.criadorUsuario?.nome ?? null,
      origemRegistro: "LEARNING" as const,
      videoCount: learningCountsById[m.id]?.videoCount ?? 0,
      treinoCount: learningCountsById[m.id]?.treinoCount ?? 0,
      aulaCount: learningCountsById[m.id]?.aulaCount ?? 0,
      materialCount: learningCountsById[m.id]?.materialCount ?? 0,
      desafioCount: learningCountsById[m.id]?.desafioCount ?? 0,
      estruturaCount: learningCountsById[m.id]?.estruturaCount ?? 0,
    }));

    const items = [...learningMapeadas, ...avulsasMapeadas].sort(
      (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    );

    return res.json({
      items,
      permissaoCriacao,
    });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao listar minhas metodologias.",
      detail: e?.message,
    });
  }
}

export async function listMetodologiasVisiveis(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const publicoPermitido: MetodologiaPublicoAlvo[] = [
      MetodologiaPublicoAlvo.ATLETAS,
      MetodologiaPublicoAlvo.PROFISSIONAIS,
      MetodologiaPublicoAlvo.AMBOS,
    ];

    const [learningItems, avulsasItems] = await Promise.all([
      prisma.metodologia.findMany({
        where: {
          ativo: true,
          publicoAlvo: { in: publicoPermitido },
        },
        orderBy: { criadoEm: "desc" },
        include: {
          criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
          _count: { select: { assinantes: true, estruturas: true } },
        },
      }),

      prisma.metodologiaAvulsa.findMany({
        where: {
          ativo: true,
          publicoAlvo: { in: publicoPermitido },
        },
        orderBy: { criadoEm: "desc" },
        include: {
          criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
          estruturas: {
            include: { itens: true },
          },
        },
      }),
    ]);

    const learningIds = learningItems.map((m) => m.id);
    const learningCountsById = await anexarCountsEstruturaPorMetodologia(learningIds);

    const learningOut = learningItems.map((m) => ({
      ...m,
      logoUrl: m.capaUrl ?? null,
      origemRegistro: "LEARNING" as const,
      videoCount: learningCountsById[m.id]?.videoCount ?? 0,
      treinoCount: learningCountsById[m.id]?.treinoCount ?? 0,
      aulaCount: learningCountsById[m.id]?.aulaCount ?? 0,
      materialCount: learningCountsById[m.id]?.materialCount ?? 0,
      desafioCount: learningCountsById[m.id]?.desafioCount ?? 0,
      estruturaCount: learningCountsById[m.id]?.estruturaCount ?? 0,
    }));

    const avulsasOut = avulsasItems.map((m) => {
      const itens = m.estruturas.flatMap((e) => e.itens || []);
      return {
        ...m,
        logoUrl: m.capaUrl ?? null,
        origemRegistro: "AVULSA" as const,
        videoCount: itens.filter((it) => it.tipo === "VIDEO").length,
        aulaCount: itens.filter((it) => it.tipo === "AULA").length,
        treinoCount: itens.filter((it) => it.tipo === "TREINO").length,
        materialCount: itens.filter((it) => it.tipo === "MATERIAL").length,
        desafioCount: itens.filter((it) => it.tipo === "DESAFIO").length,
        estruturaCount: m.estruturas.length,
        _count: {
          assinantes: 0,
          estruturas: m.estruturas.length,
        },
      };
    });

    const items = [...learningOut, ...avulsasOut].sort(
      (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    );

    return res.json({ items });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao listar visíveis.",
      detail: e?.message,
    });
  }
}

export async function listEventosAoVivoVisiveis(req: Request, res: Response) {
  try {
    const aulas = await prisma.aulaAoVivo.findMany({
      where: {
        status: {
          not: "CANCELADA",
        },
        OR: [
          // Evento avulso criado direto em /creator/eventos/novo
          {
            metodologiaId: null,
            metodologiaAvulsaId: null,
          },

          // Aula dentro de metodologia Learning publicada
          {
            metodologia: {
              ativo: true,
            },
          },

          // Aula dentro de metodologia avulsa publicada
          {
            metodologiaAvulsa: {
              ativo: true,
            },
          },
        ],
      },
      orderBy: {
        dataInicio: "asc",
      },
      include: {
        criadorUsuario: {
          select: {
            id: true,
            nome: true,
            foto: true,
            tipo: true,
            nomeDeUsuario: true,
          },
        },
        metodologia: {
          select: {
            id: true,
            titulo: true,
            descricao: true,
            capaUrl: true,
            publicoAlvo: true,
            ativo: true,
            criadorUsuario: {
              select: {
                id: true,
                nome: true,
                foto: true,
              },
            },
          },
        },
        metodologiaAvulsa: {
          select: {
            id: true,
            titulo: true,
            descricao: true,
            capaUrl: true,
            publicoAlvo: true,
            ativo: true,
            precoAssinaturaMensal: true,
            criadorUsuario: {
              select: {
                id: true,
                nome: true,
                foto: true,
              },
            },
          },
        },
        convidados: {
          orderBy: {
            ordem: "asc",
          },
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                foto: true,
                tipo: true,
                nomeDeUsuario: true,
              },
            },
          },
        },
      },
    });

    const items = aulas.map((aula: any) => {
      const isAvulsa = !!aula.metodologiaAvulsaId;
      const isLearning = !!aula.metodologiaId;
      const isEventoAvulso = !isAvulsa && !isLearning;

      const origemTipo = isAvulsa
        ? "AVULSA"
        : isLearning
          ? "LEARNING"
          : "EVENTO_AVULSO";

      const metodologiaTitulo =
        aula.metodologiaAvulsa?.titulo ||
        aula.metodologia?.titulo ||
        null;

      const metodologiaId =
        aula.metodologiaAvulsa?.id ||
        aula.metodologia?.id ||
        null;

      const capaUrl =
        aula.thumbUrl ||
        aula.metodologiaAvulsa?.capaUrl ||
        aula.metodologia?.capaUrl ||
        null;

      const criadorNome =
        aula.criadorUsuario?.nome ||
        aula.metodologiaAvulsa?.criadorUsuario?.nome ||
        aula.metodologia?.criadorUsuario?.nome ||
        "Creator FootEra";

      const precoNumero =
        origemTipo === "EVENTO_AVULSO"
          ? Number(aula.precoAcesso ?? 0)
          : origemTipo === "AVULSA"
            ? Number(aula.metodologiaAvulsa?.precoAssinaturaMensal ?? 0)
            : 0;

      const preco =
        origemTipo === "LEARNING"
          ? null
          : Number.isFinite(precoNumero)
            ? precoNumero
            : 0;

      const precoFormatado = `R$ ${precoNumero.toFixed(2).replace(".", ",")}`;

      const precoLabel =
        origemTipo === "EVENTO_AVULSO"
          ? precoNumero > 0
            ? `Acesso único: ${precoFormatado}`
            : "Evento gratuito"
          : origemTipo === "AVULSA"
            ? precoNumero > 0
              ? `Metodologia avulsa: ${precoFormatado}/mês`
              : "Metodologia avulsa"
            : "Disponível via plano Learning";

      const origemLabel =
        origemTipo === "EVENTO_AVULSO"
          ? "Evento avulso"
          : origemTipo === "AVULSA"
            ? "Premium / Avulsa"
            : "Metodologia Learning";

      return {
        id: aula.id,
        titulo: aula.titulo,
        descricao: aula.descricao,
        status: aula.status,
        dataInicio: aula.dataInicio,
        dataFim: aula.dataFim,
        inscricaoInicio: aula.inscricaoInicio,
        inscricaoFim: aula.inscricaoFim,
        thumbUrl: capaUrl,
        chatAtivo: aula.chatAtivo,
        gravacaoAtiva: aula.gravacaoAtiva,
        replayDisponivel: aula.replayDisponivel,

        origemTipo,
        origemLabel,
        preco,
        precoLabel,

        criadorUsuario: aula.criadorUsuario,
        criadorNome,

        metodologiaId,
        metodologiaTitulo,
        metodologia:
          aula.metodologiaId && aula.metodologia
            ? {
                id: aula.metodologia.id,
                titulo: aula.metodologia.titulo,
                capaUrl: aula.metodologia.capaUrl,
                publicoAlvo: aula.metodologia.publicoAlvo,
              }
            : null,
        metodologiaAvulsa:
          aula.metodologiaAvulsaId && aula.metodologiaAvulsa
            ? {
                id: aula.metodologiaAvulsa.id,
                titulo: aula.metodologiaAvulsa.titulo,
                capaUrl: aula.metodologiaAvulsa.capaUrl,
                publicoAlvo: aula.metodologiaAvulsa.publicoAlvo,
                precoAssinaturaMensal: aula.metodologiaAvulsa.precoAssinaturaMensal,
              }
            : null,

        convidados: aula.convidados || [],
        totalParticipantes: 0,
      };
    });

    return res.json({ items });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao listar eventos ao vivo visíveis.",
      detail: e?.message,
    });
  }
}

type MetodologiaItemPreparado = {
  metodologiaId: string;
  semana: number;
  ordem: number | null;
  tipo: MetodologiaConteudoTipo;
  titulo: string;
  descricao: string | null;
  videoUrl: string | null;
  thumbUrl: string | null;
  treinoProgramadoId: string | null;
  pontos: number | null;
  duracaoMin: number | null;
};

export async function createMetodologiaItens(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { metodologiaId } = req.params;

    // 1) Confere se metodologia existe e se o user é o criador
    const metodologia = await prisma.metodologia.findUnique({
      where: { id: metodologiaId },
      select: { id: true, criadorUsuarioId: true },
    });

    if (!metodologia) {
      return res.status(404).json({ message: "Metodologia não encontrada." });
    }

    if (metodologia.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Você não tem permissão para alterar esta metodologia." });
    }

    // 2) Normaliza payload (aceita {itens:[...]} ou item direto)
    const body = req.body || {};
    const itensEntrada = Array.isArray(body.itens) ? body.itens : [body];

    if (!itensEntrada.length) {
      return res.status(400).json({ message: "Envie pelo menos 1 item." });
    }

    // 3) Valida e prepara itens
    const itensPreparados: MetodologiaItemPreparado[] = [];

    for (let i = 0; i < itensEntrada.length; i++) {
      const raw = itensEntrada[i] || {};

      const semana = Number(raw.semana);
      if (!Number.isFinite(semana) || semana < 1) {
        return res.status(400).json({ message: `Item #${i + 1}: 'semana' inválida.` });
      }

      const tipoStr = String(raw.tipo || "").toUpperCase().trim();

      const tiposPermitidos = ["VIDEO", "TREINO"] as const;

      if (!tiposPermitidos.includes(tipoStr as any)) {
        return res.status(400).json({
          message: `Item #${i + 1}: 'tipo' inválido.`,
          recebido: raw.tipo,
          esperado: tiposPermitidos,
        });
      }

      const tipo = tipoStr as MetodologiaConteudoTipo;

      const ordem =
        raw.ordem === undefined || raw.ordem === null || raw.ordem === ""
          ? null
          : Number(raw.ordem);

      if (ordem !== null && (!Number.isFinite(ordem) || ordem < 1)) {
        return res.status(400).json({ message: `Item #${i + 1}: 'ordem' inválida.` });
      }

      const pontos =
        raw.pontos === undefined || raw.pontos === null || raw.pontos === ""
          ? null
          : Number(raw.pontos);

      if (pontos !== null && (!Number.isFinite(pontos) || pontos < 0)) {
        return res.status(400).json({ message: `Item #${i + 1}: 'pontos' inválido.` });
      }

      const treinoProgramadoId =
        typeof raw.treinoProgramadoId === "string" && raw.treinoProgramadoId.trim()
          ? raw.treinoProgramadoId.trim()
          : null;

      const videoUrl =
        typeof raw.videoUrl === "string" && raw.videoUrl.trim()
          ? raw.videoUrl.trim()
          : null;

      const thumbUrl =
        typeof raw.thumbUrl === "string" && raw.thumbUrl.trim()
          ? raw.thumbUrl.trim()
          : null;

      // Regras básicas por tipo (pode relaxar se quiser)
      if (tipo === "VIDEO" && !videoUrl) {
        return res.status(400).json({ message: `Item #${i + 1}: tipo VIDEO exige 'videoUrl'.` });
      }
      if (tipo === "TREINO" && !treinoProgramadoId) {
        return res.status(400).json({ message: `Item #${i + 1}: tipo TREINO exige 'treinoProgramadoId'.` });
      }

      itensPreparados.push({
        metodologiaId,
        semana,
        ordem, // pode ser null (vamos auto setar)
        tipo: tipo as MetodologiaConteudoTipo, // string (Prisma enum também aceita string igual ao valor)
        titulo:
          typeof raw.titulo === "string" && raw.titulo.trim()
            ? raw.titulo.trim()
            : tipo === "VIDEO"
              ? "Vídeo da metodologia"
              : "Treino da metodologia",

        descricao: typeof raw.descricao === "string" ? raw.descricao.trim() : null,
        videoUrl,
        thumbUrl,
        treinoProgramadoId,
        pontos,
        duracaoMin:
          raw.duracaoMin === undefined || raw.duracaoMin === null || raw.duracaoMin === ""
            ? null
            : Number(raw.duracaoMin),
      });
    }

    // 4) Se ordem vier null, auto calcula (por semana)
    //    Fazemos isso num transaction para garantir consistência.
    const created = await prisma.$transaction(async (tx) => {
      const result = [];

      for (const item of itensPreparados) {
        let ordemFinal = item.ordem;

        if (!ordemFinal) {
          const last = await tx.metodologiaItem.findFirst({
            where: { metodologiaId, semana: item.semana },
            orderBy: { ordem: "desc" },
            select: { ordem: true },
          });
          ordemFinal = (last?.ordem ?? 0) + 1;
        }

        const novo = await tx.metodologiaItem.create({
          data: {
            metodologiaId: item.metodologiaId,
            semana: item.semana,
            ordem: ordemFinal,
            tipo: item.tipo,
            titulo: item.titulo,
            descricao: item.descricao,
            videoUrl: item.videoUrl,
            thumbUrl: item.thumbUrl,
            treinoProgramadoId: item.treinoProgramadoId,
            pontos: item.pontos,
            duracaoMin:
              item.duracaoMin !== null && Number.isFinite(item.duracaoMin)
                ? item.duracaoMin
                : null,
          },
        });

        // ✅ PASSO 2: se for TREINO, garante vínculo na MetodologiaTreino
        if (item.tipo === MetodologiaConteudoTipo.TREINO && item.treinoProgramadoId) {
          await tx.metodologiaTreino.upsert({
            where: {
              metodologiaId_treinoProgramadoId: {
                metodologiaId,
                treinoProgramadoId: item.treinoProgramadoId,
              },
            },
            update: {},
            create: {
              metodologiaId,
              treinoProgramadoId: item.treinoProgramadoId,
            },
          });
        }

        result.push(novo);
      }

      return result;
    });

    return res.status(201).json({ itens: created });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao adicionar itens.", detail: e?.message });
  }
}

function aplicarPenalidadeAtraso(
  pontosBase: number,
  estrutura: {
    modoExecucao?: string | null;
    prazoFinal?: Date | null;
    percentualPerdaAtraso?: number | null;
  }
) {
  if (!estrutura?.modoExecucao) return pontosBase;
  if (estrutura.modoExecucao === "LIVRE") return pontosBase;
  if (!estrutura.prazoFinal) return pontosBase;

  const agora = new Date();
  if (agora <= new Date(estrutura.prazoFinal)) return pontosBase;

  const percentual = Number(estrutura.percentualPerdaAtraso ?? 20);
  const pontosComDesconto = Math.round(pontosBase * (1 - percentual / 100));

  return Math.max(0, pontosComDesconto);
}

export async function getMetodologiaDetalhe(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!id) {
      return res.status(400).json({ message: "ID da metodologia é obrigatório." });
    }

    const isAdmin = await isAdminUser(userId);

    const metodologia = await prisma.metodologia.findUnique({
      where: { id },
      include: {
        criadorUsuario: {
          select: { id: true, nome: true, foto: true, parceiro: true },
        },
        estruturas: {
          where: { ativo: true },
          orderBy: { ordem: "asc" },
          include: {
            itens: {
              where: { publicado: true },
              orderBy: { ordem: "asc" },
              include: {
                treinoProgramado: {
                  select: {
                    id: true,
                    nome: true,
                    codigo: true,
                    imagemUrl: true,
                    nivel: true,
                    categoria: true,
                    pontuacao: true,
                    duracao: true,
                    objetivo: true,
                    tipoTreino: true,
                  },
                },
                aulaAoVivo: {
                  select: {
                    id: true,
                    titulo: true,
                    descricao: true,
                    status: true,
                    dataInicio: true,
                    dataFim: true,
                    inscricaoInicio: true,
                    inscricaoFim: true,
                    thumbUrl: true,
                    replayDisponivel: true,
                    metodologiaId: true,
                    metodologiaAvulsaId: true,
                    itemId: true,
                    itemAvulsaId: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            assinantes: true,
            estruturas: true,
          },
        },
      },
    });

    if (!metodologia) {
      return res.status(404).json({ message: "Metodologia não encontrada." });
    }

    const assinatura = userId
      ? await prisma.metodologiaAssinante.findUnique({
          where: {
            metodologiaId_usuarioId: {
              metodologiaId: id,
              usuarioId: userId,
            },
          },
          select: {
            id: true,
            status: true,
            expiraEm: true,
            progresso: true,
            iniciouEm: true,
            concluiuEm: true,
            origem: true,
          },
        })
      : null;

    const progressoEstruturas = assinatura?.id
      ? await prisma.metodologiaProgressoEstrutura.findMany({
          where: {
            metodologiaAssinanteId: assinatura.id,
          },
          select: {
            progresso: true,
          },
        })
      : [];

    const concluidosAssinatura = Array.isArray((assinatura as any)?.progresso?.concluidos)
      ? (assinatura as any).progresso.concluidos.map((v: any) => String(v))
      : [];

    const concluidosEstruturas = progressoEstruturas.flatMap((p: any) =>
      Array.isArray(p?.progresso?.concluidos)
        ? p.progresso.concluidos.map((v: any) => String(v))
        : []
    );

    const concluidosSubmissoes = userId
      ? await (prisma as any).metodologiaItemSubmissao.findMany({
          where: {
            metodologiaId: id,
            usuarioId: userId,
          },
          select: { itemId: true },
        })
      : [];

    const concluidosIds = Array.from(
      new Set<string>([
        ...concluidosAssinatura,
        ...concluidosEstruturas,
        ...concluidosSubmissoes.map((c: any) => String(c.itemId)),
      ])
    );

    const minhaAvaliacao =
      userId
        ? await prisma.avaliacaoMetodologia.findUnique({
            where: {
              metodologiaId_usuarioId: {
                metodologiaId: id,
                usuarioId: userId,
              },
            },
            select: {
              id: true,
              nota: true,
              comentario: true,
              sentimento: true,
              updatedAt: true,
            },
          })
        : null;

    const hasAccess = assinaturaDaAcesso(assinatura);
    const assinaturaTipo = assinatura
      ? assinatura.origem === MetodologiaAssinaturaOrigem.AVULSA
        ? "AVULSA"
        : "LEARNING"
      : null;

    const assinaturasPrincipais = userId
      ? await (prisma as any).assinatura.findMany({
          where: { usuarioId: userId },
          orderBy: { startsAt: "desc" },
        })
      : [];

    const assinaturaPrincipal = pickPrincipalAssinatura(assinaturasPrincipais as any[]);
    const limite = metodologiaLimitFromPlano(assinaturaPrincipal?.plano);

    const inicioMes = startOfMonth(new Date());

    const usadasNoMes =
      userId && limite > 0
        ? await prisma.metodologiaAssinante.count({
            where: {
              usuarioId: userId,
              status: MetodologiaAssinaturaStatus.ATIVA,
              origem: MetodologiaAssinaturaOrigem.LEARNING,
              iniciouEm: { gte: inicioMes },
            },
          })
        : 0;

    const podeAssinarAgora = !!userId && !hasAccess && limite > 0 && usadasNoMes < limite;

    let motivoBloqueio: string | null = null;

    if (hasAccess) {
      motivoBloqueio = "JA_ASSINADA";
    } else if (podeAssinarAgora) {
      motivoBloqueio = null;
    } else if (limite <= 0) {
      motivoBloqueio = "PRECISA_LEARNING";
    } else {
      motivoBloqueio = "LIMITE_METODOLOGIAS";
    }

    const acessoFinal = hasAccess || isAdmin;
    const podeVerVideo = acessoFinal || metodologia.criadorUsuarioId === userId;

    const estruturas = metodologia.estruturas.map((estrutura) => {
      const { inicio, fim } = calcularDatasExecucao(estrutura, assinatura);

      return {
        id: estrutura.id,
        tipo: estrutura.tipo,
        titulo: estrutura.titulo,
        descricao: estrutura.descricao,
        objetivo: estrutura.objetivo,
        ordem: estrutura.ordem,
        duracaoSemanas: estrutura.duracaoSemanas,
        treinosPorSemana: estrutura.treinosPorSemana,
        quantidadeMinConclusao: estrutura.quantidadeMinConclusao,
        modoExecucao: estrutura.modoExecucao,
        pontosPorItem: estrutura.pontosPorItem,
        bonusConsistencia: estrutura.bonusConsistencia,
        bonusFinal: estrutura.bonusFinal,
        prazoInicio: estrutura.prazoInicio,
        prazoFinal: estrutura.prazoFinal,
        dataInicioCalculada: inicio,
        dataFimCalculada: fim,
        ativo: estrutura.ativo,
        itens: estrutura.itens.map((item) => ({
          id: item.id,
          ordem: item.ordem,
          tipo: item.tipo,
          titulo: item.titulo,
          descricao: item.descricao,
          pontos: item.pontos,
          thumbUrl: item.thumbUrl,
          duracaoMin: item.duracaoMin,
          videoUrl: podeVerVideo ? item.videoUrl : null,
          arquivoUrl: item.arquivoUrl ?? null,
          materialUrl: item.materialUrl ?? null,
          treinoProgramadoId: item.treinoProgramadoId,
          treinoProgramado: item.treinoProgramado
            ? {
                id: item.treinoProgramado.id,
                nome: item.treinoProgramado.nome,
                imagemUrl: item.treinoProgramado.imagemUrl,
                codigo: item.treinoProgramado.codigo,
                nivel: item.treinoProgramado.nivel,
                categoria: item.treinoProgramado.categoria,
                pontuacao: item.treinoProgramado.pontuacao,
                duracao: item.treinoProgramado.duracao,
                objetivo: item.treinoProgramado.objetivo,
                tipoTreino: item.treinoProgramado.tipoTreino,
              }
            : null,
            aulaAoVivo: item.aulaAoVivo
              ? {
                  id: item.aulaAoVivo.id,
                  titulo: item.aulaAoVivo.titulo,
                  descricao: item.aulaAoVivo.descricao,
                  status: item.aulaAoVivo.status,
                  dataInicio: item.aulaAoVivo.dataInicio,
                  dataFim: item.aulaAoVivo.dataFim,
                  inscricaoInicio: item.aulaAoVivo.inscricaoInicio,
                  inscricaoFim: item.aulaAoVivo.inscricaoFim,
                  thumbUrl: item.aulaAoVivo.thumbUrl,
                  replayDisponivel: item.aulaAoVivo.replayDisponivel,
                  metodologiaId: item.aulaAoVivo.metodologiaId,
                  metodologiaAvulsaId: item.aulaAoVivo.metodologiaAvulsaId,
                  itemId: item.aulaAoVivo.itemId,
                  itemAvulsaId: item.aulaAoVivo.itemAvulsaId,
                }
              : null,
          publicado: item.publicado,
          obrigatorio: item.obrigatorio,
        })),
      };
    });

    const pontosTotal = estruturas.reduce((accEstrutura, estrutura) => {
      const somaEstrutura = (estrutura.itens || []).reduce((accItem, item) => {
        const pontosItem =
          item.pontos ??
          (String(item.tipo).toUpperCase() === "TREINO"
            ? Number(item.treinoProgramado?.pontuacao ?? 0)
            : 0);

        return accItem + Number(pontosItem ?? 0);
      }, 0);

      return accEstrutura + somaEstrutura;
    }, 0);

    return res.json({
      id: metodologia.id,
      titulo: metodologia.titulo,
      descricao: metodologia.descricao,
      capaUrl: metodologia.capaUrl ?? null,
      publicoAlvo: metodologia.publicoAlvo,
      nivel: metodologia.nivel ?? "Base",
      totalSemanas: metodologia.totalSemanas ?? null,
      totalAssinantes: metodologia._count?.assinantes ?? 0,
      mediaAvaliacao: (metodologia as any).mediaAvaliacao ?? 0,
      totalReviews: (metodologia as any).totalReviews ?? 0,
      pontosTotal,
      criadorNome: metodologia.criadorUsuario?.nome ?? null,
      tipo: metodologia.tipo,
      estruturaTipo: metodologia.estruturaTipo,
      area: metodologia.area ?? null,
      geraBadge: !!metodologia.geraBadge,
      geraCertificado: !!metodologia.geraCertificado,
      estruturas,
      viewer: {
        isAssinante: acessoFinal,
        temAcesso: acessoFinal,
        assinaturaTipo: hasAccess
          ? assinaturaTipo
          : isAdmin
            ? "LEARNING"
            : assinaturaTipo,
        expiraEm: assinatura?.expiraEm
          ? new Date(assinatura.expiraEm).toISOString()
          : null,
        podeAssinarAgora: isAdmin ? false : podeAssinarAgora,
        motivoBloqueio: isAdmin ? null : motivoBloqueio,
        podeAvaliar: !!userId && acessoFinal && !minhaAvaliacao,
        minhaAvaliacao: minhaAvaliacao
          ? {
              id: minhaAvaliacao.id,
              nota: minhaAvaliacao.nota,
              comentario: minhaAvaliacao.comentario,
              sentimento: minhaAvaliacao.sentimento,
              updatedAt: minhaAvaliacao.updatedAt.toISOString(),
            }
          : null,
        progresso: {
          concluidos: concluidosIds,
        },
        status: assinatura?.status ?? null,
        concluiuEm: assinatura?.concluiuEm
          ? new Date(assinatura.concluiuEm).toISOString()
          : null,
        quota: {
          limite,
          usadasNoMes,
          restantes: Math.max(0, limite - usadasNoMes),
        },
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao buscar detalhe da metodologia.",
      detail: e?.message,
    });
  }
}

export async function assinarMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { id } = req.params;

    const origemRaw = String(
      req.query.origem ?? req.body?.origem ?? MetodologiaAssinaturaOrigem.LEARNING
    )
      .toUpperCase()
      .trim();

    const origem =
      origemRaw === "AVULSA"
        ? MetodologiaAssinaturaOrigem.AVULSA
        : MetodologiaAssinaturaOrigem.LEARNING;

    const alvo =
      origem === MetodologiaAssinaturaOrigem.AVULSA
        ? await prisma.metodologiaAvulsa.findUnique({
            where: { id },
            select: { id: true, ativo: true },
          })
        : await prisma.metodologia.findUnique({
            where: { id },
            select: { id: true, ativo: true },
          });

    if (!alvo || alvo.ativo === false) {
      return res.status(404).json({
        message:
          origem === MetodologiaAssinaturaOrigem.AVULSA
            ? "Metodologia avulsa não encontrada."
            : "Metodologia não encontrada.",
      });
    }

    const existing = await prisma.metodologiaAssinante.findFirst({
      where: {
        usuarioId: userId,
        ...(origem === MetodologiaAssinaturaOrigem.AVULSA
          ? { metodologiaAvulsaId: id }
          : { metodologiaId: id }),
      },
    });

    if (existing && assinaturaDaAcesso(existing)) {
      return res.json({ ok: true, already: true });
    }

    const agora = new Date();
    const expiraEm = addMonths(agora, 1);

    if (origem === MetodologiaAssinaturaOrigem.LEARNING) {
      const assinaturasPrincipais = await (prisma as any).assinatura.findMany({
        where: { usuarioId: userId },
        orderBy: { startsAt: "desc" },
      });

      const assinaturaPrincipal = pickPrincipalAssinatura(assinaturasPrincipais as any[]);
      const limite = metodologiaLimitFromPlano(assinaturaPrincipal?.plano);

      if (limite <= 0) {
        return res.status(403).json({
          code: "PRECISA_LEARNING",
          message: "Você precisa ter Learning ativo para selecionar metodologias.",
        });
      }

      const inicioMes = startOfMonth(new Date());
      const usadasNoMes = await prisma.metodologiaAssinante.count({
        where: {
          usuarioId: userId,
          status: MetodologiaAssinaturaStatus.ATIVA,
          origem: MetodologiaAssinaturaOrigem.LEARNING,
          iniciouEm: { gte: inicioMes },
        },
      });

      if (usadasNoMes >= limite) {
        return res.status(403).json({
          code: "LIMITE_LEARNING_ATINGIDO",
          message: `Seu plano permite ${limite} metodologia(s) Learning por mês.`,
        });
      }
    }

    const assinatura = existing
      ? await prisma.metodologiaAssinante.update({
          where: { id: existing.id },
          data: {
            origem,
            status: MetodologiaAssinaturaStatus.ATIVA,
            iniciouEm: agora,
            expiraEm,
            cancelouEm: null,
            concluiuEm: null,
            ...(origem === MetodologiaAssinaturaOrigem.AVULSA
              ? {
                  metodologiaId: null,
                  metodologiaAvulsaId: id,
                }
              : {
                  metodologiaId: id,
                  metodologiaAvulsaId: null,
                }),
          },
        })
      : await prisma.metodologiaAssinante.create({
          data: {
            usuarioId: userId,
            origem,
            status: MetodologiaAssinaturaStatus.ATIVA,
            iniciouEm: agora,
            expiraEm,
            ...(origem === MetodologiaAssinaturaOrigem.AVULSA
              ? {
                  metodologiaId: null,
                  metodologiaAvulsaId: id,
                }
              : {
                  metodologiaId: id,
                  metodologiaAvulsaId: null,
                }),
          },
        });

    return res.json({ ok: true, assinatura });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao assinar metodologia.",
      detail: e?.message,
    });
  }
}

export async function deleteMetodologiaItens(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { metodologiaId } = req.params;

    const metodologia = await prisma.metodologia.findUnique({
      where: { id: metodologiaId },
      select: { id: true, criadorUsuarioId: true },
    });

    if (!metodologia) {
      return res.status(404).json({ message: "Metodologia não encontrada." });
    }

    if (metodologia.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Você não tem permissão para alterar esta metodologia." });
    }

    const del = await prisma.metodologiaItem.deleteMany({
      where: { metodologiaId },
    });

    return res.json({ ok: true, deleted: del.count });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao limpar itens.", detail: e?.message });
  }
}

export async function criarAvaliacaoMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { metodologiaId, nota, comentario, origem, sentimento } = req.body || {};
    
    const parseSentimento = (valor: any): SentimentoAvaliacao | null => {
      const raw = String(valor || "").trim();

      if (raw === SentimentoAvaliacao.ruim) return SentimentoAvaliacao.ruim;
      if (raw === SentimentoAvaliacao.medio) return SentimentoAvaliacao.medio;
      if (raw === SentimentoAvaliacao.otimo) return SentimentoAvaliacao.otimo;

      return null;
    };

    const sentimentoFinal = parseSentimento(sentimento);
    const origemFinal = String(origem || "LEARNING").toUpperCase().trim();
    const isAvulsa = origemFinal === "AVULSA";
    const isAdmin = await isAdminUser(userId);

    if (!metodologiaId || typeof metodologiaId !== "string") {
      return res.status(400).json({ message: "metodologiaId é obrigatório." });
    }

    const n = Number(nota);
    if (!Number.isFinite(n) || n < 0 || n > 5) {
      return res.status(400).json({ message: "nota inválida (0 a 5)." });
    }

    const existe = isAvulsa
      ? await prisma.metodologiaAvulsa.findUnique({
          where: { id: metodologiaId },
          select: { id: true },
        })
      : await prisma.metodologia.findUnique({
          where: { id: metodologiaId },
          select: { id: true },
        });

    if (!existe) {
      return res.status(404).json({ message: "Metodologia não encontrada." });
    }

    const assinatura = isAvulsa
      ? await prisma.metodologiaAssinante.findFirst({
          where: {
            usuarioId: userId,
            metodologiaAvulsaId: metodologiaId,
          },
          select: {
            id: true,
            status: true,
            expiraEm: true,
            concluiuEm: true,
          },
        })
      : await prisma.metodologiaAssinante.findUnique({
          where: {
            metodologiaId_usuarioId: {
              metodologiaId,
              usuarioId: userId,
            },
          },
          select: {
            id: true,
            status: true,
            expiraEm: true,
            concluiuEm: true,
          },
        });

    const temAcesso = assinaturaDaAcesso(assinatura) || isAdmin;

    if (!temAcesso) {
      return res.status(403).json({
        message: "Você não possui acesso a esta metodologia.",
      });
    }

    if (!isAdmin && !assinatura?.concluiuEm) {
      return res.status(400).json({
        message: "Conclua a metodologia antes de avaliá-la.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      let review: {
        id: string;
        nota: number;
        comentario: string | null;
        updatedAt: Date;
        sentimento: string | null;
      };

      if (isAvulsa) {
        const existente = await tx.avaliacaoMetodologia.findFirst({
          where: {
            usuarioId: userId,
            metodologiaAvulsaId: metodologiaId,
          },
          select: { id: true },
        });

        review = existente
          ? await tx.avaliacaoMetodologia.update({
              where: { id: existente.id },
              data: {
                nota: Math.round(n),
                comentario: asNullableString(comentario),
                sentimento: sentimentoFinal,
              },
              select: {
                id: true,
                nota: true,
                comentario: true,
                updatedAt: true,
                sentimento: true,
              },
            })
          : await tx.avaliacaoMetodologia.create({
              data: {
                usuarioId: userId,
                metodologiaId: null,
                metodologiaAvulsaId: metodologiaId,
                nota: Math.round(n),
                comentario: asNullableString(comentario),
                sentimento: sentimentoFinal,
              },
              select: {
                id: true,
                nota: true,
                comentario: true,
                updatedAt: true,
                sentimento: true,
              },
            });
      } else {
        review = await tx.avaliacaoMetodologia.upsert({
          where: {
            metodologiaId_usuarioId: {
              metodologiaId,
              usuarioId: userId,
            },
          },
          create: {
            metodologiaId,
            metodologiaAvulsaId: null,
            usuarioId: userId,
            nota: Math.round(n),
            comentario: asNullableString(comentario),
            sentimento: sentimentoFinal,
          },
          update: {
            nota: Math.round(n),
            comentario: asNullableString(comentario),
            sentimento: sentimentoFinal,
          },
          select: {
            id: true,
            nota: true,
            comentario: true,
            updatedAt: true,
            sentimento: true,
          },
        });
      }

      const agg = await tx.avaliacaoMetodologia.aggregate({
        where: isAvulsa
          ? { metodologiaAvulsaId: metodologiaId }
          : { metodologiaId },
        _avg: { nota: true },
        _count: { _all: true },
      });

      const media = Number(agg._avg.nota ?? 0);
      const total = Number(agg._count._all ?? 0);

      if (isAvulsa) {
        await tx.metodologiaAvulsa.update({
          where: { id: metodologiaId },
          data: {
            mediaAvaliacao: media,
            totalReviews: total,
          },
        });
      } else {
        await tx.metodologia.update({
          where: { id: metodologiaId },
          data: {
            mediaAvaliacao: media,
            totalReviews: total,
          },
        });
      }

      return { review, media, total };
    });

    return res.status(201).json({
      ok: true,
      avaliacao: {
        id: result.review.id,
        nota: result.review.nota,
        comentario: result.review.comentario,
        updatedAt: result.review.updatedAt,
        sentimento: result.review.sentimento,
      },
      mediaAvaliacao: result.media,
      totalReviews: result.total,
    });
  } catch (e: any) {
    console.error("[criarAvaliacaoMetodologia]", e);
    return res.status(500).json({
      message: "Erro ao salvar avaliação da metodologia.",
      detail: e?.message,
    });
  }
}

export async function concluirItemMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { id } = req.params;
    const { itemId } = req.body || {};

    const isAvulsa =
      req.originalUrl.includes("/metodologias-avulsas/") ||
      String(req.query.origemTipo || "").toUpperCase() === "AVULSA";

    if (!itemId || typeof itemId !== "string") {
      return res.status(400).json({ message: "itemId é obrigatório." });
    }

    const item = isAvulsa
    ? await prisma.metodologiaAvulsaEstruturaItem.findFirst({
        where: {
          id: itemId,
          estrutura: {
            metodologiaAvulsaId: id,
          },
        },
        select: {
          id: true,
          pontos: true,
          treinoProgramado: {
            select: {
              pontuacao: true,
            },
          },
          estrutura: {
            select: {
              id: true,
              pontosPorItem: true,
              modoExecucao: true,
              prazoFinal: true,
              percentualPerdaAtraso: true,
            },
          },
        },
      })
    : await prisma.metodologiaEstruturaItem.findFirst({
        where: {
          id: itemId,
          estrutura: {
            metodologiaId: id,
          },
        },
        select: {
          id: true,
          pontos: true,
          treinoProgramado: {
            select: {
              pontuacao: true,
            },
          },
          estrutura: {
            select: {
              id: true,
              pontosPorItem: true,
              modoExecucao: true,
              prazoFinal: true,
              percentualPerdaAtraso: true,
            },
          },
        },
      });

      if (!item) {
        return res.status(404).json({
          message: isAvulsa
            ? "Item não encontrado nessa metodologia avulsa."
            : "Item não encontrado nessa metodologia.",
        });
      }

    const assinatura = isAvulsa
      ? await prisma.metodologiaAssinante.findFirst({
          where: {
            usuarioId: userId,
            metodologiaAvulsaId: id,
          },
        })
      : await prisma.metodologiaAssinante.findUnique({
          where: {
            metodologiaId_usuarioId: {
              metodologiaId: id,
              usuarioId: userId,
            },
          },
        });

    if (!assinatura || !assinaturaDaAcesso(assinatura)) {
      return res.status(403).json({ message: "Sem acesso à metodologia." });
    }

    const progresso: any = (assinatura as any).progresso || {};
    const concluidos: string[] = Array.isArray(progresso.concluidos) ? progresso.concluidos : [];
    const jaTinha = concluidos.includes(itemId);
    const novoConcluidos = jaTinha ? concluidos : [...concluidos, itemId];
    const pontosTotaisAntes = Number(progresso.pontosGanhos ?? 0);
    const pontosBase = Number(item.pontos ?? item.estrutura?.pontosPorItem ?? 0);
    const pontosGanhosAgora = jaTinha
      ? 0
      : aplicarPenalidadeAtraso(pontosBase, {
          modoExecucao: item.estrutura.modoExecucao ?? null,
          prazoFinal: item.estrutura.prazoFinal ?? null,
          percentualPerdaAtraso: item.estrutura.percentualPerdaAtraso ?? null,
        });

    const progressoNovo = {
      ...progresso,
      concluidos: novoConcluidos,
      pontosGanhos: pontosTotaisAntes + pontosGanhosAgora,
      atualizadoEm: new Date().toISOString(),
    };

    if (isAvulsa) {
      await prisma.metodologiaAssinante.update({
        where: { id: assinatura.id },
        data: { progresso: progressoNovo as any },
      });
    } else {
      await prisma.metodologiaAssinante.update({
        where: {
          metodologiaId_usuarioId: {
            metodologiaId: id,
            usuarioId: userId,
          },
        },
        data: { progresso: progressoNovo as any },
      });
    }

    const totalPublicados = isAvulsa
      ? await prisma.metodologiaAvulsaEstruturaItem.count({
          where: {
            publicado: true,
            estrutura: {
              metodologiaAvulsaId: id,
            },
          },
        })
      : await prisma.metodologiaEstruturaItem.count({
          where: {
            publicado: true,
            estrutura: {
              metodologiaId: id,
            },
          },
        });

    const metodologiaCompleta = totalPublicados > 0 && novoConcluidos.length >= totalPublicados;

    if (metodologiaCompleta) {
      if (isAvulsa) {
        await prisma.metodologiaAssinante.update({
          where: { id: assinatura.id },
          data: {
            status: MetodologiaAssinaturaStatus.CONCLUIDA as any,
            concluiuEm: new Date() as any,
          },
        });
      } else {
        await prisma.metodologiaAssinante.update({
          where: {
            metodologiaId_usuarioId: {
              metodologiaId: id,
              usuarioId: userId,
            },
          },
          data: {
            status: MetodologiaAssinaturaStatus.CONCLUIDA as any,
            concluiuEm: new Date() as any,
          },
        });
      }

      try {
        if (!isAvulsa) {
          await unlockConquistaMetodologia(userId, id);
        }
      } catch (e) {
        console.error("Falha ao desbloquear conquista da metodologia:", e);
      }
    }

    return res.json({
      ok: true,
      jaTinha,
      pontosGanhosAgora,
      metodologiaCompleta,
      progresso: {
        concluidos: novoConcluidos,
        pontosGanhos: progressoNovo.pontosGanhos,
        totalPublicados,
        concluidosCount: novoConcluidos.length,
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao concluir item.",
      detail: e?.message,
    });
  }
}

export async function createMetodologiaEstruturas(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { metodologiaId } = req.params;
    const validacao = await validarMetodologiaDoCriador(metodologiaId, userId);
    if (validacao && "erro" in validacao && validacao.erro) {
      return res.status(validacao.erro.status).json({ message: validacao.erro.message });
    }

    const metodologia = validacao.metodologia;
    const body = req.body || {};
    const entrada = Array.isArray(body.estruturas) ? body.estruturas : [body];

    if (!entrada.length) {
      return res.status(400).json({ message: "Envie ao menos uma estrutura." });
    }

    const criadas = await prisma.$transaction(async (tx) => {
      const out: any[] = [];

      for (const item of entrada) {
        const titulo = String(item?.titulo ?? "").trim();
        const descricao = asNullableString(item?.descricao);
        const objetivo = asNullableString(item?.objetivo);
        const ordemInformada = asNullableNumber(item?.ordem);
        const tipoEstrutura = item?.tipo ?? metodologia.estruturaTipo;
        const duracaoSemanas = asNullableNumber(item?.duracaoSemanas);
        const treinosPorSemana = asNullableNumber(item?.treinosPorSemana);
        const quantidadeMinConclusao = asNullableNumber(item?.quantidadeMinConclusao);
        const pontosPorItem =
          metodologia.estruturaTipo === MetodologiaEstruturaTipo.TRILHA ? 5 : null;
        const bonusConsistencia =
          metodologia.estruturaTipo === MetodologiaEstruturaTipo.TRILHA ? 10 : null;
        const bonusFinal =
          metodologia.estruturaTipo === MetodologiaEstruturaTipo.TRILHA ? 15 : null;
        const prazoInicio = item?.prazoInicio ? new Date(item.prazoInicio) : null;
        const prazoFinal = item?.prazoFinal ? new Date(item.prazoFinal) : null;
        const percentualPerdaAtraso = asNullableNumber(item?.percentualPerdaAtraso);
        const permiteAtraso = asBool(item?.permiteAtraso, true);
        const modoExecucao = item?.modoExecucao ?? null;
        const ativo = asBool(item?.ativo, true);

        if (!titulo) {
          throw new Error("Cada estrutura precisa ter título.");
        }

        if (!isValidEnumValue(MetodologiaEstruturaTipo, tipoEstrutura)) {
          throw new Error(`Tipo de estrutura inválido para "${titulo}".`);
        }

        if (!metodologia.estruturaTipo) {
          throw new Error("A metodologia ainda não tem estruturaTipo definido. Atualize a metodologia antes de criar trilhas ou módulos.");
        }

        if (tipoEstrutura !== metodologia.estruturaTipo) {
          throw new Error(`A metodologia aceita apenas estruturas do tipo ${metodologia.estruturaTipo}.`);
        }

        if (!metodologia.estruturaTipo) {
          return res.status(400).json({
            message: "A metodologia precisa ter estruturaTipo definido antes de editar a estrutura.",
          });
        }

        if (metodologia.estruturaTipo === MetodologiaEstruturaTipo.TRILHA) {
          if (!duracaoSemanas || duracaoSemanas <= 0) {
            throw new Error(`A trilha "${titulo}" exige duracaoSemanas válida.`);
          }

          if (!treinosPorSemana || treinosPorSemana <= 0) {
            throw new Error(`A trilha "${titulo}" exige treinosPorSemana válido.`);
          }

          if (!modoExecucao || !isValidEnumValue(MetodologiaModoExecucao, modoExecucao)) {
            throw new Error(`modoExecucao inválido na trilha "${titulo}".`);
          }

          if (modoExecucao === MetodologiaModoExecucao.LIVRE) {
            // sem prazos
          }

          if (modoExecucao === MetodologiaModoExecucao.PRAZO_SUGERIDO) {
            if (!prazoFinal || Number.isNaN(prazoFinal.getTime())) {
              throw new Error(`A trilha "${titulo}" exige prazoFinal no modo PRAZO_SUGERIDO.`);
            }

            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            const minFinal = new Date(hoje);
            minFinal.setDate(minFinal.getDate() + 14);

            const maxFinal = new Date(hoje);
            maxFinal.setDate(maxFinal.getDate() + 56);

            if (prazoFinal < minFinal) {
              throw new Error(`A trilha "${titulo}" exige prazoFinal de no mínimo 2 semanas a partir de hoje.`);
            }

            if (prazoFinal > maxFinal) {
              throw new Error(`A trilha "${titulo}" exige prazoFinal de no máximo 8 semanas a partir de hoje.`);
            }

            const diffDias = Math.ceil(
              (prazoFinal.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
            );
            const esperadoDias = Number(duracaoSemanas || 0) * 7;

            if (Math.abs(diffDias - esperadoDias) > 7) {
              throw new Error(
                `O prazo final da trilha "${titulo}" deve ficar próximo da duração do ciclo (${duracaoSemanas} semanas).`
              );
            }
          }

          if (modoExecucao === MetodologiaModoExecucao.DESAFIO_FECHADO) {
            if (!prazoInicio || Number.isNaN(prazoInicio.getTime())) {
              throw new Error(`A trilha "${titulo}" exige prazoInicio no modo DESAFIO_FECHADO.`);
            }

            if (!prazoFinal || Number.isNaN(prazoFinal.getTime())) {
              throw new Error(`A trilha "${titulo}" exige prazoFinal no modo DESAFIO_FECHADO.`);
            }

            if (prazoFinal <= prazoInicio) {
              throw new Error(
                `Na trilha "${titulo}", prazoFinal deve ser maior que prazoInicio.`
              );
            }
          }
        }

        if (metodologia.estruturaTipo === MetodologiaEstruturaTipo.MODULO) {
          // módulo não exige modoExecucao nem prazo
        }

        let ordemFinal = ordemInformada;

        if (!ordemFinal || ordemFinal <= 0) {
          const last = await tx.metodologiaEstrutura.findFirst({
            where: { metodologiaId },
            orderBy: { ordem: "desc" },
            select: { ordem: true },
          });

          ordemFinal = (last?.ordem ?? 0) + 1;
        }

        const estruturaComMesmoNome = await tx.metodologiaEstrutura.findFirst({
          where: {
            titulo: {
              equals: titulo,
              mode: "insensitive",
            },
          },
          select: { id: true, titulo: true },
        });

        if (estruturaComMesmoNome) {
          throw new Error(`Já existe uma trilha/módulo com o nome "${titulo}". Escolha outro nome.`);
        }

        const nova = await tx.metodologiaEstrutura.create({
          data: {
            metodologiaId,
            tipo: tipoEstrutura,
            titulo,
            descricao,
            objetivo,
            ordem: ordemFinal,
            duracaoSemanas,
            treinosPorSemana,
            quantidadeMinConclusao,
            pontosPorItem,
            bonusConsistencia,
            bonusFinal,
            prazoInicio:
              metodologia.estruturaTipo === MetodologiaEstruturaTipo.TRILHA &&
              modoExecucao === MetodologiaModoExecucao.DESAFIO_FECHADO
                ? prazoInicio
                : null,

            prazoFinal:
              metodologia.estruturaTipo === MetodologiaEstruturaTipo.TRILHA
                ? (modoExecucao === MetodologiaModoExecucao.LIVRE ? null : prazoFinal)
                : prazoFinal,

            percentualPerdaAtraso:
              metodologia.estruturaTipo === MetodologiaEstruturaTipo.TRILHA
                ? (modoExecucao === MetodologiaModoExecucao.LIVRE ? null : (percentualPerdaAtraso ?? 20))
                : null,

            permiteAtraso:
              metodologia.estruturaTipo === MetodologiaEstruturaTipo.TRILHA
                ? (modoExecucao === MetodologiaModoExecucao.DESAFIO_FECHADO ? false : permiteAtraso)
                : true,

            modoExecucao:
              metodologia.estruturaTipo === MetodologiaEstruturaTipo.TRILHA
                ? modoExecucao
                : null,
            ativo,
          },
        });

        out.push(nova);
      }

      return out;
    });

    return res.status(201).json({ estruturas: criadas });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao criar estruturas da metodologia.",
      detail: e?.message,
    });
  }
}

export async function updateMetodologiaEstrutura(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { metodologiaId, estruturaId } = req.params;

    const validacao = await validarMetodologiaDoCriador(metodologiaId, userId);
    if (validacao && "erro" in validacao && validacao.erro) {
      return res.status(validacao.erro.status).json({ message: validacao.erro.message });
    }

    const metodologia = validacao.metodologia;

    const estrutura = await prisma.metodologiaEstrutura.findFirst({
      where: {
        id: estruturaId,
        metodologiaId,
      },
    });

    if (!estrutura) {
      return res.status(404).json({ message: "Estrutura não encontrada." });
    }

    const body = req.body || {};

    const titulo = body.titulo !== undefined ? String(body.titulo ?? "").trim() : undefined;
    const descricao = body.descricao !== undefined ? asNullableString(body.descricao) : undefined;
    const objetivo = body.objetivo !== undefined ? asNullableString(body.objetivo) : undefined;
    const ordem = body.ordem !== undefined ? asNullableNumber(body.ordem) : undefined;
    const ativo = body.ativo !== undefined ? asBool(body.ativo, true) : undefined;

    const duracaoSemanas =
      body.duracaoSemanas !== undefined ? asNullableNumber(body.duracaoSemanas) : undefined;
    const treinosPorSemana =
      body.treinosPorSemana !== undefined ? asNullableNumber(body.treinosPorSemana) : undefined;
    const quantidadeMinConclusao =
      body.quantidadeMinConclusao !== undefined
        ? asNullableNumber(body.quantidadeMinConclusao)
        : undefined;
    const pontosPorItem =
      body.pontosPorItem !== undefined ? asNullableNumber(body.pontosPorItem) : undefined;
    const bonusConsistencia =
      body.bonusConsistencia !== undefined
        ? asNullableNumber(body.bonusConsistencia)
        : undefined;
    const bonusFinal =
      body.bonusFinal !== undefined ? asNullableNumber(body.bonusFinal) : undefined;

    const prazoInicio =
      body.prazoInicio !== undefined
        ? (body.prazoInicio ? new Date(body.prazoInicio) : null)
        : undefined;

    const prazoFinal =
      body.prazoFinal !== undefined
        ? (body.prazoFinal ? new Date(body.prazoFinal) : null)
        : undefined;

    const percentualPerdaAtraso =
      body.percentualPerdaAtraso !== undefined
        ? asNullableNumber(body.percentualPerdaAtraso)
        : undefined;

    const permiteAtraso =
      body.permiteAtraso !== undefined ? asBool(body.permiteAtraso, true) : undefined;

    const modoExecucao =
      body.modoExecucao !== undefined ? (body.modoExecucao || null) : undefined;

    if (titulo !== undefined && !titulo) {
      return res.status(400).json({ message: "Título não pode ser vazio." });
    }

    if (
      modoExecucao !== undefined &&
      modoExecucao !== null &&
      !isValidEnumValue(MetodologiaModoExecucao, modoExecucao)
    ) {
      return res.status(400).json({ message: "modoExecucao inválido." });
    }

    const futuraDuracao =
      duracaoSemanas !== undefined ? duracaoSemanas : estrutura.duracaoSemanas;
    const futuroTreinos =
      treinosPorSemana !== undefined ? treinosPorSemana : estrutura.treinosPorSemana;
    const futuroModoExecucao =
      modoExecucao !== undefined ? modoExecucao : estrutura.modoExecucao;
    const futuroPrazoInicio =
      prazoInicio !== undefined ? prazoInicio : estrutura.prazoInicio;
    const futuroPrazoFinal =
      prazoFinal !== undefined ? prazoFinal : estrutura.prazoFinal;

    if (metodologia.estruturaTipo === MetodologiaEstruturaTipo.TRILHA) {
      if (!futuraDuracao || futuraDuracao <= 0) {
        return res.status(400).json({ message: "Trilhas exigem duracaoSemanas válida." });
      }

      if (!futuroTreinos || futuroTreinos <= 0) {
        return res.status(400).json({ message: "Trilhas exigem treinosPorSemana válido." });
      }

      if (!futuroModoExecucao || !isValidEnumValue(MetodologiaModoExecucao, futuroModoExecucao)) {
        return res.status(400).json({ message: "Trilhas exigem modoExecucao válido." });
      }

      if (futuroModoExecucao === MetodologiaModoExecucao.PRAZO_SUGERIDO) {
        if (!futuroPrazoFinal || Number.isNaN(new Date(futuroPrazoFinal).getTime())) {
          return res.status(400).json({
            message: 'Trilhas no modo "Com prazo sugerido" exigem prazoFinal.',
          });
        }
      }

      if (futuroModoExecucao === MetodologiaModoExecucao.DESAFIO_FECHADO) {
        if (!futuroPrazoInicio || Number.isNaN(new Date(futuroPrazoInicio).getTime())) {
          return res.status(400).json({
            message: 'Trilhas no modo "Desafio fechado" exigem prazoInicio.',
          });
        }

        if (!futuroPrazoFinal || Number.isNaN(new Date(futuroPrazoFinal).getTime())) {
          return res.status(400).json({
            message: 'Trilhas no modo "Desafio fechado" exigem prazoFinal.',
          });
        }

        if (new Date(futuroPrazoFinal) <= new Date(futuroPrazoInicio)) {
          return res.status(400).json({
            message: "prazoFinal deve ser maior que prazoInicio.",
          });
        }
      }
    }

    if (titulo !== undefined && titulo) {
      const estruturaComMesmoNome = await prisma.metodologiaEstrutura.findFirst({
        where: {
          id: { not: estruturaId },
          metodologiaId,
          titulo: {
            equals: titulo,
            mode: "insensitive",
          },
        },
        select: { id: true, titulo: true },
      });

      if (estruturaComMesmoNome) {
        throw new Error(`Já existe uma trilha/módulo com o nome "${titulo}". Escolha outro nome.`);
      }
    }

    const updated = await prisma.metodologiaEstrutura.update({
      where: { id: estruturaId },
      data: {
        ...(titulo !== undefined ? { titulo } : {}),
        ...(descricao !== undefined ? { descricao } : {}),
        ...(objetivo !== undefined ? { objetivo } : {}),
        ...(ordem !== undefined && ordem !== null ? { ordem } : {}),
        ...(ativo !== undefined ? { ativo } : {}),
        ...(duracaoSemanas !== undefined ? { duracaoSemanas } : {}),
        ...(treinosPorSemana !== undefined ? { treinosPorSemana } : {}),
        ...(quantidadeMinConclusao !== undefined ? { quantidadeMinConclusao } : {}),
        ...(metodologia.estruturaTipo === MetodologiaEstruturaTipo.TRILHA
          ? {
              pontosPorItem: 5,
              bonusConsistencia: 10,
              bonusFinal: 15,
            }
          : {
              pontosPorItem: null,
              bonusConsistencia: null,
              bonusFinal: null,
            }),
        ...(metodologia.estruturaTipo === MetodologiaEstruturaTipo.TRILHA
          ? {
              ...(prazoInicio !== undefined ? { prazoInicio } : {}),
              ...(prazoFinal !== undefined ? { prazoFinal } : {}),
              ...(percentualPerdaAtraso !== undefined ? { percentualPerdaAtraso } : {}),
              ...(permiteAtraso !== undefined ? { permiteAtraso } : {}),
              ...(modoExecucao !== undefined ? { modoExecucao } : {}),
            }
          : {
              prazoInicio: null,
              ...(prazoFinal !== undefined ? { prazoFinal } : {}),
              percentualPerdaAtraso: null,
              permiteAtraso: true,
              modoExecucao: null,
            }),
      },
      include: {
        itens: {
          orderBy: { ordem: "asc" },
        },
      },
    });

    return res.json({ estrutura: updated });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao atualizar estrutura da metodologia.",
      detail: e?.message,
    });
  }
}

export async function deleteMetodologiaEstrutura(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { metodologiaId, estruturaId } = req.params;

    const validacao = await validarMetodologiaDoCriador(metodologiaId, userId);
    if (validacao && "erro" in validacao && validacao.erro) {
      return res.status(validacao.erro.status).json({ message: validacao.erro.message });
    }

    const estrutura = await prisma.metodologiaEstrutura.findFirst({
      where: {
        id: estruturaId,
        metodologiaId,
      },
      select: {
        id: true,
        metodologiaId: true,
      },
    });

    if (!estrutura) {
      return res.status(404).json({ message: "Estrutura não encontrada." });
    }

    await prisma.$transaction(async (tx) => {
      await tx.metodologiaProgressoEstrutura.deleteMany({
        where: { estruturaId },
      });

      await tx.metodologiaEstruturaItem.deleteMany({
        where: { estruturaId },
      });

      await tx.metodologiaEstrutura.delete({
        where: { id: estruturaId },
      });
    });

    return res.json({ ok: true, deletedId: estruturaId });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao excluir estrutura da metodologia.",
      detail: e?.message,
    });
  }
}

export async function createMetodologiaEstruturaItens(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { metodologiaId, estruturaId } = req.params;

    const validacao = await validarMetodologiaDoCriador(metodologiaId, userId);
    if (validacao && "erro" in validacao && validacao.erro) {
      return res.status(validacao.erro.status).json({ message: validacao.erro.message });
    }

    const estrutura = await prisma.metodologiaEstrutura.findFirst({
      where: {
        id: estruturaId,
        metodologiaId,
      },
      select: {
        id: true,
        metodologiaId: true,
        tipo: true,
      },
    });

    if (!estrutura) {
      return res.status(404).json({ message: "Estrutura não encontrada." });
    }

    const body = req.body || {};
    const entrada = Array.isArray(body.itens) ? body.itens : [body];

    if (!entrada.length) {
      return res.status(400).json({ message: "Envie ao menos um item." });
    }

    const created = await prisma.$transaction(async (tx) => {
      const out: any[] = [];

      for (const item of entrada) {
        const titulo = String(item?.titulo ?? "").trim();
        const descricao = asNullableString(item?.descricao);
        const tipo = item?.tipo;
        const ordemInformada = asNullableNumber(item?.ordem);
        const videoUrl = asNullableString(item?.videoUrl);
        const thumbUrl = asNullableString(item?.thumbUrl);
        const arquivoUrl = asNullableString(item?.arquivoUrl);
        const materialUrl = asNullableString(item?.materialUrl);
        const treinoProgramadoId = asNullableString(item?.treinoProgramadoId);
        const duracaoMinInformada = asNullableNumber(item?.duracaoMin);
        const duracaoMin =
          tipo === MetodologiaItemTipo.VIDEO ||
          tipo === MetodologiaItemTipo.AULA ||
          tipo === MetodologiaItemTipo.AULA_AO_VIVO
            ? duracaoMinInformada
            : null;

        let treinoPontuacao: number | null = null;

        if (treinoProgramadoId) {
          const treino = await tx.treinoProgramado.findUnique({
            where: { id: treinoProgramadoId },
            select: { id: true, pontuacao: true },
          });

          if (!treino) {
            throw new Error(`Treino não encontrado para o item "${titulo}".`);
          }

          treinoPontuacao = treino.pontuacao ?? 0;
        }

        const duracaoMinFinal =
          tipo === MetodologiaItemTipo.VIDEO || tipo === MetodologiaItemTipo.AULA
            ? asNullableNumber(item?.duracaoMin)
            : null;

        const pontosFinais = calcularPontuacaoItemBackend({
          tipo,
          duracaoMin: duracaoMinFinal,
          treinoPontuacao,
        });

        const obrigatorio = item?.obrigatorio !== undefined ? asBool(item?.obrigatorio, true) : true;
        const publicado = item?.publicado !== undefined ? asBool(item?.publicado, true) : true;

        if (!titulo) {
          throw new Error("Cada item precisa ter título.");
        }

        if (!isValidEnumValue(MetodologiaItemTipo, tipo)) {
          throw new Error(`Tipo de item inválido para "${titulo}".`);
        }

        if ((tipo === MetodologiaItemTipo.VIDEO || tipo === MetodologiaItemTipo.AULA) && !videoUrl) {
          throw new Error(`O item "${titulo}" exige videoUrl.`);
        }

        if (tipo === MetodologiaItemTipo.TREINO && !treinoProgramadoId) {
          throw new Error(`O item "${titulo}" exige treinoProgramadoId.`);
        }

        if (tipo === MetodologiaItemTipo.MATERIAL && !arquivoUrl && !materialUrl) {
          throw new Error(`O item "${titulo}" exige arquivoUrl ou materialUrl.`);
        }

        if (treinoProgramadoId) {
          const treino = await tx.treinoProgramado.findUnique({
            where: { id: treinoProgramadoId },
            select: { id: true, pontuacao: true },
          });

          if (!treino) {
            throw new Error(`Treino não encontrado para o item "${titulo}".`);
          }

          treinoPontuacao = treino.pontuacao ?? 0;
        }

        let ordemFinal = ordemInformada;

        if (!ordemFinal || ordemFinal <= 0) {
          const last = await tx.metodologiaEstruturaItem.findFirst({
            where: { estruturaId },
            orderBy: { ordem: "desc" },
            select: { ordem: true },
          });

          ordemFinal = (last?.ordem ?? 0) + 1;
        }

        const pontos = calcularPontuacaoItemBackend({
          tipo,
          duracaoMin,
          treinoPontuacao,
        });

        const novo = await tx.metodologiaEstruturaItem.create({
          data: {
            estruturaId,
            ordem: ordemFinal,
            titulo,
            descricao,
            tipo,
            videoUrl: tipo === MetodologiaItemTipo.AULA_AO_VIVO ? null : videoUrl,
            thumbUrl,
            arquivoUrl,
            materialUrl,
            treinoProgramadoId,
            pontos,
            duracaoMin,
            obrigatorio,
            publicado,
          },
          include: {
            treinoProgramado: {
              select: {
                id: true,
                nome: true,
                codigo: true,
                imagemUrl: true,
                nivel: true,
                categoria: true,
                pontuacao: true,
                duracao: true,
                objetivo: true,
                tipoTreino: true,
              },
            },
            aulaAoVivo: true,
          },
        });

        if (tipo === MetodologiaItemTipo.AULA_AO_VIVO) {
          await upsertAulaAoVivoParaItem({
            tx,
            userId,
            itemPayload: item,
            itemCriadoId: novo.id,
            tituloItem: titulo,
            descricaoItem: descricao,
            duracaoMin,
            thumbUrl,
            metodologiaId,
            estruturaId,
          });
        }

        // mantém compatibilidade com tabela legado MetodologiaTreino
        if (tipo === MetodologiaItemTipo.TREINO && treinoProgramadoId) {
          await tx.metodologiaTreino.upsert({
            where: {
              metodologiaId_treinoProgramadoId: {
                metodologiaId,
                treinoProgramadoId,
              },
            },
            update: {},
            create: {
              metodologiaId,
              treinoProgramadoId,
            },
          });
        }

        out.push(novo);
      }

      return out;
    });

    return res.status(201).json({ itens: created });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao criar itens da estrutura.",
      detail: e?.message,
    });
  }
}

export async function deleteMetodologiaEstruturaItens(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { metodologiaId, estruturaId } = req.params;

    const validacao = await validarMetodologiaDoCriador(metodologiaId, userId);
    if (validacao && "erro" in validacao && validacao.erro) {
      return res.status(validacao.erro.status).json({ message: validacao.erro.message });
    }

    const estrutura = await prisma.metodologiaEstrutura.findFirst({
      where: {
        id: estruturaId,
        metodologiaId,
      },
      select: { id: true },
    });

    if (!estrutura) {
      return res.status(404).json({ message: "Estrutura não encontrada." });
    }

    const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.filter(Boolean) : [];

    if (itemIds.length) {
      const deleted = await prisma.metodologiaEstruturaItem.deleteMany({
        where: {
          estruturaId,
          id: { in: itemIds },
        },
      });

      return res.json({
        ok: true,
        deleted: deleted.count,
        mode: "selected",
      });
    }

    const deleted = await prisma.metodologiaEstruturaItem.deleteMany({
      where: { estruturaId },
    });

    return res.json({
      ok: true,
      deleted: deleted.count,
      mode: "all",
    });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao excluir itens da estrutura.",
      detail: e?.message,
    });
  }
}

export async function concluirEstruturaItemMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { id: metodologiaId, estruturaId } = req.params;
    const itemId = String(req.body?.itemId ?? "").trim();

    if (!itemId) {
      return res.status(400).json({ message: "itemId é obrigatório." });
    }

    const isAvulsa =
      req.originalUrl.includes("/metodologias-avulsas/") ||
      String(req.query.origemTipo || "").toUpperCase() === "AVULSA";

    const isAdmin = await isAdminUser(userId);

    const metodologiaBase = isAvulsa
      ? await prisma.metodologiaAvulsa.findUnique({
          where: { id: metodologiaId },
          select: { id: true, ativo: true },
        })
      : await prisma.metodologia.findUnique({
          where: { id: metodologiaId },
          select: { id: true, ativo: true },
        });

    if (!metodologiaBase) {
      return res.status(404).json({
        message: isAvulsa
          ? "Metodologia avulsa não encontrada."
          : "Metodologia não encontrada.",
      });
    }

    if (!isAdmin && metodologiaBase.ativo === false) {
      return res.status(404).json({
        message: isAvulsa
          ? "Metodologia avulsa não encontrada."
          : "Metodologia não encontrada.",
      });
    }

    let assinatura = isAvulsa
      ? await prisma.metodologiaAssinante.findFirst({
          where: {
            usuarioId: userId,
            metodologiaAvulsaId: metodologiaId,
          },
          select: {
            id: true,
            status: true,
            expiraEm: true,
            progresso: true,
            concluiuEm: true,
            iniciouEm: true,
          },
        })
      : await prisma.metodologiaAssinante.findUnique({
          where: {
            metodologiaId_usuarioId: {
              metodologiaId,
              usuarioId: userId,
            },
          },
          select: {
            id: true,
            status: true,
            expiraEm: true,
            progresso: true,
            concluiuEm: true,
            iniciouEm: true,
          },
        });

    if (!assinatura && isAdmin) {
      if (isAvulsa) {
        const existeAvulsa = await prisma.metodologiaAvulsa.findUnique({
          where: { id: metodologiaId },
          select: { id: true },
        });

        if (!existeAvulsa) {
          return res.status(404).json({
            message: "Metodologia avulsa não encontrada para criar assinatura do admin.",
          });
        }

        assinatura = await prisma.metodologiaAssinante.create({
          data: {
            usuarioId: userId,
            metodologiaAvulsaId: metodologiaId,
            origem: MetodologiaAssinaturaOrigem.AVULSA,
            status: MetodologiaAssinaturaStatus.ATIVA,
            iniciouEm: new Date(),
            progresso: {
              concluidos: [],
              pontosGanhos: 0,
              atualizadoEm: new Date().toISOString(),
            } as any,
          },
          select: {
            id: true,
            status: true,
            expiraEm: true,
            progresso: true,
            concluiuEm: true,
            iniciouEm: true,
          },
        });
      } else {
        const existeLearning = await prisma.metodologia.findUnique({
          where: { id: metodologiaId },
          select: { id: true },
        });

        if (!existeLearning) {
          return res.status(404).json({
            message: "Metodologia não encontrada para criar assinatura do admin.",
          });
        }

        assinatura = await prisma.metodologiaAssinante.create({
          data: {
            usuarioId: userId,
            metodologiaId,
            origem: MetodologiaAssinaturaOrigem.LEARNING,
            status: MetodologiaAssinaturaStatus.ATIVA,
            iniciouEm: new Date(),
            progresso: {
              concluidos: [],
              pontosGanhos: 0,
              atualizadoEm: new Date().toISOString(),
            } as any,
          },
          select: {
            id: true,
            status: true,
            expiraEm: true,
            progresso: true,
            concluiuEm: true,
            iniciouEm: true,
          },
        });
      }
    }

    const temAcesso = assinaturaDaAcesso(assinatura) || isAdmin;

    if (!temAcesso) {
      return res.status(403).json({ message: "Você não possui acesso a esta metodologia." });
    }

    if (!isAdmin && assinatura?.status === MetodologiaAssinaturaStatus.CANCELADA) {
      return res.status(403).json({ message: "Você não possui acesso a esta metodologia." });
    }

    if (
      !isAdmin &&
      assinatura?.expiraEm &&
      new Date(assinatura.expiraEm) <= new Date()
    ) {
      return res.status(403).json({ message: "Sua assinatura desta metodologia expirou." });
    }

    const item = isAvulsa
      ? await prisma.metodologiaAvulsaEstruturaItem.findFirst({
          where: {
            id: itemId,
            estruturaId,
            estrutura: {
              metodologiaAvulsaId: metodologiaId,
            },
          },
          include: {
            estrutura: {
              select: {
                id: true,
                metodologiaAvulsaId: true,
                titulo: true,
                pontosPorItem: true,
                modoExecucao: true,
                prazoFinal: true,
                percentualPerdaAtraso: true,
              },
            },
            treinoProgramado: {
              select: {
                pontuacao: true,
              },
            },
          },
        })
      : await prisma.metodologiaEstruturaItem.findFirst({
          where: {
            id: itemId,
            estruturaId,
            estrutura: {
              metodologiaId,
            },
          },
          include: {
            estrutura: {
              select: {
                id: true,
                metodologiaId: true,
                titulo: true,
                pontosPorItem: true,
                modoExecucao: true,
                prazoFinal: true,
                percentualPerdaAtraso: true,
              },
            },
            treinoProgramado: {
              select: {
                pontuacao: true,
              },
            },
          },
        });

    if (!item) {
      return res.status(404).json({ message: "Item da estrutura não encontrado." });
    }

    const tipo = String(item.tipo || "").toUpperCase();

    if (!assinatura) {
      return res.status(403).json({ message: "Você não possui acesso a esta metodologia." });
    }

    const [totalItensEstrutura, totalItensConcluidosEstrutura, concluidosAtualizados] =
    await prisma.$transaction(async (tx) => {
      const progressoAssinaturaAtual: any =
        assinatura?.progresso && typeof assinatura.progresso === "object"
          ? { ...(assinatura.progresso as any) }
          : {};

      const concluidosLegado: string[] = Array.isArray(progressoAssinaturaAtual.concluidos)
        ? progressoAssinaturaAtual.concluidos.map((v: any) => String(v))
        : [];

      if (!concluidosLegado.includes(itemId)) {
        concluidosLegado.push(itemId);
      }

      const pontosBase = Number(
        item.pontos ??
        item.estrutura?.pontosPorItem ??
        (String(item.tipo || "").toUpperCase() === "TREINO"
          ? item.treinoProgramado?.pontuacao
          : 0) ??
        0
      );

      const pontosItem = concluidosLegado.includes(itemId)
        ? 0
        : aplicarPenalidadeAtraso(pontosBase, {
            modoExecucao: item.estrutura?.modoExecucao ?? null,
            prazoFinal: item.estrutura?.prazoFinal ?? null,
            percentualPerdaAtraso: item.estrutura?.percentualPerdaAtraso ?? null,
          });

      const itensPublicados = isAvulsa
        ? await tx.metodologiaAvulsaEstruturaItem.count({
            where: { estruturaId, publicado: true },
          })
        : await tx.metodologiaEstruturaItem.count({
            where: { estruturaId, publicado: true },
          });

      const statusEstrutura =
        itensPublicados > 0 && concluidosLegado.length >= itensPublicados
          ? MetodologiaProgressoStatus.CONCLUIDA
          : concluidosLegado.length > 0
            ? MetodologiaProgressoStatus.EM_ANDAMENTO
            : MetodologiaProgressoStatus.NAO_INICIADA;

      progressoAssinaturaAtual.concluidos = concluidosLegado;
      progressoAssinaturaAtual.pontosGanhos =
        Number(progressoAssinaturaAtual.pontosGanhos ?? 0) + pontosItem;
      progressoAssinaturaAtual.ultimoItemConcluidoId = itemId;
      progressoAssinaturaAtual.atualizadoEm = new Date().toISOString();

      if (isAvulsa) {
        // salva por estrutura dentro do JSON da assinatura
        const estruturasMap =
          progressoAssinaturaAtual.estruturas &&
          typeof progressoAssinaturaAtual.estruturas === "object"
            ? { ...progressoAssinaturaAtual.estruturas }
            : {};

        const estruturaAtual =
          estruturasMap[estruturaId] && typeof estruturasMap[estruturaId] === "object"
            ? { ...estruturasMap[estruturaId] }
            : {};

        estruturaAtual.status = statusEstrutura;
        estruturaAtual.itensConcluidos = concluidosLegado.filter((id) => {
          // conta só os itens desta estrutura
          return true;
        }).length;
        estruturaAtual.ultimoItemConcluidoId = itemId;
        estruturaAtual.ultimoAcessoEm = new Date().toISOString();
        if (!estruturaAtual.iniciadoEm) estruturaAtual.iniciadoEm = new Date().toISOString();
        if (statusEstrutura === MetodologiaProgressoStatus.CONCLUIDA) {
          estruturaAtual.concluidoEm = new Date().toISOString();
        }

        estruturasMap[estruturaId] = estruturaAtual;
        progressoAssinaturaAtual.estruturas = estruturasMap;

        await tx.metodologiaAssinante.update({
          where: { id: assinatura.id },
          data: {
            progresso: progressoAssinaturaAtual,
          },
        });
      } else {
        const progressoExistente = await tx.metodologiaProgressoEstrutura.findUnique({
          where: {
            metodologiaAssinanteId_estruturaId: {
              metodologiaAssinanteId: assinatura.id,
              estruturaId,
            },
          },
        });

        const payloadAtual: any =
          progressoExistente?.progresso && typeof progressoExistente.progresso === "object"
            ? { ...(progressoExistente.progresso as any) }
            : {};

        payloadAtual.concluidos = concluidosLegado;
        payloadAtual.ultimoItemConcluidoId = itemId;
        payloadAtual.pontosGanhos = Number(payloadAtual.pontosGanhos ?? 0) + pontosItem;

        await tx.metodologiaProgressoEstrutura.upsert({
          where: {
            metodologiaAssinanteId_estruturaId: {
              metodologiaAssinanteId: assinatura.id,
              estruturaId,
            },
          },
          create: {
            metodologiaAssinanteId: assinatura.id,
            estruturaId,
            status: statusEstrutura,
            iniciadoEm: new Date(),
            concluidoEm:
              statusEstrutura === MetodologiaProgressoStatus.CONCLUIDA ? new Date() : null,
            cicloInicioEm: new Date(),
            itensConcluidos: concluidosLegado.length,
            pontosGanhos: Number(payloadAtual.pontosGanhos ?? 0),
            ultimoAcessoEm: new Date(),
            progresso: payloadAtual,
          },
          update: {
            status: statusEstrutura,
            concluidoEm:
              statusEstrutura === MetodologiaProgressoStatus.CONCLUIDA ? new Date() : null,
            itensConcluidos: concluidosLegado.length,
            pontosGanhos: Number(payloadAtual.pontosGanhos ?? 0),
            ultimoAcessoEm: new Date(),
            progresso: payloadAtual,
          },
        });

        await tx.metodologiaAssinante.update({
          where: { id: assinatura.id },
          data: {
            progresso: progressoAssinaturaAtual,
          },
        });
      }

      return [itensPublicados, concluidosLegado.length, concluidosLegado] as const;
    });

    if (!isAvulsa) {
      await recalcularStatusMetodologiaAssinante(metodologiaId, userId);
    } else {
      const [totalItensPublicadosMetodologia, totalEstruturasConcluidas] = await Promise.all([
        prisma.metodologiaAvulsaEstruturaItem.count({
          where: {
            estrutura: {
              metodologiaAvulsaId: metodologiaId,
            },
            publicado: true,
          },
        }),
        prisma.metodologiaProgressoEstrutura.count({
          where: {
            metodologiaAssinanteId: assinatura.id,
            status: MetodologiaProgressoStatus.CONCLUIDA,
          },
        }),
      ]);

      const assinaturaAtualizada = await prisma.metodologiaAssinante.findUnique({
        where: { id: assinatura.id },
        select: { progresso: true, concluiuEm: true, status: true },
      });

      const payload: any =
        assinaturaAtualizada?.progresso && typeof assinaturaAtualizada.progresso === "object"
          ? { ...(assinaturaAtualizada.progresso as any) }
          : {};

      payload.totalItens = totalItensPublicadosMetodologia;
      payload.estruturasConcluidas = totalEstruturasConcluidas;

      const totalEstruturasAtivas = await prisma.metodologiaAvulsaEstrutura.count({
        where: {
          metodologiaAvulsaId: metodologiaId,
          ativo: true,
        },
      });

      const concluiuTudo =
        totalEstruturasAtivas > 0 && totalEstruturasConcluidas >= totalEstruturasAtivas;

      await prisma.metodologiaAssinante.update({
        where: { id: assinatura.id },
        data: {
          progresso: payload,
          pontosGanhos: Number(payload.pontosGanhos ?? 0),
          status: concluiuTudo
            ? (MetodologiaAssinaturaStatus.CONCLUIDA as any)
            : assinaturaAtualizada?.status,
          concluiuEm: concluiuTudo
            ? (assinaturaAtualizada?.concluiuEm ?? new Date())
            : assinaturaAtualizada?.concluiuEm,
        },
      });

      if (concluiuTudo) {
        const avulsa = await prisma.metodologiaAvulsa.findUnique({
          where: { id: metodologiaId },
          select: {
            titulo: true,
            capaUrl: true,
          },
        });

        await prisma.atividadeRecente.create({
          data: {
            usuarioId: userId,
            tipo: "Metodologia",
            titulo: `Metodologia concluída: ${avulsa?.titulo || "Metodologia"}`,
            imagemUrl: avulsa?.capaUrl ?? null,
            link: `/learning/${metodologiaId}?origem=avulsa`,
          },
        }).catch(() => null);
      }
    }

    return res.json({
      ok: true,
      estruturaId,
      itemId,
      totalItensEstrutura,
      totalItensConcluidosEstrutura,
      estruturaConcluida:
        totalItensEstrutura > 0 && totalItensConcluidosEstrutura >= totalItensEstrutura,
      progresso: {
        concluidos: concluidosAtualizados,
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao concluir item da estrutura da metodologia.",
      detail: e?.message,
    });
  }
}

export async function createMetodologiaCompleta(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const permissaoCriacao = await getPermissaoCriacaoMetodologia(userId);
    if (!permissaoCriacao.podeCriar) {
      return res.status(403).json({
        code: "CRIACAO_METODOLOGIA_BLOQUEADA",
        message: "Apenas professor, clube, escolinha ou admin podem criar metodologias.",
        detalhes: permissaoCriacao,
      });
    }

    const {
      titulo,
      descricao,
      capaUrl,
      publicoAlvo,
      tipo,
      estruturaTipo,
      area,
      geraBadge,
      geraCertificado,
      estruturas,
    } = req.body || {};

    if (!titulo || typeof titulo !== "string") {
      return res.status(400).json({ message: "Título é obrigatório." });
    }

    if (!Array.isArray(estruturas) || estruturas.length === 0) {
      return res.status(400).json({ message: "Adicione pelo menos uma trilha/módulo." });
    }

    const tituloTrim = titulo.trim();

    const metodologiaComMesmoNome = await prisma.metodologia.findFirst({
      where: {
        titulo: {
          equals: tituloTrim,
          mode: "insensitive",
        },
        criadorUsuarioId: userId,
      },
      select: { id: true },
    });

    if (metodologiaComMesmoNome) {
      return res.status(400).json({
        message: `Você já possui uma metodologia com o nome "${tituloTrim}". Escolha outro nome.`,
      });
    }

    if (!tipo || !Object.values(MetodologiaTipo).includes(tipo)) {
      return res.status(400).json({ message: "tipo inválido." });
    }

    if (!estruturaTipo || !Object.values(MetodologiaEstruturaTipo).includes(estruturaTipo)) {
      return res.status(400).json({ message: "estruturaTipo inválido." });
    }

    if (
      tipo === MetodologiaTipo.TRILHAS_TREINO &&
      estruturaTipo !== MetodologiaEstruturaTipo.TRILHA
    ) {
      return res.status(400).json({
        message: "Metodologia de trilhas de treino deve usar estruturaTipo=TRILHA.",
      });
    }

    if (
      tipo === MetodologiaTipo.CURSO_FORMACAO &&
      estruturaTipo !== MetodologiaEstruturaTipo.MODULO
    ) {
      return res.status(400).json({
        message: "Metodologia de curso/formação deve usar estruturaTipo=MODULO.",
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        tipo: true,
        professor: { select: { id: true } },
        clube: { select: { id: true } },
        escolinha: { select: { id: true } },
      },
    });

    const professorId =
      usuario?.tipo === "Professor" ? usuario?.professor?.id ?? null : null;

    const clubeId =
      usuario?.tipo === "Clube" ? usuario?.clube?.id ?? null : null;

    const escolinhaId =
      usuario?.tipo === "Escolinha" ? usuario?.escolinha?.id ?? null : null;

    const criada = await prisma.$transaction(async (tx) => {
      const metodologia = await tx.metodologia.create({
        data: {
          titulo: tituloTrim,
          descricao: asNullableString(descricao),
          capaUrl: asNullableString(capaUrl),
          publicoAlvo,
          tipo,
          estruturaTipo,
          area,
          geraBadge: asBool(geraBadge),
          geraCertificado: asBool(geraCertificado),
          criadorUsuarioId: userId,
          professorId,
          clubeId,
          escolinhaId,
          ativo: false,
        },
      });

      for (let i = 0; i < estruturas.length; i++) {
        const estrutura = estruturas[i];
        const tituloEstrutura = String(estrutura?.titulo || "").trim();

        if (!tituloEstrutura) {
          throw new Error(`A estrutura ${i + 1} precisa ter título.`);
        }

        const estruturaComMesmoNome = await tx.metodologiaEstrutura.findFirst({
          where: {
            metodologiaId: metodologia.id,
            titulo: {
              equals: tituloEstrutura,
              mode: "insensitive",
            },
          },
          select: { id: true },
        });

        if (estruturaComMesmoNome) {
          throw new Error(`Já existe uma trilha/módulo com o nome "${tituloEstrutura}". Escolha outro nome.`);
        }

        if (
          estruturaTipo === MetodologiaEstruturaTipo.TRILHA &&
          estrutura.modoExecucao === MetodologiaModoExecucao.DESAFIO_FECHADO
        ) {
          if (!estrutura.prazoInicio) {
            throw new Error(`A trilha "${tituloEstrutura}" exige prazoInicio.`);
          }
          if (!estrutura.prazoFinal) {
            throw new Error(`A trilha "${tituloEstrutura}" exige prazoFinal.`);
          }
          if (new Date(estrutura.prazoFinal) <= new Date(estrutura.prazoInicio)) {
            throw new Error(`Na trilha "${tituloEstrutura}", prazoFinal deve ser maior que prazoInicio.`);
          }
        }

        const novaEstrutura = await tx.metodologiaEstrutura.create({
          data: {
            metodologiaId: metodologia.id,
            tipo: estruturaTipo,
            titulo: tituloEstrutura,
            descricao: asNullableString(estrutura?.descricao),
            objetivo: asNullableString(estrutura?.objetivo),
            ordem: i + 1,
            duracaoSemanas: asNullableNumber(estrutura?.duracaoSemanas),
            treinosPorSemana: asNullableNumber(estrutura?.treinosPorSemana),
            quantidadeMinConclusao: asNullableNumber(estrutura?.quantidadeMinConclusao),
            pontosPorItem:
              estruturaTipo === MetodologiaEstruturaTipo.TRILHA ? 5 : null,
            bonusConsistencia:
              estruturaTipo === MetodologiaEstruturaTipo.TRILHA ? 10 : null,
            bonusFinal:
              estruturaTipo === MetodologiaEstruturaTipo.TRILHA ? 15 : null,
            prazoInicio: asNullableString(estrutura?.prazoInicio) ? new Date(estrutura.prazoInicio) : null,
            prazoFinal: asNullableString(estrutura?.prazoFinal) ? new Date(estrutura.prazoFinal) : null,
            percentualPerdaAtraso: asNullableNumber(estrutura?.percentualPerdaAtraso),
            permiteAtraso: asBool(estrutura?.permiteAtraso, true),
            modoExecucao: estruturaTipo === MetodologiaEstruturaTipo.TRILHA ? estrutura?.modoExecucao : null,
            ativo: estrutura?.ativo ?? true,
          },
        });

        
        const itens = Array.isArray(estrutura?.itens) ? estrutura.itens : [];

        for (let j = 0; j < itens.length; j++) {
          const item = itens[j];
          const tituloItem = String(item?.titulo || "").trim();
          const tipo = item?.tipo;
          const treinoProgramadoId = asNullableString(item?.treinoProgramadoId);

          if (!tituloItem) {
            throw new Error(`O item ${j + 1} da estrutura "${tituloEstrutura}" precisa ter título.`);
          }

          if ((item.tipo === "VIDEO" || item.tipo === "AULA") && !String(item.videoUrl || "").trim()) {
            throw new Error(`O item "${tituloItem}" precisa ter vídeo.`);
          }

          if (item.tipo === "MATERIAL" && !String(item.arquivoUrl || item.materialUrl || "").trim()) {
            throw new Error(`O item "${tituloItem}" precisa ter arquivo ou link do material.`);
          }

          const duracaoMinFinal =
            tipo === MetodologiaItemTipo.VIDEO ||
            tipo === MetodologiaItemTipo.AULA ||
            tipo === MetodologiaItemTipo.AULA_AO_VIVO
              ? asNullableNumber(item?.duracaoMin)
              : null;

          let treinoPontuacao: number | null = null;

          if (treinoProgramadoId) {
            const treino = await tx.treinoProgramado.findUnique({
              where: { id: treinoProgramadoId },
              select: { id: true, pontuacao: true },
            });

            if (!treino) {
              throw new Error(`Treino não encontrado para o item "${tituloItem}".`);
            }

            treinoPontuacao = treino.pontuacao ?? 0;
          }

          const pontosFinais = calcularPontuacaoItemBackend({
            tipo,
            duracaoMin: duracaoMinFinal,
            treinoPontuacao,
          });

          const novoItem = await tx.metodologiaEstruturaItem.create({
            data: {
              estruturaId: novaEstrutura.id,
              tipo,
              titulo: tituloItem,
              descricao: asNullableString(item?.descricao),
              ordem: j + 1,
              videoUrl:
                tipo === MetodologiaItemTipo.AULA_AO_VIVO
                  ? null
                  : asNullableString(item?.videoUrl),
              thumbUrl: asNullableString(item?.thumbUrl),
              arquivoUrl: asNullableString(item?.arquivoUrl),
              materialUrl: asNullableString(item?.materialUrl),
              treinoProgramadoId,
              pontos: pontosFinais,
              duracaoMin: duracaoMinFinal,
              obrigatorio: asBool(item?.obrigatorio, true),
              publicado: asBool(item?.publicado, true),
            },
          });

          if (tipo === MetodologiaItemTipo.AULA_AO_VIVO) {
            await criarAulaAoVivoParaItem({
              tx,
              userId,
              itemPayload: item,
              itemCriadoId: novoItem.id,
              tituloItem,
              descricaoItem: asNullableString(item?.descricao),
              duracaoMin: duracaoMinFinal,
              thumbUrl: asNullableString(item?.thumbUrl),

              metodologiaId: metodologia.id,
              estruturaId: novaEstrutura.id,
            });
          }
        }
      }

      return metodologia;
    });

    return res.status(201).json({ item: criada });
  } catch (e: any) {
    return res.status(400).json({
      message: e?.message || "Erro ao criar metodologia completa.",
    });
  }
}

export async function createMetodologiaAvulsaCompleta(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const permissaoCriacao = await getPermissaoCriacaoMetodologia(userId);
    if (!permissaoCriacao.podeCriar) {
      return res.status(403).json({
        code: "CRIACAO_METODOLOGIA_BLOQUEADA",
        message: "Apenas professor, clube, escolinha ou admin podem criar metodologias.",
        detalhes: permissaoCriacao,
      });
    }

    const {
      titulo,
      descricao,
      capaUrl,
      publicoAlvo,
      tipo,
      estruturaTipo,
      area,
      geraBadge,
      geraCertificado,
      precoAssinaturaMensal,
      estruturas,
    } = req.body || {};

    if (!titulo || typeof titulo !== "string") {
      return res.status(400).json({ message: "Título é obrigatório." });
    }

    const preco = Number(precoAssinaturaMensal);
    if (!Number.isFinite(preco) || preco <= 0) {
      return res.status(400).json({ message: "Preço mensal inválido." });
    }

    const tituloTrim = titulo.trim();

    const metodologiaComMesmoNome = await prisma.metodologiaAvulsa.findFirst({
      where: {
        titulo: {
          equals: tituloTrim,
          mode: "insensitive",
        },
        criadorUsuarioId: userId,
      },
      select: { id: true, titulo: true },
    });

    if (metodologiaComMesmoNome) {
      return res.status(400).json({
        code: "METODOLOGIA_NOME_DUPLICADO_DO_MESMO_CRIADOR",
        message: `Você já possui uma metodologia com o nome "${tituloTrim}". Se quiser criá-la, mude o título.`,
      });
    }

    const item = await prisma.$transaction(async (tx) => {
      const criada = await tx.metodologiaAvulsa.create({
        data: {
          titulo: tituloTrim,
          descricao: asNullableString(descricao),
          capaUrl: asNullableString(capaUrl),
          publicoAlvo,
          tipo,
          estruturaTipo,
          area,
          geraBadge: asBool(geraBadge, false),
          geraCertificado: asBool(geraCertificado, false),
          precoAssinaturaMensal: preco,
          criadorUsuarioId: userId,
          ativo: false,
        },
      });

      const estruturasPayload = Array.isArray(estruturas) ? estruturas : [];

      for (let i = 0; i < estruturasPayload.length; i++) {
        const estrutura = estruturasPayload[i];
        const tituloEstrutura = String(estrutura?.titulo ?? "").trim();

        if (!tituloEstrutura) {
          throw new Error(`A estrutura ${i + 1} precisa ter título.`);
        }

        const novaEstrutura = await tx.metodologiaAvulsaEstrutura.create({
          data: {
            metodologiaAvulsaId: criada.id,
            titulo: tituloEstrutura,
            descricao: asNullableString(estrutura?.descricao),
            objetivo: asNullableString(estrutura?.objetivo),
            tipo: estruturaTipo,
            ordem: i + 1,
            duracaoSemanas: asNullableNumber(estrutura?.duracaoSemanas),
            treinosPorSemana: asNullableNumber(estrutura?.treinosPorSemana),
            quantidadeMinConclusao: asNullableNumber(estrutura?.quantidadeMinConclusao),
            modoExecucao: estrutura?.modoExecucao ?? null,
            pontosPorItem: estruturaTipo === "TRILHA" ? 5 : null,
            bonusConsistencia: estruturaTipo === "TRILHA" ? 10 : null,
            bonusFinal: estruturaTipo === "TRILHA" ? 15 : null,
            prazoInicio: estrutura?.prazoInicio ? new Date(estrutura.prazoInicio) : null,
            prazoFinal: estrutura?.prazoFinal ? new Date(estrutura.prazoFinal) : null,
            percentualPerdaAtraso: asNullableNumber(estrutura?.percentualPerdaAtraso),
            permiteAtraso: asBool(estrutura?.permiteAtraso, true),
            ativo: asBool(estrutura?.ativo, true),
          },
        });

        const itensPayload = Array.isArray(estrutura?.itens) ? estrutura.itens : [];

        for (let j = 0; j < itensPayload.length; j++) {
          const itemPayload = itensPayload[j];
          const tipoItem = itemPayload?.tipo as MetodologiaItemTipo;
          const tituloItem = String(itemPayload?.titulo ?? "").trim();
          const treinoProgramadoId = asNullableString(itemPayload?.treinoProgramadoId);

          if (!tituloItem) {
            throw new Error(`O item ${j + 1} da estrutura "${tituloEstrutura}" precisa ter título.`);
          }

          if (!isValidEnumValue(MetodologiaItemTipo, tipoItem)) {
            throw new Error(`Tipo de item inválido para "${tituloItem}".`);
          }

          if (
            (tipoItem === MetodologiaItemTipo.VIDEO || tipoItem === MetodologiaItemTipo.AULA) &&
            !String(itemPayload?.videoUrl || "").trim()
          ) {
            throw new Error(`O item "${tituloItem}" precisa ter vídeo.`);
          }

          if (
            tipoItem === MetodologiaItemTipo.MATERIAL &&
            !String(itemPayload?.arquivoUrl || itemPayload?.materialUrl || "").trim()
          ) {
            throw new Error(`O item "${tituloItem}" precisa ter arquivo ou link do material.`);
          }

          if (tipoItem === MetodologiaItemTipo.TREINO && !treinoProgramadoId) {
            throw new Error(`O item "${tituloItem}" precisa ter treino selecionado.`);
          }

          let treinoPontuacao: number | null = null;

          if (treinoProgramadoId) {
            const treino = await tx.treinoProgramado.findUnique({
              where: { id: treinoProgramadoId },
              select: { id: true, pontuacao: true },
            });

            if (!treino) {
              throw new Error(`Treino não encontrado para o item "${tituloItem}".`);
            }

            treinoPontuacao = treino.pontuacao ?? 0;
          }

          const duracaoMinFinal =
            tipoItem === MetodologiaItemTipo.VIDEO ||
            tipoItem === MetodologiaItemTipo.AULA ||
            tipoItem === MetodologiaItemTipo.AULA_AO_VIVO
              ? asNullableNumber(itemPayload?.duracaoMin)
              : null;

          const pontosFinais = calcularPontuacaoItemBackend({
            tipo: tipoItem,
            duracaoMin: duracaoMinFinal,
            treinoPontuacao,
          });

          const novoItem = await tx.metodologiaAvulsaEstruturaItem.create({
            data: {
              estruturaId: novaEstrutura.id,
              tipo: tipoItem,
              titulo: tituloItem,
              descricao: asNullableString(itemPayload?.descricao),
              ordem: j + 1,
              videoUrl:
                tipoItem === MetodologiaItemTipo.AULA_AO_VIVO
                  ? null
                  : asNullableString(itemPayload?.videoUrl),
              thumbUrl: asNullableString(itemPayload?.thumbUrl),
              arquivoUrl: asNullableString(itemPayload?.arquivoUrl),
              materialUrl: asNullableString(itemPayload?.materialUrl),
              treinoProgramadoId,
              pontos: pontosFinais,
              duracaoMin: duracaoMinFinal,
              obrigatorio: asBool(itemPayload?.obrigatorio, true),
              publicado: asBool(itemPayload?.publicado, true),
            },
          });

          if (tipoItem === MetodologiaItemTipo.AULA_AO_VIVO) {
            await upsertAulaAoVivoParaItem({
              tx,
              userId,
              itemPayload,
              itemCriadoId: novoItem.id,
              tituloItem,
              descricaoItem: asNullableString(itemPayload?.descricao),
              duracaoMin: duracaoMinFinal,
              thumbUrl: asNullableString(itemPayload?.thumbUrl),
              metodologiaAvulsaId: criada.id,
              estruturaAvulsaId: novaEstrutura.id,
            });
          }
        }
      }

      const completa = await tx.metodologiaAvulsa.findUnique({
        where: { id: criada.id },
        include: {
          estruturas: {
            orderBy: { ordem: "asc" },
            include: {
              itens: {
                orderBy: { ordem: "asc" },
                include: {
                  aulaAoVivo: true,
                },
              },
            },
          },
        },
      });

      return completa;
    });

    return res.status(201).json({ item });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao criar metodologia avulsa.",
      detail: e?.message,
    });
  }
}

export async function createMetodologiaAvulsa(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const permissaoCriacao = await getPermissaoCriacaoMetodologia(userId);
    if (!permissaoCriacao.podeCriar) {
      return res.status(403).json({
        code: "CRIACAO_METODOLOGIA_BLOQUEADA",
        message: "Apenas professor, clube, escolinha ou admin podem criar metodologias.",
        detalhes: permissaoCriacao,
      });
    }

    const {
      titulo,
      descricao,
      capaUrl,
      publicoAlvo,
      tipo,
      estruturaTipo,
      area,
      geraBadge,
      geraCertificado,
      precoAssinaturaMensal,
    } = req.body || {};

    if (!titulo || typeof titulo !== "string") {
      return res.status(400).json({ message: "Título é obrigatório." });
    }

    const preco = Number(precoAssinaturaMensal);
    if (!Number.isFinite(preco) || preco <= 0) {
      return res.status(400).json({ message: "Preço mensal inválido." });
    }

    const tituloTrim = titulo.trim();

    const metodologiaComMesmoNome = await prisma.metodologiaAvulsa.findFirst({
      where: {
        titulo: {
          equals: tituloTrim,
          mode: "insensitive",
        },
        criadorUsuarioId: userId,
      },
      select: { id: true, titulo: true },
    });

    if (metodologiaComMesmoNome) {
      return res.status(400).json({
        code: "METODOLOGIA_NOME_DUPLICADO_DO_MESMO_CRIADOR",
        message: `Você já possui uma metodologia com o nome "${tituloTrim}". Se quiser criá-la, mude o título.`,
      });
    }

    if (!tipo || !Object.values(MetodologiaTipo).includes(tipo)) {
      return res.status(400).json({ message: "tipo inválido." });
    }

    if (!estruturaTipo || !Object.values(MetodologiaEstruturaTipo).includes(estruturaTipo)) {
      return res.status(400).json({ message: "estruturaTipo inválido." });
    }

    let publicoAlvoFinal: MetodologiaPublicoAlvo = MetodologiaPublicoAlvo.AMBOS;

    if (publicoAlvo !== undefined && publicoAlvo !== null && String(publicoAlvo).trim() !== "") {
      const raw = String(publicoAlvo).toUpperCase().trim();
      const ok = (Object.values(MetodologiaPublicoAlvo) as string[]).includes(raw);
      if (!ok) {
        return res.status(400).json({
          message: "publicoAlvo inválido",
          recebido: publicoAlvo,
          esperado: Object.values(MetodologiaPublicoAlvo),
        });
      }
      publicoAlvoFinal = raw as MetodologiaPublicoAlvo;
    }

    const created = await prisma.metodologiaAvulsa.create({
      data: {
        titulo: tituloTrim,
        descricao: asNullableString(descricao),
        capaUrl: asNullableString(capaUrl),
        publicoAlvo: publicoAlvoFinal,
        criadorUsuarioId: userId,
        ativo: false,
        tipo,
        estruturaTipo,
        area: area ?? null,
        geraBadge: asBool(geraBadge, false),
        geraCertificado: asBool(geraCertificado, false),
        precoAssinaturaMensal: preco,
      },
      include: {
        estruturas: {
          include: {
            itens: true,
          },
        },
      },
    });

    return res.status(201).json({ item: created });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao criar metodologia avulsa.",
      detail: e?.message,
    });
  }
}

export async function getMetodologiaAvulsaById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const assinatura = userId
      ? await prisma.metodologiaAssinante.findFirst({
          where: {
            usuarioId: userId,
            metodologiaAvulsaId: id,
          },
          select: {
            id: true,
            status: true,
            expiraEm: true,
            iniciouEm: true,
            progresso: true,
            concluiuEm: true,
            origem: true,
          },
        })
      : null;

    const item = await prisma.metodologiaAvulsa.findUnique({
      where: { id },
      include: {
        criadorUsuario: {
          select: { id: true, nome: true, foto: true, parceiro: true },
        },
        estruturas: {
          where: { ativo: true },
          orderBy: { ordem: "asc" },
          include: {
            itens: {
              where: { publicado: true },
              orderBy: { ordem: "asc" },
              include: {
                treinoProgramado: {
                  select: {
                    id: true,
                    nome: true,
                    codigo: true,
                    imagemUrl: true,
                    nivel: true,
                    categoria: true,
                    pontuacao: true,
                    duracao: true,
                    objetivo: true,
                    tipoTreino: true,
                  },
                },
                aulaAoVivo: {
                  select: {
                    id: true,
                    titulo: true,
                    descricao: true,
                    status: true,
                    dataInicio: true,
                    dataFim: true,
                    inscricaoInicio: true,
                    inscricaoFim: true,
                    thumbUrl: true,
                    replayDisponivel: true,
                    metodologiaId: true,
                    metodologiaAvulsaId: true,
                    itemId: true,
                    itemAvulsaId: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            assinantes: true,
            estruturas: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({
        message: "Metodologia avulsa não encontrada.",
      });
    }

    const isAdmin = await isAdminUser(userId);
    const hasAccess = assinaturaDaAcesso(assinatura);
    const acessoFinal = hasAccess || isAdmin;

    const concluidosSubmissoes = userId
      ? await (prisma as any).metodologiaItemSubmissao.findMany({
          where: {
            metodologiaAvulsaId: id,
            usuarioId: userId,
          },
          select: {
            itemAvulsaId: true,
          },
        })
      : [];

    const concluidosSubmissoesIds = concluidosSubmissoes
      .map((c: any) => c?.itemAvulsaId)
      .filter(Boolean)
      .map((v: any) => String(v));

    const progressoAssinatura: any =
      assinatura?.progresso && typeof assinatura.progresso === "object"
        ? assinatura.progresso
        : {};

    const concluidosAssinaturaIds: string[] = Array.isArray(progressoAssinatura.concluidos)
      ? progressoAssinatura.concluidos.map((v: any) => String(v))
      : [];

    const concluidosIds = Array.from(
      new Set<string>([...concluidosAssinaturaIds, ...concluidosSubmissoesIds])
    );

    const minhaAvaliacao =
      userId
        ? await prisma.avaliacaoMetodologia.findUnique({
            where: {
              metodologiaAvulsaId_usuarioId: {
                metodologiaAvulsaId: id,
                usuarioId: userId,
              },
            },
            select: {
              id: true,
              nota: true,
              comentario: true,
              sentimento: true,
              updatedAt: true,
            },
          })
        : null;

    const estruturas = (item.estruturas || []).map((estrutura: any) => {
      const { inicio, fim } = calcularDatasExecucao(estrutura, assinatura);

      return {
        id: estrutura.id,
        tipo: estrutura.tipo,
        titulo: estrutura.titulo,
        descricao: estrutura.descricao,
        objetivo: estrutura.objetivo,
        ordem: estrutura.ordem,
        duracaoSemanas: estrutura.duracaoSemanas,
        treinosPorSemana: estrutura.treinosPorSemana,
        quantidadeMinConclusao: estrutura.quantidadeMinConclusao,
        modoExecucao: estrutura.modoExecucao,
        pontosPorItem: estrutura.pontosPorItem,
        bonusConsistencia: estrutura.bonusConsistencia,
        bonusFinal: estrutura.bonusFinal,
        prazoInicio: estrutura.prazoInicio,
        prazoFinal: estrutura.prazoFinal,
        dataInicioCalculada: inicio,
        dataFimCalculada: fim,
        ativo: estrutura.ativo,
        itens: (estrutura.itens || []).map((it: any) => ({
          id: it.id,
          ordem: it.ordem,
          tipo: it.tipo,
          titulo: it.titulo,
          descricao: it.descricao,
          pontos: it.pontos,
          thumbUrl: it.thumbUrl,
          duracaoMin: it.duracaoMin,
          videoUrl: acessoFinal ? it.videoUrl : null,
          arquivoUrl: it.arquivoUrl ?? null,
          materialUrl: it.materialUrl ?? null,
          treinoProgramadoId: it.treinoProgramadoId,
          treinoProgramado: it.treinoProgramado
            ? {
                id: it.treinoProgramado.id,
                nome: it.treinoProgramado.nome,
                imagemUrl: it.treinoProgramado.imagemUrl,
                codigo: it.treinoProgramado.codigo,
                nivel: it.treinoProgramado.nivel,
                categoria: it.treinoProgramado.categoria,
                pontuacao: it.treinoProgramado.pontuacao,
                duracao: it.treinoProgramado.duracao,
                objetivo: it.treinoProgramado.objetivo,
                tipoTreino: it.treinoProgramado.tipoTreino,
              }
            : null,
          aulaAoVivo: it.aulaAoVivo
            ? {
                id: it.aulaAoVivo.id,
                titulo: it.aulaAoVivo.titulo,
                descricao: it.aulaAoVivo.descricao,
                status: it.aulaAoVivo.status,
                dataInicio: it.aulaAoVivo.dataInicio,
                dataFim: it.aulaAoVivo.dataFim,
                inscricaoInicio: it.aulaAoVivo.inscricaoInicio,
                inscricaoFim: it.aulaAoVivo.inscricaoFim,
                thumbUrl: it.aulaAoVivo.thumbUrl,
                replayDisponivel: it.aulaAoVivo.replayDisponivel,
                metodologiaId: it.aulaAoVivo.metodologiaId,
                metodologiaAvulsaId: it.aulaAoVivo.metodologiaAvulsaId,
                itemId: it.aulaAoVivo.itemId,
                itemAvulsaId: it.aulaAoVivo.itemAvulsaId,
              }
            : null,
          publicado: it.publicado,
          obrigatorio: it.obrigatorio,
        })),
      };
    });

    const pontosTotal = estruturas.reduce((accEstrutura: number, estrutura: any) => {
      const somaEstrutura = (estrutura.itens || []).reduce((accItem: number, it: any) => {
        const pontosItem =
          it?.pontos ??
          (String(it?.tipo || "").toUpperCase() === "TREINO"
            ? Number(it?.treinoProgramado?.pontuacao ?? 0)
            : 0);

        return accItem + Number(pontosItem ?? 0);
      }, 0);

      return accEstrutura + somaEstrutura;
    }, 0);

    return res.json({
      id: item.id,
      titulo: item.titulo,
      descricao: item.descricao,
      capaUrl: item.capaUrl ?? null,
      publicoAlvo: item.publicoAlvo,
      totalAssinantes: item._count?.assinantes ?? 0,
      mediaAvaliacao: (item as any).mediaAvaliacao ?? 0,
      totalReviews: (item as any).totalReviews ?? 0,
      pontosTotal,
      criadorNome: item.criadorUsuario?.nome ?? null,
      tipo: item.tipo,
      estruturaTipo: item.estruturaTipo,
      area: item.area ?? null,
      geraBadge: !!item.geraBadge,
      geraCertificado: !!item.geraCertificado,
      precoAssinaturaMensal: item.precoAssinaturaMensal ?? null,
      estruturas,
      viewer: {
        isAssinante: hasAccess,
        temAcesso: acessoFinal,
        assinaturaTipo: hasAccess
          ? "AVULSA"
          : isAdmin
            ? "AVULSA"
            : null,
        expiraEm: assinatura?.expiraEm
          ? new Date(assinatura.expiraEm).toISOString()
          : null,
        podeAssinarAgora: !isAdmin && !hasAccess,
        motivoBloqueio: isAdmin
          ? null
          : hasAccess
            ? null
            : "PRECISA_PAGAR_AVULSA",
        podeAvaliar:
          !!userId &&
          acessoFinal &&
          !minhaAvaliacao &&
          (isAdmin || !!assinatura?.concluiuEm),
        minhaAvaliacao: minhaAvaliacao
          ? {
              nota: minhaAvaliacao.nota,
              comentario: minhaAvaliacao.comentario,
              updatedAt: minhaAvaliacao.updatedAt.toISOString(),
              sentimento: minhaAvaliacao.sentimento,
            }
          : null,
        progresso: {
          concluidos: concluidosIds,
        },
        status: assinatura?.status ?? null,
        concluiuEm: assinatura?.concluiuEm
          ? new Date(assinatura.concluiuEm).toISOString()
          : null,
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao buscar metodologia avulsa.",
      detail: e?.message,
    });
  }
}

export async function updateMetodologiaAvulsa(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { id } = req.params;
    const {
      titulo,
      descricao,
      capaUrl,
      publicoAlvo,
      tipo,
      estruturaTipo,
      area,
      geraBadge,
      geraCertificado,
      precoAssinaturaMensal,
      estruturas,
    } = req.body || {};

    const atual = await prisma.metodologiaAvulsa.findUnique({
      where: { id },
      include: {
        estruturas: {
          include: {
            itens: true,
          },
        },
      },
    });

    if (!atual) {
      return res.status(404).json({ message: "Metodologia avulsa não encontrada." });
    }

    if (atual.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Você não tem permissão para alterar esta metodologia avulsa." });
    }

    if (titulo && typeof titulo === "string") {
      const tituloTrim = titulo.trim();

      const duplicada = await prisma.metodologiaAvulsa.findFirst({
        where: {
          id: { not: id },
          titulo: {
            equals: tituloTrim,
            mode: "insensitive",
          },
          criadorUsuarioId: userId,
        },
        select: { id: true },
      });

      if (duplicada) {
        return res.status(400).json({
          message: `Você já possui uma metodologia avulsa com o nome "${tituloTrim}". Escolha outro nome.`,
        });
      }
    }

    const preco =
      precoAssinaturaMensal !== undefined
        ? Number(precoAssinaturaMensal)
        : atual.precoAssinaturaMensal;

    if (!Number.isFinite(Number(preco)) || Number(preco) <= 0) {
      return res.status(400).json({ message: "Preço mensal inválido." });
    }

    await prisma.$transaction(async (tx) => {
      await tx.metodologiaAvulsa.update({
        where: { id },
        data: {
          titulo: typeof titulo === "string" ? titulo.trim() : atual.titulo,
          descricao: descricao !== undefined ? asNullableString(descricao) : atual.descricao,
          capaUrl: capaUrl !== undefined ? asNullableString(capaUrl) : atual.capaUrl,
          publicoAlvo: publicoAlvo ?? atual.publicoAlvo,
          tipo: tipo ?? atual.tipo,
          estruturaTipo: estruturaTipo ?? atual.estruturaTipo,
          area: area !== undefined ? area : atual.area,
          geraBadge: geraBadge !== undefined ? asBool(geraBadge, false) : atual.geraBadge,
          geraCertificado:
            geraCertificado !== undefined ? asBool(geraCertificado, false) : atual.geraCertificado,
          precoAssinaturaMensal: Number(preco),
          ativo: false,
        },
      });

      if (Array.isArray(estruturas)) {
        const idsEstruturasExistentes = atual.estruturas.map((e) => e.id);
        const idsEstruturasPayload = estruturas.map((e: any) => e.id).filter(Boolean);

        const estruturasRemover = idsEstruturasExistentes.filter(
          (oldId) => !idsEstruturasPayload.includes(oldId)
        );

        if (estruturasRemover.length) {
          await tx.metodologiaAvulsaEstrutura.deleteMany({
            where: {
              id: { in: estruturasRemover },
              metodologiaAvulsaId: id,
            },
          });
        }

        for (let i = 0; i < estruturas.length; i++) {
          const estrutura = estruturas[i];

          let estruturaId = estrutura?.id;

          if (estruturaId) {
            await tx.metodologiaAvulsaEstrutura.update({
              where: { id: estruturaId },
              data: {
                titulo: String(estrutura?.titulo ?? "").trim(),
                descricao: asNullableString(estrutura?.descricao),
                objetivo: asNullableString(estrutura?.objetivo),
                tipo: estruturaTipo ?? atual.estruturaTipo,
                ordem: Number(estrutura?.ordem ?? i + 1),
                duracaoSemanas: asNullableNumber(estrutura?.duracaoSemanas),
                treinosPorSemana: asNullableNumber(estrutura?.treinosPorSemana),
                quantidadeMinConclusao: asNullableNumber(estrutura?.quantidadeMinConclusao),
                modoExecucao: estrutura?.modoExecucao ?? null,
                pontosPorItem: (estruturaTipo ?? atual.estruturaTipo) === "TRILHA" ? 5 : null,
                bonusConsistencia: (estruturaTipo ?? atual.estruturaTipo) === "TRILHA" ? 10 : null,
                bonusFinal: (estruturaTipo ?? atual.estruturaTipo) === "TRILHA" ? 15 : null,
                prazoInicio: estrutura?.prazoInicio ? new Date(estrutura.prazoInicio) : null,
                prazoFinal: estrutura?.prazoFinal ? new Date(estrutura.prazoFinal) : null,
                percentualPerdaAtraso: asNullableNumber(estrutura?.percentualPerdaAtraso),
                permiteAtraso: asBool(estrutura?.permiteAtraso, true),
                ativo: asBool(estrutura?.ativo, true),
              },
            });
          } else {
            const novaEstrutura = await tx.metodologiaAvulsaEstrutura.create({
              data: {
                metodologiaAvulsaId: id,
                titulo: String(estrutura?.titulo ?? "").trim(),
                descricao: asNullableString(estrutura?.descricao),
                objetivo: asNullableString(estrutura?.objetivo),
                tipo: estruturaTipo ?? atual.estruturaTipo,
                ordem: Number(estrutura?.ordem ?? i + 1),
                duracaoSemanas: asNullableNumber(estrutura?.duracaoSemanas),
                treinosPorSemana: asNullableNumber(estrutura?.treinosPorSemana),
                quantidadeMinConclusao: asNullableNumber(estrutura?.quantidadeMinConclusao),
                modoExecucao: estrutura?.modoExecucao ?? null,
                pontosPorItem: (estruturaTipo ?? atual.estruturaTipo) === "TRILHA" ? 5 : null,
                bonusConsistencia: (estruturaTipo ?? atual.estruturaTipo) === "TRILHA" ? 10 : null,
                bonusFinal: (estruturaTipo ?? atual.estruturaTipo) === "TRILHA" ? 15 : null,
                prazoInicio: estrutura?.prazoInicio ? new Date(estrutura.prazoInicio) : null,
                prazoFinal: estrutura?.prazoFinal ? new Date(estrutura.prazoFinal) : null,
                percentualPerdaAtraso: asNullableNumber(estrutura?.percentualPerdaAtraso),
                permiteAtraso: asBool(estrutura?.permiteAtraso, true),
                ativo: asBool(estrutura?.ativo, true),
              },
            });

            estruturaId = novaEstrutura.id;
          }

          const itensExistentes = await tx.metodologiaAvulsaEstruturaItem.findMany({
            where: { estruturaId },
            select: { id: true },
          });

          const idsItensExistentes = itensExistentes.map((it) => it.id);
          const idsItensPayload = (Array.isArray(estrutura?.itens) ? estrutura.itens : [])
            .map((it: any) => it.id)
            .filter(Boolean);

          const itensRemover = idsItensExistentes.filter(
            (oldId) => !idsItensPayload.includes(oldId)
          );

          if (itensRemover.length) {
            await tx.metodologiaAvulsaEstruturaItem.deleteMany({
              where: {
                id: { in: itensRemover },
                estruturaId,
              },
            });
          }

          const itensPayload = Array.isArray(estrutura?.itens) ? estrutura.itens : [];

          for (let j = 0; j < itensPayload.length; j++) {
            const item = itensPayload[j];
            const tipoItem = item?.tipo as MetodologiaItemTipo;
            const treinoProgramadoId = asNullableString(item?.treinoProgramadoId);

            let treinoPontuacao: number | null = null;

            if (treinoProgramadoId) {
              const treino = await tx.treinoProgramado.findUnique({
                where: { id: treinoProgramadoId },
                select: { id: true, pontuacao: true },
              });

              if (!treino) {
                throw new Error(`Treino não encontrado para o item "${item?.titulo ?? ""}".`);
              }

              treinoPontuacao = treino.pontuacao ?? 0;
            }

            const duracaoMinFinal =
              tipoItem === MetodologiaItemTipo.VIDEO || tipoItem === MetodologiaItemTipo.AULA
                ? asNullableNumber(item?.duracaoMin)
                : null;

            const pontosFinais = calcularPontuacaoItemBackend({
              tipo: tipoItem,
              duracaoMin: duracaoMinFinal,
              treinoPontuacao,
            });

            let itemSalvo: any;

            if (item?.id) {
              itemSalvo = await tx.metodologiaAvulsaEstruturaItem.update({
                where: { id: item.id },
                data: {
                  tipo: tipoItem,
                  titulo: String(item?.titulo ?? "").trim(),
                  descricao: asNullableString(item?.descricao),
                  ordem: Number(item?.ordem ?? j + 1),
                  videoUrl:
                    tipoItem === MetodologiaItemTipo.AULA_AO_VIVO
                      ? null
                      : asNullableString(item?.videoUrl),
                  thumbUrl: asNullableString(item?.thumbUrl),
                  arquivoUrl: asNullableString(item?.arquivoUrl),
                  materialUrl: asNullableString(item?.materialUrl),
                  treinoProgramadoId,
                  pontos: pontosFinais,
                  duracaoMin: duracaoMinFinal,
                  obrigatorio: asBool(item?.obrigatorio, true),
                  publicado: asBool(item?.publicado, true),
                },
              });
            } else {
              itemSalvo = await tx.metodologiaAvulsaEstruturaItem.create({
                data: {
                  estruturaId,
                  tipo: tipoItem,
                  titulo: String(item?.titulo ?? "").trim(),
                  descricao: asNullableString(item?.descricao),
                  ordem: Number(item?.ordem ?? j + 1),
                  videoUrl:
                    tipoItem === MetodologiaItemTipo.AULA_AO_VIVO
                      ? null
                      : asNullableString(item?.videoUrl),
                  thumbUrl: asNullableString(item?.thumbUrl),
                  arquivoUrl: asNullableString(item?.arquivoUrl),
                  materialUrl: asNullableString(item?.materialUrl),
                  treinoProgramadoId,
                  pontos: pontosFinais,
                  duracaoMin: duracaoMinFinal,
                  obrigatorio: asBool(item?.obrigatorio, true),
                  publicado: asBool(item?.publicado, true),
                },
              });
            }

            if (tipoItem === MetodologiaItemTipo.AULA_AO_VIVO) {
              await upsertAulaAoVivoParaItem({
                tx,
                userId,
                itemPayload: item,
                itemCriadoId: itemSalvo.id,
                tituloItem: String(item?.titulo ?? "").trim(),
                descricaoItem: asNullableString(item?.descricao),
                duracaoMin: duracaoMinFinal,
                thumbUrl: asNullableString(item?.thumbUrl),
                metodologiaAvulsaId: id,
                estruturaAvulsaId: estruturaId,
              });
            }
          }
        }
      }
    });

    const atualizado = await prisma.metodologiaAvulsa.findUnique({
      where: { id },
      include: {
        criadorUsuario: {
          select: { id: true, nome: true, foto: true, parceiro: true },
        },
        estruturas: {
          orderBy: { ordem: "asc" },
          include: {
            itens: {
              orderBy: { ordem: "asc" },
              include: {
                treinoProgramado: {
                  select: {
                    id: true,
                    nome: true,
                    codigo: true,
                    imagemUrl: true,
                    nivel: true,
                    categoria: true,
                    pontuacao: true,
                    duracao: true,
                    objetivo: true,
                    tipoTreino: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return res.json({ item: atualizado });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao atualizar metodologia avulsa.",
      detail: e?.message,
    });
  }
}

export async function deleteMetodologiaAvulsa(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { id } = req.params;

    const metodologia = await prisma.metodologiaAvulsa.findUnique({
      where: { id },
      include: {
        estruturas: {
          include: {
            itens: true,
          },
        },
      },
    });

    if (!metodologia) {
      return res.status(404).json({ message: "Metodologia avulsa não encontrada." });
    }

    if (metodologia.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Sem permissão para deletar." });
    }

    await prisma.metodologiaAvulsa.delete({
      where: { id },
    });

    if (metodologia.capaUrl && metodologia.capaUrl.includes("amazonaws.com")) {
      await deleteFromS3(metodologia.capaUrl);
    }

    for (const estrutura of metodologia.estruturas) {
      for (const item of estrutura.itens) {
        const urls = [item.videoUrl, item.arquivoUrl, item.materialUrl, item.thumbUrl].filter(Boolean);
        for (const url of urls) {
          if (String(url).includes("amazonaws.com")) {
            await deleteFromS3(String(url));
          }
        }
      }
    }

    return res.json({ ok: true, message: "Metodologia avulsa removida com sucesso." });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao deletar metodologia avulsa.",
      detail: e?.message,
    });
  }
}

export async function migrarMetodologiaParaAvulsa(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { id } = req.params;

    const atual = await prisma.metodologia.findUnique({
      where: { id },
      include: {
        estruturas: {
          orderBy: { ordem: "asc" },
          include: {
            itens: {
              orderBy: { ordem: "asc" },
            },
          },
        },
      },
    });

    if (!atual) {
      return res.status(404).json({ message: "Metodologia não encontrada." });
    }

    if (atual.criadorUsuarioId !== userId) {
      return res.status(403).json({
        message: "Sem permissão para migrar esta metodologia.",
      });
    }

    const preco = Number(req.body?.precoAssinaturaMensal);
    if (!Number.isFinite(preco) || preco <= 0) {
      return res.status(400).json({
        message: "Preço mensal inválido para metodologia avulsa.",
      });
    }

    const estruturasFonte =
      Array.isArray(req.body?.estruturas) && req.body.estruturas.length
        ? req.body.estruturas
        : atual.estruturas;

    const item = await prisma.$transaction(async (tx) => {
      const estruturasProcessadas = await Promise.all(
        estruturasFonte.map(async (estrutura: any, i: number) => {
          const itensFonte = Array.isArray(estrutura?.itens) ? estrutura.itens : [];

          const itensProcessados = await Promise.all(
            itensFonte.map(async (it: any, j: number) => {
              const tipoItem = it?.tipo as MetodologiaItemTipo;
              const treinoProgramadoId = asNullableString(it?.treinoProgramadoId);
              const duracaoMinFinal =
                tipoItem === MetodologiaItemTipo.VIDEO || tipoItem === MetodologiaItemTipo.AULA
                  ? asNullableNumber(it?.duracaoMin)
                  : null;

              let treinoPontuacao: number | null = null;

              if (treinoProgramadoId) {
                const treino = await tx.treinoProgramado.findUnique({
                  where: { id: treinoProgramadoId },
                  select: { pontuacao: true },
                });

                if (!treino) {
                  throw new Error(`Treino não encontrado para o item "${it?.titulo ?? ""}".`);
                }

                treinoPontuacao = treino.pontuacao ?? 0;
              }

              const pontosFinais = calcularPontuacaoItemBackend({
                tipo: tipoItem,
                duracaoMin: duracaoMinFinal,
                treinoPontuacao,
              });

              return {
                ordem: Number(it?.ordem ?? j + 1),
                titulo: String(it?.titulo ?? "").trim(),
                descricao: asNullableString(it?.descricao),
                tipo: tipoItem,
                videoUrl: asNullableString(it?.videoUrl),
                thumbUrl: asNullableString(it?.thumbUrl),
                arquivoUrl: asNullableString(it?.arquivoUrl),
                materialUrl: asNullableString(it?.materialUrl),
                duracaoMin: duracaoMinFinal,
                treinoProgramadoId,
                pontos: pontosFinais,
                obrigatorio: asBool(it?.obrigatorio, true),
                publicado: asBool(it?.publicado, true),
              };
            })
          );

          return {
            tipo: (estrutura?.tipo ?? req.body?.estruturaTipo ?? atual.estruturaTipo) as MetodologiaEstruturaTipo,
            titulo: String(estrutura?.titulo ?? "").trim(),
            descricao: asNullableString(estrutura?.descricao),
            objetivo: asNullableString(estrutura?.objetivo),
            ordem: Number(estrutura?.ordem ?? i + 1),
            duracaoSemanas: asNullableNumber(estrutura?.duracaoSemanas),
            treinosPorSemana: asNullableNumber(estrutura?.treinosPorSemana),
            quantidadeMinConclusao: asNullableNumber(estrutura?.quantidadeMinConclusao),
            modoExecucao: estrutura?.modoExecucao ?? null,
            pontosPorItem: asNullableNumber(estrutura?.pontosPorItem),
            bonusConsistencia: asNullableNumber(estrutura?.bonusConsistencia),
            bonusFinal: asNullableNumber(estrutura?.bonusFinal),
            permiteAtraso: asBool(estrutura?.permiteAtraso, true),
            prazoInicio: estrutura?.prazoInicio ? new Date(estrutura.prazoInicio) : null,
            prazoFinal: estrutura?.prazoFinal ? new Date(estrutura.prazoFinal) : null,
            percentualPerdaAtraso: asNullableNumber(estrutura?.percentualPerdaAtraso),
            ativo: asBool(estrutura?.ativo, true),
            itens: {
              create: itensProcessados,
            },
          };
        })
      );

      const criada = await tx.metodologiaAvulsa.create({
        data: {
          titulo: req.body?.titulo?.trim?.() || atual.titulo,
          descricao: asNullableString(req.body?.descricao ?? atual.descricao),
          capaUrl: asNullableString(req.body?.capaUrl ?? atual.capaUrl),
          publicoAlvo: req.body?.publicoAlvo ?? atual.publicoAlvo,
          tipo: req.body?.tipo ?? atual.tipo,
          estruturaTipo: req.body?.estruturaTipo ?? atual.estruturaTipo,
          area: req.body?.area ?? atual.area,
          geraBadge: req.body?.geraBadge ?? atual.geraBadge,
          geraCertificado: req.body?.geraCertificado ?? atual.geraCertificado,
          precoAssinaturaMensal: preco,
          criadorUsuarioId: atual.criadorUsuarioId,
          professorId: atual.professorId,
          clubeId: atual.clubeId,
          escolinhaId: atual.escolinhaId,
          ativo: false,
          estruturas: {
            create: estruturasProcessadas,
          },
        },
        include: {
          criadorUsuario: {
            select: { id: true, nome: true, foto: true, parceiro: true },
          },
          estruturas: {
            orderBy: { ordem: "asc" },
            include: {
              itens: {
                orderBy: { ordem: "asc" },
                include: {
                  treinoProgramado: {
                    select: {
                      id: true,
                      nome: true,
                      codigo: true,
                      imagemUrl: true,
                      nivel: true,
                      categoria: true,
                      pontuacao: true,
                      duracao: true,
                      objetivo: true,
                      tipoTreino: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      await tx.metodologia.delete({
        where: { id },
      });

      return criada;
    });

    return res.json({ item });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao migrar metodologia para avulsa.",
      detail: e?.message,
    });
  }
}

export async function migrarMetodologiaAvulsaParaLearning(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { id } = req.params;

    const atual = await prisma.metodologiaAvulsa.findUnique({
      where: { id },
      include: {
        estruturas: {
          orderBy: { ordem: "asc" },
          include: {
            itens: {
              orderBy: { ordem: "asc" },
            },
          },
        },
      },
    });

    if (!atual) {
      return res.status(404).json({ message: "Metodologia avulsa não encontrada." });
    }

    if (atual.criadorUsuarioId !== userId) {
      return res.status(403).json({
        message: "Sem permissão para migrar esta metodologia avulsa.",
      });
    }

    const estruturasFonte =
      Array.isArray(req.body?.estruturas) && req.body.estruturas.length
        ? req.body.estruturas
        : atual.estruturas;

    const item = await prisma.$transaction(async (tx) => {
      const estruturasProcessadas = await Promise.all(
        estruturasFonte.map(async (estrutura: any, i: number) => {
          const itensFonte = Array.isArray(estrutura?.itens) ? estrutura.itens : [];

          const itensProcessados = await Promise.all(
            itensFonte.map(async (it: any, j: number) => {
              const tipoItem = it?.tipo as MetodologiaItemTipo;
              const treinoProgramadoId = asNullableString(it?.treinoProgramadoId);
              const duracaoMinFinal =
                tipoItem === MetodologiaItemTipo.VIDEO || tipoItem === MetodologiaItemTipo.AULA
                  ? asNullableNumber(it?.duracaoMin)
                  : null;

              let treinoPontuacao: number | null = null;

              if (treinoProgramadoId) {
                const treino = await tx.treinoProgramado.findUnique({
                  where: { id: treinoProgramadoId },
                  select: { pontuacao: true },
                });

                if (!treino) {
                  throw new Error(`Treino não encontrado para o item "${it?.titulo ?? ""}".`);
                }

                treinoPontuacao = treino.pontuacao ?? 0;
              }

              const pontosFinais = calcularPontuacaoItemBackend({
                tipo: tipoItem,
                duracaoMin: duracaoMinFinal,
                treinoPontuacao,
              });

              return {
                ordem: Number(it?.ordem ?? j + 1),
                titulo: String(it?.titulo ?? "").trim(),
                descricao: asNullableString(it?.descricao),
                tipo: tipoItem,
                videoUrl: asNullableString(it?.videoUrl),
                thumbUrl: asNullableString(it?.thumbUrl),
                arquivoUrl: asNullableString(it?.arquivoUrl),
                materialUrl: asNullableString(it?.materialUrl),
                duracaoMin: duracaoMinFinal,
                treinoProgramadoId,
                pontos: pontosFinais,
                obrigatorio: asBool(it?.obrigatorio, true),
                publicado: asBool(it?.publicado, true),
              };
            })
          );

          return {
            tipo: (estrutura?.tipo ?? req.body?.estruturaTipo ?? atual.estruturaTipo) as MetodologiaEstruturaTipo,
            titulo: String(estrutura?.titulo ?? "").trim(),
            descricao: asNullableString(estrutura?.descricao),
            objetivo: asNullableString(estrutura?.objetivo),
            ordem: Number(estrutura?.ordem ?? i + 1),
            duracaoSemanas: asNullableNumber(estrutura?.duracaoSemanas),
            treinosPorSemana: asNullableNumber(estrutura?.treinosPorSemana),
            quantidadeMinConclusao: asNullableNumber(estrutura?.quantidadeMinConclusao),
            modoExecucao: estrutura?.modoExecucao ?? null,
            pontosPorItem: asNullableNumber(estrutura?.pontosPorItem),
            bonusConsistencia: asNullableNumber(estrutura?.bonusConsistencia),
            bonusFinal: asNullableNumber(estrutura?.bonusFinal),
            permiteAtraso: asBool(estrutura?.permiteAtraso, true),
            prazoInicio: estrutura?.prazoInicio ? new Date(estrutura.prazoInicio) : null,
            prazoFinal: estrutura?.prazoFinal ? new Date(estrutura.prazoFinal) : null,
            percentualPerdaAtraso: asNullableNumber(estrutura?.percentualPerdaAtraso),
            ativo: asBool(estrutura?.ativo, true),
            itens: {
              create: itensProcessados,
            },
          };
        })
      );

      const criada = await tx.metodologia.create({
        data: {
          titulo: req.body?.titulo?.trim?.() || atual.titulo,
          descricao: asNullableString(req.body?.descricao ?? atual.descricao),
          capaUrl: asNullableString(req.body?.capaUrl ?? atual.capaUrl),
          publicoAlvo: req.body?.publicoAlvo ?? atual.publicoAlvo,
          tipo: req.body?.tipo ?? atual.tipo,
          estruturaTipo: req.body?.estruturaTipo ?? atual.estruturaTipo,
          area: req.body?.area ?? atual.area,
          geraBadge: req.body?.geraBadge ?? atual.geraBadge,
          geraCertificado: req.body?.geraCertificado ?? atual.geraCertificado,
          criadorUsuarioId: atual.criadorUsuarioId,
          professorId: atual.professorId,
          clubeId: atual.clubeId,
          escolinhaId: atual.escolinhaId,
          ativo: false,
          estruturas: {
            create: estruturasProcessadas,
          },
        },
        include: {
          criadorUsuario: {
            select: { id: true, nome: true, foto: true, parceiro: true },
          },
          estruturas: {
            orderBy: { ordem: "asc" },
            include: {
              itens: {
                orderBy: { ordem: "asc" },
                include: {
                  treinoProgramado: {
                    select: {
                      id: true,
                      nome: true,
                      codigo: true,
                      imagemUrl: true,
                      nivel: true,
                      categoria: true,
                      pontuacao: true,
                      duracao: true,
                      objetivo: true,
                      tipoTreino: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      await tx.metodologiaAvulsa.delete({
        where: { id },
      });

      return criada;
    });

    return res.json({ item });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao migrar metodologia avulsa para Learning.",
      detail: e?.message,
    });
  }
}

export async function listTodasMetodologiasAdmin(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const isAdmin = await isAdminUser(userId);
    if (!isAdmin) return res.status(403).json({ message: "Apenas admin pode acessar esta listagem." });

    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Math.min(50, Number(req.query.pageSize || 10)));
    const q = String(req.query.q || "").trim();

    const whereLearning = q
      ? {
          OR: [
            { titulo: { contains: q, mode: "insensitive" as const } },
            { descricao: { contains: q, mode: "insensitive" as const } },
            { criadorUsuario: { is: { nome: { contains: q, mode: "insensitive" as const } } } },
            { criadorUsuario: { is: { email: { contains: q, mode: "insensitive" as const } } } },
          ],
        }
      : {};

    const whereAvulsa = q
      ? {
          OR: [
            { titulo: { contains: q, mode: "insensitive" as const } },
            { descricao: { contains: q, mode: "insensitive" as const } },
            { criadorUsuario: { is: { nome: { contains: q, mode: "insensitive" as const } } } },
            { criadorUsuario: { is: { email: { contains: q, mode: "insensitive" as const } } } },
          ],
        }
      : {};

    const [learning, avulsas] = await Promise.all([
      prisma.metodologia.findMany({
        where: whereLearning as any,
        include: {
          criadorUsuario: { select: { id: true, nome: true, email: true, foto: true, parceiro: true } },
          _count: { select: { assinantes: true, estruturas: true } },
        },
        orderBy: { criadoEm: "desc" },
      }),
      prisma.metodologiaAvulsa.findMany({
        where: whereAvulsa as any,
        include: {
          criadorUsuario: { select: { id: true, nome: true, email: true, foto: true, parceiro: true } },
          _count: { select: { assinantes: true, estruturas: true } },
          estruturas: {
            include: {
              itens: true,
            },
          },
        },
        orderBy: { criadoEm: "desc" },
      }),
    ]);

    const learningIds = learning.map((m) => m.id);
    const learningCountsById = await anexarCountsEstruturaPorMetodologia(learningIds);

    const items = [
      ...learning.map((m) => ({
        ...m,
        origemTipo: "LEARNING",
        videoCount: learningCountsById[m.id]?.videoCount ?? 0,
        aulaCount: learningCountsById[m.id]?.aulaCount ?? 0,
        treinoCount: learningCountsById[m.id]?.treinoCount ?? 0,
        materialCount: learningCountsById[m.id]?.materialCount ?? 0,
        desafioCount: learningCountsById[m.id]?.desafioCount ?? 0,
        estruturaCount: learningCountsById[m.id]?.estruturaCount ?? 0,
      })),
      ...avulsas.map((m) => {
        const itens = (m.estruturas || []).flatMap((e: any) => e.itens || []);
        return {
          ...m,
          origemTipo: "AVULSA",
          videoCount: itens.filter((it: any) => it.tipo === "VIDEO").length,
          aulaCount: itens.filter((it: any) => it.tipo === "AULA").length,
          treinoCount: itens.filter((it: any) => it.tipo === "TREINO").length,
          materialCount: itens.filter((it: any) => it.tipo === "MATERIAL").length,
          desafioCount: itens.filter((it: any) => it.tipo === "DESAFIO").length,
          estruturaCount: (m.estruturas || []).length,
          _count: {
            ...(m as any)._count,
            estruturas: (m.estruturas || []).length,
          },
        };
      })
    ]
      .sort((a, b) => {
        const da = new Date(a.criadoEm || 0).getTime();
        const db = new Date(b.criadoEm || 0).getTime();
        return db - da;
      });

    const total = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);

    return res.json({
      items: paged,
      total,
      page,
      pageSize,
    });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao listar todas as metodologias do admin.",
      detail: e?.message,
    });
  }
}

export async function criarSubmissaoMetodologiaItem(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const isAdmin = await isAdminUser(userId);

    const { id: metodologiaId, estruturaId } = req.params;
    const itemId = String(req.body?.itemId ?? "").trim();
    const observacao = asNullableString(req.body?.observacao);
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!itemId) {
      return res.status(400).json({ message: "itemId é obrigatório." });
    }

    const itemAvulsa = await prisma.metodologiaAvulsaEstruturaItem.findFirst({
      where: {
        id: itemId,
        estruturaId,
        estrutura: {
          metodologiaAvulsaId: metodologiaId,
        },
      },
      include: {
        estrutura: {
          select: {
            id: true,
            metodologiaAvulsaId: true,
            titulo: true,
            pontosPorItem: true,
            modoExecucao: true,
            prazoFinal: true,
            percentualPerdaAtraso: true,
          },
        },
        treinoProgramado: {
          select: {
            pontuacao: true,
          },
        },
      },
    });

    const itemLearning = !itemAvulsa
      ? await prisma.metodologiaEstruturaItem.findFirst({
          where: {
            id: itemId,
            estruturaId,
            estrutura: {
              metodologiaId,
            },
          },
          include: {
            estrutura: {
              select: {
                id: true,
                metodologiaId: true,
                titulo: true,
                pontosPorItem: true,
                modoExecucao: true,
                prazoFinal: true,
                percentualPerdaAtraso: true,
              },
            },
            treinoProgramado: {
              select: {
                pontuacao: true,
              },
            },
          },
        })
      : null;

    const isAvulsa = !!itemAvulsa;
    const item = itemAvulsa ?? itemLearning;

    if (!item) {
      return res.status(404).json({
        message: "Item da estrutura não encontrado nesta metodologia.",
      });
    }

    let assinatura = isAvulsa
      ? await prisma.metodologiaAssinante.findFirst({
          where: {
            usuarioId: userId,
            metodologiaAvulsaId: metodologiaId,
          },
          select: {
            id: true,
            status: true,
            expiraEm: true,
            progresso: true,
            concluiuEm: true,
            iniciouEm: true,
          },
        })
      : await prisma.metodologiaAssinante.findUnique({
          where: {
            metodologiaId_usuarioId: {
              metodologiaId,
              usuarioId: userId,
            },
          },
          select: {
            id: true,
            status: true,
            expiraEm: true,
            progresso: true,
            concluiuEm: true,
            iniciouEm: true,
          },
        });

    if (!assinatura && isAdmin) {
      if (isAvulsa) {
        const existeAvulsa = await prisma.metodologiaAvulsa.findUnique({
          where: { id: metodologiaId },
          select: { id: true },
        });

        if (!existeAvulsa) {
          return res.status(404).json({
            message: "Metodologia avulsa não encontrada para criar assinatura do admin.",
          });
        }

        assinatura = await prisma.metodologiaAssinante.create({
          data: {
            usuarioId: userId,
            metodologiaAvulsaId: metodologiaId,
            origem: MetodologiaAssinaturaOrigem.AVULSA,
            status: MetodologiaAssinaturaStatus.ATIVA,
            iniciouEm: new Date(),
            progresso: {
              concluidos: [],
              pontosGanhos: 0,
              atualizadoEm: new Date().toISOString(),
            } as any,
          },
          select: {
            id: true,
            status: true,
            expiraEm: true,
            progresso: true,
            concluiuEm: true,
            iniciouEm: true,
          },
        });
      } else {
        const existeLearning = await prisma.metodologia.findUnique({
          where: { id: metodologiaId },
          select: { id: true },
        });

        if (!existeLearning) {
          return res.status(404).json({
            message: "Metodologia não encontrada para criar assinatura do admin.",
          });
        }

        assinatura = await prisma.metodologiaAssinante.create({
          data: {
            usuarioId: userId,
            metodologiaId,
            origem: MetodologiaAssinaturaOrigem.LEARNING,
            status: MetodologiaAssinaturaStatus.ATIVA,
            iniciouEm: new Date(),
            progresso: {
              concluidos: [],
              pontosGanhos: 0,
              atualizadoEm: new Date().toISOString(),
            } as any,
          },
          select: {
            id: true,
            status: true,
            expiraEm: true,
            progresso: true,
            concluiuEm: true,
            iniciouEm: true,
          },
        });
      }
    }

    const temAcesso = assinaturaDaAcesso(assinatura) || isAdmin;

    if (!temAcesso) {
      return res.status(403).json({
        message: "Você não possui acesso a esta metodologia.",
      });
    }

    if (!isAdmin && assinatura?.status === MetodologiaAssinaturaStatus.CANCELADA) {
      return res.status(403).json({
        message: "Você não possui acesso a esta metodologia.",
      });
    }

    if (!isAdmin && assinatura?.expiraEm && new Date(assinatura.expiraEm) <= new Date()) {
      return res.status(403).json({
        message: "Sua assinatura desta metodologia expirou.",
      });
    }

    const tipo = String(item.tipo || "").toUpperCase();
    if (tipo !== "TREINO" && tipo !== "DESAFIO") {
      return res.status(400).json({
        message: "Somente itens de treino ou desafio aceitam submissão.",
      });
    }

    const arquivoUrl =
      (file as any)?.location ||
      (file as any)?.key ||
      (file as any)?.url ||
      (file?.filename ? `/uploads/${file.filename}` : null);

    if (!arquivoUrl) {
      return res.status(400).json({ message: "Envie um arquivo." });
    }

    await (prisma as any).metodologiaItemSubmissao.create({
      data: isAvulsa
        ? {
            metodologiaId: null,
            metodologiaAvulsaId: metodologiaId,
            estruturaId: null,
            estruturaAvulsaId: estruturaId,
            itemId: null,
            itemAvulsaId: itemId,
            usuarioId: userId,
            tipoItem: tipo,
            observacao,
            arquivoUrl,
            mimeType: file?.mimetype || null,
            status: "ENVIADA",
          }
        : {
            metodologiaId,
            metodologiaAvulsaId: null,
            estruturaId,
            estruturaAvulsaId: null,
            itemId,
            itemAvulsaId: null,
            usuarioId: userId,
            tipoItem: tipo,
            observacao,
            arquivoUrl,
            mimeType: file?.mimetype || null,
            status: "ENVIADA",
          },
    });

    const assinaturaCompleta = await prisma.metodologiaAssinante.findUnique({
      where: { id: assinatura!.id },
      select: {
        id: true,
        progresso: true,
        status: true,
        concluiuEm: true,
      },
    });

    if (!assinaturaCompleta) {
      return res.status(404).json({
        message: "Assinatura da metodologia não encontrada.",
      });
    }

    const pontosItem = calcularPontuacaoItemBackend({
      tipo: item.tipo as MetodologiaItemTipo,
      duracaoMin: (item as any).duracaoMin ?? null,
      treinoPontuacao: item.treinoProgramado?.pontuacao ?? null,
    });

    const itensPublicados = isAvulsa
      ? await prisma.metodologiaAvulsaEstruturaItem.count({
          where: {
            estruturaId,
            publicado: true,
          },
        })
      : await prisma.metodologiaEstruturaItem.count({
          where: {
            estruturaId,
            publicado: true,
          },
        });

    const progressoAssinaturaAtual: any =
      assinaturaCompleta.progresso && typeof assinaturaCompleta.progresso === "object"
        ? { ...(assinaturaCompleta.progresso as any) }
        : {};

    const concluidosAssinatura: string[] = Array.isArray(progressoAssinaturaAtual.concluidos)
      ? progressoAssinaturaAtual.concluidos.map((v: any) => String(v))
      : [];

    const jaTinhaNaAssinatura = concluidosAssinatura.includes(itemId);

    if (!jaTinhaNaAssinatura) {
      concluidosAssinatura.push(itemId);
    }

    progressoAssinaturaAtual.concluidos = concluidosAssinatura;
    progressoAssinaturaAtual.ultimoItemConcluidoId = itemId;
    progressoAssinaturaAtual.atualizadoEm = new Date().toISOString();

    if (!isAvulsa) {
      const progressoEstruturaAtual = await prisma.metodologiaProgressoEstrutura.findUnique({
        where: {
          metodologiaAssinanteId_estruturaId: {
            metodologiaAssinanteId: assinaturaCompleta.id,
            estruturaId,
          },
        },
        select: {
          progresso: true,
          pontosGanhos: true,
        },
      });

      const concluidosEstrutura: string[] = Array.isArray(
        (progressoEstruturaAtual as any)?.progresso?.concluidos
      )
        ? (progressoEstruturaAtual as any).progresso.concluidos.map((v: any) => String(v))
        : [];

      const jaTinhaNoProgressoEstrutura = concluidosEstrutura.includes(itemId);

      if (!jaTinhaNoProgressoEstrutura) {
        concluidosEstrutura.push(itemId);
      }

      const totalItensConcluidosEstrutura = concluidosEstrutura.length;
      const estruturaConcluida =
        itensPublicados > 0 && totalItensConcluidosEstrutura >= itensPublicados;

      const pontosGanhosAnteriores = Number(progressoEstruturaAtual?.pontosGanhos ?? 0);
      const pontosGanhos = jaTinhaNoProgressoEstrutura
        ? pontosGanhosAnteriores
        : pontosGanhosAnteriores + Number(pontosItem || 0);

      await prisma.metodologiaProgressoEstrutura.upsert({
        where: {
          metodologiaAssinanteId_estruturaId: {
            metodologiaAssinanteId: assinaturaCompleta.id,
            estruturaId,
          },
        },
        create: {
          metodologiaAssinanteId: assinaturaCompleta.id,
          estruturaId,
          status: estruturaConcluida
            ? MetodologiaProgressoStatus.CONCLUIDA
            : MetodologiaProgressoStatus.EM_ANDAMENTO,
          iniciadoEm: new Date(),
          concluidoEm: estruturaConcluida ? new Date() : null,
          cicloInicioEm: new Date(),
          itensConcluidos: totalItensConcluidosEstrutura,
          pontosGanhos,
          ultimoAcessoEm: new Date(),
          progresso: {
            concluidos: concluidosEstrutura,
            ultimoItemConcluidoId: itemId,
            pontosGanhos,
          } as any,
        },
        update: {
          status: estruturaConcluida
            ? MetodologiaProgressoStatus.CONCLUIDA
            : MetodologiaProgressoStatus.EM_ANDAMENTO,
          concluidoEm: estruturaConcluida ? new Date() : null,
          itensConcluidos: totalItensConcluidosEstrutura,
          pontosGanhos,
          ultimoAcessoEm: new Date(),
          progresso: {
            concluidos: concluidosEstrutura,
            ultimoItemConcluidoId: itemId,
            pontosGanhos,
          } as any,
        },
      });

      progressoAssinaturaAtual.pontosGanhos =
        Number(progressoAssinaturaAtual.pontosGanhos ?? 0) +
        (!jaTinhaNaAssinatura ? Number(pontosItem || 0) : 0);

      await prisma.metodologiaAssinante.update({
        where: { id: assinaturaCompleta.id },
        data: {
          progresso: progressoAssinaturaAtual,
          pontosGanhos: Number(progressoAssinaturaAtual.pontosGanhos ?? 0),
        },
      });

      await recalcularStatusMetodologiaAssinante(metodologiaId, userId);
    } else {
      const estruturasMap =
        progressoAssinaturaAtual.estruturas &&
        typeof progressoAssinaturaAtual.estruturas === "object"
          ? { ...progressoAssinaturaAtual.estruturas }
          : {};

      const estruturaAtual =
        estruturasMap[estruturaId] && typeof estruturasMap[estruturaId] === "object"
          ? { ...estruturasMap[estruturaId] }
          : {};

      const concluidosEstrutura: string[] = Array.isArray(estruturaAtual.concluidos)
        ? estruturaAtual.concluidos.map((v: any) => String(v))
        : [];

      const jaTinhaNaEstrutura = concluidosEstrutura.includes(itemId);

      if (!jaTinhaNaEstrutura) {
        concluidosEstrutura.push(itemId);
      }

      const totalItensConcluidosEstrutura = concluidosEstrutura.length;
      const estruturaConcluida =
        itensPublicados > 0 && totalItensConcluidosEstrutura >= itensPublicados;

      estruturaAtual.concluidos = concluidosEstrutura;
      estruturaAtual.status = estruturaConcluida
        ? MetodologiaProgressoStatus.CONCLUIDA
        : MetodologiaProgressoStatus.EM_ANDAMENTO;
      estruturaAtual.itensConcluidos = totalItensConcluidosEstrutura;
      estruturaAtual.ultimoItemConcluidoId = itemId;
      estruturaAtual.ultimoAcessoEm = new Date().toISOString();

      if (!estruturaAtual.iniciadoEm) {
        estruturaAtual.iniciadoEm = new Date().toISOString();
      }

      if (estruturaConcluida && !estruturaAtual.concluidoEm) {
        estruturaAtual.concluidoEm = new Date().toISOString();
      }

      estruturasMap[estruturaId] = estruturaAtual;
      progressoAssinaturaAtual.estruturas = estruturasMap;
      progressoAssinaturaAtual.pontosGanhos =
        Number(progressoAssinaturaAtual.pontosGanhos ?? 0) +
        (!jaTinhaNaAssinatura ? Number(pontosItem || 0) : 0);

      const totalEstruturasConcluidas = Object.values(estruturasMap).filter(
        (e: any) => e?.status === MetodologiaProgressoStatus.CONCLUIDA
      ).length;

      progressoAssinaturaAtual.estruturasConcluidas = totalEstruturasConcluidas;

      const totalEstruturasAtivas = await prisma.metodologiaAvulsaEstrutura.count({
        where: {
          metodologiaAvulsaId: metodologiaId,
          ativo: true,
        },
      });

      const concluiuTudo =
        totalEstruturasAtivas > 0 && totalEstruturasConcluidas >= totalEstruturasAtivas;

      await prisma.metodologiaAssinante.update({
        where: { id: assinaturaCompleta.id },
        data: {
          progresso: progressoAssinaturaAtual,
          status: concluiuTudo
            ? MetodologiaAssinaturaStatus.CONCLUIDA
            : assinaturaCompleta.status,
          concluiuEm: concluiuTudo
            ? (assinaturaCompleta.concluiuEm ?? new Date())
            : assinaturaCompleta.concluiuEm,
        },
      });
    }

    return res.status(201).json({
      ok: true,
      message: "Submissão da metodologia criada com sucesso.",
      itemId,
      metodologiaId,
      estruturaId,
    });
  } catch (e: any) {
    console.error("[criarSubmissaoMetodologiaItem]", e);
    return res.status(500).json({
      message: "Erro ao criar submissão da metodologia.",
      detail: e?.message,
    });
  }
}

export async function deleteMetodologiaAvulsaEstruturaItens(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { metodologiaAvulsaId, estruturaId } = req.params;

    const metodologia = await prisma.metodologiaAvulsa.findUnique({
      where: { id: metodologiaAvulsaId },
      select: { id: true, criadorUsuarioId: true },
    });

    if (!metodologia) {
      return res.status(404).json({ message: "Metodologia avulsa não encontrada." });
    }

    const isAdmin = await isAdminUser(userId);

    if (metodologia.criadorUsuarioId !== userId && !isAdmin) {
      return res.status(403).json({ message: "Sem permissão." });
    }

    const estrutura = await prisma.metodologiaAvulsaEstrutura.findFirst({
      where: {
        id: estruturaId,
        metodologiaAvulsaId,
      },
      select: { id: true },
    });

    if (!estrutura) {
      return res.status(404).json({ message: "Estrutura avulsa não encontrada." });
    }

    const itemIds = Array.isArray(req.body?.itemIds)
      ? req.body.itemIds.filter(Boolean)
      : [];

    if (itemIds.length) {
      const deleted = await prisma.metodologiaAvulsaEstruturaItem.deleteMany({
        where: {
          estruturaId,
          id: { in: itemIds },
        },
      });

      return res.json({
        ok: true,
        deleted: deleted.count,
        mode: "selected",
      });
    }

    const deleted = await prisma.metodologiaAvulsaEstruturaItem.deleteMany({
      where: { estruturaId },
    });

    return res.json({
      ok: true,
      deleted: deleted.count,
      mode: "all",
    });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao excluir itens da estrutura avulsa.",
      detail: e?.message,
    });
  }
}