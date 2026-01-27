import { Request, Response } from "express";
import { Categoria, Nivel, TipoTreino } from "@prisma/client";
import { onExercicioIncluidoNoTreino } from "../services/statsService.js";
import { enforceTotalLimit } from '../services/usage.js';
import { audit } from "../services/audit.js";
import { prisma } from "../prisma.js";

type Dono = "Professor" | "Clube" | "Escolinha";

function ownerWhereFrom(tipoUsuario?: string, tipoUsuarioId?: string) {
  const dono = normalizarTipoUsuario(tipoUsuario);
  const id = String(tipoUsuarioId ?? "").trim();
  if (!dono || !id) return null;

  if (dono === "Professor") return { professorId: id };
  if (dono === "Clube") return { clubeId: id };
  return { escolinhaId: id };
}

function assertOwnerIdsFromBodyOrReq(body: any) {
  // prioridade: tipoUsuario/tipoUsuarioId (mais correto pra todos os tipos)
  const dono = normalizarTipoUsuario(body?.tipoUsuario);
  const donoId = String(body?.tipoUsuarioId ?? "").trim();

  // fallback: professorId antigo
  const professorId = String(body?.professorId ?? "").trim();

  if (dono && donoId) {
    if (dono === "Professor") return { dono, professorId: donoId, clubeId: null, escolinhaId: null };
    if (dono === "Clube") return { dono, professorId: null, clubeId: donoId, escolinhaId: null };
    return { dono, professorId: null, clubeId: null, escolinhaId: donoId };
  }

  // compat: se ainda vier professorId sem tipoUsuario
  if (professorId) {
    return { dono: "Professor" as const, professorId, clubeId: null, escolinhaId: null };
  }

  return null;
}

