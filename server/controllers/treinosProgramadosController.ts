import { Request, Response } from "express";
import { Categoria, Nivel, TipoTreino } from "@prisma/client";
import { onExercicioIncluidoNoTreino } from "../services/statsService.js";
import { enforceTotalLimit } from '../services/usage.js';
import { audit } from "../services/audit.js";
import { prisma } from "../prisma.js";

type Dono = "Professor" | "Clube" | "Escolinha";

function normalizarTipoUsuario(v?: string): Dono | null {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s === "professor") return "Professor";
  if (s === "clube") return "Clube";
  if (s === "escolinha" || s === "escola") return "Escolinha";
  return null;
}

function toRepeticoes(series?: any, repeticoes?: any): string {
  const s = String(series ?? "").trim();
  const r = String(repeticoes ?? "").trim();
  if (s && r) return `${s}x${r}`;
  return r || s || "";
}

function normNivel(v?: string): Nivel {
  const s = String(v || "").toLowerCase();
  if (s.startsWith("bas")) return "Base";
  if (s.startsWith("av")) return "Avancado";
  if (s.startsWith("perf")) return "Performance";
  return "Base";
}

function normTipoTreino(v?: string): TipoTreino | null {
  const s = String(v || "").toLowerCase();
  if (s.startsWith("tec")) return "Tecnico";
  if (s.startsWith("fis")) return "Fisico";
  if (s.startsWith("tat")) return "Tatico";
  return null;
}
function normCategoria(v?: string): Categoria {
  const s = String(v || "").replace(/-/g, "").toUpperCase();
  const ok = ["Sub9","Sub11","Sub13","Sub15","Sub17","Sub20","Livre"];
  return (ok.includes(s) ? s : "Sub13") as Categoria;
}

