// server/services/conquistasMetodologia.ts
import { prisma } from "../prisma.js";
import {
  Conquista,
  ConquistaOwnerTipo,
  ConquistaTipo,
  MetodologiaAssinaturaStatus,
  TipoUsuario,
  MetodologiaPublicoAlvo,
} from "@prisma/client";

export async function ensureConquistaTemplateMetodologia(
  metodologiaId: string
): Promise<Conquista | null> {
  const codigo = `metodologia_${metodologiaId}`;

  const m = await prisma.metodologia.findUnique({
    where: { id: metodologiaId },
    select: {
      id: true,
      titulo: true,
      descricao: true,
      capaUrl: true,
      geraBadge: true,
      publicoAlvo: true,
    },
  });

  if (!m) {
    await prisma.conquista.updateMany({
      where: { codigo },
      data: { ativo: false },
    });
    return null;
  }

  if (!m.geraBadge) {
    await prisma.conquista.updateMany({
      where: { codigo },
      data: { ativo: false },
    });
    return null;
  }

  const descricaoFinal =
    (m.descricao?.trim()
      ? m.descricao.trim()
      : "Conclua esta metodologia para desbloquear esta conquista.") +
    "\n\nGrupo: Learning\nTier: bronze";

  const conquista = await prisma.conquista.upsert({
    where: { codigo },
    create: {
      codigo,
      titulo: `Metodologia: ${m.titulo}`,
      descricao: descricaoFinal,
      tipo: ConquistaTipo.METODOLOGIA,
      publico: publicoConquistaFromPublicoAlvo(m.publicoAlvo),
      icon: "🎓",
      iconUrl: m.capaUrl ?? null,
      meta: 1,
      ativo: true,
    },
    update: {
      titulo: `Metodologia: ${m.titulo}`,
      descricao: descricaoFinal,
      tipo: ConquistaTipo.METODOLOGIA,
      publico: publicoConquistaFromPublicoAlvo(m.publicoAlvo),
      iconUrl: m.capaUrl ?? null,
      meta: 1,
      ativo: true,
    },
  });

  return conquista;
}

export async function ensureConquistaTemplateMetodologiaAvulsa(
  metodologiaAvulsaId: string
): Promise<Conquista | null> {
  const codigo = `metodologia_avulsa_${metodologiaAvulsaId}`;

  const m = await prisma.metodologiaAvulsa.findUnique({
    where: { id: metodologiaAvulsaId },
    select: {
      id: true,
      titulo: true,
      descricao: true,
      capaUrl: true,
      geraBadge: true,
      publicoAlvo: true,
    },
  });

  if (!m) {
    await prisma.conquista.updateMany({
      where: { codigo },
      data: { ativo: false },
    });
    return null;
  }

  if (!m.geraBadge) {
    await prisma.conquista.updateMany({
      where: { codigo },
      data: { ativo: false },
    });
    return null;
  }

  const descricaoFinal =
    (m.descricao?.trim()
      ? m.descricao.trim()
      : "Conclua esta metodologia avulsa para desbloquear esta conquista.") +
    "\n\nGrupo: Learning\nTier: bronze";

  return prisma.conquista.upsert({
    where: { codigo },
    create: {
      codigo,
      titulo: `Metodologia Avulsa: ${m.titulo}`,
      descricao: descricaoFinal,
      tipo: ConquistaTipo.METODOLOGIA,
      publico: publicoConquistaFromPublicoAlvo(m.publicoAlvo),
      icon: "🎓",
      iconUrl: m.capaUrl ?? null,
      meta: 1,
      ativo: true,
    },
    update: {
      titulo: `Metodologia Avulsa: ${m.titulo}`,
      descricao: descricaoFinal,
      tipo: ConquistaTipo.METODOLOGIA,
      publico: publicoConquistaFromPublicoAlvo(m.publicoAlvo),
      iconUrl: m.capaUrl ?? null,
      meta: 1,
      ativo: true,
    },
  });
}

