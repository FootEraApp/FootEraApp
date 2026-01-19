import { prisma } from "../prisma.js";
import type { Request, Response } from "express";


export async function getIndicacoes(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const lista = await prisma.indicacao.findMany({
      where: { olheiroId: id },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        criadoEm: true,
        status: true,
        atleta: { select: { id: true, nome: true, foto: true } },
        clube: { select: { id: true, nome: true, logo: true } },
      },
    });

    const itens = (lista || []).map((i) => ({
      id: i.id,
      criadoEm: i.criadoEm,
      status: i.status,
      atleta: {
        id: i.atleta?.id ?? "",
        nome: i.atleta?.nome ?? "",
        foto: i.atleta?.foto ?? null,
      },
      clube: {
        id: i.clube?.id ?? "",
        nome: i.clube?.nome ?? "",
        logo: i.clube?.logo ?? null,
      },
    }));

    res.json(itens);
  } catch (e) {
    console.error("GET /api/olheiros/:id/indicacoes", e);
    res.status(500).json({ error: "Falha ao carregar indicações do olheiro." });
  }
}

export async function perfilOlheiro(req: Request, res: Response) {
  try {
    let { id } = req.params as { id: string };
    const meTipoUsuarioId = (req as any).user?.tipoUsuarioId as string | undefined;

    if (id === "me" && meTipoUsuarioId) id = meTipoUsuarioId;

    const olheiro = await prisma.olheiro.findUnique({
      where: { id },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            foto: true,
            nomeDeUsuario: true,
          },
        },
        colaboracaoClube: {
          select: { id: true, usuarioId: true, nome: true, logo: true },
        },
      },
    });
    if (!olheiro) return res.status(404).json({ error: "Olheiro não encontrado." });

    const [indicacoesTot, indicacoesAprov, atletasAssinados] = await Promise.all([
      prisma.indicacao.count({ where: { olheiroId: id } }),
      prisma.indicacao.count({ where: { olheiroId: id, status: "APROVADA" } }),
      prisma.indicacao.count({ where: { olheiroId: id, status: "APROVADA" } }),
    ]);
    const taxaAprov = indicacoesTot > 0 ? indicacoesAprov / indicacoesTot : 0;

    const atletasUnicos = await prisma.indicacao.findMany({
      where: { olheiroId: id },
      select: { atletaId: true },
      distinct: ["atletaId"],
    });

    const reputacaoPersistida = olheiro.reputacaoScore ?? 0;

    const payload = {
      tipo: "Olheiro" as const,
      usuario: {
        id: olheiro.usuario.id,
        nome: olheiro.usuario.nome,
        email: olheiro.usuario.email,
        foto: olheiro.usuario.foto,
        nomeDeUsuario: olheiro.usuario.nomeDeUsuario || null,
      },
      olheiro: {
        id: olheiro.id,
        usuarioId: olheiro.usuarioId,
        fotoUrl: olheiro.fotoUrl,
        headline: olheiro.headline,
        descricao: olheiro.descricao,
        areaAtuacao: olheiro.areaAtuacao,
        anosExperiencia: olheiro.anosExperiencia,
        emailPublico: olheiro.emailPublico,
        telefonePublico: olheiro.telefonePublico,
        siteOuLinkedin: olheiro.siteOuLinkedin,
        colaboracaoClube: olheiro.colaboracaoClube
          ? {
              id: olheiro.colaboracaoClube.id,
              usuarioId: olheiro.colaboracaoClube.usuarioId,
              nome: olheiro.colaboracaoClube.nome,
              logo: olheiro.colaboracaoClube.logo,
            }
          : null,
        reputacaoScore: reputacaoPersistida,
        totalIndicacoes: olheiro.totalIndicacoes,
      },
      metrics: {
        atletasAcompanhados: atletasUnicos.length,
        indicacoesEnviadas: indicacoesTot,
        reputacaoScore: reputacaoPersistida,
        indicacoesAprovadas: indicacoesAprov,
        taxaAprovacao: taxaAprov,
        atletasAssinados: atletasAssinados,
      },
    };

    return res.json(payload);
  } catch (e: any) {
    console.error("GET /api/perfil/olheiro/:id", e);
    return res.status(500).json({ error: "Falha ao carregar perfil do olheiro." });
  }
}

export async function getNota(req: Request, res: Response) {
  try {
    const usuarioId = (req as any).userId as string;
    const { atletaId } = req.params as { atletaId: string };

    const olheiro = await prisma.olheiro.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!olheiro) return res.status(403).json({ error: "Somente olheiros podem usar notas" });

    const nota = await prisma.scoutNote.findUnique({
      where: { olheiroId_atletaId: { olheiroId: olheiro.id, atletaId } },
    });
    res.json(nota ?? { texto: "", lastScoreSeen: null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Falha ao carregar nota" });
  }
}

export async function setNota(req: Request, res: Response) {
  try {
    const usuarioId = (req as any).userId as string;
    const { atletaId } = req.params as { atletaId: string };
    const { texto, lastScoreSeen } = (req.body ?? {}) as {
      texto?: string;
      lastScoreSeen?: number | null;
    };

    const olheiro = await prisma.olheiro.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!olheiro) return res.status(403).json({ error: "Somente olheiros podem usar notas" });

    const saved = await prisma.scoutNote.upsert({
      where: { olheiroId_atletaId: { olheiroId: olheiro.id, atletaId } },
      create: {
        olheiroId: olheiro.id,
        atletaId,
        texto: texto ?? "",
        lastScoreSeen: lastScoreSeen ?? null,
      },
      update: {
        texto: texto ?? "",
        lastScoreSeen: lastScoreSeen ?? undefined,
      },
    });
    res.json(saved);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Falha ao salvar nota" });
  }
}

export async function patchColaboracao(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    const { colaboracaoClubeId } = req.body || {};

    if (colaboracaoClubeId != null) {
      const club = await prisma.clube.findUnique({ where: { id: colaboracaoClubeId } });
      if (!club) return res.status(404).json({ error: "Clube não encontrado." });
    }

    const updated = await prisma.olheiro.update({
      where: { id },
      data: { colaboracaoClubeId: colaboracaoClubeId ?? null },
      include: {
        colaboracaoClube: {
          select: { id: true, usuarioId: true, nome: true, logo: true },
        },
      },
    });

    return res.json({
      id: updated.id,
      colaboracaoClube: updated.colaboracaoClube
        ? {
            id: updated.colaboracaoClube.id,
            usuarioId: updated.colaboracaoClube.usuarioId,
            nome: updated.colaboracaoClube.nome,
            logo: updated.colaboracaoClube.logo,
          }
        : null,
    });
  } catch (e: any) {
    console.error("PATCH /api/olheiros/:id", e);
    return res.status(500).json({ error: "Falha ao atualizar olheiro." });
  }
}
