// server/controllers/templatesController.ts
import { PrismaClient, TipoUsuario, Nivel, TipoTreino, Categoria } from "@prisma/client";
import type { Request, Response } from "express";

const prisma = new PrismaClient();

function isTipo(u?: any, t?: TipoUsuario) {
  return String(u?.tipo) === String(t);
}

export async function criarTemplate(req: Request, res: Response) {
  try {
    const user = (req as any).user as {
      id: string;
      tipo: TipoUsuario;
      tipoUsuarioId?: string | null;
      isAdmin?: boolean;
    };
    if (!user?.id) return res.status(401).json({ error: "Não autenticado" });

    // descobrir owner
    let owner: { professorId?: string; escolinhaId?: string; clubeId?: string } = {};

    if (isTipo(user, "Professor")) {
      owner.professorId = user.tipoUsuarioId ?? undefined;
      if (!owner.professorId) {
        const prof = await prisma.professor.findFirst({
          where: { usuarioId: user.id },
          select: { id: true },
        });
        owner.professorId = prof?.id ?? undefined;
      }
    } else if (isTipo(user, "Escolinha")) {
      owner.escolinhaId = user.tipoUsuarioId ?? undefined;
      if (!owner.escolinhaId) {
        const esc = await prisma.escolinha.findFirst({
          where: { usuarioId: user.id },
          select: { id: true },
        });
        owner.escolinhaId = esc?.id ?? undefined;
      }
    } else if (isTipo(user, "Clube")) {
      owner.clubeId = user.tipoUsuarioId ?? undefined;
      if (!owner.clubeId) {
        const clu = await prisma.clube.findFirst({
          where: { usuarioId: user.id },
          select: { id: true },
        });
        owner.clubeId = clu?.id ?? undefined;
      }
    } else if (!user.isAdmin) {
      // atleta/olheiro não criam templates de treino
      return res.status(403).json({ error: "Somente professor/organização podem criar templates." });
    }

    const {
      titulo,
      descricao,
      nivel,
      tipoTreino,
      categoria,
      duracao,
      dicas,
      conteudo,
      publico,
      parceiro,
      expiraEm,
      naoExpira,
    } = (req.body ?? {}) as {
      titulo: string;
      descricao?: string | null;
      nivel?: Nivel | null;
      tipoTreino?: TipoTreino | null;
      categoria?: Categoria[] | null;
      duracao?: number | null;
      dicas?: string[] | null;
      conteudo: any; // JSON do template (exercícios, ordens etc.)
      publico?: boolean;
      parceiro?: boolean;
      expiraEm?: string | null;
      naoExpira?: boolean;
    };

    if (!titulo || !conteudo) {
      return res.status(400).json({ error: "Campos obrigatórios: titulo, conteudo." });
    }

    const created = await prisma.treinoSalvo.create({
      data: {
        titulo,
        descricao: descricao ?? null,
        nivel: nivel ?? null,
        tipoTreino: tipoTreino ?? null,
        categoria: (categoria ?? []) as any,
        duracao: duracao ?? null,
        dicas: (dicas ?? []) as any,
        conteudo: conteudo as any,
        publico: !!publico,
        parceiro: !!parceiro,
        expiraEm: naoExpira ? null : (expiraEm ? new Date(expiraEm) : null),
        naoExpira: !!naoExpira,
        criadoPorUsuarioId: user.id,
        ...owner,
      },
    });

    return res.status(201).json(created);
  } catch (e) {
    console.error("POST /api/templates", e);
    return res.status(500).json({ error: "Falha ao criar template." });
  }
}

export async function listarTemplates(req: Request, res: Response) {
  try {
    const user = (req as any).user as { id: string; tipo: TipoUsuario; tipoUsuarioId?: string | null };
    const { scope } = req.query as { scope?: "me" | "public" | "org" };

    const where: any = {};
    if (scope === "public") where.publico = true;
    else if (scope === "me") where.criadoPorUsuarioId = user.id;
    else if (scope === "org") {
      // lista da org do usuário (se professor vinculado, traz da org)
      if (user.tipo === "Professor") {
        const prof = await prisma.professor.findUnique({
          where: { id: user.tipoUsuarioId ?? "" },
          select: { escolinhaId: true, clubeId: true },
        });
        if (prof?.escolinhaId) where.escolinhaId = prof.escolinhaId;
        if (prof?.clubeId) where.clubeId = prof.clubeId;
      } else if (user.tipo === "Escolinha") where.escolinhaId = user.tipoUsuarioId ?? undefined;
      else if (user.tipo === "Clube") where.clubeId = user.tipoUsuarioId ?? undefined;
    }

    const list = await prisma.treinoSalvo.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      take: 100,
    });

    res.json(list);
  } catch (e) {
    console.error("GET /api/templates", e);
    res.status(500).json({ error: "Falha ao listar templates." });
  }
}

export async function deletarTemplate(req: Request, res: Response) {
  try {
    const user = (req as any).user as {
      id: string;
      tipo: TipoUsuario;
      tipoUsuarioId?: string | null;
      isAdmin?: boolean;
    };
    const { id } = req.params as { id: string };

    const tpl = await prisma.treinoSalvo.findUnique({ where: { id } });
    if (!tpl) return res.status(404).json({ error: "Template não encontrado." });

    const isOwner =
      tpl.criadoPorUsuarioId === user.id ||
      (!!tpl.professorId && tpl.professorId === user.tipoUsuarioId) ||
      (!!tpl.escolinhaId && tpl.escolinhaId === user.tipoUsuarioId) ||
      (!!tpl.clubeId && tpl.clubeId === user.tipoUsuarioId);

    if (!isOwner && !user.isAdmin) {
      return res.status(403).json({ error: "Sem permissão para remover este template." });
    }

    await prisma.treinoSalvo.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/templates/:id", e);
    res.status(500).json({ error: "Falha ao deletar template." });
  }
}