export async function syncTemplatesMetodologiasProfissionais(): Promise<void> {
  const [metodologiasComBadge, metodologiasAvulsasComBadge] = await Promise.all([
    prisma.metodologia.findMany({
      where: { geraBadge: true },
      select: { id: true },
    }),
    prisma.metodologiaAvulsa.findMany({
      where: { geraBadge: true },
      select: { id: true },
    }),
  ]);

  const validCodes = new Set<string>();

  for (const m of metodologiasComBadge) {
    validCodes.add(`metodologia_${m.id}`);
    await ensureConquistaTemplateMetodologia(m.id);
  }

  for (const m of metodologiasAvulsasComBadge) {
    validCodes.add(`metodologia_avulsa_${m.id}`);
    await ensureConquistaTemplateMetodologiaAvulsa(m.id);
  }

  const allTemplates = await prisma.conquista.findMany({
    where: {
      OR: [
        { codigo: { startsWith: "met_prof_" } },
        { codigo: { startsWith: "metodologia_" } },
        { codigo: { startsWith: "metodologia_avulsa_" } },
      ],
    },
    select: { codigo: true },
  });

  const toDisable = allTemplates
    .map((t) => t.codigo)
    .filter((codigo) => !validCodes.has(codigo));

  if (toDisable.length) {
    await prisma.conquista.updateMany({
      where: { codigo: { in: toDisable } },
      data: { ativo: false },
    });
  }
}

function publicoConquistaFromPublicoAlvo(publicoAlvo: MetodologiaPublicoAlvo): ConquistaOwnerTipo[] {
  if (publicoAlvo === MetodologiaPublicoAlvo.ATLETAS) {
    return [
      ConquistaOwnerTipo.Atleta,
      ConquistaOwnerTipo.Learning,
    ];
  }

  if (publicoAlvo === MetodologiaPublicoAlvo.PROFISSIONAIS) {
    return [
      ConquistaOwnerTipo.Professor,
      ConquistaOwnerTipo.Clube,
      ConquistaOwnerTipo.Escolinha,
      ConquistaOwnerTipo.Marca,
      ConquistaOwnerTipo.Federacao,
    ];
  }

  return [
    ConquistaOwnerTipo.Atleta,
    ConquistaOwnerTipo.Learning,
    ConquistaOwnerTipo.Professor,
    ConquistaOwnerTipo.Clube,
    ConquistaOwnerTipo.Escolinha,
    ConquistaOwnerTipo.Marca,
    ConquistaOwnerTipo.Federacao,
  ];
}

