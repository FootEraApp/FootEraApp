import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { probeVideo } from "../services/mediaMetadata.js";
import { deleteFromS3 } from "../middlewares/s3Upload.js"; 

function getAuthUserId(req: Request): string | null {
  return (req as any)?.user?.id || null;
}

function isAdminRequest(req: Request): boolean {
  const anyReq = req as any;

  if (
    anyReq?.isAdmin === true ||
    anyReq?.user?.isAdmin === true
  ) {
    return true;
  }

  const tipo = String(
    anyReq?.tipo ??
      anyReq?.user?.tipo ??
      anyReq?.user?.role ??
      anyReq?.user?.tipoUsuario ??
      ""
  )
    .trim()
    .toLowerCase();

  return (
    tipo === "admin" ||
    tipo === "administrador" ||
    tipo === "adm"
  );
}

function parseArrayField(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(String).map((v) => v.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((v) => v.trim()).filter(Boolean);
      }
    } catch {}

    return trimmed
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  return [];
}

function parseNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str ? str : null;
}

function parseNullableInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

const FAIXAS_ETARIAS_VALIDAS = [
  "Sub3",
  "Sub5",
  "Sub7",
  "Sub9",
  "Sub11",
  "Sub13",
  "Sub15",
  "Sub16",
  "Livre",
];

function normalizarFaixasEtarias(value: unknown): string[] {
  return parseArrayField(value)
    .map((f) => f.replace("-", ""))
    .filter(Boolean);
}

async function removePublicFileIfExists(fileUrl?: string | null) {
  if (!fileUrl) return;
  if (fileUrl.includes("amazonaws.com")) {
    await deleteFromS3(fileUrl);
  }
}

async function mapUsoEmTreinos(exercicioIds: string[]) {
  const map: Record<string, number> = {};
  if (!exercicioIds.length) return map;

  const candidateModels = [
    "treinoProgramadoExercicio",
    "treinoExercicio",
    "treinoProgramadoExercicios",
    "treinosProgramadosExercicios",
    "treino_programado_exercicio",
  ];

  const candidateTreinoKeys = ["treinoProgramadoId", "treinoId"];

  for (const modelName of candidateModels) {
    const model = (prisma as any)[modelName];
    if (!model?.groupBy) continue;

    for (const treinoKey of candidateTreinoKeys) {
      try {
        const rows = await model.groupBy({
          by: ["exercicioId", treinoKey],
          where: { exercicioId: { in: exercicioIds } },
        });

        for (const r of rows) {
          const exId = r.exercicioId as string;
          map[exId] = (map[exId] || 0) + 1;
        }
        break;
      } catch {
      }
    }
  }

  return map;
}

async function mapUsoPersonalizadosEmTreinos(
  exercicioIds: string[]
): Promise<Record<string, number>> {
  const resultado: Record<string, number> = {};

  if (!exercicioIds.length) {
    return resultado;
  }

  const rows = await prisma.treinoProgramadoExercicio.findMany({
    where: {
      exercicioPersonalizadoId: {
        in: exercicioIds,
      },
    },
    select: {
      exercicioPersonalizadoId: true,
      treinoProgramadoId: true,
    },
  });

  const porExercicio = new Map<string, Set<string>>();

  for (const row of rows) {
    const exercicioId = row.exercicioPersonalizadoId;

    if (!exercicioId) continue;

    if (!porExercicio.has(exercicioId)) {
      porExercicio.set(exercicioId, new Set<string>());
    }

    porExercicio
      .get(exercicioId)!
      .add(String(row.treinoProgramadoId));
  }

  for (const [exercicioId, treinos] of porExercicio.entries()) {
    resultado[exercicioId] = treinos.size;
  }

  return resultado;
}

function toCardResponse(exercicio: any, usadoEmTreinos = 0) {
  return {
    ...exercicio,
    objetivo: exercicio.objetivo ?? null,
    videoDemonstrativoUrl: exercicio.videoDemonstrativoUrl ?? null,
    series: exercicio.series ?? null,
    repeticoes: exercicio.repeticoes ?? null,
    duracao: exercicio.duracao ?? null,
    descanso: exercicio.descanso ?? null,
    tags: Array.isArray(exercicio.tags) ? exercicio.tags : [],
    faixaEtaria: Array.isArray(exercicio.faixaEtaria) ? exercicio.faixaEtaria : [],
    usadoEmTreinos,
  };
}

