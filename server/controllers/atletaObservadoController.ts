// server/controllers/atletaObservadoController.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// helper para montar objetos sem undefined/null
function pick<T extends Record<string, any>>(obj: T) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)
  ) as T;
}

// Resolve (para o usuário logado) qual o "dono" (professor|escolinha|clube) e retorna o id da tabela
async function resolveOwnerFromUsuario(usuarioId: string):
  Promise<
    | { professorId: string; escolinhaId?: never; clubeId?: never }
    | { professorId?: never; escolinhaId: string; clubeId?: never }
    | { professorId?: never; escolinhaId?: never; clubeId: string }
    | null
  > {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { tipo: true },
  });
  if (!usuario) return null;

  // tipo é string no seu schema: "Professor" | "Escolinha" | "Clube" | "Atleta"
  if (usuario.tipo === "Professor") {
    const r = await prisma.professor.findUnique({ where: { usuarioId } });
    return r ? { professorId: r.id } : null;
  }
  if (usuario.tipo === "Escolinha") {
    const r = await prisma.escolinha.findUnique({ where: { usuarioId } });
    return r ? { escolinhaId: r.id } : null;
  }
  if (usuario.tipo === "Clube") {
    const r = await prisma.clube.findUnique({ where: { usuarioId } });
    return r ? { clubeId: r.id } : null;
  }
  return null; // Atleta (ou outro) não é dono de observação
}

/** GET /api/observados?tipoUsuarioId=... (opcional) */
export async function listarObservados(req: Request, res: Response) {
  const usuarioId = (req as any).userId as string | undefined;
  if (!usuarioId) return res.status(401).json({ error: "Não autenticado." });

  const { tipoUsuarioId } = req.query as { tipoUsuarioId?: string };

  try {
    let whereOwner:
      | { OR: Array<{ professorId?: string; escolinhaId?: string; clubeId?: string }> }
      | { professorId?: string; escolinhaId?: string; clubeId?: string };

    if (tipoUsuarioId) {
      whereOwner = {
        OR: [
          { professorId: tipoUsuarioId },
          { escolinhaId: tipoUsuarioId },
          { clubeId: tipoUsuarioId },
        ],
      };
    } else {
      const owner = await resolveOwnerFromUsuario(usuarioId);
      if (!owner) {
        return res.status(403).json({ error: "Apenas professor, escolinha ou clube podem observar atletas." });
      }
      whereOwner = owner;
    }

    const rels = await prisma.atletaObservado.findMany({
      where: whereOwner,
      include: { atleta: { include: { usuario: true } } },
      orderBy: { criadoEm: "desc" },
    });

    const BASE_URL = process.env.BASE_URL || process.env.APP_BASE_URL || "";

    const payload = rels.map((r) => {
      const a = r.atleta;
      return {
        id: a.usuario.id,
        atletaId: a.id,
        nome: a.usuario.nome,
        foto: a.usuario.foto ? `${BASE_URL}${a.usuario.foto}` : null,
        posicao: a.posicao ?? null,
        idade: a.idade ?? null,
        altura: a.altura ?? null,
        peso: a.peso ?? null,
        observadoEm: r.criadoEm,
      };
    });

    return res.json(payload);
  } catch (error) {
    console.error("listarObservados error:", error);
    return res.status(500).json({ error: "Erro ao listar atletas observados." });
  }
}

/** POST /api/observados  body: { atletaId? | atletaUsuarioId? } */
export async function observarAtleta(req: Request, res: Response) {
  const usuarioId = (req as any).userId as string | undefined;
  if (!usuarioId) return res.status(401).json({ error: "Não autenticado." });

  const { atletaId, atletaUsuarioId } = (req.body ?? {}) as { atletaId?: string; atletaUsuarioId?: string };
  if (!atletaId && !atletaUsuarioId) {
    return res.status(400).json({ error: "Informe atletaId OU atletaUsuarioId." });
  }

  try {
    const owner = await resolveOwnerFromUsuario(usuarioId);
    if (!owner) {
      return res.status(403).json({ error: "Apenas professor, escolinha ou clube podem observar atletas." });
    }

    // resolve atletaId se veio apenas atletaUsuarioId
    let alvoAtletaId = atletaId ?? null;
    if (!alvoAtletaId && atletaUsuarioId) {
      const atleta = await prisma.atleta.findUnique({ where: { usuarioId: atletaUsuarioId } });
      if (!atleta) return res.status(404).json({ error: "Atleta não encontrado." });
      alvoAtletaId = atleta.id;
    }
    if (!alvoAtletaId) return res.status(400).json({ error: "Não foi possível resolver atletaId." });

    // evita duplicidade
    const existente = await prisma.atletaObservado.findFirst({
      where: pick({
        atletaId: alvoAtletaId,
        professorId: (owner as any).professorId,
        escolinhaId: (owner as any).escolinhaId,
        clubeId: (owner as any).clubeId,
      }),
    });
    if (existente) {
      return res.status(409).json({ error: "Este atleta já está sendo observado por você." });
    }

    await prisma.atletaObservado.create({
      data: pick({
        atletaId: alvoAtletaId,
        professorId: (owner as any).professorId,
        escolinhaId: (owner as any).escolinhaId,
        clubeId: (owner as any).clubeId,
      }),
    });

    return res.status(201).json({ message: "Atleta agora está sendo observado." });
  } catch (error: any) {
    console.error("observarAtleta error:", error);
    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Este atleta já está sendo observado por você." });
    }
    return res.status(500).json({ error: "Erro ao observar atleta." });
  }
}

/** DELETE /api/observados/:atletaId  (atletaId = id da tabela Atleta) */
export async function pararDeObservar(req: Request, res: Response) {
  const usuarioId = (req as any).userId as string | undefined;
  if (!usuarioId) return res.status(401).json({ error: "Não autenticado." });

  const { atletaId } = req.params as { atletaId: string };
  if (!atletaId) return res.status(400).json({ error: "atletaId é obrigatório na URL." });

  try {
    const owner = await resolveOwnerFromUsuario(usuarioId);
    if (!owner) {
      return res.status(403).json({ error: "Apenas professor, escolinha ou clube podem parar de observar atletas." });
    }

    const del = await prisma.atletaObservado.deleteMany({
      where: pick({
        atletaId,
        professorId: (owner as any).professorId,
        escolinhaId: (owner as any).escolinhaId,
        clubeId: (owner as any).clubeId,
      }),
    });

    if (del.count === 0) {
      return res.status(404).json({ error: "Observação não encontrada." });
    }

    return res.sendStatus(204);
  } catch (error) {
    console.error("pararDeObservar error:", error);
    return res.status(500).json({ error: "Erro ao parar de observar atleta." });
  }
}
