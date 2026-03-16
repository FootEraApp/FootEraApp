import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { StatusCref } from "@prisma/client"; 
import { salvarHistoricoAtletaVinculo } from "../services/historicoAtleta.js";

function normalizeStatusCref(v: any): StatusCref {
  const raw = String(v ?? "").trim();
  const values = Object.values(StatusCref) as string[];
  const upper = raw.toUpperCase();
  const found = values.find((x) => String(x).toUpperCase() === upper);
  if (found) return found as StatusCref;

  const ativo = values.find((x) => String(x).toUpperCase().includes("ATIV"));
  return (ativo ?? values[0]) as StatusCref;
}

function parseStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);

  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return [];

    if ((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("{") && t.endsWith("}"))) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
      } catch {}
    }
    return [t];
  }
  return [];
}

function makeCodigoProfessor() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PRF-${rand}`;
}

export const listarAtletasDoProfessor = async (req: Request, res: Response) => {
  const { professorId } = req.params;

  try {
    const rels = await prisma.relacaoTreinamento.findMany({
      where: {
        professorId,
        ativo: true,
        encerradoEm: null,
        atletaId: { not: null },
      },
      include: {
        atleta: {
          include: {
            usuario: true,
            clube: true,
            escolinha: true,
          },
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    const atletas = rels
      .map((r) => r.atleta)
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .sort((a, b) =>
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"),
      );
    return res.json(atletas);
  } catch (error) {
    console.error("Erro ao listar atletas do professor:", error);
    return res
      .status(500)
      .json({ message: "Erro ao listar atletas do professor." });
  }
};

async function garantirOrganizacaoGestorProfessor(params: {
  professorId: string;
  tipo: "CLUBE" | "ESCOLINHA";
  ownerId: string;
}) {
  const existente = await prisma.organizacaoGestor.findFirst({
    where: {
      professorId: params.professorId,
      tipo: params.tipo as any,
      ownerId: params.ownerId,
    },
    select: { id: true },
  });

  if (existente) {
    await prisma.organizacaoGestor.update({
      where: { id: existente.id },
      data: { ativo: true },
    });
    return;
  }

  await prisma.organizacaoGestor.create({
    data: {
      professorId: params.professorId,
      tipo: params.tipo as any,
      ownerId: params.ownerId,
      ativo: true,
    },
  });
}

async function desativarGestoresProfessor(professorId: string) {
  await prisma.organizacaoGestor.updateMany({
    where: { professorId },
    data: { ativo: false },
  });
}

async function resolveOrganizacao(organizacaoId?: string | null) {
  if (!organizacaoId) return { tipo: null as null, id: null as null };

  const [e, c] = await Promise.all([
    prisma.escolinha.findUnique({
      where: { id: organizacaoId },
      select: { id: true },
    }),
    prisma.clube.findUnique({
      where: { id: organizacaoId },
      select: { id: true },
    }),
  ]);

  if (e) return { tipo: "Escolinha" as const, id: e.id };
  if (c) return { tipo: "Clube" as const, id: c.id };
  return { tipo: null as null, id: null as null };
}

export async function buscarProfessorPorIdInterno(id: string) {
  return prisma.professor.findUnique({
    where: { id },
    select: { id: true, escolinhaId: true, clubeId: true, organizacaoId: true },
  });
}

export const buscarProfessorPorId = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const professor = await prisma.professor.findUnique({
      where: { id },
      include: { usuario: true },
    });
    if (!professor)
      return res.status(404).json({ message: "Professor não encontrado." });
    res.json(professor);
  } catch (error) {
    console.error("Erro ao buscar professor:", error);
    res.status(500).json({ message: "Erro ao buscar professor." });
  }
};

export const listarProfessores = async (req: Request, res: Response) => {
  try {
    const organizacaoIdRaw = typeof req.query.organizacaoId === "string" ? req.query.organizacaoId : "";
    const ownerTipoRaw = typeof req.query.ownerTipo === "string" ? req.query.ownerTipo : "";
    const ownerIdRaw = typeof req.query.ownerId === "string" ? req.query.ownerId : "";
    const organizacaoId = organizacaoIdRaw.trim();
    const ownerTipo = ownerTipoRaw.trim();
    const ownerId = ownerIdRaw.trim();

    if (ownerId && ownerTipo) {
      const tipoNorm = ownerTipo.toLowerCase();
      if (tipoNorm !== "clube" && tipoNorm !== "escolinha") {
        return res.status(400).json({ message: "ownerTipo deve ser Clube ou Escolinha" });
      }

      const rels = await prisma.relacaoTreinamento.findMany({
        where: {
          ativo: true,
          encerradoEm: null,
          atletaId: null,
          professorId: { not: null },
          ...(tipoNorm === "clube" ? { clubeId: ownerId } : { escolinhaId: ownerId }),
        },
        select: { professorId: true },
        orderBy: { criadoEm: "desc" },
      });

      const professorIds = Array.from(
        new Set(rels.map((r) => r.professorId).filter(Boolean) as string[]),
      );

      if (!professorIds.length) return res.json([]);

      const professores = await prisma.professor.findMany({
        where: { id: { in: professorIds } },
        include: { usuario: true },
      });

      const byId = new Map(professores.map((p) => [p.id, p]));
      const ordered = professorIds.map((id) => byId.get(id)).filter(Boolean);

      return res.json(ordered);
    }

    if (organizacaoId) {
      const { tipo, id } = await resolveOrganizacao(organizacaoId);
      if (!id || !tipo) return res.json([]);

      const rels = await prisma.relacaoTreinamento.findMany({
        where: {
          ativo: true,
          encerradoEm: null,
          atletaId: null,
          professorId: { not: null },
          ...(tipo === "Clube" ? { clubeId: id } : { escolinhaId: id }),
        },
        select: { professorId: true },
        orderBy: { criadoEm: "desc" },
      });

      const professorIds = Array.from(
        new Set(rels.map((r) => r.professorId).filter(Boolean) as string[]),
      );

      if (!professorIds.length) return res.json([]);

      const professores = await prisma.professor.findMany({
        where: { id: { in: professorIds } },
        include: { usuario: true },
      });

      const byId = new Map(professores.map((p) => [p.id, p]));
      const ordered = professorIds.map((pid) => byId.get(pid)).filter(Boolean);

      return res.json(ordered);
    }

    const professores = await prisma.professor.findMany({
      include: { usuario: true },
    });

    return res.json(professores);
  } catch (error) {
    console.error("Erro ao listar professores:", error);
    return res.status(500).json({ message: "Erro ao listar professores." });
  }
};

export const criarProfessor = async (req: Request, res: Response) => {
  try {
    const { codigo, cref, nome, areaFormacao, usuarioId, dataNascimento } = req.body;

    if (!nome || String(nome).trim() === "") {
      return res.status(400).json({ message: "Nome é obrigatório." });
    }

    const qualificacoes = parseStringArray(req.body.qualificacoes);
    const certificacoes = parseStringArray(req.body.certificacoes);
    const statusCref = normalizeStatusCref(req.body.statusCref);
    const data: any = {
      codigo: (codigo && String(codigo).trim()) ? String(codigo).trim() : makeCodigoProfessor(),
      cref: (cref && String(cref).trim()) ? String(cref).trim() : null,
      nome: String(nome).trim(),
      areaFormacao: areaFormacao ? String(areaFormacao).trim() : null,
      statusCref,
      qualificacoes,
      certificacoes,
      fotoUrl: req.file?.filename ? `/upload/${req.file.filename}` : null,
    };

    if (dataNascimento) {
      const d = new Date(String(dataNascimento));
      if (!Number.isNaN(d.getTime())) data.dataNascimento = d;
    }

    if (usuarioId) {
      data.usuario = { connect: { id: String(usuarioId) } };
    }

    const novoProfessor = await prisma.professor.create({
      data,
      include: { usuario: true },
    });

    return res.status(201).json(novoProfessor);
  } catch (error: any) {
    console.error("Erro ao criar professor:", error);
    return res.status(500).json({
      message: "Erro ao criar professor",
      error: { name: error?.name, code: error?.code, message: error?.message },
    });
  }
};

export const editarProfessor = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { codigo, cref, nome, areaFormacao, usuarioId, dataNascimento } = req.body;
    const qualificacoes = parseStringArray(req.body["qualificacoes[]"] ?? req.body.qualificacoes);
    const certificacoes = parseStringArray(req.body["certificacoes[]"] ?? req.body.certificacoes);
    const data: any = {
      ...(codigo !== undefined ? { codigo: String(codigo).trim() } : {}),
      ...(cref !== undefined ? { cref: String(cref).trim() || null } : {}),
      ...(nome !== undefined ? { nome: String(nome).trim() } : {}),
      ...(areaFormacao !== undefined ? { areaFormacao: String(areaFormacao).trim() || null } : {}),
      ...(req.body.statusCref !== undefined
        ? { statusCref: normalizeStatusCref(req.body.statusCref) }
        : {}),
      qualificacoes,
      certificacoes,
    };

    if (dataNascimento !== undefined) {
      const d = new Date(String(dataNascimento));
      data.dataNascimento = Number.isNaN(d.getTime()) ? null : d;
    }

    if (req.file) data.fotoUrl = `/upload/${req.file.filename}`;

    if (usuarioId) {
      data.usuario = { connect: { id: String(usuarioId) } };
    }

    const professorAtualizado = await prisma.professor.update({
      where: { id },
      data,
    });
    return res.json(professorAtualizado);
  } catch (error: any) {
    console.error("Erro ao editar professor:", error);
    return res.status(500).json({
      message: "Erro ao editar professor.",
      error: { name: error?.name, code: error?.code, message: error?.message },
    });
  }
};

export const excluirProfessor = async (req: Request, res: Response) => {
  const { id: professorId } = req.params;

  try {
    const professor = await prisma.professor.findUnique({
      where: { id: professorId },
      select: {
        id: true,
        usuarioId: true,
      },
    });

    if (!professor) {
      return res.status(404).json({ message: "Professor não encontrado." });
    }

    if (!professor.usuarioId) {
      return res.status(400).json({
        message: "Professor não possui usuário vinculado.",
      });
    }

    const usuarioId = professor.usuarioId as string;

    await prisma.$transaction(async (tx) => {
      const observacoes = await tx.atletaObservado.findMany({
        where: { professorId },
        select: { id: true },
      });

      const obsIds = observacoes.map((o) => o.id);

      if (obsIds.length) {
        await tx.treinoRotinaAtribuicao.deleteMany({
          where: { atletaObservadoId: { in: obsIds } },
        });

        await tx.atletaObservado.deleteMany({
          where: { id: { in: obsIds } },
        });
      }

      await tx.relacaoTreinamento.updateMany({
        where: { professorId, atletaId: { not: null } },
        data: {
          ativo: false,
          encerradoEm: new Date(),
        },
      });

      await tx.turmaProfessor.deleteMany({
        where: { professorId },
      });

      await tx.treinoAgendado.updateMany({
        where: { criadoPorProfessorId: professorId },
        data: { criadoPorProfessorId: null },
      });

      await tx.usuario.delete({
        where: { id: usuarioId },
      });
    });

    return res.status(204).send();
  } catch (error: any) {
    console.error("Erro ao excluir professor:", error);

    if (error?.code === "P2003") {
      return res.status(409).json({
        message:
          "Não foi possível excluir o professor por vínculos pendentes. Verifique dependências.",
      });
    }

    return res.status(500).json({ message: "Erro ao excluir professor." });
  }
};

export const listarVinculosProfessor = async (req: Request, res: Response) => {
  try {
    const { id: professorId } = req.params;

    const professor = await prisma.professor.findUnique({
      where: { id: professorId },
      select: {
        id: true,
        clubeId: true,
        escolinhaId: true,
      },
    });

    if (!professor) {
      return res.status(404).json({ message: "Professor não encontrado." });
    }

    const [clubesDiretos, escolinhasDiretas, clubesPivot, escolinhasPivot, gestores] =
      await Promise.all([
        professor.clubeId
          ? prisma.clube.findMany({
              where: { id: professor.clubeId },
              select: { id: true, nome: true },
            })
          : Promise.resolve([]),

        professor.escolinhaId
          ? prisma.escolinha.findMany({
              where: { id: professor.escolinhaId },
              select: { id: true, nome: true },
            })
          : Promise.resolve([]),

        prisma.professorClube.findMany({
          where: { professorId },
          select: {
            clube: {
              select: { id: true, nome: true },
            },
          },
        }),

        prisma.professorEscolinha.findMany({
          where: { professorId },
          select: {
            escolinha: {
              select: { id: true, nome: true },
            },
          },
        }),

        prisma.organizacaoGestor.findMany({
          where: { professorId, ativo: true },
          select: {
            tipo: true,
            ownerId: true,
          },
        }),
      ]);

    const gestorClubeIds = gestores
      .filter((g) => String(g.tipo) === "CLUBE")
      .map((g) => g.ownerId);

    const gestorEscolinhaIds = gestores
      .filter((g) => String(g.tipo) === "ESCOLINHA")
      .map((g) => g.ownerId);

    const [clubesGestor, escolinhasGestor] = await Promise.all([
      gestorClubeIds.length
        ? prisma.clube.findMany({
            where: { id: { in: gestorClubeIds } },
            select: { id: true, nome: true },
          })
        : Promise.resolve([]),

      gestorEscolinhaIds.length
        ? prisma.escolinha.findMany({
            where: { id: { in: gestorEscolinhaIds } },
            select: { id: true, nome: true },
          })
        : Promise.resolve([]),
    ]);

    const out: Array<{ id: string; nome: string; tipo: "Escolinha" | "Clube" }> = [];

    for (const c of clubesDiretos) {
      out.push({ id: c.id, nome: c.nome, tipo: "Clube" });
    }

    for (const e of escolinhasDiretas) {
      out.push({ id: e.id, nome: e.nome, tipo: "Escolinha" });
    }

    for (const row of clubesPivot) {
      if (row.clube) out.push({ id: row.clube.id, nome: row.clube.nome, tipo: "Clube" });
    }

    for (const row of escolinhasPivot) {
      if (row.escolinha) out.push({ id: row.escolinha.id, nome: row.escolinha.nome, tipo: "Escolinha" });
    }

    for (const c of clubesGestor) {
      out.push({ id: c.id, nome: c.nome, tipo: "Clube" });
    }

    for (const e of escolinhasGestor) {
      out.push({ id: e.id, nome: e.nome, tipo: "Escolinha" });
    }

    const seen = new Set<string>();
    const unique = out.filter((x) => {
      const k = `${x.tipo}:${x.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    return res.json(unique);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao listar vínculos do professor." });
  }
};

