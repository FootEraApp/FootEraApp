// server/controllers/atletaObservadoController.ts
import { PrismaClient, TipoUsuario } from "@prisma/client";
import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.js";

const prisma = new PrismaClient();

export async function observarAtleta(req: AuthenticatedRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Não autenticado" });

  const { atletaUsuarioId } = req.body || {};
  if (!atletaUsuarioId) {
    return res.status(400).json({ error: "atletaUsuarioId é obrigatório" });
  }

  const atleta = await prisma.atleta.findUnique({
    where: { usuarioId: String(atletaUsuarioId) },
    select: { id: true },
  });
  if (!atleta) return res.status(404).json({ error: "Atleta não encontrado" });

  const data: any = { atletaId: atleta.id };

  try {
    const data: any = { atletaId: atleta.id };

    switch (req.tipo) {
      case TipoUsuario.Professor:
      case "Professor":
        data.professorId = req.tipoUsuarioId;
        break;
      case TipoUsuario.Clube:
      case "Clube":
        data.clubeId = req.tipoUsuarioId;
        break;
      case TipoUsuario.Escolinha:
      case "Escolinha":
        data.escolinhaId = req.tipoUsuarioId;
        break;
      case TipoUsuario.Olheiro:
      case "Olheiro":
        data.olheiroId = req.tipoUsuarioId;   // ✅ ESSENCIAL
        break;
      default:
        return res.status(403).json({ error: "Este perfil não pode observar atletas" });
    }

    // (opcional) log pra conferir
    console.log("observarAtleta payload:", { tipo:req.tipo, tipoUsuarioId:req.tipoUsuarioId, data });

    await prisma.atletaObservado.create({ data });
    return res.status(201).json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2002")
      return res.status(409).json({ ok: true, message: "Já observando" });

    console.error("observarAtleta error:", e); // 👈 coloque esse catch aqui
    return res.status(500).json({ error: e?.message, code: e?.code });
  }
}

export async function listarObservados(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Não autenticado" });

    const where: any = {};
    switch (req.tipo) {
      case TipoUsuario.Professor:
      case "Professor":
        where.professorId = req.tipoUsuarioId;
        break;
      case TipoUsuario.Clube:
      case "Clube":
        where.clubeId = req.tipoUsuarioId;
        break;
      case TipoUsuario.Escolinha:
      case "Escolinha":
        where.escolinhaId = req.tipoUsuarioId;
        break;
      case TipoUsuario.Olheiro:
      case "Olheiro":
        where.olheiroId = req.tipoUsuarioId; // << usar o id do olheiro aqui
        break;
      default:
        return res.json([]);
    }

    const rows = await prisma.atletaObservado.findMany({
      where,
      include: {
        atleta: { include: { usuario: { select: { id: true, nome: true, foto: true } } } },
      },
      orderBy: { criadoEm: "desc" },
    });

    return res.json(
      rows.map((r) => ({
        id: r.atleta?.usuario?.id ?? r.atletaId,
        atletaId: r.atletaId,
        usuarioId: r.atleta?.usuario?.id ?? null,
        nome: r.atleta?.usuario?.nome ?? null,
        foto: r.atleta?.usuario?.foto ?? null,
      }))
    );
  } catch (e) {
    console.error("listarObservados ERROR:", e);
    return res.json([]);
  }
}

export async function pararDeObservar(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Não autenticado" });

    const { atletaId } = req.params;
    const where: any = { atletaId };

    switch (req.tipo) {
      case TipoUsuario.Professor:
      case "Professor":
        where.professorId = req.tipoUsuarioId;
        break;
      case TipoUsuario.Clube:
      case "Clube":
        where.clubeId = req.tipoUsuarioId;
        break;
      case TipoUsuario.Escolinha:
      case "Escolinha":
        where.escolinhaId = req.tipoUsuarioId;
        break;
      case TipoUsuario.Olheiro:
      case "Olheiro":
        where.olheiroId = req.tipoUsuarioId;
        break;
      default:
        return res.status(403).json({ error: "Este perfil não pode parar observação" });
    }

    await prisma.atletaObservado.deleteMany({ where });
    return res.json({ ok: true });
  } catch (e) {
    console.error("pararDeObservar ERROR:", e);
    return res.status(500).json({ error: "Falha ao parar observação" });
  }
}

// controllers/atletaObservadoController.ts
export async function listarObservadosPorOlheiro(req: AuthenticatedRequest, res: Response) {
  const { olheiroId } = req.params;
  const rows = await prisma.atletaObservado.findMany({
    where: { olheiroId },
    include: { atleta: { include: { usuario: { select: { id: true, nome: true, foto: true } } } } },
    orderBy: { criadoEm: "desc" },
  });
  res.json(rows.map(r => ({
    id: r.atleta?.usuario?.id ?? r.atletaId,
    atletaId: r.atletaId,
    usuarioId: r.atleta?.usuario?.id ?? null,
    nome: r.atleta?.usuario?.nome ?? null,
    foto: r.atleta?.usuario?.foto ?? null,
  })));
}