import { Request, Response } from "express";
import { PosicaoCampo } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { prisma } from "../prisma.js";
import {
  getActiveContext,
} from "../services/activeContext.js";

type ElencoOwner = {
  tipo:
    | "professor"
    | "clube"
    | "escolinha";

  ownerId: string;

  where:
    | { professorId: string }
    | { clubeId: string }
    | { escolinhaId: string };

  data:
    | { professorId: string }
    | { clubeId: string }
    | { escolinhaId: string };
};

async function getElencoOwner(
  req: AuthenticatedRequest
): Promise<ElencoOwner | null> {
  const usuarioId = String(
    req.userId ??
      req.user?.id ??
      ""
  ).trim();

  if (!usuarioId) {
    return null;
  }

  const contexto =
    req.authUser?.activeContext ??
    await getActiveContext(usuarioId);

  if (!contexto) {
    return null;
  }

  if (contexto.kind === "PERSONAL") {
    const papel = String(
      contexto.role ??
        contexto.tipoUsuario ??
        ""
    )
      .trim()
      .toLowerCase();

    const profileId = String(
      contexto.profileId ??
        contexto.tipoUsuarioId ??
        ""
    ).trim();

    if (!profileId) {
      return null;
    }

    if (papel === "professor") {
      return {
        tipo: "professor",
        ownerId: profileId,

        where: {
          professorId: profileId,
        },

        data: {
          professorId: profileId,
        },
      };
    }

    return null;
  }

  if (contexto.kind === "ORGANIZATION") {
    const organizationType = String(
      contexto.organizationType ??
        ""
    )
      .trim()
      .toLowerCase();

    const legacyOrganizationId = String(
      contexto.legacyOrganizationId ??
        ""
    ).trim();

    if (!legacyOrganizationId) {
      return null;
    }

    if (organizationType === "clube") {
      return {
        tipo: "clube",
        ownerId: legacyOrganizationId,

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
      organizationType === "escolinha" ||
      organizationType === "escola"
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

async function podeGerenciarTurma(
  req: AuthenticatedRequest,
  turmaId: string
) {
  const owner =
    await getElencoOwner(req);

  if (!owner) {
    return false;
  }

  const turma =
    await prisma.turma.findFirst({
      where: {
        id: turmaId,
        ativo: true,
      },

      select: {
        clubeId: true,
        escolinhaId: true,

        professores: {
          select: {
            professorId: true,
          },
        },
      },
    });

  if (!turma) {
    return false;
  }

  if (owner.tipo === "clube") {
    return (
      turma.clubeId ===
      owner.ownerId
    );
  }

  if (owner.tipo === "escolinha") {
    return (
      turma.escolinhaId ===
      owner.ownerId
    );
  }

  if (owner.tipo === "professor") {
    return turma.professores.some(
      (item) =>
        item.professorId ===
        owner.ownerId
    );
  }

  return false;
}

async function montarRespostaElencos(
  owner: ElencoOwner,
  turmaId?: string
) {
  const where: Prisma.ElencoWhereInput = {
    ativo: true,

    ...owner.where,

    ...(turmaId
      ? {
          turmaId,
        }
      : {}),
  };

  const elencos =
    await prisma.elenco.findMany({
      where,

      select: {
        id: true,
        nome: true,
        atletasIds: true,
        escala: true,
        formacao: true,
        turmaId: true,
        maxJogadores: true,
      },

      orderBy: {
        dataCriacao: "desc",
      },
    });

  return elencos;
}

export async function listarElencosMinha(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const turmaId =
      req.query.turmaId
        ? String(req.query.turmaId)
        : undefined;

    const owner =
      await getElencoOwner(req);

    if (!owner) {
      return res.json([]);
    }

    if (turmaId) {
      const autorizado =
        await podeGerenciarTurma(
          req,
          turmaId
        );

      if (!autorizado) {
        return res.status(403).json({
          error:
            "Sem permissão nesta turma",
        });
      }
    }

    const data =
      await montarRespostaElencos(
        owner,
        turmaId
      );

    return res.json(data);
  } catch (e) {
    console.error(
      "[listarElencosMinha] erro:",
      e
    );

    return res.status(500).json({
      error:
        "Erro ao buscar elencos.",
    });
  }
}

export async function escalaPorTurma(req: AuthenticatedRequest, res: Response) {
   try {
     const turmaId =
        String(
          req.query.turmaId || ""
        ).trim();

      if (!turmaId) {
        return res.status(400).json({
          error:
            "turmaId obrigatório",
        });
      }

      const owner =
        await getElencoOwner(req);

      if (!owner) {
        return res.status(403).json({
          error:
            "O contexto ativo não pode acessar esta turma.",
        });
      }

      const autorizado =
        await podeGerenciarTurma(
          req,
          turmaId
        );

      if (!autorizado) {
        return res.status(403).json({
          error:
            "Sem permissão nesta turma",
        });
      }

      const turma =
        await prisma.turma.findUnique({
          where: {
            id: turmaId,
          },

          select: {
            id: true,
            nome: true,
          },
        });

      if (!turma) {
        return res.status(404).json({
          error:
            "Turma não encontrada",
        });
      }

    const elencoId = String(
      req.query.elencoId || ""
    ).trim();

    const elenco =
      await prisma.elenco.findFirst({
        where: {
          turmaId,
          ativo: true,

          ...owner.where,

          ...(elencoId
            ? {
                id: elencoId,
              }
            : {}),
        },

        orderBy: {
          dataCriacao: "desc",
        },

        select: {
          id: true,
          nome: true,
          maxJogadores: true,
          escala: true,
          formacao: true,
        },
      });

    if (!elenco) return res.json(null);

    const escalaBruta =
      (
        elenco.escala as
          | Record<string, unknown>
          | null
      ) ?? {};

    const entradasTitulares =
      Object.entries(escalaBruta)
        .filter(
          (
            entrada
          ): entrada is [
            string,
            string
          ] => {
            const [chave, valor] =
              entrada;

            return (
              chave !==
                "__reservasIds" &&
              typeof valor ===
                "string" &&
              valor.trim().length > 0
            );
          }
        );

    const escalaTitulares =
      Object.fromEntries(
        entradasTitulares
      ) as Record<
        string,
        string
      >;

    const atletasIds = Array.from(
      new Set(
        Object.values(
          escalaTitulares
        )
      )
    );

    const atletas = atletasIds.length
      ? await prisma.atleta.findMany({
          where: { id: { in: atletasIds } },
          select: { id: true, usuarioId: true, nome: true, foto: true, idade: true, posicao: true },
        })
      : [];

    const byId = new Map(atletas.map((a) => [a.id, a]));
    const escalaEnriquecida: any = {};
    Object.entries(escalaTitulares).forEach(([pos, atletaId]) => {
      const a = atletaId ? byId.get(atletaId) : null;
      escalaEnriquecida[pos] = a
        ? {
            atletaId: a.id,
            usuarioId: a.usuarioId,
            nome: a.nome,
            foto: a.foto,
            idade: a.idade,
            posicao: a.posicao,
          }
        : null;
    });

    return res.json({
      id: elenco.id,
      nome:
        elenco.nome ??
        turma.nome ??
        "Elenco",
      maxJogadores:
        elenco.maxJogadores ?? 11,
      escala:
        escalaEnriquecida,
      reservasIds:
        normalizarIds(
          escalaBruta.__reservasIds
        ),
      formacao:
        typeof elenco.formacao === "string"
          ? elenco.formacao
          : null,
    });
  } catch (e) {
    console.error("[escalaPorTurma] erro:", e);
    return res.status(500).json({ error: "Erro ao buscar escala." });
  }
}

function extrairAtletasDaEscala(escala: any): string[] {
  if (!escala || typeof escala !== "object") return [];
  const set = new Set<string>();

  for (const val of Object.values(escala)) {
    if (!val) continue;
    if (typeof val === "string") {
      set.add(val);
    } else if (typeof val === "object" && val !== null) {
      const id = (val as any).atletaId ?? (val as any).id ?? null;
      if (id) set.add(String(id));
    }
  }

  return Array.from(set);
}

async function getEscalaCore(elencoId: string, res: Response) {
  try {
    const elenco = await prisma.elenco.findUnique({
      where: { id: elencoId },
      select: {
        id: true,
        nome: true,
        maxJogadores: true,
        escala: true,
        formacao: true,
      },
    });

    if (!elenco) {
      return res.json(null);
    }

    const escala =
      (elenco.escala as Record<string, string | null> | null) ?? null;

    const formacao =
      typeof elenco.formacao === "string"
        ? elenco.formacao
        : null;
        
    return res.json({
      id: elenco.id,
      nome: elenco.nome,
      maxJogadores: elenco.maxJogadores,
      escala,
      formacao,
    });
  } catch (err) {
    console.error("Erro ao buscar escala do elenco:", err);
    return res.status(500).json({ error: "Erro ao buscar escala do elenco" });
  }
}

export async function getEscalaPorElencoId(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "id é obrigatório" });
  return getEscalaCore(id, res);
}

export async function getEscalaPorDono(req: Request, res: Response) {
  try {
    const fromQuery = (req.query.tipoUsuarioId ?? "") as string;
    const fromParams =
      (req.params.escolinhaId as string | undefined) ||
      (req.params.clubeId as string | undefined) ||
      (req.params.professorId as string | undefined);

    const tipoUsuarioId = String(fromQuery || fromParams || "").trim();
    if (!tipoUsuarioId) {
      return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });
    }

    const elenco = await prisma.elenco.findFirst({
      where: {
        ativo: true,
        OR: [
          { professorId: tipoUsuarioId },
          { escolinhaId: tipoUsuarioId },
          { clubeId: tipoUsuarioId },
        ],
      },
      orderBy: { dataCriacao: "desc" },
    });

    if (!elenco) return res.json(null);

    return getEscalaCore(elenco.id, res);
  } catch (err) {
    console.error("Erro ao buscar escala por dono:", err);
    return res.status(500).json({ error: "Erro ao buscar escala por dono" });
  }
}