export const salvarVinculoProfessor = async (req: Request, res: Response) => {
  try {
    const { id: professorId } = req.params;
    const body = req.body || {};
    const orgId: string | null =
      body.organizacaoId ?? body.idOrganizacao ?? body.organizacao ?? null;

    const { tipo, id } = await resolveOrganizacao(orgId);

    const professorExistente = await prisma.professor.findUnique({
      where: { id: professorId },
      select: {
        id: true,
        clubeId: true,
        escolinhaId: true,
      },
    });

    if (!professorExistente) {
      return res.status(404).json({ message: "Professor não encontrado." });
    }

    if (!id || !tipo) {
      await prisma.$transaction(async (tx) => {
        await tx.professor.update({
          where: { id: professorId },
          data: {
            escolinhaId: null,
            clubeId: null,
            organizacaoId: null,
          },
        });

        await tx.organizacaoGestor.updateMany({
          where: { professorId },
          data: { ativo: false },
        });

        await tx.professorClube.deleteMany({
          where: { professorId },
        });

        await tx.professorEscolinha.deleteMany({
          where: { professorId },
        });
      });

      const atualizado = await buscarProfessorPorIdInterno(professorId);

      return res.status(200).json({
        ok: true,
        tipo: null,
        organizacaoId: null,
        professor: atualizado,
        message: "Vínculo removido com sucesso.",
      });
    }

    const jaVinculado =
      (tipo === "Clube" && professorExistente.clubeId === id) ||
      (tipo === "Escolinha" && professorExistente.escolinhaId === id);

    if (jaVinculado) {
      return res.status(200).json({
        ok: true,
        tipo,
        organizacaoId: id,
        jaVinculado: true,
        message: "Você já está vinculado a essa organização.",
      });
    }

    const professor = await prisma.$transaction(async (tx) => {
      await tx.organizacaoGestor.updateMany({
        where: { professorId },
        data: { ativo: false },
      });

      await tx.professorClube.deleteMany({
        where: { professorId },
      });

      await tx.professorEscolinha.deleteMany({
        where: { professorId },
      });

      if (tipo === "Clube") {
        await tx.professorClube.upsert({
          where: {
            professorId_clubeId: {
              professorId,
              clubeId: id,
            },
          },
          update: {
            papel: "Professor",
          },
          create: {
            professorId,
            clubeId: id,
            papel: "Professor",
          },
        });

        await tx.organizacaoGestor.upsert({
          where: {
            tipo_ownerId_professorId: {
              tipo: "CLUBE",
              ownerId: id,
              professorId,
            },
          },
          update: {
            ativo: true,
          },
          create: {
            tipo: "CLUBE",
            ownerId: id,
            professorId,
            ativo: true,
          },
        });

        return tx.professor.update({
          where: { id: professorId },
          data: {
            clubeId: id,
            escolinhaId: null,
            organizacaoId: id,
          },
        });
      }

      await tx.professorEscolinha.upsert({
        where: {
          professorId_escolinhaId: {
            professorId,
            escolinhaId: id,
          },
        },
        update: {
          papel: "Professor",
        },
        create: {
          professorId,
          escolinhaId: id,
          papel: "Professor",
        },
      });

      await tx.organizacaoGestor.upsert({
        where: {
          tipo_ownerId_professorId: {
            tipo: "ESCOLINHA",
            ownerId: id,
            professorId,
          },
        },
        update: {
          ativo: true,
        },
        create: {
          tipo: "ESCOLINHA",
          ownerId: id,
          professorId,
          ativo: true,
        },
      });

      return tx.professor.update({
        where: { id: professorId },
        data: {
          escolinhaId: id,
          clubeId: null,
          organizacaoId: id,
        },
      });
    });

    return res.status(200).json({
      ok: true,
      tipo,
      organizacaoId: id,
      professor,
      message: "Vínculo salvo com sucesso.",
    });
  } catch (err: any) {
    console.error("Erro ao salvar vínculo do professor:", err);
    return res.status(500).json({
      message: err?.message || "Erro ao salvar vínculo.",
    });
  }
};

