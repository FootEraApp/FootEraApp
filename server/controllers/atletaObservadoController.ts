import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type OwnerWhere = {
  professorId?: string;
  escolinhaId?: string;
  clubeId?: string;
  olheiroId?: string;
  OR?: OwnerWhere[];
};

function buildOwnerWhere(tipoRaw: string | undefined, ownerId: string): OwnerWhere {
  const tipo = String(tipoRaw || "").toLowerCase();

  if (tipo === "professor") return { professorId: ownerId };
  if (tipo === "clube") return { clubeId: ownerId };
  if (tipo === "escola" || tipo === "escolinha") return { escolinhaId: ownerId };
  if (tipo === "olheiro") return { olheiroId: ownerId };

  return {
    OR: [
      { professorId: ownerId },
      { escolinhaId: ownerId },
      { clubeId: ownerId },
      { olheiroId: ownerId },
    ],
  };
}

function buildOwnerCreate(tipoRaw: string | undefined, ownerId: string) {
  const tipo = String(tipoRaw || "").toLowerCase();

  if (tipo === "professor") {
    return { professor: { connect: { id: ownerId } } };
  }

  if (tipo === "clube") {
    return { clube: { connect: { id: ownerId } } };
  }

  if (tipo === "escola" || tipo === "escolinha") {
    return { escolinha: { connect: { id: ownerId } } };
  }

  if (tipo === "olheiro") {
    return { olheiro: { connect: { id: ownerId } } };
  }

  throw new Error(
    `buildOwnerCreate: tipo de owner inválido ou ausente (tipoRaw="${tipoRaw}", ownerId="${ownerId}")`
  );
}

export async function statusObservacao(req: Request, res: Response) {
  const { atletaId: rawId } = req.params as { atletaId?: string };

  if (!rawId) {
    return res.status(400).json({ message: "id é obrigatório" });
  }

  const atleta = await prisma.atleta.findFirst({
    where: {
      OR: [{ id: rawId }, { usuarioId: rawId }],
    },
    select: { id: true },
  });

  if (!atleta) {
    return res.json({ observando: false });
  }

  const atletaId = atleta.id;

  const q: any = req.query || {};
  const user: any = (req as any).user || {};

  const ownerId: string =
    (q.ownerId as string) ||
    (q.tipoUsuarioId as string) ||
    (user.tipoUsuarioId as string) ||
    "";

  const tipoRaw: string =
    (q.tipo as string) ||
    (q.tipoUsuario as string) ||
    (user.tipo as string) ||
    (user.tipoUsuario as string) ||
    "";

  if (!ownerId) {
    return res.json({ observando: false });
  }

  const ownerWhere = buildOwnerWhere(tipoRaw, ownerId);

  const existe = await prisma.atletaObservado.findFirst({
    where: { atletaId, ...ownerWhere },
  });

  return res.json({ observando: !!existe });
}

export async function listarObservados(req: Request, res: Response) {
  const q: any = req.query || {};
  const user: any = (req as any).user || {};

  const ownerId: string =
    (q.ownerId as string) ||
    (q.tipoUsuarioId as string) ||
    (q.professorId as string) ||
    (q.clubeId as string) ||
    (q.escolinhaId as string) ||
    (q.olheiroId as string) ||
    (user.tipoUsuarioId as string) ||
    "";

  if (!ownerId) {
    return res.json([]);
  }

  const tipoRaw: string =
    (q.tipo as string) ||
    (q.tipoUsuario as string) ||
    (q.tipoSalvo as string) ||
    (user.tipo as string) ||
    (user.tipoUsuario as string) ||
    "";

  const ownerWhere = buildOwnerWhere(tipoRaw, ownerId);

  const rows = await prisma.atletaObservado.findMany({
    where: ownerWhere,
    include: { atleta: { include: { usuario: true } } },
    orderBy: { criadoEm: "desc" },
  });

  if (rows.length > 0) {
    console.log(
      "[OBSERVADOS] Exemplo de row[0]:",
      JSON.stringify(rows[0], null, 2)
    );
  }

  const incluirPontuacao = String(q.incluirPontuacao ?? "").trim() !== "";
  const incluirNotas = String(q.incluirNotas ?? "").trim() !== "";

  const lista = rows.map((r) => {
    const rr: any = r;
    const item = {
      id: r.atleta?.usuario?.id ?? r.atleta?.usuarioId ?? r.atletaId,
      usuarioId: r.atleta?.usuario?.id ?? r.atleta?.usuarioId ?? "",
      atletaId: r.atletaId,
      nome: r.atleta?.usuario?.nome ?? "Atleta",
      foto: r.atleta?.usuario?.foto ?? null,
      posicao: (r as any).atleta?.posicao ?? null,
      idade: (r as any).atleta?.idade ?? null,
      altura: (r as any).atleta?.altura ?? null,
      peso: (r as any).atleta?.peso ?? null,
      observadoEm: r.criadoEm?.toISOString?.() ?? null,
      categoria: (r as any).atleta?.categoria ?? null,
      pontuacao: incluirPontuacao ? (r as any).atleta?.pontuacao ?? null : null,
      notaInterna: incluirNotas ? rr.notaInterna ?? null : null,
      alertarMudancas: incluirNotas ? rr.alertarMudancas ?? null : null,
    };

    return item;
  });

  return res.json(lista);
}

