import { Response } from "express";
import { PrismaClient, TipoUsuario, AvaliacaoAutorTipo } from "@prisma/client";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middlewares/auth.js";

const prisma = new PrismaClient();

const schema = z.object({
  treinoAgendadoId: z.string().min(1),
  submissaoTreinoId: z.string().min(1),
  nota: z.number().int().min(0).max(5).optional().default(0),
  comentario: z.string().optional().nullable(),
  concluiu: z.boolean().optional().default(true),
  teveDificuldade: z.boolean().optional().default(false),
  dificuldadeMotivo: z.string().optional().nullable(),
  motivoNaoConcluiu: z.enum(["TEMPO", "LESAO", "OBSERVACAO"]).optional().nullable(),
});

export async function criarAvaliacaoTreino(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = String(req.userId || "");
    if (!usuarioId) return res.status(401).json({ error: "Não autenticado." });

    const body = schema.parse(req.body);

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, tipo: true },
    });
    if (!usuario) return res.status(401).json({ error: "Usuário não encontrado." });

    let autorTipo: AvaliacaoAutorTipo;
    let autorId: string;

    if (usuario.tipo === TipoUsuario.Professor) {
      const prof = await prisma.professor.findUnique({
        where: { usuarioId: usuario.id },
        select: { id: true },
      });
      if (!prof) return res.status(403).json({ error: "Professor não encontrado para este usuário." });
      autorTipo = AvaliacaoAutorTipo.Professor;
      autorId = prof.id;
    } else if (usuario.tipo === TipoUsuario.Clube) {
      const clube = await prisma.clube.findUnique({
        where: { usuarioId: usuario.id },
        select: { id: true },
      });
      if (!clube) return res.status(403).json({ error: "Clube não encontrado para este usuário." });
      autorTipo = AvaliacaoAutorTipo.Clube;
      autorId = clube.id;
    } else if (usuario.tipo === TipoUsuario.Escolinha) {
      const escola = await prisma.escolinha.findFirst({
        where: { usuarioId: usuario.id },
        select: { id: true },
      });
      if (!escola) return res.status(403).json({ error: "Escolinha não encontrada para este usuário." });
      autorTipo = AvaliacaoAutorTipo.Escolinha;
      autorId = escola.id;
    } else {
      return res.status(403).json({ error: "Apenas Professor/Clube/Escolinha podem avaliar treinos." });
    }

    const treinoAgendado = await prisma.treinoAgendado.findUnique({
      where: { id: body.treinoAgendadoId },
      select: { id: true, atletaId: true },
    });
    if (!treinoAgendado) return res.status(404).json({ error: "Treino agendado não encontrado." });

    const submissao = await prisma.submissaoTreino.findUnique({
      where: { id: body.submissaoTreinoId },
      select: { id: true, atletaId: true, treinoAgendadoId: true },
    });
    if (!submissao) return res.status(404).json({ error: "Submissão de treino não encontrada." });

    if (submissao.treinoAgendadoId !== treinoAgendado.id) {
      return res.status(400).json({ error: "submissaoTreinoId não pertence a esse treinoAgendadoId." });
    }

    if (submissao.atletaId !== treinoAgendado.atletaId) {
      return res.status(400).json({ error: "Submissão não pertence ao atleta deste treino agendado." });
    }

    if (body.concluiu === false && !body.motivoNaoConcluiu) {
      return res.status(400).json({ error: "Informe o motivo por não concluir o treino." });
    }

    const comentarioTexto = (body.comentario ?? "").trim();
    const criarComentario = comentarioTexto.length > 0;

    const avaliacao = await prisma.avaliacaoTreino.upsert({
      where: {
        submissaoTreinoId_autorTipo_autorId: {
          submissaoTreinoId: body.submissaoTreinoId,
          autorTipo,
          autorId,
        },
      },
      update: {
        nota: body.nota,
        concluiu: body.concluiu,
        teveDificuldade: body.teveDificuldade,
        dificuldadeMotivo: body.teveDificuldade ? (body.dificuldadeMotivo ?? null) : null,
        motivoNaoConcluiu: body.concluiu ? null : (body.motivoNaoConcluiu ?? null),

        ...(criarComentario
          ? {
              comentarios: {
                deleteMany: {}, 
                create: [{ texto: comentarioTexto, ordem: 0 }],
              },
            }
          : {}),
      },
      create: {
        atletaId: treinoAgendado.atletaId,
        treinoAgendadoId: treinoAgendado.id,
        submissaoTreinoId: body.submissaoTreinoId,
        autorTipo,
        autorId,
        autorUsuarioId: usuario.id,
        nota: body.nota,
        concluiu: body.concluiu,
        teveDificuldade: body.teveDificuldade,
        dificuldadeMotivo: body.teveDificuldade ? (body.dificuldadeMotivo ?? null) : null,
        motivoNaoConcluiu: body.concluiu ? null : (body.motivoNaoConcluiu ?? null),

        ...(criarComentario
          ? { comentarios: { create: [{ texto: comentarioTexto, ordem: 0 }] } }
          : {}),
      },
      include: { comentarios: true },
    });

    return res.json({ ok: true, avaliacao });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return res.status(400).json({ error: "Dados inválidos.", details: e.errors });
    }
    console.error(e);
    return res.status(500).json({ error: "Erro interno ao salvar avaliação." });
  }
}