export const listarHistoricoAtletasProfessor = async (req: Request, res: Response) => {
  const { professorId } = req.params;
  const { atletaNomeUsuario } = req.query;

  try {
    const historicos = await prisma.atletaHistoricoVinculo.findMany({
      where: { professorId },
      include: {
        atleta: {
          include: {
            usuario: true,
          },
        },
      },
      orderBy: { fimVinculo: "desc" },
    });

    let resultado = historicos;

    if (
      typeof atletaNomeUsuario === "string" &&
      atletaNomeUsuario.trim() !== ""
    ) {
      const alvo = atletaNomeUsuario.trim().toLowerCase();
      resultado = historicos.filter((h) => {
        const nomeUser = h.atleta?.usuario?.nomeDeUsuario || "";
        return nomeUser.toLowerCase() === alvo;
      });
    }

    res.json(resultado);
  } catch (err) {
    console.error("Erro ao listar histórico de atletas do professor:", err);
    res.status(500).json({
      message: "Erro ao listar histórico de atletas do professor.",
    });
  }
};

export const vincularAtletaAoProfessor = async (req: Request, res: Response) => {
  const { professorId } = req.params;
  const { atletaId } = req.body;

  if (!professorId || !atletaId) {
    return res
      .status(400)
      .json({ message: "professorId e atletaId são obrigatórios." });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const relacaoExistente = await tx.relacaoTreinamento.findFirst({
        where: { professorId, atletaId },
      });

      if (relacaoExistente) {
        await tx.relacaoTreinamento.update({
          where: { id: relacaoExistente.id },
          data: { encerradoEm: null, ativo: true },
        });
      } else {
        await tx.relacaoTreinamento.create({
          data: {
            professorId,
            atletaId,
            ativo: true,
          },
        });
      }

      await tx.atleta.update({
        where: { id: atletaId },
        data: { statusConexao: "Aprovado" },
      });
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao vincular atleta ao professor:", err);
    return res
      .status(500)
      .json({ message: "Erro ao vincular atleta ao professor." });
  }
};

