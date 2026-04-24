// server/controllers/treinosProgramadosController
import { Request, Response } from "express";
import { Categoria, Nivel, TipoTreino } from "@prisma/client";
import { onExercicioIncluidoNoTreino } from "../services/statsService.js";
import { enforceTotalLimit } from '../services/usage.js';
import { audit } from "../services/audit.js";
import { prisma } from "../prisma.js";

type Dono = "Professor" | "Clube" | "Escolinha" | "Admin";

function ownerWhereFrom(tipoUsuario?: string, tipoUsuarioId?: string) {
  const dono = normalizarTipoUsuario(tipoUsuario);
  const id = String(tipoUsuarioId ?? "").trim();
  if (!dono || !id) return null;

  if (dono === "Professor") return { professorId: id };
  if (dono === "Clube") return { clubeId: id };
  if (dono === "Escolinha") return { escolinhaId: id };
  return { criadorUsuarioId: id };
}

function assertOwnerIdsFromBodyOrReq(body: any) {
  const dono = normalizarTipoUsuario(body?.tipoUsuario);
  const donoId = String(body?.tipoUsuarioId ?? "").trim();
  const professorId = String(body?.professorId ?? "").trim();

  if (dono && donoId) {
    if (dono === "Professor") {
      return { dono, professorId: donoId, clubeId: null, escolinhaId: null, criadorUsuarioId: null };
    }

    if (dono === "Clube") {
      return { dono, professorId: null, clubeId: donoId, escolinhaId: null, criadorUsuarioId: null };
    }

    if (dono === "Escolinha") {
      return { dono, professorId: null, clubeId: null, escolinhaId: donoId, criadorUsuarioId: null };
    }

    return { dono, professorId: null, clubeId: null, escolinhaId: null, criadorUsuarioId: donoId };
  }

  if (professorId) {
    return { dono: "Professor" as const, professorId, clubeId: null, escolinhaId: null };
  }

  return null;
}

