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
      // AGORA usamos olheiroId (nada de todos nulos)
      data.olheiroId = req.tipoUsuarioId;
      break;
    default:
      return res.status(403).json({ error: "Este perfil não pode observar atletas" });
  }

  try {
    await prisma.atletaObservado.create({ data });
    return res.status(201).json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(409).json({ ok: true, message: "Já observando" });
    console.error(e);
    return res.status(500).json({ error: "Falha ao observar atleta" });
  }
}

export async function listarObservados(req: AuthenticatedRequest, res: Response) {
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
      where.olheiroId = req.tipoUsuarioId; // <-- aqui!
      break;
    default:
      return res.json([]);
  }

  const rows = await prisma.atletaObservado.findMany({
    where,
    include: {
      atleta: { include: { usuario: { select: { id: true, nome: true, foto: true } } } },
    },
    orderBy: { criadoEm: "desc" }, // campo que existe no schema
  });

  res.json(
    rows.map((r) => ({
      id: r.atleta?.usuario?.id ?? r.atletaId,
      atletaId: r.atletaId,
      usuarioId: r.atleta?.usuario?.id ?? null,
      nome: r.atleta?.usuario?.nome ?? null,
      foto: r.atleta?.usuario?.foto ?? null,
    }))
  );
}

export async function pararDeObservar(req: AuthenticatedRequest, res: Response) {
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
      where.olheiroId = req.tipoUsuarioId; // <-- aqui!
      break;
    default:
      return res.status(403).json({ error: "Este perfil não pode parar observação" });
  }

  await prisma.atletaObservado.deleteMany({ where });
  res.json({ ok: true });
}