export const desvincularAtletaDoProfessor = async (req: Request, res: Response) => {
  const { professorId } = req.params;
  const { atletaId } = req.body;

  if (!professorId || !atletaId) {
    return res
      .status(400)
      .json({ message: "professorId e atletaId são obrigatórios." });
  }

  try {
    const relacao = await prisma.relacaoTreinamento.findFirst({
      where: { professorId, atletaId },
    });

    if (!relacao) {
      return res.status(404).json({ message: "Relação não encontrada." });
    }

    const agora = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.relacaoTreinamento.update({
        where: { id: relacao.id },
        data: { encerradoEm: agora, ativo: false },
      });

      await tx.atleta.update({
        where: { id: atletaId },
        data: { statusConexao: "Pendente" },
      });
    });

    await salvarHistoricoAtletaVinculo({
      atletaId,
      dono: { tipo: "Professor", id: professorId },
      inicioVinculo: relacao.criadoEm,
      fimVinculo: agora,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao desvincular atleta do professor:", err);
    return res
      .status(500)
      .json({ message: "Erro ao desvincular atleta do professor." });
  }
};

export const listarProfessoresVinculados = async (req: Request, res: Response) => {
  try {
    const tipo = String(req.query.tipo || "").toLowerCase();
    const tipoUsuarioId = String(req.query.tipoUsuarioId || "").trim();

    if (!tipoUsuarioId || (tipo !== "clube" && tipo !== "escolinha")) {
      return res.status(400).json({
        message: "Informe tipo=clube|escolinha e tipoUsuarioId",
      });
    }

    const rels = await prisma.relacaoTreinamento.findMany({
      where: {
        ativo: true,
        encerradoEm: null,
        atletaId: null,
        professorId: { not: null },
        ...(tipo === "clube" ? { clubeId: tipoUsuarioId } : { escolinhaId: tipoUsuarioId }),
      },
      select: { professorId: true },
      orderBy: { criadoEm: "desc" },
    });

    const professorIds = Array.from(
      new Set(rels.map((r) => r.professorId).filter(Boolean) as string[]),
    );

    if (!professorIds.length) return res.json({ items: [] });

    const professores = await prisma.professor.findMany({
      where: { id: { in: professorIds } },
      select: {
        id: true,
        nome: true,
        usuario: { select: { nome: true } },
      },
    });

    const byId = new Map(professores.map((p) => [p.id, p]));
    const ordered = professorIds.map((id) => byId.get(id)).filter(Boolean) as typeof professores;

    const items = ordered.map((p) => ({
      id: String(p.id),
      nome: String(p.usuario?.nome || p.nome || "").trim() || "Professor",
    }));

    return res.json({ items });
  } catch (error) {
    console.error("Erro ao listar professores vinculados:", error);
    return res.status(500).json({ message: "Erro ao listar professores vinculados." });
  }
};

