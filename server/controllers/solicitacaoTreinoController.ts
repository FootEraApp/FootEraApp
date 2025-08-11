import { Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { AuthenticatedRequest } from "server/middlewares/auth";
import { API } from "../../client/src/config";

const prisma = new PrismaClient();

type SolicitacaoComRemetente = Prisma.SolicitacaoTreinoGetPayload<{
  include: { remetente: { select: { id: true; nomeDeUsuario: true; foto: true } } }
}>;

export const criarSolicitacao = async (req: AuthenticatedRequest, res: Response) => {
  const { destinatarioId } = req.body;
  const remetenteId = req.userId;

  if (!remetenteId) {
    return res.status(401).json({ error: "Usuário não autenticado." });
  }

  try {
    const solicitacaoExistente = await prisma.solicitacaoTreino.findFirst({
      where: {
        remetenteId,
        destinatarioId,
      },
    });

    if (solicitacaoExistente) {
      return res.status(400).json({ error: "Solicitação já enviada." });
    }

    const solicitacao = await prisma.solicitacaoTreino.create({
      data: {
        remetenteId,
        destinatarioId,
        status: "PENDENTE", 
      },
    });

    return res.status(201).json(solicitacao);
  } catch (error) {
    console.error("Erro ao criar solicitação:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};

export const listarSolicitacoesRecebidas = async (req: AuthenticatedRequest, res: Response) => {
  const usuarioId = req.userId;
  if (!usuarioId) return res.status(401).json({ error: "Usuário não autenticado." });

  try {
    const solicitacoes: SolicitacaoComRemetente[] =
      await prisma.solicitacaoTreino.findMany({
        where: { destinatarioId: usuarioId, status: "PENDENTE" },
        include: { remetente: { select: { id: true, nomeDeUsuario: true, foto: true } } },
        orderBy: { criadoEm: "desc" },
      });

    const BASE_URL = process.env.BASE_URL ?? `${API.BASE_URL}`;

    const payload = solicitacoes.map((s) => ({
      id: s.id,
      remetenteId: s.remetenteId,
      remetente: {
        id: s.remetente.id,
        nomeDeUsuario: s.remetente.nomeDeUsuario,
        fotoUrl: s.remetente.foto ? `${BASE_URL}${s.remetente.foto}` : null,
      },
    }));

    return res.json(payload);
  } catch (error) {
    console.error("Erro ao listar solicitações recebidas:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const aceitarSolicitacao = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const destinatarioId = req.userId;

  try {
    const solicitacao = await prisma.solicitacaoTreino.findUnique({
      where: { id },
    });

    if (!solicitacao || solicitacao.destinatarioId !== destinatarioId) {
      return res.status(404).json({ error: "Solicitação não encontrada" });
    }

    const remetente = await prisma.usuario.findUnique({
      where: { id: solicitacao.remetenteId },
      select: { tipo: true },
    });

    const destinatario = await prisma.usuario.findUnique({
      where: { id: solicitacao.destinatarioId },
      select: { tipo: true },
    });

    let professorId: string | undefined;
    let atletaId: string | undefined;

    if (remetente?.tipo === "Professor" && destinatario?.tipo === "Atleta") {
      const professor = await prisma.professor.findUnique({
        where: { usuarioId: solicitacao.remetenteId },
      });

      const atleta = await prisma.atleta.findUnique({
        where: { usuarioId: solicitacao.destinatarioId },
      });

      if (!professor || !atleta) {
        return res.status(400).json({ error: "Professor ou atleta não encontrado." });
      }

      professorId = professor.id;
      atletaId = atleta.id;

    } else if (remetente?.tipo === "Atleta" && destinatario?.tipo === "Professor") {
      const atleta = await prisma.atleta.findUnique({
        where: { usuarioId: solicitacao.remetenteId },
      });

      const professor = await prisma.professor.findUnique({
        where: { usuarioId: solicitacao.destinatarioId },
      });

      if (!professor || !atleta) {
        return res.status(400).json({ error: "Professor ou atleta não encontrado." });
      }

      professorId = professor.id;
      atletaId = atleta.id;

    } else {
      return res.status(400).json({ error: "Tipos de usuário inválidos para relação." });
    }

    await prisma.relacaoTreinamento.create({
      data: {
        professorId,
        atletaId,
      },
    });

    await prisma.solicitacaoTreino.delete({
      where: { id },
    });

    return res.json({ message: "Solicitação aceita com sucesso." });
  } catch (error) {
    console.error("Erro ao aceitar solicitação:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const recusarSolicitacao = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const usuarioId = req.userId; 

  try {
    const solicitacao = await prisma.solicitacaoTreino.findUnique({
      where: { id },
    });

    if (!solicitacao || solicitacao.destinatarioId !== usuarioId) {
      console.warn("❌ Não é o destinatário ou solicitação inexistente");
      return res.status(404).json({ error: "Solicitação não encontrada" });
    }

    await prisma.solicitacaoTreino.delete({
      where: { id },
    });

    return res.json({ message: "Solicitação recusada com sucesso." });
  } catch (error) {
    console.error("Erro ao recusar solicitação:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};