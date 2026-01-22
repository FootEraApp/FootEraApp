import { Request, Response } from "express";
import { TipoMidia, StorageClass, TipoUsuario } from "@prisma/client";
import { prisma } from "../prisma.js";

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
      relacoesTreinamento: {
        where: {
          ativo: true,
          encerradoEm: null,
        },
        include: {
          professor: { include: { usuario: true } },
          clube: true,
          escolinha: true,
        },
      },
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
        tipo: TipoUsuario.Atleta,
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

    const rels = await prisma.relacaoTreinamento.findMany({
      where: {
        atletaId,
        ativo: true,
        encerradoEm: null,
        professorId: { not: null },
      },
      include: { professor: { include: { usuario: true } } },
      orderBy: { criadoEm: "desc" },
    });

    const map = new Map<string, { id: string; nome: string | null }>();
    for (const r of rels) {
      const prof = r.professor;
      if (prof?.id) {
        map.set(prof.id, {
          id: prof.id,
          nome: prof.nome || prof.usuario?.nome || null,
        });
      }
    }

    return res.json(Array.from(map.values()));
  } catch (e) {
    console.error("getProfessorDoAtleta erro:", e);
    return res.status(500).json({ error: "Erro ao buscar professores do atleta" });
  }
}

export async function vinculosBasic(req: Request, res: Response) {
  try {
    const raw = String(req.params.id ?? "").trim();
    if (!raw) {
      return res.status(400).json({ error: "id inválido" });
    }

    // ✅ aceita atleta.id OU usuarioId
    const atleta = await prisma.atleta.findFirst({
      where: { OR: [{ id: raw }, { usuarioId: raw }] },
      select: { id: true, clubeId: true, escolinhaId: true },
    });

    if (!atleta) {
      return res.json({ professores: [], clube: null, escolinha: null });
    }

    // ✅ pega vínculos ativos
    const rels = await prisma.relacaoTreinamento.findMany({
      where: {
        atletaId: atleta.id,
        ativo: true,
        encerradoEm: null,
      },
      select: {
        professor: { select: { id: true, nome: true } },
        clube: { select: { id: true, nome: true } },
        escolinha: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: "desc" },
    });

    // ✅ monta lista de professores (sem duplicar)
    const profMap = new Map<string, { id: string; nome: string }>();
    for (const r of rels) {
      if (r.professor?.id) {
        profMap.set(r.professor.id, {
          id: r.professor.id,
          nome: r.professor.nome,
        });
      }
    }
    const professores = Array.from(profMap.values());

    // ✅ clube/escolinha: pega o primeiro encontrado (mais recente)
    const clube = rels.find((r) => r.clube)?.clube ?? null;
    const escolinha = rels.find((r) => r.escolinha)?.escolinha ?? null;

    return res.json({ professores, clube, escolinha });
  } catch (e) {
    console.error("Erro em vinculos-basic:", e);
    return res.status(500).json({ error: "Erro ao carregar vínculos" });
  }
}