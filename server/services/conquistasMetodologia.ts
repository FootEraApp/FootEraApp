// server/services/conquistasMetodologia.ts
import { prisma } from "../prisma.js";
import {
  Conquista,
  ConquistaOwnerTipo,
  ConquistaTipo,
  MetodologiaAssinaturaStatus,
  MetodologiaPublicoAlvo,
  TipoUsuario,
} from "@prisma/client";

/**
 * Cria/atualiza o TEMPLATE de conquista para uma metodologia PROFISSIONAIS.
 * - Se a metodologia não existir => desativa a conquista "met_prof_<id>" (se existir) e retorna null
 * - Se publicoAlvo != PROFISSIONAIS => desativa e retorna null
 * - Se for PROFISSIONAIS => upsert ativo=true e retorna a Conquista
 */
export async function ensureConquistaTemplateMetodologia(
  metodologiaId: string
): Promise<Conquista | null> {
  const codigo = `met_prof_${metodologiaId}`;

  const m = await prisma.metodologia.findUnique({
    where: { id: metodologiaId },
    select: {
      id: true,
      titulo: true,
      descricao: true,
      capaUrl: true,
      publicoAlvo: true,
    },
  });

  // Não existe mais: desativa template (se houver) e sai
  if (!m) {
    await prisma.conquista.updateMany({
      where: { codigo },
      data: { ativo: false },
    });
    return null;
  }

  // Não é profissionais: desativa e sai
  if (m.publicoAlvo !== MetodologiaPublicoAlvo.PROFISSIONAIS) {
    await prisma.conquista.updateMany({
      where: { codigo },
      data: { ativo: false },
    });
    return null;
  }

  const descricaoFinal =
    (m.descricao?.trim()
      ? m.descricao.trim()
      : "Conclua esta metodologia profissional.") +
    "\n\nGrupo: Metodologias Profissionais\nTier: bronze";

  const conquista = await prisma.conquista.upsert({
    where: { codigo },
    create: {
      codigo,
      titulo: `Metodologia: ${m.titulo}`,
      descricao: descricaoFinal,
      tipo: ConquistaTipo.METODOLOGIA,
      publico: [
        ConquistaOwnerTipo.Professor,
        ConquistaOwnerTipo.Clube,
        ConquistaOwnerTipo.Escolinha,
      ],
      icon: "🎓",
      iconUrl: m.capaUrl ?? null,
      meta: 1,
      ativo: true,
    },
    update: {
      titulo: `Metodologia: ${m.titulo}`,
      descricao: descricaoFinal,
      tipo: ConquistaTipo.METODOLOGIA,
      iconUrl: m.capaUrl ?? null,
      meta: 1,
      ativo: true,
    },
  });

  return conquista;
}

/**
 * Mantém o catálogo de conquistas de metodologias profissionais consistente:
 * - Garante template para TODAS as metodologias PROFISSIONAIS existentes
 * - Desativa conquistas "met_prof_" que não tem mais metodologia PROFISSIONAIS correspondente
 */
export async function syncTemplatesMetodologiasProfissionais(): Promise<void> {
  const metodologiasProf = await prisma.metodologia.findMany({
    where: { publicoAlvo: MetodologiaPublicoAlvo.PROFISSIONAIS },
    select: { id: true },
  });

  const validCodes = new Set<string>();

  for (const m of metodologiasProf) {
    validCodes.add(`met_prof_${m.id}`);
    // upsert/atualiza
    await ensureConquistaTemplateMetodologia(m.id);
  }

  // Desativa templates órfãos (metodologia apagou ou mudou publicoAlvo)
  const allTemplates = await prisma.conquista.findMany({
    where: { codigo: { startsWith: "met_prof_" } },
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

/**
 * Resolve owner SOMENTE profissionais (Professor/Clube/Escolinha).
 * Atleta NÃO pode ganhar conquista de metodologia profissional.
 */
async function resolveOwnerByUsuarioId(usuarioId: string): Promise<{
  ownerTipo: ConquistaOwnerTipo;
  ownerId: string;
  professorId?: string | null;
  clubeId?: string | null;
  escolinhaId?: string | null;
} | null> {
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { tipo: true },
  });
  if (!u) return null;

  if (u.tipo === TipoUsuario.Professor) {
    const prof = await prisma.professor.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!prof?.id) return null;

    return {
      ownerTipo: ConquistaOwnerTipo.Professor,
      ownerId: prof.id,
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
      professorId: null,
      clubeId: null,
      escolinhaId: esc.id,
    };
  }

  return null;
}

/**
 * (A) Desbloqueia a conquista quando conclui a metodologia PROFISSIONAIS.
 * - Idempotente via upsert do vínculo.
 */
export async function unlockConquistaMetodologia(usuarioId: string, metodologiaId: string) {
  const conquista = await ensureConquistaTemplateMetodologia(metodologiaId);
  if (!conquista) {
    return { ok: false as const, reason: "NOT_PROFESSIONAL_OR_NOT_FOUND" as const };
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

      professorId: owner.professorId ?? null,
      clubeId: owner.clubeId ?? null,
      escolinhaId: owner.escolinhaId ?? null,

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
      // se você quiser manter a data original, remova essa linha:
      conquistadoEm: new Date(),
    },
  });

  return { ok: true as const };
}

/**
 * (B) Fallback de sync: varre metodologias concluídas e tenta desbloquear
 * (o unlock já filtra PROFISSIONAIS e usuário profissional).
 */
export async function syncConquistasMetodologias(usuarioId: string) {
  const concluidas = await prisma.metodologiaAssinante.findMany({
    where: {
      usuarioId,
      OR: [
        { status: MetodologiaAssinaturaStatus.CONCLUIDA },
        { concluiuEm: { not: null } },
      ],
    },
    select: { metodologiaId: true },
  });

  for (const row of concluidas) {
    await unlockConquistaMetodologia(usuarioId, row.metodologiaId);
  }
}