export async function listarElencos(req: Request, res: Response) {
  try {
    const tipoUsuarioId = String(req.query.tipoUsuarioId ?? "").trim();
    const turmaId = req.query.turmaId ? String(req.query.turmaId).trim() : "";

    if (!tipoUsuarioId) {
      return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });
    }

    const where: any = {
      OR: [
        { professorId: tipoUsuarioId },
        { escolinhaId: tipoUsuarioId },
        { clubeId: tipoUsuarioId },
      ],
      ativo: true,
    };

    if (turmaId) {
      where.turmaId = turmaId;
    }

    const elencos = await prisma.elenco.findMany({
      where,
      select: {
        id: true,
        nome: true,
        maxJogadores: true,
        escala: true,
        formacao: true,
        atletasIds: true,
        turmaId: true,
      },
      orderBy: { dataCriacao: "desc" },
    });

    return res.json(elencos);
  } catch (err) {
    console.error("Erro ao listar elencos:", err);
    return res.status(500).json({ error: "Erro ao listar elencos" });
  }
}

function normalizarIds(
  valores: unknown
): string[] {
  if (!Array.isArray(valores)) {
    return [];
  }

  return Array.from(
    new Set(
      valores
        .map(String)
        .map((id) => id.trim())
        .filter(Boolean)
    )
  );
}

