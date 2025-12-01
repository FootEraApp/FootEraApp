import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
  const { id } = req.params;
  try {
    await prisma.professor.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir professor:", error);
    res.status(500).json({ message: "Erro ao excluir professor." });
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
