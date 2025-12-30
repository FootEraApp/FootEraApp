import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { salvarHistoricoAtletaVinculo } from "../services/historicoAtleta.js";

const prisma = new PrismaClient();

export const listarAtletasDoProfessor = async (req: Request, res: Response) => {
  const { professorId } = req.params;

  try {
    const atletas = await prisma.atleta.findMany({
      where: { professorId },
      include: {
        usuario: true,
        clube: true,
        escolinha: true,
      },
      orderBy: { nome: "asc" },
    });

    res.json(atletas);
  } catch (error) {
    console.error("Erro ao listar atletas do professor:", error);
    res.status(500).json({ message: "Erro ao listar atletas do professor." });
  }
};

async function resolveOrganizacao(organizacaoId?: string | null) {
  if (!organizacaoId) return { tipo: null as null, id: null as null };

  const [e, c] = await Promise.all([
    prisma.escolinha.findUnique({ where: { id: organizacaoId }, select: { id: true } }),
    prisma.clube.findUnique({ where: { id: organizacaoId }, select: { id: true } }),
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
    if (!professor) return res.status(404).json({ message: "Professor não encontrado." });
    res.json(professor);
  } catch (error) {
    console.error("Erro ao buscar professor:", error);
    res.status(500).json({ message: "Erro ao buscar professor." });
  }
};

export const listarProfessores = async (req: Request, res: Response) => {
  try {
    const { organizacaoId } = req.query;

    let where: any = {};

    if (typeof organizacaoId === "string" && organizacaoId.trim() !== "") {

      const { id } = await resolveOrganizacao(organizacaoId.trim());

      if (!id) {

        return res.json([]);
      }

      where = {
        OR: [
          { clubeId: id },
          { escolinhaId: id },
          { organizacaoId: id },
        ],
      };
    }

    const professores = await prisma.professor.findMany({
      where,
      include: { usuario: true },
    });

    res.json(professores);
  } catch (error) {
    console.error("Erro ao listar professores:", error);
    res.status(500).json({ message: "Erro ao listar professores." });
  }
};

export const criarProfessor = async (req: Request, res: Response) => {
  try {
    const { codigo, cref, nome, areaFormacao, usuario, statusCref } = req.body;

    let qualificacoes = req.body.qualificacoes;
    let certificacoes = req.body.certificacoes;
    if (typeof qualificacoes === "string") qualificacoes = [qualificacoes];
    if (typeof certificacoes === "string") certificacoes = [certificacoes];

    const data: any = {
      codigo,
      cref,
      nome,
      areaFormacao,
      statusCref,
      qualificacoes,
      certificacoes,
      fotoUrl: req.file?.filename || "",
    };
    if (usuario) data.usuario = usuario;

    const novoProfessor = await prisma.professor.create({ data });
    res.status(201).json(novoProfessor);
  } catch (error) {
    console.error("Erro ao criar professor:", error);
    res.status(500).json({ message: "Erro ao criar professor", error });
  }
};

export const editarProfessor = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { codigo, cref, nome, areaFormacao, statusCref } = req.body;

    let qualificacoes = req.body["qualificacoes[]"] || req.body.qualificacoes;
    let certificacoes = req.body["certificacoes[]"] || req.body.certificacoes;
    if (typeof qualificacoes === "string") qualificacoes = [qualificacoes];
    if (typeof certificacoes === "string") certificacoes = [certificacoes];

    const data: any = { codigo, cref, nome, areaFormacao, statusCref, qualificacoes, certificacoes };
    if (req.file) data.fotoUrl = req.file.filename;

    const professorAtualizado = await prisma.professor.update({ where: { id }, data });
    res.json(professorAtualizado);
  } catch (error) {
    console.error("Erro ao editar professor:", error);
    res.status(500).json({ message: "Erro ao editar professor.", error });
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
        where: { professorId },
        data: {
          professorId: null,
          ativo: false,
          encerradoEm: new Date(),
        },
      });

      await tx.atleta.updateMany({
        where: { professorId },
        data: {
          professorId: null,
          statusConexao: "Pendente",
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
    const { id } = req.params;

    const prof = await prisma.professor.findUnique({
      where: { id },
      select: { escolinhaId: true, clubeId: true },
    });
    if (!prof) return res.json([]);

    const [e, c] = await Promise.all([
      prof.escolinhaId
        ? prisma.escolinha.findUnique({ where: { id: prof.escolinhaId }, select: { id: true, nome: true } })
        : null,
      prof.clubeId
        ? prisma.clube.findUnique({ where: { id: prof.clubeId }, select: { id: true, nome: true } })
        : null,
    ]);

    const out: Array<{ id: string; nome: string; tipo: "Escolinha" | "Clube" }> = [];
    if (e) out.push({ id: e.id, nome: e.nome, tipo: "Escolinha" });
    if (c) out.push({ id: c.id, nome: c.nome, tipo: "Clube" });

    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao listar vínculos do professor." });
  }
};

export const salvarVinculoProfessor = async (req: Request, res: Response) => {
  try {
    const { id: professorId } = req.params;

    const body = req.body || {};
    const orgId: string | null =
      body.organizacaoId ?? body.idOrganizacao ?? body.organizacao ?? null;

    const { tipo, id } = await resolveOrganizacao(orgId);

    if (!id || !tipo) {
      await prisma.$transaction(async (tx) => {
        await tx.professor.update({
          where: { id: professorId },
          data: { escolinhaId: null, clubeId: null, organizacaoId: null },
        });
        await tx.relacaoTreinamento.deleteMany({
          where: { professorId, atletaId: null },
        });
      });

      const atualizado = await buscarProfessorPorIdInterno(professorId);
      return res.status(200).json({ ok: true, tipo: null, organizacaoId: null, professor: atualizado });
    }

    const dataProfessor =
      tipo === "Escolinha"
        ? { escolinhaId: id, clubeId: null, organizacaoId: id }
        : { clubeId: id, escolinhaId: null, organizacaoId: id };

    const professor = await prisma.$transaction(async (tx) => {
      await tx.relacaoTreinamento.deleteMany({ where: { professorId, atletaId: null } });

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

    res.status(200).json({
      ok: true,
      tipo,
      organizacaoId: id,
      professor,
    });
  } catch (err) {
    console.error("Erro ao salvar vínculo do professor:", err);
    res.status(500).json({ message: "Erro ao salvar vínculo." });
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

    if (typeof atletaNomeUsuario === "string" && atletaNomeUsuario.trim() !== "") {
      const alvo = atletaNomeUsuario.trim().toLowerCase();
      resultado = historicos.filter((h) => {
        const nomeUser = h.atleta?.usuario?.nomeDeUsuario || "";
        return nomeUser.toLowerCase() === alvo;
      });
    }

    res.json(resultado);
  } catch (err) {
    console.error("Erro ao listar histórico de atletas do professor:", err);
    res.status(500).json({ message: "Erro ao listar histórico de atletas do professor." });
  }
};

export const vincularAtletaAoProfessor = async (req: Request, res: Response) => {
  const { professorId } = req.params;
  const { atletaId } = req.body;

  if (!professorId || !atletaId) {
    return res.status(400).json({ message: "professorId e atletaId são obrigatórios." });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.atleta.update({
        where: { id: atletaId },
        data: { professorId: professorId },
      });

      const relacaoExistente = await tx.relacaoTreinamento.findFirst({
        where: { professorId, atletaId },
      });

      if (relacaoExistente) {
        await tx.relacaoTreinamento.update({
          where: { id: relacaoExistente.id },
          data: { encerradoEm: null },
        });
      } else {
        await tx.relacaoTreinamento.create({
          data: {
            professorId,
            atletaId,
          },
        });
      }
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao vincular atleta ao professor:", err);
    return res.status(500).json({ message: "Erro ao vincular atleta ao professor." });
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
        data: { encerradoEm: agora },
      });

      await tx.atleta.update({
        where: { id: atletaId },
        data: { professorId: null },
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

    const where =
      tipo === "clube"
        ? { OR: [{ clubeId: tipoUsuarioId }, { organizacaoId: tipoUsuarioId }] }
        : { OR: [{ escolinhaId: tipoUsuarioId }, { organizacaoId: tipoUsuarioId }] };

    const professores = await prisma.professor.findMany({
      where,
      select: {
        id: true,
        nome: true,
        usuario: { select: { nome: true } },
      },
      orderBy: [{ usuario: { nome: "asc" } }, { nome: "asc" }],
    });

    const items = professores.map((p) => ({
      id: String(p.id),
      nome: String(p.usuario?.nome || p.nome || "").trim() || "Professor",
    }));

    return res.json({ items });
  } catch (error) {
    console.error("Erro ao listar professores vinculados:", error);
    return res.status(500).json({ message: "Erro ao listar professores vinculados." });
  }
};