async function resolveOwnerByUsuarioId(usuarioId: string): Promise<{
  ownerTipo: ConquistaOwnerTipo;
  ownerId: string;
  atletaId?: string | null;
  professorId?: string | null;
  clubeId?: string | null;
  escolinhaId?: string | null;
} | null> {
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { tipo: true },
  });
  if (!u) return null;

  if (u.tipo === TipoUsuario.Atleta) {
    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!atleta?.id) return null;

    return {
      ownerTipo: ConquistaOwnerTipo.Atleta,
      ownerId: atleta.id,
      atletaId: atleta.id,
      professorId: null,
      clubeId: null,
      escolinhaId: null,
    };
  }

  if (u.tipo === TipoUsuario.Professor) {
    const prof = await prisma.professor.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!prof?.id) return null;

    return {
      ownerTipo: ConquistaOwnerTipo.Professor,
      ownerId: prof.id,
      atletaId: null,
      professorId: prof.id,
      clubeId: null,
      escolinhaId: null,
    };
  }

  if (u.tipo === TipoUsuario.Clube) {
    const clu = await prisma.clube.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!clu?.id) return null;

    return {
      ownerTipo: ConquistaOwnerTipo.Clube,
      ownerId: clu.id,
      atletaId: null,
      professorId: null,
      clubeId: clu.id,
      escolinhaId: null,
    };
  }

  if (u.tipo === TipoUsuario.Escolinha) {
    const esc = await prisma.escolinha.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!esc?.id) return null;

    return {
      ownerTipo: ConquistaOwnerTipo.Escolinha,
      ownerId: esc.id,
      atletaId: null,
      professorId: null,
      clubeId: null,
      escolinhaId: esc.id,
    };
  }

  if (u.tipo === TipoUsuario.Learning) {
    const learning = await prisma.learningProfile.findUnique({
      where: { usuarioId },
      select: { id: true },
    });

    if (!learning?.id) return null;

    return {
      ownerTipo: ConquistaOwnerTipo.Learning,
      ownerId: learning.id,
      atletaId: null,
      professorId: null,
      clubeId: null,
      escolinhaId: null,
      learningProfileId: learning.id,
      marcaId: null,
      federacaoId: null,
    } as any;
  }

  if (u.tipo === TipoUsuario.Marca) {
    const marca = await prisma.marca.findUnique({
      where: { usuarioId },
      select: { id: true },
    });

    if (!marca?.id) return null;

    return {
      ownerTipo: ConquistaOwnerTipo.Marca,
      ownerId: marca.id,
      atletaId: null,
      professorId: null,
      clubeId: null,
      escolinhaId: null,
      learningProfileId: null,
      marcaId: marca.id,
      federacaoId: null,
    } as any;
  }

  if (u.tipo === TipoUsuario.Federacao) {
    const federacao = await prisma.federacao.findUnique({
      where: { usuarioId },
      select: { id: true },
    });

    if (!federacao?.id) return null;

    return {
      ownerTipo: ConquistaOwnerTipo.Federacao,
      ownerId: federacao.id,
      atletaId: null,
      professorId: null,
      clubeId: null,
      escolinhaId: null,
      learningProfileId: null,
      marcaId: null,
      federacaoId: federacao.id,
    } as any;
  }

  return null;
}

export async function unlockConquistaMetodologia(usuarioId: string, metodologiaId: string) {
  const conquista = await ensureConquistaTemplateMetodologia(metodologiaId);
  if (!conquista) {
    return { ok: false as const, reason: "BADGE_DISABLED_OR_NOT_FOUND" as const };
  }

  const owner = await resolveOwnerByUsuarioId(usuarioId);
  if (!owner) return { ok: false as const, reason: "OWNER_NOT_FOUND" as const };

  await prisma.conquistaVinculo.upsert({
    where: {
      ownerTipo_ownerId_conquistaId: {
        ownerTipo: owner.ownerTipo,
        ownerId: owner.ownerId,
        conquistaId: conquista.id,
      },
    },
    create: {
      conquistaId: conquista.id,
      ownerTipo: owner.ownerTipo,
      ownerId: owner.ownerId,

      atletaId: owner.atletaId ?? null,
      professorId: owner.professorId ?? null,
      clubeId: owner.clubeId ?? null,
      escolinhaId: owner.escolinhaId ?? null,
      learningProfileId: (owner as any).learningProfileId ?? null,
      marcaId: (owner as any).marcaId ?? null,
      federacaoId: (owner as any).federacaoId ?? null,

      refTipo: "METODOLOGIA",
      refId: metodologiaId,

      progresso: 100,
      concluida: true,
      conquistadoEm: new Date(),
    },
    update: {
      refTipo: "METODOLOGIA",
      refId: metodologiaId,
      progresso: 100,
      concluida: true,
      conquistadoEm: new Date(),
    },
  });

  return { ok: true as const };
}

