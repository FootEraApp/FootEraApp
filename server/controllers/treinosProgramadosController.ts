import { Request, Response } from "express";
import { PrismaClient, Categoria, Nivel, TipoTreino } from "@prisma/client";

const prisma = new PrismaClient();

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
  try {
    const {
      nome,
      codigo,
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
      nome?: string; codigo?: string; nivel?: string; descricao?: string;
      categoria?: string[]; tipoTreino?: string; dataAgendada?: string;
      objetivo?: string; duracao?: number; dicas?: string[];
      imagemUrl?: string; metas?: any; pontuacao?: number;
      expiraEm?: string; naoExpira?: boolean; exercicios?: any[];
      tipoUsuario?: string; tipoUsuarioId?: string;
      atletasIds?: string[]; elencoId?: string; elencosIds?: string[];
    };

    if (!nome || !codigo) {
      return res.status(400).json({ message: "Campos obrigatórios ausentes: 'nome' e/ou 'codigo'." });
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

    const dono = normalizarTipoUsuario(tipoUsuario);
    if (!dono || !tipoUsuarioId) {
      return res.status(400).json({ message: "Informe 'tipoUsuario' (Professor/Clube/Escolinha) e 'tipoUsuarioId'." });
    }

    const nivelNorm      = normNivel(nivel);
    const tipoTreinoNorm = normTipoTreino(tipoTreino);
    const categoriasNorm = Array.isArray(categoria) ? (categoria.map(normCategoria) as Categoria[]) : [];

    if (categoriasNorm.length === 0) {
      return res.status(400).json({ message: "Pelo menos uma categoria deve ser selecionada." });
    }

    const duplicado = await prisma.treinoProgramado.findFirst({
      where: { OR: [{ nome }, { codigo }] },
      select: { id: true, nome: true, codigo: true },
    });
    if (duplicado) {
      return res.status(400).json({ message: "Treino com o mesmo nome ou código já existe.", duplicado });
    }

    const itens = (exercicios as any[]).map((e: any, i: number) => ({
      exercicioId: e.exercicioId ?? e.id,
      ordem: Number(e.ordem ?? i + 1),
      repeticoes: toRepeticoes(e.series, e.repeticoes),
    }));

    const treinoCriado = await prisma.treinoProgramado.create({
      data: {
        nome,
        codigo,
        nivel: nivelNorm,
        descricao: descricao ?? null,
        categoria: categoriasNorm,
        tipoTreino: tipoTreinoNorm,
        dataAgendada: dataAgendada ? new Date(dataAgendada) : null,
        objetivo: objetivo ?? null,
        duracao: duracao != null ? Number(duracao) : null,
        dicas: Array.isArray(dicas) ? dicas : [],
        imagemUrl: imagemUrl ?? null,
        metas: metas ?? null,
        pontuacao: pontuacao != null ? Number(pontuacao) : null,
        expiraEm: expiraEm ? new Date(expiraEm) : null,
        naoExpira: Boolean(naoExpira),
        ...(dono === "Professor" ? { professor: { connect: { id: tipoUsuarioId } } } : {}),
        ...(dono === "Clube"     ? { clube:     { connect: { id: tipoUsuarioId } } } : {}),
        ...(dono === "Escolinha" ? { escolinha: { connect: { id: tipoUsuarioId } } } : {}),
        exercicios: { create: itens },
      },
      include: {
        professor: { include: { usuario: true } },
        clube: true,
        escolinha: true,
        exercicios: { select: { id: true, exercicioId: true, ordem: true, repeticoes: true } },
      },
    });

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
        professor: { include: { usuario: true } },
        clube: true,
        escolinha: true,
        exercicios: { include: { exercicio: true } },
      },
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
    const { id } = req.params;
    const {
      nome, codigo, descricao, nivel, categoria, tipoTreino, dataAgendada, objetivo,
      duracao, dicas, imagemUrl, metas, pontuacao, expiraEm, naoExpira,
      exercicios = [],
      tipoUsuario, tipoUsuarioId,
    } = req.body;

    if (nome || codigo) {
      const dup = await prisma.treinoProgramado.findFirst({
        where: { id: { not: id }, OR: [{ nome: nome ?? "" }, { codigo: codigo ?? "" }] },
        select: { id: true, nome: true, codigo: true },
      });
      if (dup) {
        return res.status(400).json({ message: "Já existe treino com esse nome ou código.", duplicado: dup });
      }
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
      exercicioId: e.exercicioId ?? e.id,
      ordem: Number(e.ordem ?? i + 1),
      repeticoes: toRepeticoes(e.series, e.repeticoes),
    }));

    await prisma.$transaction([
      prisma.treinoProgramadoExercicio.deleteMany({ where: { treinoProgramadoId: id } }),
      prisma.treinoProgramado.update({
        where: { id },
        data: {
          ...(nome !== undefined ? { nome } : {}),
          ...(codigo !== undefined ? { codigo } : {}),
          ...(descricao !== undefined ? { descricao } : {}),
          ...(nivel !== undefined ? { nivel: nivel as Nivel } : {}),
          ...(categoria !== undefined ? { categoria: { set: categoria as Categoria[] } } : {}),
          ...(tipoTreino !== undefined ? { tipoTreino: tipoTreino as TipoTreino | null } : {}),
          ...(dataAgendada !== undefined ? { dataAgendada: dataAgendada ? new Date(dataAgendada) : null } : {}),
          ...(objetivo !== undefined ? { objetivo } : {}),
          ...(duracao !== undefined ? { duracao: duracao != null ? Number(duracao) : null } : {}),
          ...(dicas !== undefined ? { dicas: Array.isArray(dicas) ? dicas : [] } : {}),
          ...(imagemUrl !== undefined ? { imagemUrl } : {}),
          ...(metas !== undefined ? { metas } : {}),
          ...(pontuacao !== undefined ? { pontuacao: pontuacao != null ? Number(pontuacao) : null } : {}),
          ...(expiraEm !== undefined ? { expiraEm: expiraEm ? new Date(expiraEm) : null } : {}),
          ...(naoExpira !== undefined ? { naoExpira: Boolean(naoExpira) } : {}),
          ...dataDono,
          exercicios: { create: itens },
        },
      }),
    ]);

    res.setHeader("X-TPR-Handler", "treinosprogramados.put.v2");
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
        professor: { include: { usuario: true } },
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