function normalizarNomeExercicio(nome: string) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function mapPersonalizadoToCardResponse(exercicio: any, usadoEmTreinos = 0) {
  return {
    id: exercicio.id,
    codigo: exercicio.codigo ?? null,
    nome: exercicio.nome,
    objetivo: exercicio.descricao ?? null,
    descricao: exercicio.descricao ?? null,
    nivel: exercicio.nivel ?? null,
    tipo: exercicio.tipo ?? null,
    faixaEtaria: Array.isArray(exercicio.categorias) ? exercicio.categorias : [],
    categorias: Array.isArray(exercicio.categorias) ? exercicio.categorias : [],
    modoExecucao: exercicio.modoExecucao ?? null,
    series: exercicio.series ?? null,
    repeticoes: exercicio.repeticoes ?? null,
    duracao: exercicio.duracao ?? null,
    descanso: exercicio.descanso ?? null,
    tags: Array.isArray(exercicio.tags) ? exercicio.tags : [],
    quantidadeAtletas: exercicio.quantidadeAtletas ?? null,
    materiaisNecessarios: exercicio.materiaisNecessarios ?? null,
    espacoNecessario: exercicio.espacoNecessario ?? null,
    videoDemonstrativoUrl: exercicio.videoDemonstrativoUrl ?? null,
    videoPosterUrl: exercicio.videoPosterUrl ?? null,
    favorito: Boolean(exercicio.favorito),
    criadoPorId: exercicio.criadorUsuarioId ?? null,
    usadoEmTreinos,
    origem: "personalizado",
    createdAt: exercicio.criadoEm ?? null,
    updatedAt: exercicio.atualizadoEm ?? null,
  };
}