export const createTreinoProgramado = async (req: Request, res: Response) => {
  const isTemplate = !!req.body?.naoExpira === true;

  if (isTemplate) {
    await enforceTotalLimit(req, res, 'templates_total', async () =>
      prisma.treinoProgramado.count({
        where: { professorId: req.body.professorId, naoExpira: true }
      })
    );
  } else {
    await enforceTotalLimit(req, res, 'planos_ativos_total', async () =>
      prisma.treinoProgramado.count({
        where: {
          professorId: req.body.professorId,
          OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }],
          NOT: { naoExpira: true }
        }
      })
    );
  }
  try {
    const body =
      typeof req.body?.payload === "string"
        ? JSON.parse(req.body.payload)
        : req.body;

    (req as any).body = body;

    const {
      nome,
      nivel,
      descricao,
      categoria,
      tipoTreino,
      dataAgendada,
      objetivo,
      duracao,
      dicas,
      imagemUrl,
      metas,
      pontuacao,
      expiraEm,
      naoExpira,
      exercicios,
      tipoUsuario,
      tipoUsuarioId,
      atletasIds = [],
      elencoId,
      elencosIds = [],
    } = req.body as {
      nome?: string; nivel?: string; descricao?: string;
      categoria?: string[]; tipoTreino?: string; dataAgendada?: string;
      objetivo?: string; duracao?: number; dicas?: string[];
      imagemUrl?: string; metas?: any; pontuacao?: number;
      expiraEm?: string; naoExpira?: boolean; exercicios?: any[];
      tipoUsuario?: string; tipoUsuarioId?: string;
      atletasIds?: string[]; elencoId?: string; elencosIds?: string[];
    };

    if (!nome) {
      return res.status(400).json({ message: "Campo obrigatório ausente: 'nome'." });
    }
    if (!nivel) {
      return res.status(400).json({ message: "Campo obrigatório ausente: 'nivel'." });
    }
    if (!Array.isArray(exercicios) || exercicios.length === 0) {
      return res.status(400).json({ message: "Informe ao menos um exercício no treino." });
    }
    if (exercicios.some((e: any) => !(e.exercicioId || e.id))) {
      return res.status(400).json({ message: "Todos os exercícios devem possuir 'exercicioId'." });
    }

    // ✅ dono vem do front (Professor principal)
    const professorId = String((req.body as any).professorId ?? "").trim();
    if (!professorId) {
      return res.status(400).json({ message: "Campo obrigatório ausente: 'professorId'." });
    }
    const nivelNorm      = normNivel(nivel);
    const tipoTreinoNorm = normTipoTreino(tipoTreino);
    const categoriasNorm: Categoria[] = Array.isArray(categoria)
      ? (categoria.map(normCategoria) as Categoria[])
      : [];

    const duplicado = await prisma.treinoProgramado.findFirst({
      where: { nome },
      select: { id: true, nome: true },
    });
    if (duplicado) {
      return res.status(400).json({ message: "Treino com o mesmo nome já existe.", duplicado });
    }

    const itens = (exercicios as any[]).map((e: any, i: number) => ({
      exercicioId: String(e.exercicioId ?? e.id ?? "").trim(),
      ordem: Number(e.ordem ?? i + 1),
      repeticoes: String(e.repeticoes ?? "").trim(), // ✅ vem pronto do front
    }));

    const profExiste = await prisma.professor.findUnique({
      where: { id: professorId },
      select: { id: true },
    });
    if (!profExiste) {
      return res.status(400).json({ message: "professorId inválido (Professor não encontrado)." });
    }

    const colabs = Array.isArray((req.body as any).professoresColabIds)
      ? (req.body as any).professoresColabIds
      : [];

    const allProfIds = Array.from(new Set([professorId, ...colabs]))
      .map((x) => String(x).trim())
      .filter(Boolean);

    const uploadedPath =
      req.file?.filename ? `/upload/${req.file.filename}` : null;

    // prioridade: arquivo enviado; senão mantém imagemUrl vinda do body
    const imagemFinal = uploadedPath ?? (imagemUrl ? String(imagemUrl) : null);

    const treinoCriado = await prisma.treinoProgramado.create({
      data: {
        nome,
        nivel: nivelNorm,
        descricao: descricao ?? null,
        categoria: categoriasNorm.length ? categoriasNorm : undefined,
        tipoTreino: tipoTreinoNorm,
        dataAgendada: dataAgendada ? new Date(dataAgendada) : null,
        objetivo: objetivo ?? null,
        duracao: duracao != null ? Number(duracao) : null,
        dicas: Array.isArray(dicas) ? dicas : [],
        imagemUrl: imagemFinal,
        metas: metas ?? null,
        pontuacao: pontuacao != null ? Number(pontuacao) : null,
        expiraEm: expiraEm ? new Date(expiraEm) : null,
        naoExpira: Boolean(naoExpira),
        criadorProfessor: { connect: { id: professorId } },
        professores: {
          create: allProfIds.map((pid) => ({ professorId: pid })),
        },
        exercicios: { create: itens },
      },
      include: {
        criadorProfessor: { include: { usuario: true } }, 
        clube: true,
        escolinha: true,
        exercicios: { include: { exercicio: true } },
      }
    });

    let agendadosCriados = 0;

      const professorIdForStats =
        normalizarTipoUsuario(tipoUsuario) === "Professor"
          ? String(tipoUsuarioId)
          : undefined;

      const r = await prisma.treinoAgendado.createMany({
        data: [],
        skipDuplicates: true,
      });

      agendadosCriados = r.count ?? 0;

      if (agendadosCriados > 0) {
        await audit(req, {
          acao: "ALTERAR_AGENDA",
          entidade: "TreinoAgendado",
          entidadeId: undefined,
          descricao: `Agendamento em lote gerado pelo TreinoProgramado`,
          meta: {
            treinoProgramadoId: treinoCriado.id,
            criados: agendadosCriados,
            dataBase: req.body.dataAgendada || null,
          },
        });

    await audit(req, {
      acao: 'PRESCREVER_TREINO',
      entidade: 'TreinoProgramado',
      entidadeId: treinoCriado.id,
      descricao: `Treino criado (${treinoCriado.nome})`,
      meta: { nome, tipoTreino: tipoTreinoNorm, categorias: categoriasNorm },
    });

      await Promise.all(
        (itens || [])
          .map((i) => i.exercicioId)
          .filter((id) => typeof id === "string" && id)
          .map((exercicioId: string) =>
            onExercicioIncluidoNoTreino({
              treinoId: treinoCriado.id,
              exercicioId,
              professorId: professorIdForStats,
            })
          )
      );
    } 

    try {
      const elencosParaBuscar = [
        ...new Set([...(Array.isArray(elencosIds) ? elencosIds : []), ...(elencoId ? [elencoId] : [])]),
      ];

      let atletasDeElencos: string[] = [];
      if (elencosParaBuscar.length) {
        const rels = await prisma.atletaElenco.findMany({
          where: { elencoId: { in: elencosParaBuscar } },
          select: { atletaId: true },
        });
        atletasDeElencos = rels.map(r => r.atletaId);
      }

      const alvoAtletas = Array.from(new Set([...(Array.isArray(atletasIds) ? atletasIds : []), ...atletasDeElencos]))
        .filter(Boolean);

      if (alvoAtletas.length) {
        const quando = req.body.dataAgendada ? new Date(req.body.dataAgendada) : new Date(Date.now() + 24*60*60*1000);
        await prisma.treinoAgendado.createMany({
          data: alvoAtletas.map(aid => ({
            titulo: treinoCriado.nome,
            atletaId: aid,
            treinoProgramadoId: treinoCriado.id,
            dataTreino: quando,
            dataExpiracao: quando,
          })),
          skipDuplicates: true,
        });
      }
    } catch (e) {
      console.warn("Agendamento em lote falhou (seguindo com 201):", e);
    }

    return res.status(201).json(treinoCriado);

  } catch (error: any) {
    console.error("Erro ao criar treino programado:", error);
    return res.status(500).json({ message: "Erro interno ao criar treino.", error: error.message });
  }
};