function limparEscala(
  escala: unknown,
  atletasPermitidos: Set<string>
): Record<string, string | null> {
  const resultado: Record<
    string,
    string | null
  > = {};

  if (
    !escala ||
    typeof escala !== "object"
  ) {
    return resultado;
  }

  const posicoesValidas = new Set(
    Object.values(PosicaoCampo)
  );

  const atletasUsados =
    new Set<string>();

  for (
    const [posicao, valor]
    of Object.entries(
      escala as Record<string, unknown>
    )
  ) {
    if (
      posicao === "__reservasIds" ||
      !posicoesValidas.has(
        posicao as PosicaoCampo
      )
    ) {
      continue;
    }

    let atletaId:
      | string
      | null = null;

    if (typeof valor === "string") {
      atletaId =
        valor.trim() || null;
    } else if (
      valor &&
      typeof valor === "object"
    ) {
      const objeto = valor as {
        atletaId?: unknown;
        id?: unknown;
      };

      const id =
        objeto.atletaId ??
        objeto.id ??
        null;

      atletaId =
        id != null
          ? String(id).trim()
          : null;
    }

    const atletaValido =
      atletaId &&
      atletasPermitidos.has(atletaId) &&
      !atletasUsados.has(atletaId);

    if (atletaValido && atletaId) {
      resultado[posicao] =
        atletaId;

      atletasUsados.add(
        atletaId
      );
    } else {
      resultado[posicao] =
        null;
    }
  }

  return resultado;
}