async function gerarCodigoUnicoParaExercicio(nomeBase: string) {
  const base = String(nomeBase || "EXERCICIO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toUpperCase()
    .slice(0, 30) || "EXERCICIO";

  let codigo = `${base}-${Date.now().toString().slice(-6)}`;
  let contador = 2;

  while (await prisma.exercicio.findFirst({ where: { codigo } })) {
    codigo = `${base}-${Date.now().toString().slice(-6)}-${contador}`;
    contador += 1;
  }

  return codigo;
}

async function gerarNomeUnicoParaExercicio(nomeBase: string) {
  const base = String(nomeBase || "Exercício").trim() || "Exercício";
  let nome = base;
  let contador = 2;

  while (await prisma.exercicio.findFirst({ where: { nome } })) {
    nome = `${base} (${contador})`;
    contador += 1;
  }

  return nome;
}

async function migrarPersonalizadoParaExercicio(personalizado: any, userId: string) {
  const nomeNormalizado = normalizarNomeExercicio(personalizado.nome);

  const exercicioExistente = await prisma.exercicio.findFirst({
    where: { nomeNormalizado },
    select: { id: true },
  });

  if (exercicioExistente) {
    await prisma.exercicioPersonalizado.delete({
      where: { id: personalizado.id },
    });

    return prisma.exercicio.findUnique({
      where: { id: exercicioExistente.id },
    });
  }
  const codigoUnico = await gerarCodigoUnicoParaExercicio(personalizado.nome);

  const exercicioCriado = await prisma.exercicio.create({
    data: {
      id: personalizado.id,
      codigo: codigoUnico,
      nome: String(personalizado.nome).trim(),
      nomeNormalizado,
      objetivo: personalizado.descricao ?? null,
      nivel: (personalizado.nivel ?? "Base") as any,
      videoDemonstrativoUrl: personalizado.videoDemonstrativoUrl ?? null,
      criadoPorId: userId,
      favorito: false,
      tipo: null,
      faixaEtaria: {
        set: Array.isArray(personalizado.categorias) ? personalizado.categorias : [],
      },
      modoExecucao: null,
      series: null,
      repeticoes: null,
      duracao: null,
      descanso: null,
      tags: [],
      quantidadeAtletas: null,
      materiaisNecessarios: null,
      espacoNecessario: null,
    } as any,
  });

  await prisma.exercicioPersonalizado.delete({
    where: { id: personalizado.id },
  });

  return exercicioCriado;
}

export const criarExercicio = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    const videoFile = req.file as any;
    const videoDemonstrativoUrl = videoFile ? videoFile.location : null;
    const {
      codigo,
      nome,
      objetivo,
      nivel,
      tipo,
      faixaEtaria,
      modoExecucao,
      series,
      repeticoes,
      duracao,
      descanso,
      materiaisNecessarios,
      quantidadeAtletas,
      espacoNecessario,
      tags,
    } = req.body;

    if (!nome || !String(nome).trim()) return res.status(400).json({ message: "Nome é obrigatório." });
    if (!codigo || !String(codigo).trim()) return res.status(400).json({ message: "Código é obrigatório." });

    const nomeNormalizado = normalizarNomeExercicio(String(nome));
    const codigoNormalizado = String(codigo).trim();

    if (modoExecucao && !["Tempo", "SeriesRepeticoes", "LivreOrientativo"].includes(String(modoExecucao))) {
      return res.status(400).json({ message: "Modo de execução inválido." });
    }

    const codigoExistente = await prisma.exercicio.findFirst({ where: { codigo: codigoNormalizado } });
    if (codigoExistente) return res.status(400).json({ message: "Já existe um exercício com esse código." });

    const exercicioMesmoNome = await prisma.exercicio.findFirst({ where: { nomeNormalizado }, select: { id: true } });
    if (exercicioMesmoNome) return res.status(400).json({ message: "Já existe um exercício com esse nome." });

    const meuPersonalizadoMesmoNome = await prisma.exercicioPersonalizado.findFirst({
      where: {
        nomeNormalizado,
        criadorUsuarioId: userId,
      },
      select: { id: true },
    });

    if (meuPersonalizadoMesmoNome) {
      return res.status(400).json({
        message: "Você já possui um exercício personalizado com esse nome.",
      });
    }
    if (tipo && !["Tecnico", "Fisico", "Tatico", "Mental"].includes(String(tipo))) {
      return res.status(400).json({ message: "Tipo inválido." });
    }

    const faixasEtarias = normalizarFaixasEtarias(req.body.faixaEtaria);
    const faixasValidas = FAIXAS_ETARIAS_VALIDAS;
    
    if (!tipo || !String(tipo).trim()) return res.status(400).json({ message: "Tipo é obrigatório." });
    if (!nivel || !String(nivel).trim()) return res.status(400).json({ message: "Nível é obrigatório." });
    if (!["Base", "Avancado", "Performance"].includes(String(nivel))) return res.status(400).json({ message: "Nível inválido." });

    if (faixasEtarias.length === 0) return res.status(400).json({ message: "Selecione pelo menos uma faixa etária." });
    if (faixasEtarias.some((faixa) => !faixasValidas.includes(faixa))) return res.status(400).json({ message: "Faixa etária inválida." });

    if (espacoNecessario && !["Pequeno", "Medio", "Grande"].includes(String(espacoNecessario))) {
      return res.status(400).json({ message: "Espaço necessário inválido." });
    }

    if (videoDemonstrativoUrl) {
      try {
        const metadata = await probeVideo(videoDemonstrativoUrl);

        if (metadata?.durationSec != null && metadata.durationSec > 60) {
          await deleteFromS3(videoDemonstrativoUrl); 
          return res.status(400).json({ message: "Esse vídeo é muito longo. O máximo permitido é 60 segundos." });
        }
      } catch (err) {
        await deleteFromS3(videoDemonstrativoUrl);
        return res.status(400).json({ message: "Não foi possível validar a duração do vídeo enviado." });
      }
    }

    const novoExercicio = await prisma.exercicio.create({
      data: {
        codigo: codigoNormalizado,
        nome: String(nome).trim(),
        nomeNormalizado,
        objetivo: parseNullableString(objetivo),
        nivel: parseNullableString(nivel) as any,
        videoDemonstrativoUrl,
        criadoPorId: userId,
        favorito: false,
        tipo: parseNullableString(tipo) as any,
        faixaEtaria: { set: faixasEtarias as any[] },
        modoExecucao: parseNullableString(modoExecucao) as any,
        series: parseNullableInt(series),
        repeticoes: parseNullableString(repeticoes),
        duracao: parseNullableString(duracao),
        descanso: parseNullableString(descanso),
        tags: parseArrayField(tags),
        quantidadeAtletas: parseNullableString(quantidadeAtletas),
        materiaisNecessarios: parseNullableString(materiaisNecessarios),
        espacoNecessario: parseNullableString(espacoNecessario) as any,
      } as any,
    });

    res.status(201).json(toCardResponse(novoExercicio, 0));
  } catch (error) {
    console.error("Erro ao criar exercício:", error);
    res.status(500).json({ message: "Erro ao criar exercício." });
  }
};

