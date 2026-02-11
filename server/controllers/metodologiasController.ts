// server/controllers/metodologiasController
import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { MetodologiaAssinaturaStatus, MetodologiaPublicoAlvo, MetodologiaConteudoTipo  } from "@prisma/client";

/** Pega userId do token (igual seu padrão) */
function getUserId(req: Request): string | null {
  const r: any = req;
  return r.userId || r.user?.id || r.usuarioId || null;
}

/** =========================
 * GET /api/metodologias
 * ?criadorUsuarioId=...
 * ========================= */
export async function listMetodologias(req: Request, res: Response) {
  try {
    const criadorUsuarioId = (req.query.criadorUsuarioId as string) || undefined;

    const items = await prisma.metodologia.findMany({
      where: criadorUsuarioId ? { criadorUsuarioId } : undefined,
      orderBy: { criadoEm: "desc" },
      include: {
        criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
        _count: { select: { assinantes: true, itens: true } },
      },
    });

    return res.json({ items });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao listar metodologias.", detail: e?.message });
  }
}

/** =========================
 * GET /api/metodologias/:id
 * ========================= */
export async function getMetodologiaById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const item = await prisma.metodologia.findUnique({
      where: { id },
      include: {
        criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
        itens: { orderBy: [{ semana: "asc" }, { ordem: "asc" }] },
        _count: { select: { assinantes: true, itens: true } },
      },
    });

    if (!item) return res.status(404).json({ message: "Metodologia não encontrada." });
    return res.json({ item });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao buscar metodologia.", detail: e?.message });
  }
}

/** =========================
 * POST /api/metodologias
 * body: { titulo, descricao?, capaUrl?, totalSemanas?, nivel?, categorias? }
 * ========================= */
export async function createMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { titulo, descricao, capaUrl, totalSemanas, nivel, categorias, publicoAlvo } = req.body || {};

    if (!titulo || typeof titulo !== "string") {
      return res.status(400).json({ message: "Campo 'titulo' é obrigatório." });
    }

    // ✅ resolve o "dono real" (professor/clube/escolinha) a partir do usuário logado
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        tipo: true,
        professor: { select: { id: true } },
        clube: { select: { id: true } },
        escolinha: { select: { id: true } },
      },
    });

    const professorId =
      usuario?.tipo === "Professor" ? usuario?.professor?.id ?? null : null;

    const clubeId =
      usuario?.tipo === "Clube" ? usuario?.clube?.id ?? null : null;

    const escolinhaId =
      usuario?.tipo === "Escolinha" ? usuario?.escolinha?.id ?? null : null;

    let publicoAlvoFinal: MetodologiaPublicoAlvo = MetodologiaPublicoAlvo.AMBOS;

    if (publicoAlvo !== undefined && publicoAlvo !== null && String(publicoAlvo).trim() !== "") {
      const raw = String(publicoAlvo).toUpperCase().trim();
      const ok = (Object.values(MetodologiaPublicoAlvo) as string[]).includes(raw);
      if (!ok) {
        return res.status(400).json({
          message: "publicoAlvo inválido",
          recebido: publicoAlvo,
          esperado: Object.values(MetodologiaPublicoAlvo),
        });
      }
      publicoAlvoFinal = raw as MetodologiaPublicoAlvo;
    }

    const created = await prisma.metodologia.create({
      data: {
        titulo: titulo.trim(),
        descricao: typeof descricao === "string" ? descricao.trim() : null,
        capaUrl: typeof capaUrl === "string" ? capaUrl.trim() : null,
        totalSemanas: typeof totalSemanas === "number" ? totalSemanas : null,
        nivel: nivel ?? undefined,
        categorias: Array.isArray(categorias) ? categorias : undefined,
        publicoAlvo: publicoAlvoFinal,

        criadorUsuarioId: userId,

        // ✅ agora grava o “tipo dono”
        professorId: professorId ?? undefined,
        clubeId: clubeId ?? undefined,
        escolinhaId: escolinhaId ?? undefined,
      },
      include: { _count: { select: { assinantes: true, itens: true } } },
    });

    return res.status(201).json({ item: created });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao criar metodologia.", detail: e?.message });
  }
}

/** =========================
 * PUT /api/metodologias/:id
 * Edita (somente criador)
 * ========================= */
