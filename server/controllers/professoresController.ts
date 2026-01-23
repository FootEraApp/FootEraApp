import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { StatusCref } from "@prisma/client"; // ✅ ADICIONE ISSO
import { salvarHistoricoAtletaVinculo } from "../services/historicoAtleta.js";

function normalizeStatusCref(v: any): StatusCref {
  const raw = String(v ?? "").trim();

  // valores reais do enum no Prisma (ex: "ATIVO", "INATIVO" ou "Ativo", "Inativo")
  const values = Object.values(StatusCref) as string[];

  // tenta match case-insensitive
  const upper = raw.toUpperCase();
  const found = values.find((x) => String(x).toUpperCase() === upper);
  if (found) return found as StatusCref;

  // fallback seguro: tenta achar algo "ATIV"
  const ativo = values.find((x) => String(x).toUpperCase().includes("ATIV"));
  return (ativo ?? values[0]) as StatusCref;
}

function parseStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);

  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return [];

    // se veio JSON stringify
    if ((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("{") && t.endsWith("}"))) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
      } catch {}
    }

    // fallback: um item só
    return [t];
  }

  return [];
}

function makeCodigoProfessor() {
  // exemplo simples: PRF-ABC123
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

/**
 * ✅ LISTAR PROFESSORES (AGORA: SOMENTE VIA RelacaoTreinamento quando houver filtro de org/owner)
 *
 * Aceita:
 * - /api/professores?organizacaoId=<id>
 * - /api/professores?ownerTipo=Clube&ownerId=<id>
 * - /api/professores?ownerTipo=Escolinha&ownerId=<id>
 *
 * Sem filtro: lista todos (comportamento antigo mantido).
 */
export const listarProfessores = async (req: Request, res: Response) => {
  try {
    const organizacaoIdRaw = typeof req.query.organizacaoId === "string" ? req.query.organizacaoId : "";
    const ownerTipoRaw = typeof req.query.ownerTipo === "string" ? req.query.ownerTipo : "";
    const ownerIdRaw = typeof req.query.ownerId === "string" ? req.query.ownerId : "";

    const organizacaoId = organizacaoIdRaw.trim();
    const ownerTipo = ownerTipoRaw.trim();
    const ownerId = ownerIdRaw.trim();

    // 🔹 se vier ownerTipo/ownerId, prioriza
    if (ownerId && ownerTipo) {
      const tipoNorm = ownerTipo.toLowerCase();
      if (tipoNorm !== "clube" && tipoNorm !== "escolinha") {
        return res.status(400).json({ message: "ownerTipo deve ser Clube ou Escolinha" });
      }

      const rels = await prisma.relacaoTreinamento.findMany({
        where: {
          ativo: true,
          encerradoEm: null,
          atletaId: null, // vínculo professor<->org
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

      // mantém a ordenação estável
      const byId = new Map(professores.map((p) => [p.id, p]));
      const ordered = professorIds.map((id) => byId.get(id)).filter(Boolean);

      return res.json(ordered);
    }

    // 🔹 se vier organizacaoId (id pode ser de clube ou escolinha)
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

    // 🔸 sem filtro: comportamento antigo (lista todos)
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
      // ✅ se não vier codigo, gera
      codigo: (codigo && String(codigo).trim()) ? String(codigo).trim() : makeCodigoProfessor(),

      // ✅ cref opcional
      cref: (cref && String(cref).trim()) ? String(cref).trim() : null,

      nome: String(nome).trim(),
      areaFormacao: areaFormacao ? String(areaFormacao).trim() : null,
      statusCref,
      qualificacoes,
      certificacoes,
      fotoUrl: req.file?.filename ? `/upload/${req.file.filename}` : null,
    };

    // ✅ dataNascimento opcional
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
      // ✅ codigo continua existindo no banco, mas no admin você não precisa mandar.
      // se mandar, atualiza; se não mandar, não mexe.
      ...(codigo !== undefined ? { codigo: String(codigo).trim() } : {}),

      // ✅ cref opcional: se vier vazio, seta null
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

    // ✅ agora: vínculos do professor vêm da RelacaoTreinamento (professor<->org, atletaId null)
    const rels = await prisma.relacaoTreinamento.findMany({
      where: {
        professorId,
        ativo: true,
        encerradoEm: null,
        atletaId: null,
        OR: [{ clubeId: { not: null } }, { escolinhaId: { not: null } }],
      },
      select: { clubeId: true, escolinhaId: true, criadoEm: true },
      orderBy: { criadoEm: "desc" },
    });

    if (!rels.length) return res.json([]);

    const clubeIds = Array.from(new Set(rels.map((r) => r.clubeId).filter(Boolean) as string[]));
    const escolinhaIds = Array.from(new Set(rels.map((r) => r.escolinhaId).filter(Boolean) as string[]));

    const [clubes, escolinhas] = await Promise.all([
      clubeIds.length
        ? prisma.clube.findMany({ where: { id: { in: clubeIds } }, select: { id: true, nome: true } })
        : Promise.resolve([]),
      escolinhaIds.length
        ? prisma.escolinha.findMany({ where: { id: { in: escolinhaIds } }, select: { id: true, nome: true } })
        : Promise.resolve([]),
    ]);

    const clubeById = new Map(clubes.map((c) => [c.id, c]));
    const escolinhaById = new Map(escolinhas.map((e) => [e.id, e]));

    const out: Array<{ id: string; nome: string; tipo: "Escolinha" | "Clube" }> = [];

    for (const r of rels) {
      if (r.clubeId) {
        const c = clubeById.get(r.clubeId);
        if (c) out.push({ id: c.id, nome: c.nome, tipo: "Clube" });
      }
      if (r.escolinhaId) {
        const e = escolinhaById.get(r.escolinhaId);
        if (e) out.push({ id: e.id, nome: e.nome, tipo: "Escolinha" });
      }
    }

    // dedupe final
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

    // 🔸 se removeu vínculo
    if (!id || !tipo) {
      await prisma.$transaction(async (tx) => {
        // mantém como estava (você ainda usa esses campos)
        await tx.professor.update({
          where: { id: professorId },
          data: { escolinhaId: null, clubeId: null, organizacaoId: null },
        });
        await tx.relacaoTreinamento.deleteMany({
          where: { professorId, atletaId: null },
        });
      });

      const atualizado = await buscarProfessorPorIdInterno(professorId);
      return res
        .status(200)
        .json({ ok: true, tipo: null, organizacaoId: null, professor: atualizado });
    }

    const dataProfessor =
      tipo === "Escolinha"
        ? { escolinhaId: id, clubeId: null, organizacaoId: id }
        : { clubeId: id, escolinhaId: null, organizacaoId: id };

    const professor = await prisma.$transaction(async (tx) => {
      await tx.relacaoTreinamento.deleteMany({
        where: { professorId, atletaId: null },
      });

      await tx.relacaoTreinamento.create({
        data: {
          professorId,
          atletaId: null,
          escolinhaId: tipo === "Escolinha" ? id : null,
          clubeId: tipo === "Clube" ? id : null,
        },
      });

      return tx.professor.update({ where: { id: professorId }, data: dataProfessor });
    });

    return res.status(200).json({
      ok: true,
      tipo,
      organizacaoId: id,
      professor,
    });
  } catch (err) {
    console.error("Erro ao salvar vínculo do professor:", err);
    return res.status(500).json({ message: "Erro ao salvar vínculo." });
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

/**
 * ✅ LISTAR PROFESSORES VINCULADOS (AGORA: SOMENTE VIA RelacaoTreinamento)
 * /api/professores/vinculados?tipo=clube|escolinha&tipoUsuarioId=<id>
 */
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
    // 🔎 busca professor + usuário
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
      // 🔁 atualiza flag rápida
      await tx.usuario.update({
        where: { id: usuarioId },
        data: { parceiro },
      });

      if (parceiro) {
        // ✅ cria registro parceiro se não existir
        await tx.parceiro.upsert({
          where: { usuarioId },
          create: { usuarioId },
          update: { ativo: true },
        });
      } else {
        // ❌ desativa parceiro (mantém histórico)
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