async function prepararJogadoresElenco(
  turmaId: string,
  escala: unknown,
  reservasIds: unknown
) {
  const atletasPermitidos =
    await buscarAtletaIdsDaTurma(
      turmaId
    );

  if (atletasPermitidos === null) {
    return {
      ok: false as const,
      error:
        "Turma não encontrada ou inativa.",
    };
  }

  const escalaLimpa =
    limparEscala(
      escala,
      atletasPermitidos
    );

  const titularesValidos =
    extrairAtletasDaEscala(
      escalaLimpa
    );

  const titularesSet = new Set(
    titularesValidos
  );

  const reservasValidas =
    normalizarIds(reservasIds)
      .filter(
        (id) =>
          atletasPermitidos.has(id) &&
          !titularesSet.has(id)
      );

  if (titularesValidos.length > 11) {
    return {
      ok: false as const,

      error:
        "O elenco pode possuir no máximo 11 titulares.",
    };
  }

  if (reservasValidas.length > 11) {
    return {
      ok: false as const,

      error:
        "O elenco pode possuir no máximo 11 reservas.",
    };
  }

  const totalSelecionados =
    titularesValidos.length +
    reservasValidas.length;

  if (totalSelecionados < 2) {
    return {
      ok: false as const,

      error:
        "Adicione pelo menos 2 jogadores válidos ao elenco.",

      detalhe: {
        titulares:
          titularesValidos.length,

        reservas:
          reservasValidas.length,
      },
    };
  }

  const atletasIdsFinal = [
    ...titularesValidos,
    ...reservasValidas,
  ];

  return {
    ok: true as const,
    escalaLimpa,
    titularesValidos,
    reservasValidas,
    atletasIdsFinal,
  };
}

async function buscarAtletaIdsDaTurma(
  turmaId: string
): Promise<Set<string> | null> {
  const turma =
    await prisma.turma.findUnique({
      where: {
        id: turmaId,
      },

      select: {
        id: true,
        ativo: true,
        clubeId: true,
        escolinhaId: true,

        membros: {
          select: {
            usuarioId: true,
          },
        },

        professores: {
          select: {
            professorId: true,
          },
        },
      },
    });

  if (!turma || turma.ativo === false) {
    return null;
  }

  const usuarioIds =
    turma.membros
      .map(
        (membro) =>
          membro.usuarioId
      )
      .filter(Boolean);

  if (!usuarioIds.length) {
    return new Set();
  }

  const professorIds =
    turma.professores
      .map(
        (item) =>
          item.professorId
      )
      .filter(Boolean);

  const vinculosDiretos:
    Prisma.AtletaWhereInput[] = [];

  if (turma.clubeId) {
    vinculosDiretos.push({
      clubeId: turma.clubeId,
    });
  }

  if (turma.escolinhaId) {
    vinculosDiretos.push({
      escolinhaId:
        turma.escolinhaId,
    });
  }

  const relacoesPermitidas:
    Prisma.RelacaoTreinamentoWhereInput[] =
    [];

  if (turma.clubeId) {
    relacoesPermitidas.push({
      clubeId: turma.clubeId,
    });
  }

  if (turma.escolinhaId) {
    relacoesPermitidas.push({
      escolinhaId:
        turma.escolinhaId,
    });
  }

  if (professorIds.length) {
    relacoesPermitidas.push({
      professorId: {
        in: professorIds,
      },
    });
  }

  if (relacoesPermitidas.length) {
    vinculosDiretos.push({
      relacoesTreinamento: {
        some: {
          ativo: true,
          encerradoEm: null,
          OR: relacoesPermitidas,
        },
      },
    });
  }

  if (!vinculosDiretos.length) {
    return new Set();
  }

  const atletas =
    await prisma.atleta.findMany({
      where: {
        usuarioId: {
          in: usuarioIds,
        },

        OR: vinculosDiretos,
      },

      select: {
        id: true,
      },
    });

  return new Set(
    atletas.map(
      (atleta) =>
        atleta.id
    )
  );
}

