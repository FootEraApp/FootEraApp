// server/controllers/atletaObservadoController.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Tipo auxiliar para filtros do dono
 */
type OwnerWhere = {
  professorId?: string;
  clubeId?: string;
  escolinhaId?: string;
  olheiroId?: string;
};

/**
 * Para filtros (where): usa os campos ID (professorId, clubeId, ...)
 */
function buildOwnerWhere(tipoRaw: string | undefined, ownerId: string): OwnerWhere {
  const tipo = String(tipoRaw || "").toLowerCase();

  if (tipo === "professor") return { professorId: ownerId };
  if (tipo === "clube") return { clubeId: ownerId };
  if (tipo === "escola" || tipo === "escolinha") return { escolinhaId: ownerId };
  if (tipo === "olheiro") return { olheiroId: ownerId };

  // padrão: professorId
  return { professorId: ownerId };
}

/**
 * Para CREATE: usa nested connect (professor: { connect: { id } })
 */
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

  // se cair aqui é bug de integração → estoura pra aparecer no log
  throw new Error(
    `buildOwnerCreate: tipo de owner inválido ou ausente (tipoRaw="${tipoRaw}", ownerId="${ownerId}")`
  );
}

/**
 * GET /api/observados/status/:atletaId?ownerId=...&tipo=...
 * :atletaId pode ser atletaId OU usuarioId (do atleta)
 */
export async function statusObservacao(req: Request, res: Response) {
  const { atletaId: rawId } = req.params as { atletaId?: string };

  if (!rawId) {
    return res.status(400).json({ message: "id é obrigatório" });
  }

  // 1) Resolver o ID real do atleta (pode vir Atleta.id ou Usuario.id)
  const atleta = await prisma.atleta.findFirst({
    where: {
      OR: [{ id: rawId }, { usuarioId: rawId }],
    },
    select: { id: true },
  });

  if (!atleta) {
    // Se não achar atleta correspondente, considera não observado
    return res.json({ observando: false });
  }

  const atletaId = atleta.id;

  const q: any = req.query || {};
  const user: any = (req as any).user || {};

  // 2) Descobrir o dono (professor/clube/escolinha/olheiro)
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
    // sem dono => não tem como estar observando
    return res.json({ observando: false });
  }

  const ownerWhere = buildOwnerWhere(tipoRaw, ownerId);

  const existe = await prisma.atletaObservado.findFirst({
    where: { atletaId, ...ownerWhere },
  });

  return res.json({ observando: !!existe });
}

/**
 * GET /api/observados?ownerId=...&tipo=...
 * Também aceita: ?tipoUsuarioId=...&usuarioId=...
 */
export async function listarObservados(req: Request, res: Response) {
  const q: any = req.query || {};
  const user: any = (req as any).user || {};

  // 1) Descobrir o ID do dono (professor/escolinha/clube/olheiro)
  const ownerId: string =
    (q.ownerId as string) ||
    (q.tipoUsuarioId as string) || // o que o front está mandando
    (q.professorId as string) ||
    (q.clubeId as string) ||
    (q.escolinhaId as string) ||
    (q.olheiroId as string) ||
    (user.tipoUsuarioId as string) || // cai pro token, se existir
    "";

  // Se mesmo assim não tiver um dono, devolve lista vazia (não quebra a tela)
  if (!ownerId) {
    return res.json([]);
  }

  // 2) Descobrir o tipo do dono
  const tipoRaw: string =
    (q.tipo as string) ||
    (q.tipoUsuario as string) ||
    (q.tipoSalvo as string) ||
    (user.tipo as string) ||
    (user.tipoUsuario as string) ||
    ""; // pode ficar vazio, o buildOwnerWhere trata

  const ownerWhere = buildOwnerWhere(tipoRaw, ownerId);

  // 3) Buscar os atletas observados por esse dono
  const rows = await prisma.atletaObservado.findMany({
    where: ownerWhere,
    include: { atleta: { include: { usuario: true } } },
    orderBy: { criadoEm: "desc" },
  });

  const incluirPontuacao = String(q.incluirPontuacao ?? "").trim() !== "";
  const incluirNotas = String(q.incluirNotas ?? "").trim() !== "";

  const lista = rows.map((r) => {
    const rr: any = r; // para acessar campos adicionais (notaInterna, alertarMudancas)
    return {
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
  });

  return res.json(lista);
}

/**
 * POST /api/observados
 * body: { atletaId, ownerId, tipo }
 */
export async function observarAtleta(req: Request, res: Response) {
  const { atletaId, ownerId, tipo } = req.body as {
    atletaId?: string;
    ownerId?: string;
    tipo?: string;
  };

  if (!atletaId || !ownerId) {
    return res
      .status(400)
      .json({ message: "atletaId e ownerId são obrigatórios" });
  }

  const ownerWhere = buildOwnerWhere(tipo, ownerId);
  const ownerCreate = buildOwnerCreate(tipo, ownerId);

  try {
    const row = await prisma.atletaObservado.create({
      data: {
        atleta: { connect: { id: atletaId } },
        ...ownerCreate,
      },
    });

    return res.status(201).json({ ok: true, observando: true, id: row.id });
  } catch (e: any) {
    // unique constraint (já existe relação)
    if (e?.code === "P2002") {
      const ja = await prisma.atletaObservado.findFirst({
        where: { atletaId, ...ownerWhere },
      });
      return res.status(200).json({
        ok: true,
        observando: true,
        id: ja?.id ?? null,
      });
    }
    console.error("observarAtleta error", e);
    return res.status(500).json({ error: "Falha ao observar atleta" });
  }
}

/**
 * DELETE /api/observados/:atletaId
 * body/query podem conter { ownerId, tipo }
 */
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

  // se não tiver ownerId, não faz nada (no-op)
  if (!ownerId) {
    return res.sendStatus(204);
  }

  const ownerWhere = buildOwnerWhere(tipoRaw, ownerId);

  await prisma.atletaObservado.deleteMany({
    where: { atletaId, ...ownerWhere },
  });

  return res.sendStatus(204);
}

/**
 * GET /api/observados/olheiro/:olheiroId
 */
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