export const toggleProfessorParceiro = async (req: Request, res: Response) => {
  const { id: professorId } = req.params;
  const { parceiro } = req.body as { parceiro?: boolean };

  if (typeof parceiro !== "boolean") {
    return res.status(400).json({
      message: "Campo 'parceiro' deve ser boolean (true ou false).",
    });
  }

  try {
    const professor = await prisma.professor.findUnique({
      where: { id: professorId },
      select: {
        id: true,
        usuarioId: true,
        usuario: {
          select: { id: true, parceiro: true },
        },
      },
    });

    if (!professor || !professor.usuarioId) {
      return res.status(404).json({
        message: "Professor ou usuário vinculado não encontrado.",
      });
    }

    const usuarioId = professor.usuarioId;

    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuarioId },
        data: { parceiro },
      });

      if (parceiro) {
        await tx.parceiro.upsert({
          where: { usuarioId },
          create: { usuarioId },
          update: { ativo: true },
        });
      } else {
        await tx.parceiro.updateMany({
          where: { usuarioId },
          data: { ativo: false },
        });
      }
    });

    return res.json({
      ok: true,
      professorId,
      usuarioId,
      parceiro,
    });
  } catch (error) {
    console.error("Erro ao atualizar parceiro do professor:", error);
    return res.status(500).json({
      message: "Erro ao atualizar status de parceiro.",
    });
  }
};