export async function criarElenco(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const {
      nome,
      escala,
      turmaId,
      formacao,
      reservasIds,
    } = req.body;

    const owner =
      await getElencoOwner(req);

    if (!owner) {
      return res.status(403).json({
        error:
          "O contexto ativo não pode criar elencos.",
      });
    }

    if (!turmaId) {
      return res.status(400).json({
        error:
          "É obrigatório selecionar uma turma.",
      });
    }

    const autorizado =
      await podeGerenciarTurma(
        req,
        String(turmaId)
      );

    if (!autorizado) {
      return res.status(403).json({
        error:
          "Você não pode criar elenco nesta turma.",
      });
    }

    const preparacao =
      await prepararJogadoresElenco(
        String(turmaId),
        escala,
        reservasIds
      );

    if (!preparacao.ok) {
      return res.status(400).json({
        error: preparacao.error,

        detalhe:
          "detalhe" in preparacao
            ? preparacao.detalhe
            : undefined,
      });
    }

    const {
      escalaLimpa,
      reservasValidas,
      atletasIdsFinal,
    } = preparacao;

    const elenco =
      await prisma.elenco.create({
        data: {
          nome,
          ...owner.data,
          atletasIds:
            atletasIdsFinal,

          escala: {
            ...escalaLimpa,
            __reservasIds:
              reservasValidas,
          },

          formacao:
            formacao ?? null,

          maxJogadores: 11,

          turmaId:
            String(turmaId),
        },
      });

    return res
      .status(201)
      .json(elenco);
  } catch (error) {
    console.error(
      "Erro ao criar elenco:",
      error
    );

    return res.status(500).json({
      error: "Erro ao criar elenco",
    });
  }
}

export async function atualizarElenco(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = req.params;

    const {
      nome,
      escala,
      turmaId,
      formacao,
      reservasIds,
    } = req.body;

    const owner =
      await getElencoOwner(req);

    if (!owner) {
      return res.status(403).json({
        error:
          "O contexto ativo não pode alterar elencos.",
      });
    }

    if (!turmaId) {
      return res.status(400).json({
        error:
          "É obrigatório selecionar uma turma.",
      });
    }

    const autorizado =
      await podeGerenciarTurma(
        req,
        String(turmaId)
      );

    if (!autorizado) {
      return res.status(403).json({
        error:
          "Você não pode alterar o elenco desta turma.",
      });
    }

    const preparacao =
      await prepararJogadoresElenco(
        String(turmaId),
        escala,
        reservasIds
      );

    if (!preparacao.ok) {
      return res.status(400).json({
        error: preparacao.error,

        detalhe:
          "detalhe" in preparacao
            ? preparacao.detalhe
            : undefined,
      });
    }

    const {
      escalaLimpa,
      reservasValidas,
      atletasIdsFinal,
    } = preparacao;

    const elencoExistente =
      await prisma.elenco.findFirst({
        where: {
          id,
          turmaId:
            String(turmaId),

          ativo: true,

          ...owner.where,
        },

        select: {
          id: true,
        },
      });

    if (!elencoExistente) {
      return res.status(404).json({
        error:
          "Elenco não encontrado nesta turma.",
      });
    }

    const elenco =
      await prisma.elenco.update({
        where: {
          id,
        },

        data: {
          nome,
          atletasIds:
            atletasIdsFinal,
          escala: {
            ...escalaLimpa,
            __reservasIds:
              reservasValidas,
          },
          formacao:
            formacao ?? null,
          maxJogadores: 11,
          turmaId:
            String(turmaId),
        },
      });

    return res.json(elenco);
  } catch (error) {
    console.error(
      "Erro ao atualizar elenco:",
      error
    );

    return res.status(500).json({
      error: "Erro ao atualizar elenco",
    });
  }
}