export const editarExercicio = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Usuário não autenticado." });

    let exercicioAtual = await prisma.exercicio.findUnique({ where: { id } });

    const personalizadoAtual = await prisma.exercicioPersonalizado.findUnique({
      where: { id },
    });

    if (personalizadoAtual) {
      if (
        !isAdminRequest(req) &&
        personalizadoAtual.criadorUsuarioId !== userId
      ) {
        return res.status(403).json({
          message: "Você não pode editar esse exercício.",
        });
      }

      const videoFile = req.file as any;
      const novaVideoUrl = videoFile ? videoFile.location : null;

      const {
        nome,
        objetivo,
        descricao,
        nivel,
        tipo,
        faixaEtaria,
        categorias,
        modoExecucao,
        series,
        repeticoes,
        duracao,
        descanso,
        materiaisNecessarios,
        quantidadeAtletas,
        espacoNecessario,
        tags,
        removerVideo,
      } = req.body;

      if (!nome || !String(nome).trim()) {
        return res.status(400).json({ message: "Nome é obrigatório." });
      }

      const nomeNormalizado = normalizarNomeExercicio(String(nome));

      const nomeDuplicado = await prisma.exercicioPersonalizado.findFirst({
        where: {
          nomeNormalizado,
          criadorUsuarioId: personalizadoAtual.criadorUsuarioId,
          NOT: { id },
        },
        select: { id: true },
      });

      if (nomeDuplicado) {
        return res.status(400).json({
          message: "Você já possui outro exercício personalizado com esse nome.",
        });
      }

      const faixasFinal = parseArrayField(categorias ?? faixaEtaria);
      const deveRemoverVideo = String(removerVideo) === "true";

      if ((novaVideoUrl || deveRemoverVideo) && personalizadoAtual.videoDemonstrativoUrl) {
        await removePublicFileIfExists(personalizadoAtual.videoDemonstrativoUrl);
      }

      const atualizado = await prisma.exercicioPersonalizado.update({
        where: { id },
        data: {
          nome: String(nome).trim(),
          nomeNormalizado,
          descricao: parseNullableString(descricao ?? objetivo),
          nivel: parseNullableString(nivel) as any,
          categorias: faixasFinal as any,
          ...(novaVideoUrl
            ? { videoDemonstrativoUrl: novaVideoUrl }
            : deveRemoverVideo
              ? { videoDemonstrativoUrl: null }
              : {}),
          tipo: parseNullableString(tipo) as any,
          modoExecucao: parseNullableString(modoExecucao) as any,
          series: parseNullableInt(series),
          repeticoes: parseNullableString(repeticoes),
          duracao: parseNullableString(duracao),
          descanso: parseNullableString(descanso),
          tags: parseArrayField(tags),
          quantidadeAtletas: parseNullableString(quantidadeAtletas),
          materiaisNecessarios: parseNullableString(materiaisNecessarios),
          espacoNecessario: parseNullableString(espacoNecessario) as any,
        } as any,
      });

      return res.json(mapPersonalizadoToCardResponse(atualizado, 0));
    }

    if (!exercicioAtual) {
      return res.status(404).json({ message: "Exercício não encontrado." });
    }

    if (
      !isAdminRequest(req) &&
      (exercicioAtual as any).criadoPorId &&
      (exercicioAtual as any).criadoPorId !== userId
    ) {
      return res.status(403).json({
        message: "Você não pode editar esse exercício.",
      });
    }

    const videoFile = req.file as any;
    const novaVideoUrl = videoFile ? videoFile.location : null;
    const {
      codigo,
      nome,
      objetivo,
      nivel,
      tipo,
      faixaEtaria,
      modoExecucao,
      series,
      repeticoes,
      duracao,
      descanso,
      materiaisNecessarios,
      quantidadeAtletas,
      espacoNecessario,
      tags,
      removerVideo,
    } = req.body;

    if (!nome || !String(nome).trim()) return res.status(400).json({ message: "Nome é obrigatório." });
    if (!codigo || !String(codigo).trim()) return res.status(400).json({ message: "Código é obrigatório." });
    if (nivel && !["Base", "Avancado", "Performance"].includes(String(nivel))) return res.status(400).json({ message: "Nível inválido." });
    if (modoExecucao && !["Tempo", "SeriesRepeticoes", "LivreOrientativo"].includes(String(modoExecucao))) return res.status(400).json({ message: "Modo de execução inválido." });
    if (tipo && !["Tecnico", "Fisico", "Tatico", "Mental"].includes(String(tipo))) return res.status(400).json({ message: "Tipo inválido." });
    if (!tipo || !String(tipo).trim()) return res.status(400).json({ message: "Tipo é obrigatório." });
    if (!nivel || !String(nivel).trim()) return res.status(400).json({ message: "Nível é obrigatório." });

    const faixasEtarias = normalizarFaixasEtarias(req.body.faixaEtaria);
    const faixasValidas = FAIXAS_ETARIAS_VALIDAS;

    if (faixasEtarias.some((faixa) => !faixasValidas.includes(faixa))) return res.status(400).json({ message: "Faixa etária inválida." });
    if (faixasEtarias.length === 0) return res.status(400).json({ message: "Selecione pelo menos uma faixa etária." });
    if (espacoNecessario && !["Pequeno", "Medio", "Grande"].includes(String(espacoNecessario))) return res.status(400).json({ message: "Espaço necessário inválido." });

    const nomeNormalizado = normalizarNomeExercicio(String(nome));
    const codigoNormalizado = String(codigo).trim();
    const idAtual = (exercicioAtual as any).id;

    const codigoDuplicado = await prisma.exercicio.findFirst({ where: { codigo: codigoNormalizado, NOT: { id: idAtual } } });
    if (codigoDuplicado) return res.status(400).json({ message: "Já existe um exercício com esse código." });

    const nomeDuplicadoExercicio = await prisma.exercicio.findFirst({ where: { nomeNormalizado, NOT: { id: idAtual } }, select: { id: true } });
    if (nomeDuplicadoExercicio) return res.status(400).json({ message: "Já existe outro exercício com esse nome." });

    const nomeDuplicadoPersonalizado = await prisma.exercicioPersonalizado.findFirst({
      where: {
        nomeNormalizado,
        criadorUsuarioId: userId,
        NOT: { id: idAtual },
      },
      select: { id: true },
    });

    if (nomeDuplicadoPersonalizado) {
      return res.status(400).json({
        message: "Você já possui um exercício personalizado com esse nome.",
      });
    }

    if (novaVideoUrl) {
      try {
        const metadata = await probeVideo(novaVideoUrl);
        if (metadata?.durationSec != null && metadata.durationSec > 60) {
          await deleteFromS3(novaVideoUrl);
          return res.status(400).json({ message: "Esse vídeo é muito longo. O máximo permitido é 60 segundos." });
        }
      } catch {
        await deleteFromS3(novaVideoUrl);
        return res.status(400).json({ message: "Não foi possível validar a duração do vídeo enviado." });
      }
    }

    const deveRemoverVideo = String(removerVideo) === "true";

    if ((novaVideoUrl || deveRemoverVideo) && (exercicioAtual as any).videoDemonstrativoUrl) {
      await removePublicFileIfExists((exercicioAtual as any).videoDemonstrativoUrl);
    }

    const exercicio = await prisma.exercicio.update({
      where: { id: idAtual },
      data: {
        codigo: codigoNormalizado,
        nome: String(nome).trim(),
        nomeNormalizado,
        objetivo: parseNullableString(objetivo),
        nivel: parseNullableString(nivel) as any,
        ...(novaVideoUrl
          ? { videoDemonstrativoUrl: novaVideoUrl }
          : deveRemoverVideo
            ? { videoDemonstrativoUrl: null }
            : {}),
        tipo: parseNullableString(tipo) as any,
        faixaEtaria: { set: faixasEtarias as any[] },
        modoExecucao: parseNullableString(modoExecucao) as any,
        series: parseNullableInt(series),
        repeticoes: parseNullableString(repeticoes),
        duracao: parseNullableString(duracao),
        descanso: parseNullableString(descanso),
        tags: parseArrayField(tags),
        quantidadeAtletas: parseNullableString(quantidadeAtletas),
        materiaisNecessarios: parseNullableString(materiaisNecessarios),
        espacoNecessario: parseNullableString(espacoNecessario) as any,
      } as any,
    });

    const usoMap = await mapUsoEmTreinos([idAtual]);
    res.json(toCardResponse(exercicio, usoMap[idAtual] || 0));
  } catch (error) {
    console.error("Erro ao editar exercício:", error);
    res.status(500).json({ message: "Erro ao editar exercício." });
  }
};