export const listarProfessoresRealizadores = async (req: Request, res: Response) => {
  try {
    const authUserId =
      (req as any).user?.id ||
      (req as any).userId ||
      (req as any).usuarioId ||
      null;

    const authTipo =
      String(
        (req as any).user?.tipo ||
        (req as any).tipo ||
        ""
      ).trim().toLowerCase();

    if (!authUserId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const grupos: Array<{
      tipo: "Escolinha" | "Clube";
      ownerId: string;
      nome: string;
      professores: Array<{
        id: string;
        nome: string;
        codigo: string | null;
        cref: string | null;
        fotoUrl: string | null;
      }>;
    }> = [];

    const addGrupo = async (
      tipo: "Escolinha" | "Clube",
      ownerId: string,
      nome: string,
      professorLogadoId?: string | null
    ) => {
      const professorIdsSet = new Set<string>();

      if (tipo === "Clube") {
        const [diretos, pivot, gestores, relacoes] = await Promise.all([
          prisma.professor.findMany({
            where: { clubeId: ownerId },
            select: { id: true },
          }),
          prisma.professorClube.findMany({
            where: { clubeId: ownerId },
            select: { professorId: true },
          }),
          prisma.organizacaoGestor.findMany({
            where: { tipo: "CLUBE", ownerId, ativo: true },
            select: { professorId: true },
          }),
          prisma.relacaoTreinamento.findMany({
            where: {
              clubeId: ownerId,
              ativo: { not: false },
              professorId: { not: null },
            },
            select: { professorId: true },
          }),
        ]);

        for (const p of diretos) professorIdsSet.add(p.id);
        for (const p of pivot) if (p.professorId) professorIdsSet.add(p.professorId);
        for (const p of gestores) if (p.professorId) professorIdsSet.add(p.professorId);
        for (const p of relacoes) if (p.professorId) professorIdsSet.add(p.professorId);
      } else {
        const [diretos, pivot, gestores, relacoes] = await Promise.all([
          prisma.professor.findMany({
            where: { escolinhaId: ownerId },
            select: { id: true },
          }),
          prisma.professorEscolinha.findMany({
            where: { escolinhaId: ownerId },
            select: { professorId: true },
          }),
          prisma.organizacaoGestor.findMany({
            where: { tipo: "ESCOLINHA", ownerId, ativo: true },
            select: { professorId: true },
          }),
          prisma.relacaoTreinamento.findMany({
            where: {
              escolinhaId: ownerId,
              ativo: { not: false },
              professorId: { not: null },
            },
            select: { professorId: true },
          }),
        ]);

        for (const p of diretos) professorIdsSet.add(p.id);
        for (const p of pivot) if (p.professorId) professorIdsSet.add(p.professorId);
        for (const p of gestores) if (p.professorId) professorIdsSet.add(p.professorId);
        for (const p of relacoes) if (p.professorId) professorIdsSet.add(p.professorId);
      }

      let professorIds = Array.from(professorIdsSet);

      if (professorLogadoId) {
        professorIds = professorIds.filter((id) => String(id) !== String(professorLogadoId));
      }

      if (!professorIds.length) return;

      const professores = await prisma.professor.findMany({
        where: { id: { in: professorIds } },
        select: {
          id: true,
          nome: true,
          codigo: true,
          cref: true,
          fotoUrl: true,
        },
        orderBy: { nome: "asc" },
      });

      grupos.push({
        tipo,
        ownerId,
        nome,
        professores: professores.map((p) => ({
          id: p.id,
          nome: p.nome ?? "Professor",
          codigo: p.codigo ?? null,
          cref: p.cref ?? null,
          fotoUrl: p.fotoUrl ?? null,
        })),
      });
    };

    if (authTipo === "professor") {
      const professor = await prisma.professor.findFirst({
        where: { usuarioId: authUserId },
        select: {
          id: true,
          clubeId: true,
          escolinhaId: true,
        },
      });

      if (!professor) {
        return res.json({ grupos: [] });
      }

      const [clubesPivot, escolinhasPivot, clubesDiretos, escolinhasDiretas] = await Promise.all([
        prisma.professorClube.findMany({
          where: { professorId: professor.id },
          select: {
            clube: {
              select: { id: true, nome: true },
            },
          },
        }),
        prisma.professorEscolinha.findMany({
          where: { professorId: professor.id },
          select: {
            escolinha: {
              select: { id: true, nome: true },
            },
          },
        }),
        professor.clubeId
          ? prisma.clube.findUnique({
              where: { id: professor.clubeId },
              select: { id: true, nome: true },
            })
          : Promise.resolve(null),
        professor.escolinhaId
          ? prisma.escolinha.findUnique({
              where: { id: professor.escolinhaId },
              select: { id: true, nome: true },
            })
          : Promise.resolve(null),
      ]);

      const clubesMap = new Map<string, string>();
      const escolinhasMap = new Map<string, string>();

      if (clubesDiretos?.id) clubesMap.set(clubesDiretos.id, clubesDiretos.nome ?? "Clube");
      if (escolinhasDiretas?.id) escolinhasMap.set(escolinhasDiretas.id, escolinhasDiretas.nome ?? "Escolinha");

      for (const item of clubesPivot) {
        if (item.clube?.id) clubesMap.set(item.clube.id, item.clube.nome ?? "Clube");
      }

      for (const item of escolinhasPivot) {
        if (item.escolinha?.id) escolinhasMap.set(item.escolinha.id, item.escolinha.nome ?? "Escolinha");
      }

      for (const [id, nome] of escolinhasMap.entries()) {
        await addGrupo("Escolinha", id, nome, professor.id);
      }

      for (const [id, nome] of clubesMap.entries()) {
        await addGrupo("Clube", id, nome, professor.id);
      }

      return res.json({ grupos });
    }

    if (authTipo === "clube") {
      const clube = await prisma.clube.findFirst({
        where: { usuarioId: authUserId },
        select: { id: true, nome: true },
      });

      if (!clube) return res.json({ grupos: [] });

      await addGrupo("Clube", clube.id, clube.nome ?? "Clube", null);
      return res.json({ grupos });
    }

    if (authTipo === "escolinha") {
      const escolinha = await prisma.escolinha.findFirst({
        where: { usuarioId: authUserId },
        select: { id: true, nome: true },
      });

      if (!escolinha) return res.json({ grupos: [] });

      await addGrupo("Escolinha", escolinha.id, escolinha.nome ?? "Escolinha", null);
      return res.json({ grupos });
    }

    return res.json({ grupos: [] });
  } catch (error) {
    console.error("Erro ao listar professores realizadores:", error);
    return res.status(500).json({ message: "Erro ao listar professores realizadores." });
  }
};