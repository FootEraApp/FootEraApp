import { Request, Response } from "express";
import { PrismaClient, TipoMidia, StorageClass } from "@prisma/client";

const prisma = new PrismaClient();

export const getAllAtletas = async (_req: Request, res: Response) => {
  const atletas = await prisma.atleta.findMany({
    include: { usuario: true, midias: true, postagens: true },
  });
  res.json(atletas);
};

export const getAtletaById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const atleta = await prisma.atleta.findUnique({
    where: { id },
    include: {
      usuario: {
        include: { seguidores: true, seguindo: true },
      },
      midias: true,
      postagens: {
        orderBy: { dataCriacao: "desc" },
        take: 5,
      },
      clube: true,
      escolinha: true,
    },
  });

  if (!atleta) return res.status(404).json({ error: "Atleta não encontrado" });
  res.json(atleta);
};

export const createAtleta = async (req: Request, res: Response) => {
  try {
    const { nomeDeUsuario, senha, nome, email, ...atletaDados } = req.body;

    const bcrypt = await import("bcryptjs");
    const senhaHash = await bcrypt.hash(senha, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nomeDeUsuario,
        senhaHash,
        nome,
        email,
        tipo: "Atleta",
      },
    });

    const atleta = await prisma.atleta.create({
      data: {
        usuarioId: usuario.id,
        ...atletaDados,
      },
    });

    res.status(201).json({ usuario, atleta });
  } catch (error) {
    console.error("Erro ao criar atleta:", error);
    res.status(500).json({ error: "Erro interno ao criar atleta" });
  }
};

export const updateAtleta = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const atleta = await prisma.atleta.update({
      where: { id },
      data: {
        ...data,
        dataUltimaModificacao: new Date(),
      },
    });

    res.json(atleta);
  } catch (error) {
    console.error("Erro ao atualizar atleta:", error);
    res.status(500).json({ error: "Erro interno ao atualizar atleta" });
  }
};

export const deleteAtleta = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.atleta.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error("Erro ao deletar atleta:", error);
    res.status(500).json({ error: "Erro interno ao deletar atleta" });
  }
};

export const getMidiasAtleta = async (req: Request, res: Response) => {
  const { id } = req.params;
  const midias = await prisma.midia.findMany({
    where: { atletaId: id },
  });
  res.json(midias);
};

export const uploadMidiaAtleta = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { url, tipo, titulo, descricao } = req.body as {
    url: string;
    tipo: string;
    titulo?: string;
    descricao?: string;
  };

  const tipoMidia: TipoMidia =
    tipo === "Video"
      ? TipoMidia.Video
      : tipo === "Documento"
      ? TipoMidia.Documento
      : TipoMidia.Imagem;

  const midia = await prisma.midia.create({
    data: {
      atletaId: id,
      url,
      tipo: tipoMidia,
      titulo: titulo ?? "",
      descricao: descricao ?? "",
      dataEnvio: new Date(),
      storageClass: StorageClass.HOT,
    },
  });

  res.status(201).json(midia);
};

export async function getProfessorDoAtleta(req: Request, res: Response) {
  try {
    const { atletaId } = req.params;

    const atleta = await prisma.atleta.findUnique({
      where: { id: atletaId },
      select: { id: true },
    });
    if (!atleta)
      return res.status(404).json({ error: "Atleta não encontrado" });

    const rel = await prisma.relacaoTreinamento.findFirst({
      where: { atletaId: atleta.id, professorId: { not: null } },
      orderBy: { criadoEm: "desc" },
      include: { professor: { include: { usuario: true } } },
    });

    const payload = rel?.professor
      ? {
          id: rel.professor.id,
          nome: rel.professor.nome || rel.professor.usuario?.nome || null,
        }
      : null;

    res.json(payload);
  } catch (e) {
    console.error("getProfessorDoAtleta erro:", e);
    res.status(500).json({ error: "Erro ao buscar professor do atleta" });
  }
}
