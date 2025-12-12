import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient;;

export const treinosLivresController = {
  async index(req: Request, res: Response) {
    try {
      const { atletaId: atletaIdQuery, tipoAtividade, categoria } = req.query as any;

      const tipo = (req as any).user?.tipo;
      const tipoUsuarioId = (req as any).user?.tipoUsuarioId;
      const atletaId = tipo === "atleta" ? tipoUsuarioId : atletaIdQuery;

      const where: any = {
        ...(atletaId ? { atletaId } : {}),
        ...(tipoAtividade
          ? { tipoAtividade: { equals: String(tipoAtividade), mode: "insensitive" } }
          : {}),
        ...(categoria
          ? { categoria: { equals: String(categoria), mode: "insensitive" } }
          : {}),
      };

      const treinos = await prisma.treinoLivre.findMany({
        where,
        include: { atleta: true },
        orderBy: { data: "desc" },
      });

      res.json(treinos);
    } catch (err) {
      res.status(500).json({ message: "Erro ao listar treinos livres", error: err });
    }
  },

  async show(req: Request, res: Response) {
    try {
      const id = String(req.params.id);

      const treino = await prisma.treinoLivre.findUnique({
        where: { id },
        include: { atleta: true },
      });

      if (!treino) return res.status(404).json({ message: "Treino não encontrado" });

      res.json(treino);
    } catch (err) {
      res.status(500).json({ message: "Erro ao buscar treino", error: err });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const {
        atletaId,
        data,
        descricao,
        duracaoMin,
        tipoAtividade,
        categoria,
      } = req.body as any;

      const userId = (req as any).user?.id;
      const tipo = (req as any).user?.tipo;
      const tipoUsuarioId = (req as any).user?.tipoUsuarioId;

      if (tipo === "atleta" && tipoUsuarioId !== atletaId) {
        return res
          .status(403)
          .json({ message: "Sem permissão para registrar treino para outro atleta." });
      }

      const atletaExiste = await prisma.atleta.findUnique({
        where: { id: String(atletaId) },
      });
      if (!atletaExiste)
        return res.status(400).json({ message: "Atleta inválido" });

      if (!data || !duracaoMin || !(tipoAtividade ?? descricao)?.trim()) {
        return res.status(400).json({
          message: "Campos obrigatórios: data, duração e atividade/descrição.",
        });
      }

      const file = (req as any).file as Express.Multer.File | undefined;
      const urlEvidencia = file
        ? `/uploads/treinos-livres/${file.filename}`
        : null;

      const novo = await prisma.treinoLivre.create({
        data: {
          atletaId: String(atletaId),
          data: new Date(data),
          descricao: (descricao ?? "").trim(),
          duracaoMin: Number(duracaoMin) || 0,
          tipoAtividade: tipoAtividade || null,
          categoria: categoria || null,
          urlEvidencia, 
        },
      });

      try {
        const atleta = await prisma.atleta.findUnique({
          where: { id: String(atletaId) },
          select: { usuarioId: true },
        });

        if (atleta?.usuarioId) {
          await prisma.atividadeRecente.create({
            data: {
              usuarioId: atleta.usuarioId,
              tipo: "treino",
              imagemUrl: urlEvidencia,
            },
          });
        }
      } catch {
      }

      return res.status(201).json(novo);
    } catch (err) {
      console.error("Erro ao criar treino livre:", err);
      return res
        .status(500)
        .json({ message: "Erro ao criar treino", error: err });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = String(req.params.id);

      const treino = await prisma.treinoLivre.findUnique({ where: { id } });
      if (!treino) return res.status(404).json({ message: "Treino não encontrado" });

      await prisma.treinoLivre.delete({ where: { id } });

      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Erro ao deletar treino", error: err });
    }
  },
};