export const listarExercicios = async (_req: Request, res: Response) => {
  try {
    const exercicios = await prisma.exercicio.findMany({ orderBy: { nome: "asc" } });
    const ids = exercicios.map((e) => e.id);
    const usoMap = await mapUsoEmTreinos(ids);
    const out = exercicios.map((e) => toCardResponse(e, usoMap[e.id] || 0));
    res.json(out);
  } catch (error) {
    console.error("Erro ao listar exercícios:", error);
    res.status(500).json({ message: "Erro ao listar exercícios." });
  }
};

export const listarExerciciosAdmin = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Usuário não autenticado." });
    }

    if (!isAdminRequest(req)) {
      return res
        .status(403)
        .json({ message: "Acesso permitido apenas para administradores." });
    }

    const [exercicios, personalizados] = await Promise.all([
      prisma.exercicio.findMany({
        orderBy: {
          nome: "asc",
        },
      }),

      prisma.exercicioPersonalizado.findMany({
        orderBy: [
          {
            atualizadoEm: "desc",
          },
          {
            nome: "asc",
          },
        ],
      }),
    ]);

    const idsExercicios = exercicios.map((e) => e.id);
    const idsPersonalizados = personalizados.map((e) => e.id);

    const [usoExercicios, usoPersonalizados] =
      await Promise.all([
        mapUsoEmTreinos(idsExercicios),
        mapUsoPersonalizadosEmTreinos(idsPersonalizados),
      ]);

    const exerciciosMapeados = exercicios.map((e) => ({
      ...toCardResponse(
        e,
        usoExercicios[e.id] || 0
      ),
      descricao: e.objetivo ?? null,
      origem: "catalogo",
      exercicioId: e.id,
    }));

    const personalizadosMapeados = personalizados.map((e) =>
      mapPersonalizadoToCardResponse(
        e,
        usoPersonalizados[e.id] || 0
      )
    );

    const todos = [
      ...exerciciosMapeados,
      ...personalizadosMapeados,
    ].sort((a, b) =>
      String(a.nome || "").localeCompare(
        String(b.nome || ""),
        "pt-BR",
        {
          sensitivity: "base",
        }
      )
    );

    return res.json(todos);
  } catch (error) {
    console.error(
      "Erro ao listar exercícios para o Admin:",
      error
    );

    return res.status(500).json({
      message: "Erro ao listar exercícios.",
    });
  }
};

