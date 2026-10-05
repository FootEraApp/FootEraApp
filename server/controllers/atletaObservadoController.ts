import { Response } from "express";
import type {
  AuthenticatedRequest,
} from "../middlewares/auth.js";
import { prisma } from "../prisma.js";
import {
  getActiveContext,
} from "../services/activeContext.js";

type OwnerWhere = {
  professorId?: string;
  escolinhaId?: string;
  clubeId?: string;
  olheiroId?: string;
  OR?: OwnerWhere[];
};

type ObservacaoOwner = {
  tipo:
    | "professor"
    | "clube"
    | "escolinha"
    | "olheiro";

  ownerId: string;

  where: OwnerWhere;

  data:
    | { professorId: string }
    | { clubeId: string }
    | { escolinhaId: string }
    | { olheiroId: string };
};

async function getObservacaoOwner(
  req: AuthenticatedRequest
): Promise<ObservacaoOwner | null> {
  const usuarioId =
    String(
      req.userId ??
      req.user?.id ??
      ""
    ).trim();

  if (!usuarioId) {
    return null;
  }

  const contexto =
    req.authUser?.activeContext ??
    await getActiveContext(
      usuarioId
    );

  if (!contexto) {
    return null;
  }

  if (
    contexto.kind ===
    "PERSONAL"
  ) {
    const papel =
      String(
        contexto.role ??
        contexto.tipoUsuario ??
        ""
      )
        .trim()
        .toLowerCase();

    const profileId =
      String(
        contexto.profileId ??
        contexto.tipoUsuarioId ??
        ""
      ).trim();

    if (!profileId) {
      return null;
    }

    if (
      papel ===
      "professor"
    ) {
      return {
        tipo: "professor",
        ownerId: profileId,
        where: {
          professorId:
            profileId,
        },
        data: {
          professorId:
            profileId,
        },
      };
    }

    if (
      papel ===
      "olheiro"
    ) {
      return {
        tipo: "olheiro",
        ownerId: profileId,
        where: {
          olheiroId:
            profileId,
        },
        data: {
          olheiroId:
            profileId,
        },
      };
    }

    return null;
  }

  if (
    contexto.kind ===
    "ORGANIZATION"
  ) {
    const organizationType =
      String(
        contexto.organizationType ??
        ""
      )
        .trim()
        .toLowerCase();

    const legacyOrganizationId =
      String(
        contexto.legacyOrganizationId ??
        ""
      ).trim();

    if (!legacyOrganizationId) {
      return null;
    }

    if (
      organizationType ===
      "clube"
    ) {
      return {
        tipo: "clube",
        ownerId:
          legacyOrganizationId,
        where: {
          clubeId:
            legacyOrganizationId,
        },
        data: {
          clubeId:
            legacyOrganizationId,
        },
      };
    }

    if (
      organizationType ===
        "escolinha" ||
      organizationType ===
        "escola"
    ) {
      return {
        tipo: "escolinha",
        ownerId:
          legacyOrganizationId,
        where: {
          escolinhaId:
            legacyOrganizationId,
        },
        data: {
          escolinhaId:
            legacyOrganizationId,
        },
      };
    }
  }

  return null;
}

export async function statusObservacao(
  req: AuthenticatedRequest,
  res: Response
) {
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

  const owner =
    await getObservacaoOwner(
      req
    );

  if (!owner) {
    return res.json({
      observando: false,
    });
  }

  const ownerWhere =
    owner.where;

  const existe = await prisma.atletaObservado.findFirst({
    where: { atletaId, ...ownerWhere },
  });

  return res.json({ observando: !!existe });
}