export async function unlockConquistaMetodologiaAvulsa(
  usuarioId: string,
  metodologiaAvulsaId: string
) {
  const conquista = await ensureConquistaTemplateMetodologiaAvulsa(metodologiaAvulsaId);
  if (!conquista) {
    return { ok: false as const, reason: "BADGE_DISABLED_OR_NOT_FOUND" as const };
  }

  const owner = await resolveOwnerByUsuarioId(usuarioId);
  if (!owner) return { ok: false as const, reason: "OWNER_NOT_FOUND" as const };

  await prisma.conquistaVinculo.upsert({
    where: {
      ownerTipo_ownerId_conquistaId: {
        ownerTipo: owner.ownerTipo,
        ownerId: owner.ownerId,
        conquistaId: conquista.id,
      },
    },
    create: {
      conquistaId: conquista.id,
      ownerTipo: owner.ownerTipo,
      ownerId: owner.ownerId,

      atletaId: owner.atletaId ?? null,
      professorId: owner.professorId ?? null,
      clubeId: owner.clubeId ?? null,
      escolinhaId: owner.escolinhaId ?? null,
      learningProfileId: (owner as any).learningProfileId ?? null,
      marcaId: (owner as any).marcaId ?? null,
      federacaoId: (owner as any).federacaoId ?? null,

      refTipo: "METODOLOGIA_AVULSA",
      refId: metodologiaAvulsaId,

      progresso: 100,
      concluida: true,
      conquistadoEm: new Date(),
    },
    update: {
      refTipo: "METODOLOGIA_AVULSA",
      refId: metodologiaAvulsaId,
      progresso: 100,
      concluida: true,
      conquistadoEm: new Date(),
    },
  });

  return { ok: true as const };
}

export async function syncConquistasMetodologias(usuarioId: string) {
  const concluidas = await prisma.metodologiaAssinante.findMany({
    where: {
      usuarioId,
      OR: [
        { status: MetodologiaAssinaturaStatus.CONCLUIDA },
        { concluiuEm: { not: null } },
      ],
    },
    select: {
      metodologiaId: true,
      metodologiaAvulsaId: true,
      origem: true,
    },
  });

  for (const row of concluidas) {
    if (row.origem === "AVULSA" && row.metodologiaAvulsaId) {
      await unlockConquistaMetodologiaAvulsa(usuarioId, row.metodologiaAvulsaId);
      await emitirCertificadoMetodologiaAvulsa({
        usuarioId,
        metodologiaAvulsaId: row.metodologiaAvulsaId,
      });
    } else if (row.metodologiaId) {
      await unlockConquistaMetodologia(usuarioId, row.metodologiaId);
      await emitirCertificadoMetodologia({
        usuarioId,
        metodologiaId: row.metodologiaId,
      });
    }
  }
}