export const listarMeusExercicios = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Usuário não autenticado." });

    const busca = parseNullableString(req.query.busca);
    const tipo = parseNullableString(req.query.tipo);
    const faixaEtaria = parseNullableString(req.query.faixaEtaria);
    const favorito = req.query.favorito === "true" ? true : undefined;
    const nivel = parseNullableString(req.query.nivel);

    const whereExercicio: any = { criadoPorId: userId };

    if (busca) {
      whereExercicio.OR = [
        { nome: { contains: busca, mode: "insensitive" } },
        { codigo: { contains: busca, mode: "insensitive" } },
        { objetivo: { contains: busca, mode: "insensitive" } },
      ];
    }
    if (tipo && tipo !== "Todos") whereExercicio.tipo = tipo;
    if (faixaEtaria && faixaEtaria !== "Todos") whereExercicio.faixaEtaria = { has: faixaEtaria };
    if (nivel && nivel !== "Todos") whereExercicio.nivel = nivel;
    if (favorito !== undefined) whereExercicio.favorito = favorito;

    const exercicios = await prisma.exercicio.findMany({
      where: whereExercicio,
      orderBy: [{ favorito: "desc" }, { updatedAt: "desc" as any }, { nome: "asc" }],
    });

    const wherePersonalizado: any = { criadorUsuarioId: userId };
    if (busca) {
      wherePersonalizado.OR = [
        { nome: { contains: busca, mode: "insensitive" } },
        { descricao: { contains: busca, mode: "insensitive" } },
      ];
    }
    if (faixaEtaria && faixaEtaria !== "Todos") wherePersonalizado.categorias = { has: faixaEtaria };
    if (nivel && nivel !== "Todos") wherePersonalizado.nivel = nivel;

    if (tipo && tipo !== "Todos") wherePersonalizado.tipo = tipo;

    if (favorito !== undefined) wherePersonalizado.favorito = favorito;

    const personalizados = await prisma.exercicioPersonalizado.findMany({
      where: wherePersonalizado,
      orderBy: [{ atualizadoEm: "desc" }, { nome: "asc" }],
    });

    const ids = exercicios.map((e) => e.id);
    const usoMap = await mapUsoEmTreinos(ids);

    const exerciciosMapeados = exercicios.map((e) => toCardResponse(e, usoMap[e.id] || 0));
    const personalizadosMapeados = personalizados.map((p) => mapPersonalizadoToCardResponse(p, 0));
    const combinado = [...exerciciosMapeados, ...personalizadosMapeados];

    const map = new Map<string, any>();
    for (const item of combinado) {
      const chave = normalizarNomeExercicio(item.nome ?? "");
      if (!chave) continue;
      const existente = map.get(chave);
      if (!existente) { map.set(chave, item); continue; }
      if (item.origem === "personalizado") map.set(chave, item);
    }

    res.json(Array.from(map.values()));
  } catch (error) {
    console.error("Erro ao listar meus exercícios:", error);
    res.status(500).json({ message: "Erro ao listar seus exercícios." });
  }
};

export const buscarExercicioPorId = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const userId = getAuthUserId(req);
    const exercicio = await prisma.exercicio.findUnique({ where: { id } });

    if (exercicio) {
      if (
        !isAdminRequest(req) &&
        userId &&
        (exercicio as any).criadoPorId &&
        (exercicio as any).criadoPorId !== userId
      ) {
        return res.status(403).json({
          message: "Você não pode acessar esse exercício.",
        });
      }
      const usoMap = await mapUsoEmTreinos([id]);
      return res.json(toCardResponse(exercicio, usoMap[id] || 0));
    }

    const personalizado = await prisma.exercicioPersonalizado.findUnique({ where: { id } });
    if (!personalizado) return res.status(404).json({ message: "Exercício não encontrado." });
    if (
      !isAdminRequest(req) &&
      userId &&
      personalizado.criadorUsuarioId !== userId
    ) {
      return res.status(403).json({
        message: "Você não pode acessar esse exercício.",
      });
    }

    return res.json(mapPersonalizadoToCardResponse(personalizado, 0));
  } catch (error) {
    console.error("Erro ao buscar exercício:", error);
    res.status(500).json({ message: "Erro ao buscar exercício." });
  }
};