export async function listarObservados(
  req: AuthenticatedRequest,
  res: Response
) {
  const q: any =
    req.query || {};

  const owner =
    await getObservacaoOwner(
      req
    );

  if (!owner) {
    return res.json([]);
  }

  const ownerWhere =
    owner.where;

  const rows =
    await prisma.atletaObservado.findMany({
      where:
        ownerWhere,

      include: {
        atleta: {
          include: {
            usuario: true,
          },
        },
      },

      orderBy: {
        criadoEm:
          "desc",
      },
    });

  const incluirPontuacao = String(q.incluirPontuacao ?? "").trim() !== "";
  const incluirNotas = String(q.incluirNotas ?? "").trim() !== "";

  const lista = rows.map((r) => {
    const rr: any = r;
    const item = {
      id: r.atleta?.usuario?.id ?? r.atleta?.usuarioId ?? r.atletaId,
      observadoId: r.id,
      usuarioId: r.atleta?.usuario?.id ?? r.atleta?.usuarioId ?? "",
      atletaId: r.atletaId,
      owner: {
          professorId: (r as any).professorId ?? null,
          clubeId: (r as any).clubeId ?? null,
          escolinhaId: (r as any).escolinhaId ?? null,
         olheiroId: (r as any).olheiroId ?? null,
      },
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

export async function observarAtleta(
  req: AuthenticatedRequest,
  res: Response
) {
  const {
    atletaId,
  } = req.body as {
    atletaId?: string;
  };

  if (!atletaId) {
    return res.status(400).json({
      message:
        "atletaId é obrigatório",
    });
  }

  const owner =
    await getObservacaoOwner(
      req
    );

  if (!owner) {
    return res.status(403).json({
      message:
        "O contexto ativo não pode observar atletas.",
    });
  }

  try {
    const row = await prisma.atletaObservado.create({
      data: {
        atletaId,
        ...owner.data,
      },
    });

    return res.status(201).json({ ok: true, observando: true, id: row.id });
  } catch (e: any) {
    if (e?.code === "P2002") {
      const ownerWhere =
        owner.where;
      const ja = await prisma.atletaObservado.findFirst({
        where: { atletaId, ...ownerWhere },
      });
      return res.status(200).json({ ok: true, observando: true, id: ja?.id ?? null });
    }

    console.error("observarAtleta error", e);
    return res.status(500).json({ error: "Falha ao observar atleta" });
  }
}

export async function pararDeObservar(
  req: AuthenticatedRequest,
  res: Response
) {
  const { atletaId } = req.params;
  if (!atletaId) {
    return res.status(400).json({ message: "atletaId é obrigatório" });
  }

  const owner =
    await getObservacaoOwner(
      req
    );

  if (!owner) {
    return res.status(403).json({
      message:
        "O contexto ativo não pode remover observações.",
    });
  }

  const ownerWhere =
    owner.where;

  await prisma.atletaObservado.deleteMany({
    where: { atletaId, ...ownerWhere },
  });

  return res.sendStatus(204);
}

export async function listarObservadosPorOlheiro(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    let { olheiroId } = req.params as { olheiroId?: string };

    if (!olheiroId || olheiroId === "me") {
      const q: any = req.query || {};
      olheiroId = q.ownerId || null;
    }

    if (!olheiroId) {
      return res.status(400).json({
        error: "olheiroId é obrigatório",
      });
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
      orderBy: {
        criadoEm: "desc",
      },
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

    return res.status(500).json({
      error: "Falha ao listar observados do olheiro",
    });
  }
}

export async function atualizarObservado(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const idParamRaw = String(
      (req.params as any).id ?? (req.params as any).atletaId ?? ""
    ).trim();

    const b: any = req.body || {};
    const notaInterna = b.notaInterna;
    const alertarMudancas = b.alertarMudancas;

    if (!idParamRaw) {
      return res.status(400).json({ message: "id é obrigatório" });
    }
    
    const owner =
      await getObservacaoOwner(
        req
      );

    if (!owner) {
      return res.status(403).json({
        message:
          "O contexto ativo não pode atualizar observações.",
      });
    }

    const ownerWhere =
      owner.where;

    const byId = await prisma.atletaObservado.findFirst({
      where: { id: idParamRaw, ...ownerWhere },
      select: { id: true },
    });

    if (byId) {
      await prisma.atletaObservado.update({
        where: { id: byId.id },
        data: {
          notaInterna: typeof notaInterna === "string" ? notaInterna : null,
          alertarMudancas: !!alertarMudancas,
        },
      });

      return res.json({ ok: true, mode: "by_observado_id" });
    }

    const result = await prisma.atletaObservado.updateMany({
      where: {
        atletaId: idParamRaw,
        ...ownerWhere,
      },
      data: {
        notaInterna: typeof notaInterna === "string" ? notaInterna : null,
        alertarMudancas: !!alertarMudancas,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ message: "Observação não encontrada para atualizar" });
    }

    return res.json({ ok: true, mode: "by_atleta_id" });
  } catch (e) {
    console.error("[atualizarObservado] erro:", e);
    return res.status(500).json({ message: "Erro ao salvar nota interna" });
  }
}