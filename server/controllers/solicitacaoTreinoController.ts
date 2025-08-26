import { Response, Request } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middlewares/auth.js"; 

const prisma = new PrismaClient();

export async function criarSolicitacao(req: Request, res: Response) {
  const remetenteId = req.userId;
  const { destinatarioId } = (req.body ?? {}) as { destinatarioId?: string };

  if (!remetenteId) return res.status(401).json({ message: "Não autenticado." });
  if (!destinatarioId) return res.status(400).json({ message: "destinatarioId é obrigatório" });
  if (remetenteId === destinatarioId) {
    return res.status(400).json({ message: "Não é permitido enviar para si mesmo." });
  }

  const existe = await prisma.solicitacaoTreino.findFirst({
    where: { remetenteId, destinatarioId, status: { in: ["pendente", "ativa"] } },
  });
  if (existe) return res.status(409).json({ message: "Já existe uma solicitação." });

  const nova = await prisma.solicitacaoTreino.create({
    data: { remetenteId, destinatarioId, status: "pendente" },
  });
  return res.status(201).json(nova);
}

export async function cancelarSolicitacao(req: Request, res: Response) {
  const remetenteId = req.userId;
  const destinatarioId = (req.params as any).destinatarioId || (req.body ?? {}).destinatarioId;

  if (!remetenteId) return res.status(401).json({ message: "Não autenticado." });
  if (!destinatarioId) return res.status(400).json({ message: "destinatarioId é obrigatório" });

  const del = await prisma.solicitacaoTreino.deleteMany({
    where: { remetenteId, destinatarioId, status: "pendente" },
  });
  if (del.count === 0) return res.status(404).json({ message: "Não há solicitação pendente" });
  return res.sendStatus(204);
}

export async function listarSolicitacoesRecebidas(req: Request, res: Response) {
  const usuarioId = req.userId;
  if (!usuarioId) return res.status(401).json({ error: "Usuário não autenticado." });

  try {
    const solicitacoes = await prisma.solicitacaoTreino.findMany({
      where: { destinatarioId: usuarioId, status: "pendente" },
      include: {
        remetente: { select: { id: true, nomeDeUsuario: true, foto: true, nome: true } },
      },
    });

    const BASE_URL = process.env.BASE_URL || process.env.APP_BASE_URL || "";

    const payload = solicitacoes.map((s) => ({
      id: s.id,
      remetenteId: s.remetenteId,
      remetente: {
        id: s.remetente.id,
        nomeDeUsuario: s.remetente.nomeDeUsuario,
        nome: s.remetente.nome,
        fotoUrl: s.remetente.foto ? `${BASE_URL}${s.remetente.foto}` : null,
      },
    }));

    return res.json(payload);
  } catch (error) {
    console.error("Erro ao listar solicitações recebidas:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function aceitarSolicitacao(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const destinatarioId = req.userId;
  if (!destinatarioId) return res.status(401).json({ error: "Não autenticado." });

  try {
    const solicitacao = await prisma.solicitacaoTreino.findUnique({ where: { id } });
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
      const professor = await prisma.professor.findUnique({ where: { usuarioId: solicitacao.remetenteId } });
      const atleta = await prisma.atleta.findUnique({ where: { usuarioId: solicitacao.destinatarioId } });
      if (!professor || !atleta) return res.status(400).json({ error: "Professor ou atleta não encontrado." });
      professorId = professor.id; atletaId = atleta.id;
    } else if (remetente?.tipo === "Atleta" && destinatario?.tipo === "Professor") {
      const atleta = await prisma.atleta.findUnique({ where: { usuarioId: solicitacao.remetenteId } });
      const professor = await prisma.professor.findUnique({ where: { usuarioId: solicitacao.destinatarioId } });
      if (!professor || !atleta) return res.status(400).json({ error: "Professor ou atleta não encontrado." });
      professorId = professor.id; atletaId = atleta.id;
    } else {
      return res.status(400).json({ error: "Tipos de usuário inválidos para relação." });
    }

    await prisma.relacaoTreinamento.create({ data: { professorId, atletaId } });
    await prisma.solicitacaoTreino.delete({ where: { id } });

    return res.json({ message: "Solicitação aceita com sucesso." });
  } catch (error) {
    console.error("Erro ao aceitar solicitação:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function recusarSolicitacao(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const usuarioId = req.userId;
  if (!usuarioId) return res.status(401).json({ error: "Não autenticado." });

  try {
    const solicitacao = await prisma.solicitacaoTreino.findUnique({ where: { id } });
    if (!solicitacao || solicitacao.destinatarioId !== usuarioId) {
      return res.status(404).json({ error: "Solicitação não encontrada" });
    }

    await prisma.solicitacaoTreino.delete({ where: { id } });
    return res.json({ message: "Solicitação recusada com sucesso." });
  } catch (error) {
    console.error("Erro ao recusar solicitação:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