export async function observarAtleta(req: Request, res: Response) {
  const { atletaId, ownerId, tipo } = req.body as {
    atletaId?: string;
    ownerId?: string;
    tipo?: string;
  };

  if (!atletaId || !ownerId) {
    return res.status(400).json({ message: "atletaId e ownerId são obrigatórios" });
  }

  const t = String(tipo || "").toLowerCase();

  const ownerData: any = {};
  if (t === "professor") ownerData.professorId = ownerId;
  else if (t === "clube") ownerData.clubeId = ownerId;
  else if (t === "escola" || t === "escolinha") ownerData.escolinhaId = ownerId;
  else if (t === "olheiro") ownerData.olheiroId = ownerId;
  else {
    return res.status(400).json({ message: `tipo inválido: "${tipo}"` });
  }

  try {
    const row = await prisma.atletaObservado.create({
      data: {
        atletaId,
        ...ownerData,
      },
    });

    return res.status(201).json({ ok: true, observando: true, id: row.id });
  } catch (e: any) {
    if (e?.code === "P2002") {
      const ownerWhere = buildOwnerWhere(tipo, ownerId);
      const ja = await prisma.atletaObservado.findFirst({
        where: { atletaId, ...ownerWhere },
      });
      return res.status(200).json({ ok: true, observando: true, id: ja?.id ?? null });
    }

    console.error("observarAtleta error", e);
    return res.status(500).json({ error: "Falha ao observar atleta" });
  }
}

export async function pararDeObservar(req: Request, res: Response) {
  const { atletaId } = req.params;
  if (!atletaId) {
    return res.status(400).json({ message: "atletaId é obrigatório" });
  }

  const q: any = req.query || {};
  const b: any = req.body || {};
  const user: any = (req as any).user || {};

  const ownerId: string =
    b.ownerId ||
    q.ownerId ||
    q.tipoUsuarioId ||
    user.tipoUsuarioId ||
    "";

  const tipoRaw: string =
    b.tipo ||
    q.tipo ||
    q.tipoUsuario ||
    user.tipo ||
    user.tipoUsuario ||
    "";

  if (!ownerId) {
    return res.sendStatus(204);
  }

  const ownerWhere = buildOwnerWhere(tipoRaw, ownerId);

  await prisma.atletaObservado.deleteMany({
    where: { atletaId, ...ownerWhere },
  });

  return res.sendStatus(204);
}

export async function listarObservadosPorOlheiro(req: Request, res: Response) {
  try {
    let { olheiroId } = req.params as { olheiroId?: string };
    if (!olheiroId || olheiroId === "me") {
      const q: any = req.query || {};
      olheiroId = q.ownerId || null;
    }
    if (!olheiroId) {
      return res.status(400).json({ error: "olheiroId é obrigatório" });
    }

    const rows = await prisma.atletaObservado.findMany({
      where: { olheiroId },
      include: {
        atleta: {
          include: {
            usuario: true,
          },
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    const lista = rows.map((r) => {
      const rr: any = r;
      return {
        id: r.atleta?.usuario?.id ?? r.atletaId,
        atletaId: r.atletaId,
        nome: r.atleta?.usuario?.nome ?? "Atleta",
        foto: r.atleta?.usuario?.foto ?? null,
        posicao: (r as any).atleta?.posicao ?? null,
        idade: (r as any).atleta?.idade ?? null,
        altura: (r as any).atleta?.altura ?? null,
        peso: (r as any).atleta?.peso ?? null,
        observadoEm: r.criadoEm?.toISOString?.() ?? null,
        categoria: (r as any).atleta?.categoria ?? null,
        pontuacao: (r as any).atleta?.pontuacao ?? null,
        notaInterna: rr.notaInterna ?? null,
        alertarMudancas: rr.alertarMudancas ?? null,
      };
    });

    return res.json(lista);
  } catch (e) {
    console.error("listarObservadosPorOlheiro", e);
    return res
      .status(500)
      .json({ error: "Falha ao listar observados do olheiro" });
  }
}