async function mustBeOwner(req: Request, treinoId: string) {
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
  if (s === "admin" || s === "administrador" || s === "adm") return "Admin";
  return null;
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

function normalizarNomeExercicio(nome: string) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normTipoTreino(v?: string): TipoTreino | null {
  const s0 = String(v || "").trim().toLowerCase();
  const s = stripAccents(s0);

  if (s.startsWith("tec")) return "Tecnico";
  if (s.startsWith("fis")) return "Fisico";
  if (s.startsWith("tat")) return "Tatico";
  return null;
}

const SESSOES_PADRAO_TREINO = [
  "Aquecimento",
  "Coletivo",
  "Treino de finalização",
];

function normalizarSessaoTreinoNome(nome: string) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function resolverSessaoTreinoId(sessaoTreino?: any, sessaoTreinoId?: any) {
  const id = String(sessaoTreinoId ?? "").trim();
  if (id) {
    const existe = await prisma.treinoSessao.findUnique({
      where: { id },
      select: { id: true },
    });
    return existe?.id ?? null;
  }

  const nome = String(sessaoTreino ?? "").trim();
  if (!nome) return null;

  return (
    await prisma.treinoSessao.upsert({
      where: { nomeNormalizado: normalizarSessaoTreinoNome(nome) },
      update: { nome },
      create: {
        nome,
        nomeNormalizado: normalizarSessaoTreinoNome(nome),
      },
      select: { id: true },
    })
  ).id;
}

function normCategoria(v?: string): Categoria {
  const s = String(v || "").replace(/-/g, "").toUpperCase();
  const ok = ["Sub-3","Sub-5","Sub-7","Sub-9","Sub-11","Sub-13","Sub-15","Sub-16","Livre"];
  return (ok.includes(s) ? s : "Sub-13") as Categoria;
}

export const createTreinoProgramado = async (req: Request, res: Response) => {
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
      sessaoTreino,
      sessaoTreinoId,
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
      sessaoTreino?: string;
      sessaoTreinoId?: string;
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
    if (
      exercicios.some((e: any) => {
        const exercicioId = String(e?.exercicioId ?? "").trim();
        const exercicioPersonalizadoId = String(e?.exercicioPersonalizadoId ?? "").trim();
        const exercicioTemporarioId = String(e?.exercicioTemporarioId ?? "").trim();
        const idGenerico = String(e?.id ?? "").trim();
        const nome = String(e?.nome ?? "").trim();

        return (
          !exercicioId &&
          !exercicioPersonalizadoId &&
          !exercicioTemporarioId &&
          !idGenerico &&
          !nome
        );
      })
    ) {
      return res.status(400).json({
        message:
          "Cada exercício precisa ter 'exercicioId' (catálogo), 'exercicioPersonalizadoId', 'exercicioTemporarioId' ou 'nome' (personalizado novo).",
      });
    }

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
      where: {
        nome,
        OR: [
          owner.professorId ? { professorId: owner.professorId } : undefined,
          owner.clubeId ? { clubeId: owner.clubeId } : undefined,
          owner.escolinhaId ? { escolinhaId: owner.escolinhaId } : undefined,
          owner.criadorUsuarioId ? { criadorUsuarioId: owner.criadorUsuarioId } : undefined,
        ].filter(Boolean) as any,
      },
      select: { id: true, nome: true },
    });

    if (duplicado) {
      return res.status(400).json({
        message: "Treino com o mesmo nome já existe para este dono.",
        duplicado,
      });
    }

    const viewerUserId = String((req as any).user?.id || "").trim();
    if (!viewerUserId) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    const itens = await Promise.all(
      (exercicios as any[]).map(async (e: any, i: number) => {
        const ordem = Number(e?.ordem ?? i + 1);
        const seriesRaw = e?.series ?? e?.serie ?? null;
        const series =
          seriesRaw === null || seriesRaw === undefined || String(seriesRaw).trim() === ""
            ? null
            : Number.isFinite(Number(seriesRaw))
            ? Number(seriesRaw)
            : null;

        const repeticoes =
          e?.repeticoes === null || e?.repeticoes === undefined
            ? ""
            : String(e.repeticoes).trim();

        const duracao =
          e?.duracao === null || e?.duracao === undefined
            ? null
            : String(e.duracao).trim() || null;

        const descanso =
          e?.descanso === null || e?.descanso === undefined
            ? null
            : String(e.descanso).trim() || null;
        // ✅ IDs vindos do front (prioridade)
        const exercicioPersonalizadoId = String(e?.exercicioPersonalizadoId ?? "").trim();
        const exercicioTemporarioId = String(e?.exercicioTemporarioId ?? "").trim();
        const exercicioIdCatalogo = String(e?.exercicioId ?? "").trim();
        // ✅ fallback que muita tela manda como "id"
        const idGenerico = String(e?.id ?? "").trim();
        const tipo = String(e?.tipo ?? e?.exercicio?.tipo ?? "").toLowerCase(); // "catalogo" | "temporario" | "personalizado"
        const descricaoExercicio = e?.descricao != null && String(e.descricao).trim() ? String(e.descricao).trim() : null;

        // 1) Se veio explícito, usa explícito
        if (exercicioPersonalizadoId) {
          if (descricaoExercicio) {
            await prisma.exercicioPersonalizado.update({
              where: { id: exercicioPersonalizadoId },
              data: { descricao: descricaoExercicio },
            });
          }
          return { exercicioPersonalizadoId, ordem, repeticoes, series, duracao, descanso, descricaoExecucao: descricaoExercicio };
        }
        if (exercicioTemporarioId) {
          if (descricaoExercicio) {
            await prisma.exercicioTemporario.update({
              where: { id: exercicioTemporarioId },
              data: { descricao: descricaoExercicio },
            });
          }
          return { exercicioTemporarioId, ordem, repeticoes, series, duracao, descanso, descricaoExecucao: descricaoExercicio };
        }
        if (exercicioIdCatalogo) {
          return {
            exercicioId: exercicioIdCatalogo,
            ordem,
            repeticoes,
            series,
            duracao,
            descanso,
            descricaoExecucao: descricaoExercicio,
          };
        }

        if (idGenerico) {
          if (tipo === "personalizado") {
            if (descricaoExercicio) {
              await prisma.exercicioPersonalizado.update({
                where: { id: idGenerico },
                data: { descricao: descricaoExercicio },
              });
            }
            return { exercicioPersonalizadoId: idGenerico, ordem, repeticoes, series, duracao, descanso, descricaoExecucao: descricaoExercicio };
          }
          if (tipo === "temporario") {
            if (descricaoExercicio) {
              await prisma.exercicioTemporario.update({
                where: { id: idGenerico },
                data: { descricao: descricaoExercicio },
              });
            }
            return { exercicioTemporarioId: idGenerico, ordem, repeticoes, series, duracao, descanso, descricaoExecucao: descricaoExercicio };
          }
          return { exercicioId: idGenerico, ordem, repeticoes, series, duracao, descanso, descricaoExecucao: descricaoExercicio };
        }

        const nomeOriginal = String(e?.nome ?? "").trim();
        const nomeNormalizado = normalizarNomeExercicio(nomeOriginal);
          
        if (!nomeNormalizado) {
          throw new Error("Nome do exercício personalizado não informado.");
        }
        const descricao = e?.descricao != null ? String(e.descricao) : null;
        // opcional
        const videoDemonstrativoUrl =
          e?.videoDemonstrativoUrl != null ? String(e.videoDemonstrativoUrl) : null;
        const videoPosterUrl = e?.videoPosterUrl != null ? String(e.videoPosterUrl) : null;
        // se vier nivel/categorias no treino, dá pra salvar junto
        const nivelDoExercicio = e?.nivel ? normNivel(e.nivel) : null;
        const categoriasDoExercicio: Categoria[] = Array.isArray(e?.categorias)
          ? (e.categorias.map(normCategoria) as Categoria[])
          : [];

        const existenteExercicio = await prisma.exercicio.findFirst({
          where: { nomeNormalizado },
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        });

        if (existenteExercicio?.id) {
          return {
            exercicioId: existenteExercicio.id,
            ordem,
            repeticoes,
            series,
            duracao,
            descanso,
          };
        }

        const existente = await prisma.exercicioPersonalizado.findFirst({
          where: { nomeNormalizado },
          select: {
            id: true,
            nome: true,
            nivel: true,
            categorias: true,
            criadorUsuarioId: true,
          },
        });

        if (existente?.id && (videoDemonstrativoUrl || videoPosterUrl)) {
          await prisma.exercicioPersonalizado.update({
            where: { id: existente.id },
            data: {
              ...(videoDemonstrativoUrl ? { videoDemonstrativoUrl } : {}),
              ...(videoPosterUrl ? { videoPosterUrl } : {}),
            },
          });
        }

        let personalizadoId = existente?.id ?? null;

        if (!personalizadoId) {
          try {
            personalizadoId = (
              await prisma.exercicioPersonalizado.create({
                data: {
                  nome: nomeOriginal,
                  nomeNormalizado,
                  descricao,
                  nivel: nivelDoExercicio,
                  categorias: categoriasDoExercicio,
                  videoDemonstrativoUrl,
                  videoPosterUrl,
                  criadorUsuarioId: viewerUserId,
                },
                select: { id: true },
              })
            ).id;
          } catch (err: any) {
            const again = await prisma.exercicioPersonalizado.findFirst({
              where: { nomeNormalizado },
              select: { id: true },
            });

            if (!again?.id) throw err;
            personalizadoId = again.id;
          }
        }

        return {
          exercicioPersonalizadoId: personalizadoId,
          ordem,
          repeticoes,
          series,
          descanso,
          duracao,
        };
      })
    );

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

    const colabs =
      Array.isArray((req.body as any).professoresColabIds)
        ? (req.body as any).professoresColabIds
        : Array.isArray((req.body as any).colaboradoresProfessorIds)
        ? (req.body as any).colaboradoresProfessorIds
        : [];

    const donoProfessorId = owner.dono === "Professor" ? owner.professorId : null;
    const allProfIds = Array.from(
      new Set([...(donoProfessorId ? [donoProfessorId] : []), ...colabs])
    )
      .map((x) => String(x).trim())
      .filter(Boolean);

    const colabProfIds = allProfIds.filter((pid) => pid !== owner.professorId);
    const uploadedPath =
      req.file?.filename ? `/upload/${req.file.filename}` : null;

    const imagemFinal = uploadedPath ?? (imagemUrl ? String(imagemUrl) : null);
    const sessaoTreinoIdFinal = await resolverSessaoTreinoId(
      sessaoTreino,
      sessaoTreinoId
    );

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
            sessaoTreinoId: sessaoTreinoIdFinal,
            ...(owner.professorId ? { professorId: owner.professorId } : {}),
            ...(owner.clubeId ? { clubeId: owner.clubeId } : {}),
            ...(owner.escolinhaId ? { escolinhaId: owner.escolinhaId } : {}),
            ...(owner.criadorUsuarioId ? { criadorUsuarioId: owner.criadorUsuarioId } : {}),
            ...(criadorProfessorIdNorm
              ? { criadorProfessorId: criadorProfessorIdNorm }
              : owner.dono === "Professor"
              ? { criadorProfessorId: owner.professorId! }
              : {}),
            professores: {
              create: colabProfIds.map((professorId: string) => ({ professorId })),
            },
            exercicios: { create: itens },
          },
          include: {
            criadorProfessor: { include: { usuario: true } },
            criadorUsuario: true,
            clube: true,
            escolinha: true,
            sessaoTreino: true,
            exercicios: {
              include: {
                exercicio: true,
                exercicioPersonalizado: true,
                exercicioTemporario: true,
              },
            },
          },
        });

        // ✅ AUDIT
        await audit(req, {
          acao: "PRESCREVER_TREINO",
          entidade: "TreinoProgramado",
          entidadeId: treinoCriado.id,
          descricao: `Treino criado (${treinoCriado.nome})`,
          meta: { nome, tipoTreino: tipoTreinoNorm, categorias: categoriasNorm },
        });

        // ✅ STATS (só se fizer sentido pro professor)
        const professorIdForStats =
          normalizarTipoUsuario(tipoUsuario) === "Professor" ? String(tipoUsuarioId) : undefined;

        const exerciciosOficiaisIds = (itens || [])
          .map((i: any) => i?.exercicioId)
          .filter((id: any): id is string => typeof id === "string" && id.trim().length > 0);

        await Promise.all(
          exerciciosOficiaisIds.map((exercicioId) =>
            onExercicioIncluidoNoTreino({
              treinoId: treinoCriado.id,
              exercicioId,
              professorId: professorIdForStats,
            })
          )
        );

        // ✅ AGENDAR ATLETAS (continua dentro do mesmo try)
        try {
          const elencosParaBuscar = [
            ...new Set([
              ...(Array.isArray(elencosIds) ? elencosIds : []),
              ...(elencoId ? [elencoId] : []),
            ]),
          ];

          let atletasDeElencos: string[] = [];
          if (elencosParaBuscar.length) {
            const rels = await prisma.atletaElenco.findMany({
              where: { elencoId: { in: elencosParaBuscar } },
              select: { atletaId: true },
            });
            atletasDeElencos = rels.map((r) => r.atletaId);
          }

          const alvoAtletas = Array.from(
            new Set([...(Array.isArray(atletasIds) ? atletasIds : []), ...atletasDeElencos])
          ).filter(Boolean);

          if (alvoAtletas.length) {
            const quando = req.body.dataAgendada
              ? new Date(req.body.dataAgendada)
              : new Date(Date.now() + 24 * 60 * 60 * 1000);

            await prisma.treinoAgendado.createMany({
              data: alvoAtletas.map((aid) => ({
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
        criadorUsuario: true,
        clube: true,
        escolinha: true,
        sessaoTreino: true,
        exercicios: {
          include: {
            exercicio: true,
            exercicioPersonalizado: true,
            exercicioTemporario: true,
          },
        },
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
      sessaoTreino,
      sessaoTreinoId
    } = req.body;

    if (!Array.isArray(exercicios) || exercicios.length === 0) {
      return res.status(400).json({ message: "Informe ao menos um exercício no treino." });
    }

    if (
      exercicios.some((e: any) => {
        const exercicioId = String(e?.exercicioId ?? "").trim();
        const exercicioPersonalizadoId = String(e?.exercicioPersonalizadoId ?? "").trim();
        const exercicioTemporarioId = String(e?.exercicioTemporarioId ?? "").trim();
        const idGenerico = String(e?.id ?? "").trim();
        const nome = String(e?.nome ?? "").trim();

        return (
          !exercicioId &&
          !exercicioPersonalizadoId &&
          !exercicioTemporarioId &&
          !idGenerico &&
          !nome
        );
      })
    ) {
      return res.status(400).json({
        message:
          "Cada exercício precisa ter 'exercicioId' (catálogo), 'exercicioPersonalizadoId', 'exercicioTemporarioId', 'id' ou 'nome' (personalizado novo).",
      });
    }

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
      dataDono.criadorUsuario = { disconnect: true };

      if (dono === "Professor") dataDono.Professor = { connect: { id: tipoUsuarioId } };
      if (dono === "Clube") dataDono.clube = { connect: { id: tipoUsuarioId } };
      if (dono === "Escolinha") dataDono.escolinha = { connect: { id: tipoUsuarioId } };
      if (dono === "Admin") dataDono.criadorUsuario = { connect: { id: tipoUsuarioId } };

    }

    const viewerUserId = String((req as any).user?.id || "").trim();
    if (!viewerUserId) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    const itens = await Promise.all(
      (exercicios as any[]).map(async (e: any, i: number) => {
        const ordem = Number(e?.ordem ?? i + 1);
        const seriesRaw = e?.series ?? e?.serie ?? null;
        const series =
          seriesRaw === null || seriesRaw === undefined || String(seriesRaw).trim() === ""
            ? null
            : Number.isFinite(Number(seriesRaw))
            ? Number(seriesRaw)
            : null;

        const repeticoes =
          e?.repeticoes === null || e?.repeticoes === undefined
            ? ""
            : String(e.repeticoes).trim();

        const duracao =
          e?.duracao === null || e?.duracao === undefined
            ? null
            : String(e.duracao).trim() || null;

        const descanso =
          e?.descanso === null || e?.descanso === undefined
            ? null
            : String(e.descanso).trim() || null;
        // ✅ IDs vindos do front (prioridade)
        const exercicioPersonalizadoId = String(e?.exercicioPersonalizadoId ?? "").trim();
        const exercicioTemporarioId = String(e?.exercicioTemporarioId ?? "").trim();
        const exercicioIdCatalogo = String(e?.exercicioId ?? "").trim();

        // ✅ fallback que muita tela manda como "id"
        const idGenerico = String(e?.id ?? "").trim();
        const tipo = String(e?.tipo ?? e?.exercicio?.tipo ?? "").toLowerCase(); // "catalogo" | "temporario" | "personalizado"

        const descricaoExercicio = e?.descricao != null && String(e.descricao).trim() ? String(e.descricao).trim() : null;

        if (exercicioPersonalizadoId) {
          if (descricaoExercicio) {
            await prisma.exercicioPersonalizado.update({
              where: { id: exercicioPersonalizadoId },
              data: { descricao: descricaoExercicio },
            });
          }
          return { exercicioPersonalizadoId, ordem, repeticoes, series, duracao, descanso, descricaoExecucao: descricaoExercicio };
        }
        if (exercicioTemporarioId) {
          if (descricaoExercicio) {
            await prisma.exercicioTemporario.update({
              where: { id: exercicioTemporarioId },
              data: { descricao: descricaoExercicio },
            });
          }
          return { exercicioTemporarioId, ordem, repeticoes, series, duracao, descanso, descricaoExecucao: descricaoExercicio };
        }
        if (exercicioIdCatalogo) {
          return { exercicioId: exercicioIdCatalogo, ordem, repeticoes, series, duracao, descanso, descricaoExecucao: descricaoExercicio };
        }

        if (idGenerico) {
          if (tipo === "personalizado") {
            if (descricaoExercicio) {
              await prisma.exercicioPersonalizado.update({
                where: { id: idGenerico },
                data: { descricao: descricaoExercicio },
              });
            }
            return { exercicioPersonalizadoId: idGenerico, ordem, repeticoes, series, duracao, descanso, descricaoExecucao: descricaoExercicio };
          }
          if (tipo === "temporario") {
            if (descricaoExercicio) {
              await prisma.exercicioTemporario.update({
                where: { id: idGenerico },
                data: { descricao: descricaoExercicio },
              });
            }
            return { exercicioTemporarioId: idGenerico, ordem, repeticoes, series, duracao, descanso, descricaoExecucao: descricaoExercicio };
          }
          return { exercicioId: idGenerico, ordem, repeticoes, series, duracao, descanso, descricaoExecucao: descricaoExercicio };
        }

        const nomeOriginal = String(e?.nome ?? "").trim();
        const nomeNormalizado = normalizarNomeExercicio(nomeOriginal);

        if (!nomeNormalizado) {
          throw new Error("Nome do exercício personalizado não informado.");
        }

        const descricao = e?.descricao != null ? String(e.descricao) : null;
        const videoDemonstrativoUrl =
          e?.videoDemonstrativoUrl != null ? String(e.videoDemonstrativoUrl) : null;
        const videoPosterUrl =
          e?.videoPosterUrl != null ? String(e.videoPosterUrl) : null;

        const nivelDoExercicio = e?.nivel ? normNivel(e.nivel) : null;
        const categoriasDoExercicio: Categoria[] = Array.isArray(e?.categorias)
          ? (e.categorias.map(normCategoria) as Categoria[])
          : [];

        const existenteExercicio = await prisma.exercicio.findFirst({
          where: { nomeNormalizado },
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        });

        if (existenteExercicio?.id) {
          return {
            exercicioId: existenteExercicio.id,
            ordem,
            repeticoes,
            series,
            duracao,
            descanso,
          };
        }

        const existente = await prisma.exercicioPersonalizado.findFirst({
          where: { nomeNormalizado },
          select: {
            id: true,
            nome: true,
            nivel: true,
            categorias: true,
            criadorUsuarioId: true,
          },
        });

        if (existente?.id && (videoDemonstrativoUrl || videoPosterUrl)) {
          await prisma.exercicioPersonalizado.update({
            where: { id: existente.id },
            data: {
              ...(videoDemonstrativoUrl ? { videoDemonstrativoUrl } : {}),
              ...(videoPosterUrl ? { videoPosterUrl } : {}),
            },
          });
        }

        let personalizadoId = existente?.id ?? null;

        if (!personalizadoId) {
          try {
            personalizadoId = (
              await prisma.exercicioPersonalizado.create({
                data: {
                  nome: nomeOriginal,
                  nomeNormalizado,
                  descricao,
                  nivel: nivelDoExercicio,
                  categorias: categoriasDoExercicio,
                  videoDemonstrativoUrl,
                  videoPosterUrl,
                  criadorUsuarioId: viewerUserId,
                },
                select: { id: true },
              })
            ).id;
          } catch (err: any) {
            const again = await prisma.exercicioPersonalizado.findFirst({
              where: {
                nome: {
                  equals: nomeNormalizado,
                  mode: "insensitive",
                },
              },
              select: { id: true },
            });

            if (!again?.id) throw err;
            personalizadoId = again.id;
          }
        }

        return {
          exercicioPersonalizadoId: personalizadoId,
          ordem,
          repeticoes,
          series,
          duracao,
          descanso,
        };
      })
    );

    const antigos = await prisma.treinoProgramadoExercicio.findMany({
      where: { treinoProgramadoId: id },
      select: { exercicioId: true },
    });
    const antigosSet = new Set(
      antigos.map(a => a.exercicioId).filter(Boolean) as string[]
    );

    const uploadedPath =
      req.file?.filename ? `/upload/${req.file.filename}` : null;

    const imagemPatch =
      uploadedPath ? { imagemUrl: uploadedPath }
      : (imagemUrl !== undefined ? { imagemUrl: imagemUrl ? String(imagemUrl) : null } : {});

    const sessaoTreinoIdFinal =
      sessaoTreino !== undefined || sessaoTreinoId !== undefined
        ? await resolverSessaoTreinoId(sessaoTreino, sessaoTreinoId)
        : undefined;

    await prisma.$transaction([
      prisma.treinoProgramadoExercicio.deleteMany({ where: { treinoProgramadoId: id } }),
      prisma.treinoProgramado.update({
        where: { id },
        data: {
          ...(nome !== undefined ? { nome } : {}),
          ...(descricao !== undefined ? { descricao } : {}),
          ...(nivel !== undefined ? { nivel: normNivel(nivel) } : {}),
          ...(categoria !== undefined
            ? {
                categoria: {
                  set: Array.isArray(categoria)
                    ? (categoria.map(normCategoria) as Categoria[])
                    : [],
                },
              }
            : {}),
          ...(tipoTreino !== undefined ? { tipoTreino: normTipoTreino(tipoTreino) } : {}),
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
          ...(sessaoTreinoIdFinal !== undefined
            ? {
                sessaoTreino: sessaoTreinoIdFinal
                  ? { connect: { id: sessaoTreinoIdFinal } }
                  : { disconnect: true },
              }
            : {}),
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
        sessaoTreino: true,
        professores: { include: { professor: { include: { usuario: true } } } },
        exercicios: {
          include: {
            exercicio: true,
            exercicioPersonalizado: true,
            exercicioTemporario: true,
          },
        },
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
  const viewerTipo = String((req as any).user?.tipo || "").toLowerCase();
  const viewerId = String((req as any).user?.tipoUsuarioId || "").trim();
  const scope = String((req.query as any).scope || "");

  try {
    const {
      professorId,
      ownerTipo,
      apenasCriador,
      incluirColabs,
      order = "desc",
      limit,
      tipoUsuario,
      tipoUsuarioId,
      onlyMine,
      sessaoTreinoId,
    } = req.query as Record<string, string | undefined>;

    const where: any = {};

    // 1) filtro explícito: quero os treinos "do professor X"
    if (professorId) {
      const pid = String(professorId);
      const incluirColabsBool = String(incluirColabs ?? "") === "1";

      if (incluirColabsBool) {
        // ✅ dono OU colaborador
        where.OR = [
          { professorId: pid },
          { professores: { some: { professorId: pid } } },
        ];
      } else {
        // ✅ só dono (comportamento atual)
        where.professorId = pid;
      }

      // se você quer forçar "somente treinos do professor (não do clube/escolinha)",
      // mantenha essa regra SÓ quando for modo apenasCriador:
      const dono = normalizarTipoUsuario(ownerTipo);
      if (!incluirColabsBool && (dono === "Professor" || apenasCriador === "1")) {
        where.clubeId = null;
        where.escolinhaId = null;
      }
    }

    // 2) compatibilidade com o seu modo "onlyMine" (caso você use em outras telas)
    const onlyMineBool = String(onlyMine ?? "").toLowerCase() === "true";
    const ownerWhere = ownerWhereFrom(tipoUsuario, tipoUsuarioId);
    if (onlyMineBool && ownerWhere) {
      Object.assign(where, ownerWhere);
    }

    const take =
      limit && !Number.isNaN(Number(limit))
        ? Math.min(200, Math.max(1, Number(limit)))
        : undefined;

    const sort = String(order).toLowerCase() === "asc" ? "asc" : "desc";

    if (scope === "picker" && viewerTipo && viewerId) {
      const isProfessor = viewerTipo === "professor";
      const isClube = viewerTipo === "clube";
      const isEscolinha = viewerTipo === "escolinha" || viewerTipo === "escola";

      const wherePicker: any = {
        OR: [
          ...(isProfessor ? [{ professorId: viewerId }] : []),
          ...(isClube ? [{ clubeId: viewerId }] : []),
          ...(isEscolinha ? [{ escolinhaId: viewerId }] : []),
          ...(isProfessor ? [{ professores: { some: { professorId: viewerId } } }] : []),

          // públicos de parceiro (seu requisito)
          { parceiro: true, professorId: { not: null } },
        ],
      };

      const treinos = await prisma.treinoProgramado.findMany({
        where: wherePicker,
        orderBy: { createdAt: sort },
        take,
        include: {
          criadorProfessor: { include: { usuario: true } },
          Professor: { include: { usuario: true } },
          clube: true,
          escolinha: true,
          sessaoTreino: true,
          professores: { include: { professor: { include: { usuario: true } } } },
          exercicios: {
            include: {
              exercicio: true,
              exercicioPersonalizado: true,
              exercicioTemporario: true,
            },
          },
        },
      });

      const mapped = treinos.map((t) => {

      const isOwner =
        (viewerTipo === "professor" && t.professorId === viewerId) ||
        (viewerTipo === "clube" && t.clubeId === viewerId) ||
        ((viewerTipo === "escolinha" || viewerTipo === "escola") && t.escolinhaId === viewerId);

      const isColab =
        viewerTipo === "professor" &&
        (t.professores?.some((p: any) => p.professorId === viewerId) ?? false);

      const isParceiroPublico = Boolean((t as any).parceiro) === true && !!t.professorId;

      return {
        ...t,
        origem: isOwner ? "CRIADOR" : isColab ? "COLABORADOR" : isParceiroPublico ? "PARCEIRO_PUBLICO" : "OUTRO",
      };
    });

    return res.json(mapped);
    }

    const treinos = await prisma.treinoProgramado.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: sort },
      take,
      include: {
        criadorProfessor: { include: { usuario: true } },
        Professor: { include: { usuario: true } },
        clube: true,
        escolinha: true,
        sessaoTreino: true,
        professores: {
          include: { professor: { include: { usuario: true } } },
        },
        exercicios: {
          include: {
            exercicio: true,
            exercicioPersonalizado: true,
            exercicioTemporario: true,
          },
        },
      },
    });

    return res.json(treinos);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar treinos.", details: error.message });
  }
};