export async function updateMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { id } = req.params;
    const { titulo, descricao, capaUrl, totalSemanas, ativo, nivel, categorias, publicoAlvo } = req.body || {};

    const current = await prisma.metodologia.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: "Metodologia não encontrada." });

    if (current.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Você não tem permissão para editar esta metodologia." });
    }

    let publicoAlvoUpdate: MetodologiaPublicoAlvo | undefined = undefined;

    if (publicoAlvo !== undefined) {
      const raw = String(publicoAlvo).toUpperCase().trim();
      const ok = (Object.values(MetodologiaPublicoAlvo) as string[]).includes(raw);
      if (!ok) {
        return res.status(400).json({
          message: "publicoAlvo inválido",
          recebido: publicoAlvo,
          esperado: Object.values(MetodologiaPublicoAlvo),
        });
      }
      publicoAlvoUpdate = raw as MetodologiaPublicoAlvo;
    }

    const updated = await prisma.metodologia.update({
      where: { id },
      data: {
        titulo: typeof titulo === "string" ? titulo.trim() : undefined,
        descricao: typeof descricao === "string" ? descricao.trim() : undefined,
        capaUrl: typeof capaUrl === "string" ? capaUrl.trim() : undefined,
        totalSemanas: typeof totalSemanas === "number" ? totalSemanas : undefined,
        ativo: typeof ativo === "boolean" ? ativo : undefined,
        nivel: nivel ?? undefined,
        categorias: Array.isArray(categorias) ? categorias : undefined,
        ...(publicoAlvoUpdate !== undefined ? { publicoAlvo: publicoAlvoUpdate } : {}),
      },
      include: {
        _count: { select: { assinantes: true, itens: true } },
      },
    });

    return res.json({ item: updated });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao editar metodologia.", detail: e?.message });
  }
}

/** =========================
 * DELETE /api/metodologias/:id
 * Exclui (somente criador)
 * ========================= */
export async function deleteMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { id } = req.params;

    const current = await prisma.metodologia.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: "Metodologia não encontrada." });

    if (current.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Você não tem permissão para excluir esta metodologia." });
    }

    await prisma.metodologia.delete({ where: { id } });

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao excluir metodologia.", detail: e?.message });
  }
}

/** =========================
 * GET /api/metodologias/minhas/assinadas
 * Lista metodologias assinadas pelo usuário
 * ========================= */
export async function listMinhasMetodologiasAssinadas(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const assinaturas = await prisma.metodologiaAssinante.findMany({
      where: {
        usuarioId: userId,
        status: MetodologiaAssinaturaStatus.ATIVA, // ✅ no seu schema é status (enum), não "ativo"
      },
      orderBy: { iniciouEm: "desc" }, // ✅ no seu schema é iniciouEm (não criadoEm)
      include: {
        metodologia: {
          include: {
            criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
            _count: { select: { assinantes: true, itens: true } },
          },
        },
      },
    });

    return res.json({
      items: assinaturas.map((a) => ({
        ...a,
        metodologia: a.metodologia, // ✅ agora existe
      })),
    });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao listar assinadas.", detail: e?.message });
  }
}

/** =========================
 * GET /api/metodologias/minhas
 * Lista metodologias criadas pelo usuário logado
 * (pra selects no front)
 * ========================= */
export async function listMinhasMetodologiasCriadas(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const items = await prisma.metodologia.findMany({
      where: { criadorUsuarioId: userId, ativo: true },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        titulo: true,
        publicoAlvo: true,
      },
    });

    return res.json({ items });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao listar minhas metodologias.", detail: e?.message });
  }
}

export async function listMetodologiasVisiveis(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const tipo =
      String((req as any).authUser?.tipo ?? (req as any).user?.tipo ?? "")
        .toLowerCase()
        .trim();

    const publicoPermitido =
      tipo === "atleta"
        ? [MetodologiaPublicoAlvo.ATLETAS, MetodologiaPublicoAlvo.AMBOS]
        : [MetodologiaPublicoAlvo.PROFISSIONAIS, MetodologiaPublicoAlvo.AMBOS];

    const items = await prisma.metodologia.findMany({
      where: {
        ativo: true,
        publicoAlvo: { in: publicoPermitido },
      },
      orderBy: { criadoEm: "desc" },
      include: {
        criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
        _count: { select: { assinantes: true, itens: true } },
      },
    });

    return res.json({ items });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao listar visíveis.", detail: e?.message });
  }
}

/** =========================
 * POST /api/metodologias/:metodologiaId/itens
 * body:
 *  - { itens: [...] }  OU  { ...item }
 *
 * Item aceito (flexível):
 *  {
 *    semana: number,
 *    ordem?: number,
 *    tipo: "VIDEO" | "TREINO" | "TEXTO",
 *    titulo?: string,
 *    descricao?: string,
 *    videoUrl?: string,
 *    treinoProgramadoId?: string,
 *    pontos?: number,
 *    duracaoMin?: number
 *  }
 * ========================= */

type MetodologiaItemPreparado = {
  metodologiaId: string;
  semana: number;
  ordem: number | null;
  tipo: MetodologiaConteudoTipo;
  titulo: string;
  descricao: string | null;
  videoUrl: string | null;
  treinoProgramadoId: string | null;
  pontos: number | null;
  duracaoMin: number | null;
};

