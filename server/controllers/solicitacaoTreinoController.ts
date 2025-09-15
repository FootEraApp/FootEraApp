import { Response, Request } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const getBase = (req: Request) =>
  process.env.API_BASE_URL || `${req.protocol}://${req.get("host")}`;

const absFoto = (req: Request, f?: string | null) =>
  f
    ? (/^(https?:|data:|blob:)/i.test(f)
        ? f
        : `${getBase(req)}${f.startsWith("/") ? f : `/${f}`}`)
    : null;

export async function listarSolicitacoesMinhas(req: Request, res: Response) {
  const me: string | undefined = (req as any).user?.id || (req as any).userId;
  if (!me) return res.status(401).json({ error: "Não autenticado." });

  try {
    const rows = await prisma.solicitacaoTreino.findMany({
      where: { remetenteId: me },             
      include: {
        destinatario: {
          select: { id: true, nomeDeUsuario: true, nome: true, foto: true },
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    const payload = rows.map((s) => ({
      id: s.id,
      status: s.status,
      criadaEm: s.criadoEm,
      destinatarioId: s.destinatarioId,
      destinatario: {
        id: s.destinatario.id,
        nomeDeUsuario: s.destinatario.nomeDeUsuario,
        nome: s.destinatario.nome,
        foto: absFoto(req, s.destinatario.foto),   
      },
    }));

    return res.json(payload);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Falha ao listar solicitações" });
  }
}

export async function listarSolicitacoesRecebidas(req: Request, res: Response) {
  const me: string | undefined = (req as any).user?.id || (req as any).userId;
  if (!me) return res.status(401).json({ error: "Usuário não autenticado." });

  try {
    const rows = await prisma.solicitacaoTreino.findMany({
      where: { destinatarioId: me, status: "pendente" },
      include: {
        remetente: {
          select: { id: true, nomeDeUsuario: true, nome: true, foto: true },
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    const payload = rows.map((s) => ({
      id: s.id,
      status: s.status,
      criadaEm: s.criadoEm,
      remetenteId: s.remetenteId,
      remetente: {
        id: s.remetente.id,
        nomeDeUsuario: s.remetente.nomeDeUsuario,
        nome: s.remetente.nome,
        foto: absFoto(req, s.remetente.foto),    
      },
    }));

    return res.json(payload);
  } catch (error) {
    console.error("Erro ao listar solicitações recebidas:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function criarSolicitacao(req: Request, res: Response) {
  const remetenteId: string | undefined = (req as any).user?.id || (req as any).userId;
  const { destinatarioId } = (req.body ?? {}) as { destinatarioId?: string };

  if (!remetenteId) return res.status(401).json({ message: "Não autenticado." });
  if (!destinatarioId) return res.status(400).json({ message: "destinatarioId é obrigatório" });
  if (remetenteId === destinatarioId) {
    return res.status(400).json({ message: "Não é permitido enviar para si mesmo." });
  }

  const existente = await prisma.solicitacaoTreino.findFirst({
    where: {
      status: { in: ["pendente", "ativa"] },
      OR: [
        { remetenteId, destinatarioId },
        { remetenteId: destinatarioId, destinatarioId: remetenteId },
      ],
    },
  });

  if (existente) {
    return res.status(200).json({ id: existente.id, status: existente.status, ok: true, duplicated: true });
  }

  const nova = await prisma.solicitacaoTreino.create({
    data: { remetenteId, destinatarioId, status: "pendente" },
  });
  return res.status(201).json(nova);
}

export async function cancelarSolicitacao(req: Request, res: Response) {
  const me: string | undefined = (req as any).user?.id || (req as any).userId;
  const outroId = (req.params as any).destinatarioId || (req.body ?? {}).destinatarioId;

  if (!me) return res.status(401).json({ message: "Não autenticado." });
  if (!outroId) return res.status(400).json({ message: "destinatarioId é obrigatório" });

  const del = await prisma.solicitacaoTreino.deleteMany({
    where: {
      status: "pendente",
      OR: [
        { remetenteId: me, destinatarioId: outroId },
        { remetenteId: outroId, destinatarioId: me },
      ],
    },
  });

  if (del.count === 0) return res.status(404).json({ message: "Não há solicitação pendente" });
  return res.sendStatus(204);
}

export async function aceitarSolicitacao(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const destinatarioId: string | undefined = (req as any).user?.id || (req as any).userId;
  if (!destinatarioId) return res.status(401).json({ error: "Não autenticado." });

  try {
    const solicitacao = await prisma.solicitacaoTreino.findUnique({ where: { id } });
    if (!solicitacao || solicitacao.destinatarioId !== destinatarioId) {
      return res.status(404).json({ error: "Solicitação não encontrada" });
    }

    const [remetente, destinatario] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: solicitacao.remetenteId }, select: { tipo: true } }),
      prisma.usuario.findUnique({ where: { id: solicitacao.destinatarioId }, select: { tipo: true } }),
    ]);

    async function getIdsByTipo(usuarioId: string, tipo?: string) {
      switch (tipo) {
        case "Professor": {
          const r = await prisma.professor.findUnique({ where: { usuarioId } });
          return { professorId: r?.id };
        }
        case "Atleta": {
          const r = await prisma.atleta.findUnique({ where: { usuarioId } });
          return { atletaId: r?.id };
        }
        case "Escolinha": {
          const r = await prisma.escolinha.findUnique({ where: { usuarioId } });
          return { escolinhaId: r?.id };
        }
        case "Clube": {
          const r = await prisma.clube.findUnique({ where: { usuarioId } });
          return { clubeId: r?.id };
        }
        default:
          return {};
      }
    }

    const idsRem = await getIdsByTipo(solicitacao.remetenteId, remetente?.tipo);
    const idsDes = await getIdsByTipo(solicitacao.destinatarioId, destinatario?.tipo);
    const ids = { ...idsRem, ...idsDes } as {
      professorId?: string; escolinhaId?: string; clubeId?: string; atletaId?: string;
    };

    const donos = ["professorId", "escolinhaId", "clubeId"].filter(k => (ids as any)[k]);
    if (!ids.atletaId || donos.length !== 1) {
      return res.status(400).json({ error: "Tipos de usuário inválidos para relação." });
    }

    const existente = await prisma.relacaoTreinamento.findFirst({
      where: {
        atletaId: ids.atletaId!,
        ...(ids.professorId ? { professorId: ids.professorId } : {}),
        ...(ids.escolinhaId ? { escolinhaId: ids.escolinhaId } : {}),
        ...(ids.clubeId ? { clubeId: ids.clubeId } : {}),
      },
    });

    if (!existente) {
      await prisma.relacaoTreinamento.create({
        data: {
          atletaId: ids.atletaId!,
          professorId: ids.professorId ?? null,
          escolinhaId: ids.escolinhaId ?? null,
          clubeId: ids.clubeId ?? null,
        },
      });
    }

    await prisma.solicitacaoTreino.delete({ where: { id } });

    return res.json({ message: existente ? "Relação já existia. Solicitação removida." : "Solicitação aceita com sucesso." });
  } catch (error) {
    console.error("Erro ao aceitar solicitação:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function recusarSolicitacao(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const me: string | undefined = (req as any).user?.id || (req as any).userId;
  if (!me) return res.status(401).json({ error: "Não autenticado." });

  try {
    const solicitacao = await prisma.solicitacaoTreino.findUnique({ where: { id } });
    if (!solicitacao || solicitacao.destinatarioId !== me) {
      return res.status(404).json({ error: "Solicitação não encontrada" });
    }

    await prisma.solicitacaoTreino.delete({ where: { id } });
    return res.json({ message: "Solicitação recusada com sucesso." });
  } catch (error) {
    console.error("Erro ao recusar solicitação:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}