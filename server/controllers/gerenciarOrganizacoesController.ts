// server/controllers/gerenciarOrganizacoesController.ts
import type { Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.js";

type VinculoGestor = Prisma.OrganizacaoGestorGetPayload<{
  select: {
    id: true;
    tipo: true;
    ownerId: true;
    papel: true;
    permissoes: true;
    ativo: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

export async function listarMinhasOrganizacoesGerenciaveis(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = String(req.user?.id || "");
    const tipo = String(req.user?.tipo || "");

    if (!userId) return res.status(401).json({ items: [] });

    if (tipo !== "Professor") return res.json({ items: [] });

    const prof = await prisma.professor.findFirst({
      where: { usuarioId: userId },
      select: { id: true, nome: true },
    });

    if (!prof?.id) return res.json({ items: [] });

    const vinculos: VinculoGestor[] = await prisma.organizacaoGestor.findMany({
      where: { professorId: prof.id, ativo: true },
      select: {
        id: true,
        tipo: true,
        ownerId: true,
        papel: true,
        permissoes: true,
        ativo: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const clubeIds = vinculos
      .filter((v: VinculoGestor) => v.tipo === "CLUBE")
      .map((v: VinculoGestor) => v.ownerId);

    const escolinhaIds = vinculos
      .filter((v: VinculoGestor) => v.tipo === "ESCOLINHA")
      .map((v: VinculoGestor) => v.ownerId);

    const [clubes, escolinhas] = await Promise.all([
      clubeIds.length
        ? prisma.clube.findMany({
            where: { id: { in: clubeIds } },
            select: { id: true, nome: true, logo: true, cidade: true, estado: true },
          })
        : Promise.resolve([]),
      escolinhaIds.length
        ? prisma.escolinha.findMany({
            where: { id: { in: escolinhaIds } },
            select: { id: true, nome: true, logo: true, cidade: true, estado: true },
          })
        : Promise.resolve([]),
    ]);

    const clubeMap = new Map(clubes.map((c) => [c.id, c]));
    const escolinhaMap = new Map(escolinhas.map((e) => [e.id, e]));

    const items = vinculos.map((v: VinculoGestor) => {
      const detalhes =
        v.tipo === "CLUBE" ? clubeMap.get(v.ownerId) : escolinhaMap.get(v.ownerId);

      return {
        id: v.id,
        tipo: v.tipo,
        ownerId: v.ownerId,
        papel: v.papel ?? null,
        permissoes: v.permissoes ?? null,
        ativo: v.ativo,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
        nome: detalhes?.nome ?? null,
        logo: (detalhes as any)?.logo ?? null,
        cidade: (detalhes as any)?.cidade ?? null,
        estado: (detalhes as any)?.estado ?? null,
      };
    });

    return res.json({ professorId: prof.id, items });
  } catch (e: any) {
    return res.status(500).json({
      items: [],
      message: e?.message || "Erro ao listar organizações gerenciáveis.",
    });
  }
}

export async function criarVinculoGestor(req: AuthenticatedRequest, res: Response) {
  try {
    const tipoUsuario = String(req.user?.tipo || "");
    if (!req.user?.id) return res.status(401).json({ error: "Não autenticado." });

    if (tipoUsuario !== "Admin") {
      return res.status(403).json({ error: "Sem permissão." });
    }

    const tipo = String(req.body?.tipo || "").toUpperCase(); // CLUBE | ESCOLINHA
    const ownerId = String(req.body?.ownerId || "").trim();
    const professorId = String(req.body?.professorId || "").trim();
    const papel = req.body?.papel ? String(req.body.papel) : null;
    const permissoes = req.body?.permissoes ?? null;

    if (!["CLUBE", "ESCOLINHA"].includes(tipo)) {
      return res.status(400).json({ error: "tipo deve ser CLUBE ou ESCOLINHA." });
    }
    if (!ownerId) return res.status(400).json({ error: "ownerId obrigatório." });
    if (!professorId) return res.status(400).json({ error: "professorId obrigatório." });

    if (tipo === "CLUBE") {
      const clube = await prisma.clube.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!clube) return res.status(404).json({ error: "Clube não encontrado." });
    } else {
      const esc = await prisma.escolinha.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!esc) return res.status(404).json({ error: "Escolinha não encontrada." });
    }

    const prof = await prisma.professor.findUnique({
      where: { id: professorId },
      select: { id: true },
    });
    if (!prof) return res.status(404).json({ error: "Professor não encontrado." });

    // ⚠️ esse "where" só funciona se você tiver o @@unique([tipo, ownerId, professorId])
    const created = await prisma.organizacaoGestor.upsert({
      where: {
        tipo_ownerId_professorId: {
          tipo: tipo as any,
          ownerId,
          professorId,
        },
      },
      update: {
        ativo: true,
        papel,
        permissoes,
      },
      create: {
        tipo: tipo as any,
        ownerId,
        professorId,
        papel,
        permissoes,
        ativo: true,
      },
    });

    return res.status(201).json({ item: created });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erro ao criar vínculo." });
  }
}

export async function desativarVinculoGestor(req: AuthenticatedRequest, res: Response) {
  try {
    const tipoUsuario = String(req.user?.tipo || "");
    if (!req.user?.id) return res.status(401).json({ error: "Não autenticado." });

    if (tipoUsuario !== "Admin") {
      return res.status(403).json({ error: "Sem permissão." });
    }

    const id = String(req.params?.id || "");
    if (!id) return res.status(400).json({ error: "id obrigatório." });

    const updated = await prisma.organizacaoGestor.update({
      where: { id },
      data: { ativo: false },
    });

    return res.json({ item: updated });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erro ao desativar vínculo." });
  }
}

// 👇 adicione no seu controller (mesmo arquivo)
function canManageOwnerOrAdmin(tipoUsuario: string, myOwnerId: string | null, tipo: string, ownerId: string) {
  if (tipoUsuario === "Admin") return true;
  if (!myOwnerId) return false;

  if (tipoUsuario === "Clube" && tipo === "CLUBE" && myOwnerId === ownerId) return true;
  if (tipoUsuario === "Escolinha" && tipo === "ESCOLINHA" && myOwnerId === ownerId) return true;

  return false;
}

async function getMyOwnerId(req: AuthenticatedRequest) {
  const userId = String(req.user?.id || "");
  const tipoUsuario = String(req.user?.tipo || "");

  if (!userId) return { tipoUsuario, myOwnerId: null as string | null };

  if (tipoUsuario === "Clube") {
    const clube = await prisma.clube.findFirst({ where: { usuarioId: userId }, select: { id: true } });
    return { tipoUsuario, myOwnerId: clube?.id ?? null };
  }

  if (tipoUsuario === "Escolinha") {
    const esc = await prisma.escolinha.findFirst({ where: { usuarioId: userId }, select: { id: true } });
    return { tipoUsuario, myOwnerId: esc?.id ?? null };
  }

  return { tipoUsuario, myOwnerId: null as string | null };
}

export async function listarGestores(req: AuthenticatedRequest, res: Response) {
  try {
    const tipo = String(req.query?.tipo || "").toUpperCase(); // CLUBE | ESCOLINHA
    const ownerId = String(req.query?.ownerId || "").trim();

    if (!["CLUBE", "ESCOLINHA"].includes(tipo)) {
      return res.status(400).json({ message: "tipo deve ser CLUBE ou ESCOLINHA." });
    }
    if (!ownerId) return res.status(400).json({ message: "ownerId obrigatório." });

    const { tipoUsuario, myOwnerId } = await getMyOwnerId(req);

    if (!canManageOwnerOrAdmin(tipoUsuario, myOwnerId, tipo, ownerId)) {
      return res.status(403).json({ message: "Sem permissão." });
    }

    const rows = await prisma.organizacaoGestor.findMany({
      where: { tipo: tipo as any, ownerId },
      orderBy: { createdAt: "desc" },
      include: {
        professor: { select: { id: true, nome: true, cref: true, fotoUrl: true } },
      },
    });

    return res.json({
      items: rows.map((g) => ({
        id: g.id,
        professorId: g.professorId,
        ativo: g.ativo,
        papel: g.papel ?? null,
        permissoes: g.permissoes ?? null,
        professorNome: g.professor?.nome ?? null,
        professorCref: g.professor?.cref ?? null,
        professorFoto: g.professor?.fotoUrl ?? null,
      })),
    });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Falha ao carregar responsáveis." });
  }
}

export async function criarGestor(req: AuthenticatedRequest, res: Response) {
  try {
    const tipo = String(req.body?.tipo || "").toUpperCase();
    const ownerId = String(req.body?.ownerId || "").trim();
    const professorId = String(req.body?.professorId || "").trim();
    const papel = req.body?.papel ? String(req.body.papel) : null;
    const permissoes = req.body?.permissoes ?? null;

    if (!["CLUBE", "ESCOLINHA"].includes(tipo)) {
      return res.status(400).json({ error: "tipo deve ser CLUBE ou ESCOLINHA." });
    }
    if (!ownerId) return res.status(400).json({ error: "ownerId obrigatório." });
    if (!professorId) return res.status(400).json({ error: "professorId obrigatório." });

    const { tipoUsuario, myOwnerId } = await getMyOwnerId(req);
    if (!canManageOwnerOrAdmin(tipoUsuario, myOwnerId, tipo, ownerId)) {
      return res.status(403).json({ error: "Sem permissão." });
    }

    // garante owner existe
    if (tipo === "CLUBE") {
      const clube = await prisma.clube.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!clube) return res.status(404).json({ error: "Clube não encontrado." });
    } else {
      const esc = await prisma.escolinha.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!esc) return res.status(404).json({ error: "Escolinha não encontrada." });
    }

    const prof = await prisma.professor.findUnique({ where: { id: professorId }, select: { id: true } });
    if (!prof) return res.status(404).json({ error: "Professor não encontrado." });

    // ✅ se não tiver @@unique([tipo, ownerId, professorId]) use findFirst
    const existente = await prisma.organizacaoGestor.findFirst({
      where: { tipo: tipo as any, ownerId, professorId },
      select: { id: true },
    });

    const item = existente
      ? await prisma.organizacaoGestor.update({
          where: { id: existente.id },
          data: { ativo: true, papel, permissoes },
        })
      : await prisma.organizacaoGestor.create({
          data: { tipo: tipo as any, ownerId, professorId, papel, permissoes, ativo: true },
        });

    return res.status(201).json({ item });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erro ao adicionar responsável." });
  }
}

export async function atualizarGestor(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params?.id || "");
    if (!id) return res.status(400).json({ error: "id obrigatório." });

    const found = await prisma.organizacaoGestor.findUnique({
      where: { id },
      select: { id: true, tipo: true, ownerId: true },
    });
    if (!found) return res.status(404).json({ error: "Vínculo não encontrado." });

    const { tipoUsuario, myOwnerId } = await getMyOwnerId(req);
    if (!canManageOwnerOrAdmin(tipoUsuario, myOwnerId, String(found.tipo), found.ownerId)) {
      return res.status(403).json({ error: "Sem permissão." });
    }

    const papel = req.body?.papel !== undefined ? (req.body.papel ? String(req.body.papel) : null) : undefined;
    const permissoes = req.body?.permissoes !== undefined ? req.body.permissoes : undefined;
    const ativo = req.body?.ativo !== undefined ? !!req.body.ativo : undefined;

    const item = await prisma.organizacaoGestor.update({
      where: { id },
      data: {
        ...(papel !== undefined ? { papel } : {}),
        ...(permissoes !== undefined ? { permissoes } : {}),
        ...(ativo !== undefined ? { ativo } : {}),
      },
    });

    return res.json({ item });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erro ao salvar responsável." });
  }
}

export async function removerGestor(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params?.id || "");
    if (!id) return res.status(400).json({ error: "id obrigatório." });

    const found = await prisma.organizacaoGestor.findUnique({
      where: { id },
      select: { id: true, tipo: true, ownerId: true },
    });
    if (!found) return res.status(404).json({ error: "Vínculo não encontrado." });

    const { tipoUsuario, myOwnerId } = await getMyOwnerId(req);
    if (!canManageOwnerOrAdmin(tipoUsuario, myOwnerId, String(found.tipo), found.ownerId)) {
      return res.status(403).json({ error: "Sem permissão." });
    }

    // seu front espera DELETE. Vamos desativar (soft delete)
    await prisma.organizacaoGestor.update({ where: { id }, data: { ativo: false } });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erro ao remover responsável." });
  }
}