import { Request, Response } from "express";
import { ChecklistContext } from "@prisma/client";
import { prisma } from "../prisma.js";

export async function listarTemplates(req: Request, res: Response) {
  const ctx = String(req.query.context || "SUBMISSAO_TREINO") as ChecklistContext;
  const rows = await prisma.checklistTemplate.findMany({
    where: { context: ctx, ativo: true },
    include: { items: { orderBy: { ordem: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
}

export async function criarTemplate(req: Request, res: Response) {
  const { context, nome, items, professorId, clubeId, escolinhaId } = req.body;
  const tpl = await prisma.checklistTemplate.create({
    data: {
      context,
      nome,
      professorId, clubeId, escolinhaId,
      items: { create: (items || []).map((it: any, i: number) => ({
        ordem: it.ordem ?? i,
        label: it.label,
        key: it.key,
        type: it.type,
        required: !!it.required,
        weight: it.weight ?? 1,
        options: it.options ?? [],
      })) }
    },
    include: { items: true }
  });
  res.status(201).json(tpl);
}

export async function salvarChecklistSubTreino(req: Request, res: Response) {
  const { submissaoTreinoId } = req.params;
  const { templateId, answers } = req.body as { templateId: string; answers: { itemId: string; value: any; comment?: string }[] };

  const existing = await prisma.submissionChecklist.findFirst({ where: { submissaoTreinoId } });
  const checklist = existing
    ? await prisma.submissionChecklist.update({
        where: { id: existing.id },
        data: { templateId, context: "SUBMISSAO_TREINO" }
      })
    : await prisma.submissionChecklist.create({
        data: { templateId, context: "SUBMISSAO_TREINO", submissaoTreinoId }
      });

  await prisma.checklistAnswer.deleteMany({ where: { checklistId: checklist.id } });
  await prisma.checklistAnswer.createMany({
    data: answers.map(a => ({ checklistId: checklist.id, itemId: a.itemId, value: a.value, comment: a.comment }))
  });

  res.json({ ok: true, checklistId: checklist.id });
}