export async function createMetodologiaItens(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { metodologiaId } = req.params;

    // 1) Confere se metodologia existe e se o user é o criador
    const metodologia = await prisma.metodologia.findUnique({
      where: { id: metodologiaId },
      select: { id: true, criadorUsuarioId: true },
    });

    if (!metodologia) {
      return res.status(404).json({ message: "Metodologia não encontrada." });
    }

    if (metodologia.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Você não tem permissão para alterar esta metodologia." });
    }

    // 2) Normaliza payload (aceita {itens:[...]} ou item direto)
    const body = req.body || {};
    const itensEntrada = Array.isArray(body.itens) ? body.itens : [body];

    if (!itensEntrada.length) {
      return res.status(400).json({ message: "Envie pelo menos 1 item." });
    }

    // 3) Valida e prepara itens
    const itensPreparados: MetodologiaItemPreparado[] = [];


    for (let i = 0; i < itensEntrada.length; i++) {
      const raw = itensEntrada[i] || {};

      const semana = Number(raw.semana);
      if (!Number.isFinite(semana) || semana < 1) {
        return res.status(400).json({ message: `Item #${i + 1}: 'semana' inválida.` });
      }

      const tipoStr = String(raw.tipo || "").toUpperCase().trim();

      const tiposPermitidos = ["VIDEO", "TREINO"] as const;

      if (!tiposPermitidos.includes(tipoStr as any)) {
        return res.status(400).json({
          message: `Item #${i + 1}: 'tipo' inválido.`,
          recebido: raw.tipo,
          esperado: tiposPermitidos,
        });
      }

      const tipo = tipoStr as MetodologiaConteudoTipo;

      const ordem =
        raw.ordem === undefined || raw.ordem === null || raw.ordem === ""
          ? null
          : Number(raw.ordem);

      if (ordem !== null && (!Number.isFinite(ordem) || ordem < 1)) {
        return res.status(400).json({ message: `Item #${i + 1}: 'ordem' inválida.` });
      }

      const pontos =
        raw.pontos === undefined || raw.pontos === null || raw.pontos === ""
          ? null
          : Number(raw.pontos);

      if (pontos !== null && (!Number.isFinite(pontos) || pontos < 0)) {
        return res.status(400).json({ message: `Item #${i + 1}: 'pontos' inválido.` });
      }

      const treinoProgramadoId =
        typeof raw.treinoProgramadoId === "string" && raw.treinoProgramadoId.trim()
          ? raw.treinoProgramadoId.trim()
          : null;

      const videoUrl =
        typeof raw.videoUrl === "string" && raw.videoUrl.trim()
          ? raw.videoUrl.trim()
          : null;

      // Regras básicas por tipo (pode relaxar se quiser)
      if (tipo === "VIDEO" && !videoUrl) {
        return res.status(400).json({ message: `Item #${i + 1}: tipo VIDEO exige 'videoUrl'.` });
      }
      if (tipo === "TREINO" && !treinoProgramadoId) {
        return res.status(400).json({ message: `Item #${i + 1}: tipo TREINO exige 'treinoProgramadoId'.` });
      }

      itensPreparados.push({
        metodologiaId,
        semana,
        ordem, // pode ser null (vamos auto setar)
        tipo: tipo as MetodologiaConteudoTipo, // string (Prisma enum também aceita string igual ao valor)
        titulo:
          typeof raw.titulo === "string" && raw.titulo.trim()
            ? raw.titulo.trim()
            : tipo === "VIDEO"
              ? "Vídeo da metodologia"
              : "Treino da metodologia",

        descricao: typeof raw.descricao === "string" ? raw.descricao.trim() : null,
        videoUrl,
        treinoProgramadoId,
        pontos,
        duracaoMin:
          raw.duracaoMin === undefined || raw.duracaoMin === null || raw.duracaoMin === ""
            ? null
            : Number(raw.duracaoMin),
      });
    }

    // 4) Se ordem vier null, auto calcula (por semana)
    //    Fazemos isso num transaction para garantir consistência.
    const created = await prisma.$transaction(async (tx) => {
      const result = [];

      for (const item of itensPreparados) {
        let ordemFinal = item.ordem;

        if (!ordemFinal) {
          const last = await tx.metodologiaItem.findFirst({
            where: { metodologiaId, semana: item.semana },
            orderBy: { ordem: "desc" },
            select: { ordem: true },
          });
          ordemFinal = (last?.ordem ?? 0) + 1;
        }

        const novo = await tx.metodologiaItem.create({
          data: {
            metodologiaId: item.metodologiaId,
            semana: item.semana,
            ordem: ordemFinal,
            tipo: item.tipo,
            titulo: item.titulo,
            descricao: item.descricao,
            videoUrl: item.videoUrl,
            treinoProgramadoId: item.treinoProgramadoId,
            pontos: item.pontos,
            duracaoMin:
              item.duracaoMin !== null && Number.isFinite(item.duracaoMin)
                ? item.duracaoMin
                : null,
          },
        });

        // ✅ PASSO 2: se for TREINO, garante vínculo na MetodologiaTreino
        if (item.tipo === MetodologiaConteudoTipo.TREINO && item.treinoProgramadoId) {
          await tx.metodologiaTreino.upsert({
            where: {
              metodologiaId_treinoProgramadoId: {
                metodologiaId,
                treinoProgramadoId: item.treinoProgramadoId,
              },
            },
            update: {},
            create: {
              metodologiaId,
              treinoProgramadoId: item.treinoProgramadoId,
            },
          });
        }

        result.push(novo);
      }

      return result;
    });

    return res.status(201).json({ itens: created });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao adicionar itens.", detail: e?.message });
  }
}