export const atletasVinculados = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let professorId: string | undefined =
      (typeof req.query.professorId === "string" && req.query.professorId.trim()) ||
      (typeof req.query.tipoUsuarioId === "string" && req.query.tipoUsuarioId.trim()) ||
      undefined;

    const usuarioIdQ =
      typeof req.query.usuarioId === "string" ? req.query.usuarioId.trim() : undefined;

    if (!professorId && usuarioIdQ) {
      const prof = await prisma.professor.findFirst({
        where: { usuarioId: usuarioIdQ },
        select: { id: true },
      });
      professorId = prof?.id;
    }

    if (!professorId) {
      res.json([]);
      return;
    }
    const pid: string = professorId;
    const incluirPontuacao = String(req.query.incluirPontuacao ?? "") === "1";

    const rows = await prisma.relacaoTreinamento.findMany({
      where: {
        professorId: pid,
        atletaId: {
          not: null,
        },
        ativo: true,
        encerradoEm: null,
      },
      select: {
        atleta: {
          select: {
            id: true,
            usuarioId: true,
            posicao: true,
            idade: true,
            categoria: true,
            usuario: { select: { nome: true, foto: true } },
            ...(incluirPontuacao
              ? { pontuacao: { select: { pontuacaoTotal: true } } }
              : {}),
          },
        },
      },
    });

    const lista = rows
      .map((r: (typeof rows)[number]) => r.atleta)
      .filter((a): a is NonNullable<(typeof rows)[number]["atleta"]> => Boolean(a))
      .map((a) => ({
        id: a.id,
        usuarioId: a.usuarioId,
        atletaId: a.id,
        nome: a.usuario?.nome ?? "Atleta",
        foto: a.usuario?.foto ?? null,
        posicao: a.posicao ?? null,
        idade: a.idade ?? null,
        categoria: Array.isArray(a.categoria) && a.categoria.length ? a.categoria[0] : null,
        pontuacao: (a as any).pontuacao?.pontuacaoTotal ?? null,
      }));

    res.json(lista);
  } catch (e) {
    console.error("GET /elencos/atletas-vinculados erro:", e);
    res.status(500).json({ error: "Falha ao buscar atletas vinculados" });
  }
};

export async function listarAtletasVinculados(req: Request, res: Response) {
  try {
    const tipoUsuarioId = String(req.query.tipoUsuarioId || "");
    const turmaId = req.query.turmaId ? String(req.query.turmaId) : undefined;

    if (!tipoUsuarioId) {
      return res.status(400).json({ error: "tipoUsuarioId obrigatório" });
    }

    const whereBase: Prisma.AtletaWhereInput = {
      OR: [
        {
          relacoesTreinamento: {
            some: {
              professorId: tipoUsuarioId,
              ativo: true,
              encerradoEm: null,
            },
          },
        },
        { clubeId: tipoUsuarioId },
        { escolinhaId: tipoUsuarioId },
      ],
    };

    if (turmaId) {
      const membros = await prisma.turmaUsuario.findMany({
        where: { turmaId },
        select: { usuarioId: true },
      });
      const usuarioIds = membros.map((m) => m.usuarioId);

      whereBase.usuarioId = { in: usuarioIds.length ? usuarioIds : ["__none__"] };
    }

    const atletas = await prisma.atleta.findMany({
      where: whereBase,
      select: {
        id: true,
        usuarioId: true,
        nome: true,
        foto: true,
        idade: true,
        posicao: true,
      },
      orderBy: { nome: "asc" },
    });

    return res.json(atletas);
  } catch (e) {
    console.error("[listarAtletasVinculados]", e);
    return res.status(500).json({ error: "Erro ao listar atletas vinculados" });
  }
}

export async function excluirElenco(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.userId;
    const elencoId = String(
      req.params.id || ""
    ).trim();

    if (!userId) {
      return res.status(401).json({
        error: "Não autenticado.",
      });
    }

    if (!elencoId) {
      return res.status(400).json({
        error: "ID do elenco obrigatório.",
      });
    }

    const owner =
  await getElencoOwner(req);

if (!owner) {
      return res.status(403).json({
        error:
          "O contexto ativo não pode excluir elencos.",
      });
    }

    const elenco =
      await prisma.elenco.findFirst({
        where: {
          id: elencoId,
          ativo: true,
          ...owner.where,
        },

        select: {
          id: true,
        },
      });

    if (!elenco) {
      return res.status(404).json({
        error:
          "Elenco não encontrado ou sem permissão.",
      });
    }

    await prisma.elenco.update({
      where: {
        id: elenco.id,
      },
      data: {
        ativo: false,
      },
    });

    return res.json({
      ok: true,
      id: elenco.id,
    });
  } catch (error) {
    console.error(
      "[excluirElenco] erro:",
      error
    );

    return res.status(500).json({
      error:
        "Não foi possível excluir o elenco.",
    });
  }
}