export const duplicarExercicio = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Usuário não autenticado." });

    const original = await prisma.exercicio.findUnique({ where: { id } });

    if (original) {
      const baseCodigo = `${(original as any).codigo || "EX"}-COPIA`;
      let novoCodigo = baseCodigo;
      let contador = 2;

      while (await prisma.exercicio.findFirst({ where: { codigo: novoCodigo } })) {
        novoCodigo = `${baseCodigo}-${contador}`;
        contador += 1;
      }

      const novoNome = await gerarNomeUnicoParaExercicio(`${(original as any).nome} (Cópia)`);

      const duplicado = await prisma.exercicio.create({
        data: {
          codigo: novoCodigo,
          nome: novoNome,
          objetivo: (original as any).objetivo ?? null,
          nivel: (original as any).nivel ?? null,
          videoDemonstrativoUrl: (original as any).videoDemonstrativoUrl ?? null,
          criadoPorId: userId,
          favorito: false,
          tipo: (original as any).tipo ?? null,
          faixaEtaria: { set: Array.isArray((original as any).faixaEtaria) ? (original as any).faixaEtaria : [] },
          modoExecucao: (original as any).modoExecucao ?? null,
          series: (original as any).series ?? null,
          repeticoes: (original as any).repeticoes ?? null,
          duracao: (original as any).duracao ?? null,
          descanso: (original as any).descanso ?? null,
          tags: Array.isArray((original as any).tags) ? (original as any).tags : [],
          quantidadeAtletas: (original as any).quantidadeAtletas ?? null,
          materiaisNecessarios: (original as any).materiaisNecessarios ?? null,
          espacoNecessario: (original as any).espacoNecessario ?? null,
        } as any,
      });

      return res.status(201).json(toCardResponse(duplicado, 0));
    }

    const personalizado = await prisma.exercicioPersonalizado.findUnique({ where: { id } });
    if (!personalizado) return res.status(404).json({ message: "Exercício não encontrado." });
    if (personalizado.criadorUsuarioId !== userId) return res.status(403).json({ message: "Você não pode duplicar esse exercício." });

    const nomeUnico = await gerarNomeUnicoParaExercicio(`${personalizado.nome} (Cópia)`);
    const codigoUnico = await gerarCodigoUnicoParaExercicio(personalizado.nome);

    const duplicado = await prisma.exercicioPersonalizado.create({
      data: {
        nome: nomeUnico,
        nomeNormalizado: normalizarNomeExercicio(nomeUnico),
        descricao: personalizado.descricao ?? null,
        nivel: personalizado.nivel ?? "Base",
        categorias: Array.isArray(personalizado.categorias) ? personalizado.categorias : [],
        videoDemonstrativoUrl: personalizado.videoDemonstrativoUrl ?? null,
        videoPosterUrl: personalizado.videoPosterUrl ?? null,
        criadorUsuarioId: userId,
        tipo: (personalizado as any).tipo ?? null,
        modoExecucao: (personalizado as any).modoExecucao ?? null,
        series: (personalizado as any).series ?? null,
        repeticoes: (personalizado as any).repeticoes ?? null,
        duracao: (personalizado as any).duracao ?? null,
        descanso: (personalizado as any).descanso ?? null,
        tags: Array.isArray((personalizado as any).tags) ? (personalizado as any).tags : [],
        quantidadeAtletas: (personalizado as any).quantidadeAtletas ?? null,
        materiaisNecessarios: (personalizado as any).materiaisNecessarios ?? null,
        espacoNecessario: (personalizado as any).espacoNecessario ?? null,
      } as any,
    });

    return res.status(201).json(mapPersonalizadoToCardResponse(duplicado, 0));
  } catch (error) {
    console.error("Erro ao duplicar exercício:", error);
    res.status(500).json({ message: "Erro ao duplicar exercício." });
  }
};