export const getTreinoById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const treino = await prisma.treinoProgramado.findUnique({
      where: { id },
      include: {
        criadorProfessor: { include: { usuario: true } }, 
        clube: true,
        escolinha: true,
        exercicios: { include: { exercicio: true } },
      }
    });
    if (!treino) return res.status(404).json({ message: "Treino não encontrado." });
    return res.json(treino);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao buscar treino.", error: err.message });
  }
};

export async function updateTreino(req: Request, res: Response) {
  try {
    const body =
      typeof req.body?.payload === "string"
        ? JSON.parse(req.body.payload)
        : req.body;

    (req as any).body = body;

    const { id } = req.params;
    const {
      nome, descricao, nivel, categoria, tipoTreino, dataAgendada, objetivo,
      duracao, dicas, imagemUrl, metas, pontuacao, expiraEm, naoExpira,
      exercicios = [],
      tipoUsuario, tipoUsuarioId,
    } = req.body;

    if (nome) {
      const dup = await prisma.treinoProgramado.findFirst({
        where: { id: { not: id }, nome },
        select: { id: true, nome: true },
      });
      if (dup) return res.status(400).json({ message: "Já existe treino com esse nome.", duplicado: dup });
    }

    const dataDono: any = {};
    if (tipoUsuario || tipoUsuarioId) {
      const dono = normalizarTipoUsuario(tipoUsuario);
      if (!dono || !tipoUsuarioId) {
        return res.status(400).json({ message: "Para trocar o dono, informe tipoUsuario e tipoUsuarioId." });
      }
      dataDono.professor = { disconnect: true };
      dataDono.clube = { disconnect: true };
      dataDono.escolinha = { disconnect: true };
      if (dono === "Professor") dataDono.professor = { connect: { id: tipoUsuarioId } };
      if (dono === "Clube") dataDono.clube = { connect: { id: tipoUsuarioId } };
      if (dono === "Escolinha") dataDono.escolinha = { connect: { id: tipoUsuarioId } };
    }

    const itens = (exercicios as any[]).map((e: any, i: number) => ({
      exercicioId: String(e.exercicioId ?? e.id ?? "").trim(),
      ordem: Number(e.ordem ?? i + 1),
      repeticoes: String(e.repeticoes ?? "").trim(), // ✅ vem pronto do front
    }));

    const antigos = await prisma.treinoProgramadoExercicio.findMany({
      where: { treinoProgramadoId: id },
      select: { exercicioId: true },
    });
    const antigosSet = new Set(
      antigos.map(a => a.exercicioId).filter(Boolean) as string[]
    );

    const uploadedPath =
      req.file?.filename ? `/upload/${req.file.filename}` : null;

    // se veio arquivo, SEMPRE substitui
    // se não veio, respeita o que vier no body (ou não altera se undefined)
    const imagemPatch =
      uploadedPath ? { imagemUrl: uploadedPath }
      : (imagemUrl !== undefined ? { imagemUrl: imagemUrl ? String(imagemUrl) : null } : {});

    await prisma.$transaction([
      prisma.treinoProgramadoExercicio.deleteMany({ where: { treinoProgramadoId: id } }),
      prisma.treinoProgramado.update({
        where: { id },
        data: {
          ...(nome !== undefined ? { nome } : {}),
          ...(descricao !== undefined ? { descricao } : {}),
          ...(nivel !== undefined ? { nivel: nivel as Nivel } : {}),
          ...(categoria !== undefined ? { categoria: { set: categoria as Categoria[] } } : {}),
          ...(tipoTreino !== undefined ? { tipoTreino: tipoTreino as TipoTreino | null } : {}),
          ...(dataAgendada !== undefined ? { dataAgendada: dataAgendada ? new Date(dataAgendada) : null } : {}),
          ...(objetivo !== undefined ? { objetivo } : {}),
          ...(duracao !== undefined ? { duracao: duracao != null ? Number(duracao) : null } : {}),
          ...(dicas !== undefined ? { dicas: Array.isArray(dicas) ? dicas : [] } : {}),
          ...imagemPatch,
          ...(metas !== undefined ? { metas } : {}),
          ...(pontuacao !== undefined ? { pontuacao: pontuacao != null ? Number(pontuacao) : null } : {}),
          ...(expiraEm !== undefined ? { expiraEm: expiraEm ? new Date(expiraEm) : null } : {}),
          ...(naoExpira !== undefined ? { naoExpira: Boolean(naoExpira) } : {}),
          ...dataDono,
          exercicios: { create: itens },
        },
      }),
    ]);

    const novosOficiais = (Array.isArray(exercicios) ? exercicios : [])
      .map((e: any) => e.exercicioId ?? e.id)
      .filter((v: any) => typeof v === "string" && v);

    const apenasNovos = novosOficiais.filter((id: string) => !antigosSet.has(id));

    if (apenasNovos.length) {
      const dono = normalizarTipoUsuario(tipoUsuario);
      const professorIdForStats = dono === "Professor" ? String(tipoUsuarioId) : undefined;

      await Promise.all(
        apenasNovos.map((exercicioId: string) =>
          onExercicioIncluidoNoTreino({
            treinoId: id,
            exercicioId,
            professorId: professorIdForStats,
          })
        )
      );
    }

    res.setHeader("X-TPR-Handler", "treinosprogramados.put.v2");
    await audit(req, {
      acao: 'ATUALIZAR_TREINO_PROGRAMADO',
      entidade: 'TreinoProgramado',
      entidadeId: id,
      descricao: 'Treino programado atualizado',
    });
    return res.json({ ok: true, id, updated: true });
  } catch (error: any) {
    console.error("ERRO PUT treinosprogramados:", error);
    return res.status(500).json({ message: "Erro ao atualizar treino.", error: error.message });
  }
}

export const deleteTreino = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.$transaction([
      prisma.treinoProgramadoExercicio.deleteMany({ where: { treinoProgramadoId: id } }),
      prisma.treinoProgramado.delete({ where: { id } }),
    ]);
    return res.status(200).json({ message: "Treino excluído." });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao excluir treino.", error: e.message });
  }
};

export const getAllTreinos = async (_req: Request, res: Response) => {
  try {
    const treinos = await prisma.treinoProgramado.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        criadorProfessor: { include: { usuario: true } }, 
        clube: true,
        escolinha: true,
        exercicios: { include: { exercicio: true } },
      },
    });

    return res.json(treinos);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar treinos.", details: error.message });
  }
};