async function mustBeOwner(req: Request, treinoId: string) {
  // tenta pegar de várias fontes (token > headers/query > body)
  const tipoRaw = String(
    (req as any).user?.tipo ??
      req.headers["x-tipo"] ??
      req.query.tipoUsuario ??
      (req as any).body?.tipoUsuario ??
      ""
  )
    .trim()
    .toLowerCase();

  const tipoUsuarioId = String(
    (req as any).user?.tipoUsuarioId ??
      req.headers["x-tipousuarioid"] ??
      req.query.tipoUsuarioId ??
      (req as any).body?.tipoUsuarioId ??
      ""
  ).trim();

  // ADMIN PODE TUDO
  const isAdmin =
    tipoRaw === "admin" || tipoRaw === "administrador" || tipoRaw === "adm";

  if (isAdmin) {
    const treino = await prisma.treinoProgramado.findUnique({
      where: { id: treinoId },
      select: { id: true },
    });
    if (!treino)
      return { ok: false as const, status: 404, message: "Treino não encontrado." };
    return { ok: true as const, treino, status: 200, message: "ok" };
  }

  console.log("[mustBeOwner]", { tipoRaw, tipoUsuarioId, treinoId });

  const treino = await prisma.treinoProgramado.findUnique({
    where: { id: treinoId },
    select: {
      id: true,
      professorId: true,
      clubeId: true,
      escolinhaId: true,
      professores: tipoUsuarioId
        ? {
            where: { professorId: tipoUsuarioId },
            select: { professorId: true },
          }
        : { select: { professorId: true } },
    },
  });

  if (!treino)
    return { ok: false as const, status: 404, message: "Treino não encontrado." };

  const donoId = treino.professorId || treino.clubeId || treino.escolinhaId || "";
  const donoTipo =
    treino.professorId ? "professor" : treino.clubeId ? "clube" : treino.escolinhaId ? "escolinha" : "desconhecido";

  const isOwner =
    !!tipoUsuarioId && !!donoId && tipoUsuarioId === donoId && tipoRaw === donoTipo;

  const isColabProfessor =
    tipoRaw === "professor" &&
    !!tipoUsuarioId &&
    Array.isArray(treino.professores) &&
    treino.professores.length > 0;

  const ok = isOwner || isColabProfessor;

  return {
    ok,
    treino,
    status: ok ? 200 : 403,
    message: ok ? "ok" : "Você não é dono nem colaborador deste treino.",
  };
}

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

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normTipoTreino(v?: string): TipoTreino | null {
  const s0 = String(v || "").trim().toLowerCase();
  const s = stripAccents(s0); // "técnico" -> "tecnico"

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
      criadorProfessorId
    } = req.body as {
      nome?: string; nivel?: string; descricao?: string;
      categoria?: string[]; tipoTreino?: string; dataAgendada?: string;
      objetivo?: string; duracao?: number; dicas?: string[];
      imagemUrl?: string; metas?: any; pontuacao?: number;
      expiraEm?: string; naoExpira?: boolean; exercicios?: any[];
      tipoUsuario?: string; tipoUsuarioId?: string;
      atletasIds?: string[]; elencoId?: string; elencosIds?: string[];
      criadorProfessorId?: string;
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
    const owner = assertOwnerIdsFromBodyOrReq(req.body);
    if (!owner) {
      return res.status(400).json({
        message: "Informe o dono do treino: (tipoUsuario + tipoUsuarioId) ou (professorId).",
      });
    }

    const criadorProfessorIdNorm = String(criadorProfessorId ?? "").trim();

    if (criadorProfessorIdNorm) {
      const profOk = await prisma.professor.findUnique({
        where: { id: criadorProfessorIdNorm },
        select: { id: true },
      });
      if (!profOk) return res.status(400).json({ message: "Professor principal inválido." });
    }

        // ✅ limites só fazem sentido para professor (ajuste se quiser também para clube/escolinha)
    if (owner.dono === "Professor") {
      const pid = owner.professorId!;

      if (Boolean((req.body as any).naoExpira) === true) {
        await enforceTotalLimit(req, res, "templates_total", async () =>
          prisma.treinoProgramado.count({
            where: { professorId: pid, naoExpira: true },
          })
        );
      } else {
        await enforceTotalLimit(req, res, "planos_ativos_total", async () =>
          prisma.treinoProgramado.count({
            where: {
              professorId: pid,
              OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }],
              NOT: { naoExpira: true },
            },
          })
        );
      }
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
      repeticoes: toRepeticoes(e.series ?? e.serie, e.repeticoes), // <- aqui
    }));

    if (owner.dono === "Professor") {
      const profExiste = await prisma.professor.findUnique({
        where: { id: owner.professorId! },
        select: { id: true },
      });
      if (!profExiste) return res.status(400).json({ message: "Professor dono inválido." });
    }

    if (owner.dono === "Clube") {
      const clubeExiste = await prisma.clube.findUnique({
        where: { id: owner.clubeId! },
        select: { id: true },
      });
      if (!clubeExiste) return res.status(400).json({ message: "Clube dono inválido." });
    }

    if (owner.dono === "Escolinha") {
      const escExiste = await prisma.escolinha.findUnique({
        where: { id: owner.escolinhaId! },
        select: { id: true },
      });
      if (!escExiste) return res.status(400).json({ message: "Escolinha dona inválida." });
    }

    const colabs = Array.isArray((req.body as any).professoresColabIds)
      ? (req.body as any).professoresColabIds
      : [];

    // dono pode ser professor (ou não). se for professor, entra como "base" para lista de profs
    const donoProfessorId = owner.dono === "Professor" ? owner.professorId : null;

    const allProfIds = Array.from(
      new Set([...(donoProfessorId ? [donoProfessorId] : []), ...colabs])
    )
      .map((x) => String(x).trim())
      .filter(Boolean);

    // lista final de colaboradores (sem duplicar o dono)
    const colabProfIds = allProfIds.filter((pid) => pid !== owner.professorId);

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
        // DONO REAL (apenas um)
        ...(owner.professorId ? { Professor: { connect: { id: owner.professorId } } } : {}),
        ...(owner.clubeId ? { clube: { connect: { id: owner.clubeId } } } : {}),
        ...(owner.escolinhaId ? { escolinha: { connect: { id: owner.escolinhaId } } } : {}),

        // se você quiser manter criadorProfessor como “criador humano”, ok:
        ...(criadorProfessorIdNorm
          ? { criadorProfessor: { connect: { id: criadorProfessorIdNorm } } }
          : owner.dono === "Professor"
          ? { criadorProfessor: { connect: { id: owner.professorId! } } }
          : {}),

        professores: {
          create: colabProfIds.map((professorId: string) => ({ professorId })),
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

    const perm = await mustBeOwner(req, id);
    if (!perm.ok) return res.status(perm.status).json({ message: perm.message });

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
      dataDono.Professor = { disconnect: true };
      dataDono.clube = { disconnect: true };
      dataDono.escolinha = { disconnect: true };

      if (dono === "Professor") dataDono.Professor = { connect: { id: tipoUsuarioId } };
      if (dono === "Clube") dataDono.clube = { connect: { id: tipoUsuarioId } };
      if (dono === "Escolinha") dataDono.escolinha = { connect: { id: tipoUsuarioId } };
    }

    const itens = (exercicios as any[]).map((e: any, i: number) => ({
      exercicioId: String(e.exercicioId ?? e.id ?? "").trim(),
      ordem: Number(e.ordem ?? i + 1),
      repeticoes: toRepeticoes(e.series ?? e.serie, e.repeticoes), // <- aqui
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

    const atualizado = await prisma.treinoProgramado.findUnique({
      where: { id },
      include: {
        criadorProfessor: { include: { usuario: true } },
        Professor: { include: { usuario: true } },
        clube: true,
        escolinha: true,
        professores: { include: { professor: { include: { usuario: true } } } },
        exercicios: { include: { exercicio: true } },
      },
    });

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
    return res.json(atualizado);
  } catch (error: any) {
    console.error("ERRO PUT treinosprogramados:", error);
    return res.status(500).json({ message: "Erro ao atualizar treino.", error: error.message });
  }
}

export const deleteTreino = async (req: Request, res: Response) => {
  const { id } = req.params;
  const perm = await mustBeOwner(req, id);
  if (!perm.ok) return res.status(perm.status).json({ message: perm.message });

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

export const getAllTreinos = async (req: Request, res: Response) => {
  try {
    const {
      professorId,
      ownerTipo,          // "Professor" | "Clube" | "Escolinha"
      apenasCriador,      // "1" para forçar somente treinos do professor
      order = "desc",
      limit,
    } = req.query as Record<string, string | undefined>;

    const dono = normalizarTipoUsuario(ownerTipo);

    const take = limit ? Math.max(1, Math.min(Number(limit), 50)) : undefined;
    const orderBy = { createdAt: order === "asc" ? ("asc" as const) : ("desc" as const) };

    const where: any = {};

    // ✅ CASO 1: PERFIL PROFESSOR (somente treinos do professor dono)
    // - passa ownerTipo=Professor (ou apenasCriador=1)
    // - e professorId=<id do professor>
    if ((apenasCriador === "1" || dono === "Professor") && professorId) {
      where.professorId = String(professorId);
      where.clubeId = null;
      where.escolinhaId = null;
    }
    // ✅ CASO 2: outras telas podem filtrar por professorId sem restringir dono
    else if (professorId) {
      where.professorId = String(professorId);
      // aqui NÃO forçamos clubeId/escolinhaId = null
      // pois você pode querer incluir treinos do “ecossistema” do professor
    }

    const onlyMine = String((req.query?.onlyMine ?? "")).toLowerCase() === "true";
    const tipoUsuario = String((req.query?.tipoUsuario ?? "")).trim();
    const tipoUsuarioId = String((req.query?.tipoUsuarioId ?? "")).trim();

    const ownerWhere = ownerWhereFrom(tipoUsuario, tipoUsuarioId);

    const treinos = await prisma.treinoProgramado.findMany({
      where: onlyMine && ownerWhere ? ownerWhere : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        criadorProfessor: { include: { usuario: true } },
        Professor: { include: { usuario: true } }, // se existir relação professor dono
        clube: true,
        escolinha: true,
        professores: { // join de colaboradores
          include: { professor: { include: { usuario: true } } },
        },
        exercicios: { include: { exercicio: true } },
      },

    });

    return res.json(treinos);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar treinos.", details: error.message });
  }
};