function gerarCodigoCertificado() {
  return `CERT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function emitirCertificadoMetodologia(params: {
  usuarioId: string;
  metodologiaId: string;
}) {
  const { usuarioId, metodologiaId } = params;

  const metodologia = await prisma.metodologia.findUnique({
    where: { id: metodologiaId },
    select: {
      id: true,
      titulo: true,
      geraCertificado: true,
      capaUrl: true,
      criadorUsuario: { select: { nome: true } },
      professor: { select: { nome: true } },
      clube: { select: { nome: true } },
      escolinha: { select: { nome: true } },
    },
  });

  if (!metodologia || !metodologia.geraCertificado) {
    return { ok: false as const, reason: "CERTIFICADO_DISABLED_OR_NOT_FOUND" as const };
  }

  const assinatura = await prisma.metodologiaAssinante.findUnique({
    where: {
      metodologiaId_usuarioId: {
        metodologiaId,
        usuarioId,
      },
    },
    select: {
      id: true,
      concluiuEm: true,
      status: true,
    },
  });

  if (!assinatura || (assinatura.status !== MetodologiaAssinaturaStatus.CONCLUIDA && !assinatura.concluiuEm)) {
    return { ok: false as const, reason: "NOT_COMPLETED" as const };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nome: true },
  });

  const emissorNome =
    metodologia.professor?.nome ||
    metodologia.clube?.nome ||
    metodologia.escolinha?.nome ||
    metodologia.criadorUsuario?.nome ||
    "FootEra";

  const certificado = await prisma.certificadoMetodologia.upsert({
    where: {
      usuarioId_metodologiaId: {
        usuarioId,
        metodologiaId,
      },
    },
    create: {
      usuarioId,
      metodologiaId,
      metodologiaAssinanteId: assinatura.id,
      codigoValidacao: gerarCodigoCertificado(),
      nomeUsuario: usuario?.nome ?? "Usuário",
      tituloMetodologia: metodologia.titulo,
      nomeEmissor: emissorNome,
      concluidoEm: assinatura.concluiuEm ?? new Date(),
      emitidoEm: new Date(),
      imagemUrl: metodologia.capaUrl ?? null,
      pdfUrl: null,
    },
    update: {
      metodologiaAssinanteId: assinatura.id,
      nomeUsuario: usuario?.nome ?? "Usuário",
      tituloMetodologia: metodologia.titulo,
      nomeEmissor: emissorNome,
      concluidoEm: assinatura.concluiuEm ?? new Date(),
      emitidoEm: new Date(),
      imagemUrl: metodologia.capaUrl ?? null,
    },
  });

  return { ok: true as const, certificado };
}

export async function emitirCertificadoMetodologiaAvulsa(params: {
  usuarioId: string;
  metodologiaAvulsaId: string;
}) {
  const { usuarioId, metodologiaAvulsaId } = params;

  const metodologia = await prisma.metodologiaAvulsa.findUnique({
    where: { id: metodologiaAvulsaId },
    select: {
      id: true,
      titulo: true,
      geraCertificado: true,
      capaUrl: true,
      criadorUsuario: { select: { nome: true } },
      professor: { select: { nome: true } },
      clube: { select: { nome: true } },
      escolinha: { select: { nome: true } },
    },
  });

  if (!metodologia || !metodologia.geraCertificado) {
    return { ok: false as const, reason: "CERTIFICADO_DISABLED_OR_NOT_FOUND" as const };
  }

  const assinatura = await prisma.metodologiaAssinante.findFirst({
    where: {
      usuarioId,
      metodologiaAvulsaId,
    },
    select: {
      id: true,
      concluiuEm: true,
      status: true,
    },
  });

  if (
    !assinatura ||
    (assinatura.status !== MetodologiaAssinaturaStatus.CONCLUIDA &&
      !assinatura.concluiuEm)
  ) {
    return { ok: false as const, reason: "NOT_COMPLETED" as const };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nome: true },
  });

  const emissorNome =
    metodologia.professor?.nome ||
    metodologia.clube?.nome ||
    metodologia.escolinha?.nome ||
    metodologia.criadorUsuario?.nome ||
    "FootEra";

  const certificado = await prisma.certificadoMetodologia.upsert({
    where: {
      usuarioId_metodologiaAvulsaId: {
        usuarioId,
        metodologiaAvulsaId,
      },
    },
    create: {
      usuarioId,
      metodologiaAvulsaId,
      metodologiaAssinanteId: assinatura.id,
      codigoValidacao: gerarCodigoCertificado(),
      nomeUsuario: usuario?.nome ?? "Usuário",
      tituloMetodologia: metodologia.titulo,
      nomeEmissor: emissorNome,
      concluidoEm: assinatura.concluiuEm ?? new Date(),
      emitidoEm: new Date(),
      imagemUrl: metodologia.capaUrl ?? null,
      pdfUrl: null,
    },
    update: {
      metodologiaAssinanteId: assinatura.id,
      nomeUsuario: usuario?.nome ?? "Usuário",
      tituloMetodologia: metodologia.titulo,
      nomeEmissor: emissorNome,
      concluidoEm: assinatura.concluiuEm ?? new Date(),
      emitidoEm: new Date(),
      imagemUrl: metodologia.capaUrl ?? null,
    },
  });

  return { ok: true as const, certificado };
}