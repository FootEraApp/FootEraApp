import { Response } from "express";
import { TipoUsuario, AvaliacaoAutorTipo } from "@prisma/client";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { prisma } from "../prisma.js";

const schema = z.object({
  treinoAgendadoId: z.string().min(1),
  submissaoTreinoId: z.string().min(1).optional().nullable(),
  nota: z.number().int().min(0).max(5).optional().default(0),
  comentario: z.string().optional().nullable(),
  concluiu: z.boolean().optional().default(true),
  teveDificuldade: z.boolean().optional().default(false),
  dificuldadeMotivo: z.string().optional().nullable(),
  sentimento: z.enum(["ruim", "medio", "otimo"]).optional().nullable(),
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

    if (usuario.tipo === TipoUsuario.Atleta) {
      const atleta = await prisma.atleta.findUnique({
        where: { usuarioId: usuario.id },
        select: { id: true },
      });
      if (!atleta) {
        return res.status(403).json({ error: "Atleta não encontrado." });
      }

      autorTipo = AvaliacaoAutorTipo.Atleta;
      autorId = atleta.id;

    } else if (usuario.tipo === TipoUsuario.Professor) {
      const prof = await prisma.professor.findUnique({
        where: { usuarioId: usuario.id },
        select: { id: true },
      });
      if (!prof) return res.status(403).json({ error: "Professor não encontrado." });

      autorTipo = AvaliacaoAutorTipo.Professor;
      autorId = prof.id;

    } else if (usuario.tipo === TipoUsuario.Clube) {
      const clube = await prisma.clube.findUnique({
        where: { usuarioId: usuario.id },
        select: { id: true },
      });
      if (!clube) return res.status(403).json({ error: "Clube não encontrado." });

      autorTipo = AvaliacaoAutorTipo.Clube;
      autorId = clube.id;

    } else if (usuario.tipo === TipoUsuario.Escolinha) {
      const escola = await prisma.escolinha.findFirst({
        where: { usuarioId: usuario.id },
        select: { id: true },
      });
      if (!escola) return res.status(403).json({ error: "Escolinha não encontrada." });

      autorTipo = AvaliacaoAutorTipo.Escolinha;
      autorId = escola.id;

    } else {
      return res.status(403).json({ error: "Tipo de usuário não pode avaliar treino." });
    }

    const treinoAgendado = await prisma.treinoAgendado.findUnique({
      where: { id: body.treinoAgendadoId },
      select: { id: true, atletaId: true },
    });
    if (!treinoAgendado) return res.status(404).json({ error: "Treino agendado não encontrado." });

    if (usuario.tipo === TipoUsuario.Atleta) {
      const atletaDoUsuario = await prisma.atleta.findUnique({
        where: { usuarioId: usuario.id },
        select: { id: true },
      });

      if (!atletaDoUsuario || atletaDoUsuario.id !== treinoAgendado.atletaId) {
        return res.status(403).json({ error: "Você só pode avaliar seus próprios treinos." });
      }
    }

    const createData: any = {
      atletaId: treinoAgendado.atletaId,
      treinoAgendadoId: treinoAgendado.id,
      autorTipo,
      autorId,
      autorUsuarioId: usuario.id,
      nota: body.nota,
      concluiu: body.concluiu,
      sentimento: body.sentimento ?? null,
      teveDificuldade: body.teveDificuldade,
      dificuldadeMotivo: body.teveDificuldade ? (body.dificuldadeMotivo ?? null) : null,
      motivoNaoConcluiu: body.concluiu ? null : (body.motivoNaoConcluiu ?? null),
    };

    if (body.submissaoTreinoId) {
      createData.submissaoTreinoId = body.submissaoTreinoId;
    }

    let submissao = null;

    if (body.submissaoTreinoId) {
      submissao = await prisma.submissaoTreino.findUnique({
        where: { id: body.submissaoTreinoId },
        select: { id: true, atletaId: true, treinoAgendadoId: true },
      });

      if (!submissao) {
        return res.status(404).json({ error: "Submissão de treino não encontrada." });
      }

      if (submissao.treinoAgendadoId !== treinoAgendado.id) {
        return res.status(400).json({ error: "Submissão não pertence a este treino." });
      }

      if (submissao.atletaId !== treinoAgendado.atletaId) {
        return res.status(403).json({ error: "Submissão não pertence ao atleta." });
      }
    }

    if (body.concluiu === false && !body.motivoNaoConcluiu) {
      return res.status(400).json({ error: "Informe o motivo por não concluir o treino." });
    }

    const comentarioTexto = (body.comentario ?? "").trim();
    const criarComentario = comentarioTexto.length > 0;

    if (criarComentario) {
      createData.comentarios = { create: [{ texto: comentarioTexto, ordem: 0 }] };
    }
    const whereUnique =
      body.submissaoTreinoId
        ? {
            submissaoTreinoId_autorTipo_autorId: {
              submissaoTreinoId: body.submissaoTreinoId,
              autorTipo,
              autorId,
            },
          }
        : {
            treinoAgendadoId_autorTipo_autorId: {
              treinoAgendadoId: treinoAgendado.id,
              autorTipo,
              autorId,
            },
          };

    const avaliacao = await prisma.avaliacaoTreino.upsert({
      where: whereUnique as any,
      update: {
        nota: body.nota,
        concluiu: body.concluiu,
        teveDificuldade: body.teveDificuldade,
        sentimento: body.sentimento ?? null,
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
      create: createData,
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