export const favoritarExercicio = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Usuário não autenticado." });

    let exercicio = await prisma.exercicio.findUnique({ where: { id } });

    if (!exercicio) {
      const personalizado = await prisma.exercicioPersonalizado.findUnique({ where: { id } });

      if (!personalizado) {
        return res.status(404).json({ message: "Exercício não encontrado." });
      }

      if (personalizado.criadorUsuarioId !== userId) {
        return res.status(403).json({ message: "Você não pode favoritar esse exercício." });
      }

      const novoFavorito =
        typeof req.body?.favorito === "boolean"
          ? req.body.favorito
          : !Boolean((personalizado as any).favorito);

      const atualizado = await prisma.exercicioPersonalizado.update({
        where: { id },
        data: { favorito: novoFavorito } as any,
      });

      return res.json(mapPersonalizadoToCardResponse(atualizado, 0));
    }

    if ((exercicio as any).criadoPorId && (exercicio as any).criadoPorId !== userId) {
      return res.status(403).json({ message: "Você não pode favoritar esse exercício." });
    }

    const atualizado = await prisma.exercicio.update({
      where: { id },
      data: { favorito: typeof req.body?.favorito === "boolean" ? req.body.favorito : !(exercicio as any).favorito } as any,
    });

    const usoMap = await mapUsoEmTreinos([id]);
    res.json(toCardResponse(atualizado, usoMap[id] || 0));
  } catch (error) {
    console.error("Erro ao favoritar exercício:", error);
    res.status(500).json({ message: "Erro ao favoritar exercício." });
  }
};

export const excluirExercicio = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Usuário não autenticado." });

    const exercicio = await prisma.exercicio.findUnique({ where: { id } });

    if (exercicio) {
      if (
        !isAdminRequest(req) &&
        (exercicio as any).criadoPorId &&
        (exercicio as any).criadoPorId !== userId
      ) {
        return res.status(403).json({
          message: "Você não pode excluir esse exercício.",
        });
      }
      await removePublicFileIfExists((exercicio as any).videoDemonstrativoUrl);
      await prisma.exercicio.delete({ where: { id } });
      return res.status(204).send();
    }

    const personalizado = await prisma.exercicioPersonalizado.findUnique({ where: { id } });
    if (!personalizado) return res.status(404).json({ message: "Exercício não encontrado." });
    if (
      !isAdminRequest(req) &&
      personalizado.criadorUsuarioId !== userId
    ) {
      return res.status(403).json({
        message: "Você não pode excluir esse exercício.",
      });
    }

    await removePublicFileIfExists(personalizado.videoDemonstrativoUrl);
    await prisma.exercicioPersonalizado.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir exercício:", error);
    res.status(500).json({ message: "Erro ao excluir exercício." });
  }
};

export const criarExercicioPersonalizado = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    const videoFile = req.file as any;
    const videoDemonstrativoUrl = videoFile ? videoFile.location : null;

    const {
      nome,
      descricao,
      objetivo,
      nivel,
      categorias,
      faixaEtaria,
      videoUrl,
      videoPosterUrl,
      tipo,
      modoExecucao,
      series,
      repeticoes,
      duracao,
      descanso,
      tags,
      quantidadeAtletas,
      materiaisNecessarios,
      espacoNecessario,
      favorito
    } = req.body;

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ message: "Nome é obrigatório." });
    }

    const nomeFinal = String(nome).trim();
    const nomeNormalizado = normalizarNomeExercicio(nomeFinal);

    const existente = await prisma.exercicioPersonalizado.findFirst({
      where: {
        criadorUsuarioId: userId,
        nomeNormalizado,
      },
      select: { id: true },
    });

    if (existente) {
      return res.status(400).json({
        message: "Você já possui um exercício personalizado com esse nome.",
      });
    }

    const categoriasFinal = parseArrayField(categorias ?? faixaEtaria);

    const criado = await prisma.exercicioPersonalizado.create({
      data: {
        nome: nomeFinal,
        nomeNormalizado,
        descricao: parseNullableString(descricao ?? objetivo),
        nivel: parseNullableString(nivel) ?? "Base",
        categorias: categoriasFinal,
        videoDemonstrativoUrl:
          videoDemonstrativoUrl ??
          parseNullableString(videoUrl) ??
          null,
        videoPosterUrl: parseNullableString(videoPosterUrl),
        criadorUsuarioId: userId,
        tipo: parseNullableString(tipo) as any,
        modoExecucao: parseNullableString(modoExecucao) as any,
        series: parseNullableInt(series),
        repeticoes: parseNullableString(repeticoes),
        duracao: parseNullableString(duracao),
        descanso: parseNullableString(descanso),
        tags: parseArrayField(tags),
        quantidadeAtletas: parseNullableString(quantidadeAtletas),
        materiaisNecessarios: parseNullableString(materiaisNecessarios),
        espacoNecessario: parseNullableString(espacoNecessario) as any,
        favorito: false,
      } as any,
    });

    return res.status(201).json({
      ...criado,
      origem: "personalizado",
    });
  } catch (error) {
    console.error("Erro ao criar exercício personalizado:", error);
    return res.status(500).json({
      message: "Erro ao criar exercício personalizado.",
    });
  }
};