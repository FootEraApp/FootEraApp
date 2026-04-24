// server/controllers/exerciciosController.ts
import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { probeVideo } from "../services/mediaMetadata.js";
import { deleteFromS3 } from "../middlewares/s3Upload.js"; // ✅ Importando a função de apagar do S3

function getAuthUserId(req: Request): string | null {
  return (req as any)?.user?.id || null;
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

// ✅ Limpeza do S3 se precisar remover um vídeo
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
        // Ignora se falhar
      }
    }
  }

  return map;
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
    nivel: exercicio.nivel ?? null,
    tipo: null,
    faixaEtaria: Array.isArray(exercicio.categorias) ? exercicio.categorias : [],
    modoExecucao: null,
    series: null,
    repeticoes: null,
    duracao: null,
    descanso: null,
    tags: [],
    quantidadeAtletas: null,
    materiaisNecessarios: null,
    espacoNecessario: null,
    videoDemonstrativoUrl: exercicio.videoDemonstrativoUrl ?? null,
    favorito: false,
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

    // ✅ Agora o arquivo vem no req.file, e já está no S3
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

    const personalizadoMesmoNome = await prisma.exercicioPersonalizado.findFirst({ where: { nomeNormalizado }, select: { id: true } });
    if (personalizadoMesmoNome) return res.status(400).json({ message: "Já existe um exercício personalizado com esse nome." });

    if (tipo && !["Tecnico", "Fisico", "Tatico", "Mental"].includes(String(tipo))) {
      return res.status(400).json({ message: "Tipo inválido." });
    }

    const faixasEtarias = parseArrayField(req.body.faixaEtaria);
    const faixasValidas = ["Sub-3", "Sub-5", "Sub-7", "Sub-9", "Sub-11", "Sub-13", "Sub-15", "Sub-16", "Livre"];

    if (!tipo || !String(tipo).trim()) return res.status(400).json({ message: "Tipo é obrigatório." });
    if (!nivel || !String(nivel).trim()) return res.status(400).json({ message: "Nível é obrigatório." });
    if (!["Base", "Avancado", "Performance"].includes(String(nivel))) return res.status(400).json({ message: "Nível inválido." });

    if (faixasEtarias.length === 0) return res.status(400).json({ message: "Selecione pelo menos uma faixa etária." });
    if (faixasEtarias.some((faixa) => !faixasValidas.includes(faixa))) return res.status(400).json({ message: "Faixa etária inválida." });

    if (espacoNecessario && !["Pequeno", "Medio", "Grande"].includes(String(espacoNecessario))) {
      return res.status(400).json({ message: "Espaço necessário inválido." });
    }

    // ✅ Validação de duração LENDO DIRETO DA URL DO S3
    if (videoDemonstrativoUrl) {
      try {
        const metadata = await probeVideo(videoDemonstrativoUrl);

        if (metadata?.durationSec != null && metadata.durationSec > 60) {
          await deleteFromS3(videoDemonstrativoUrl); // Apaga do S3 se for muito longo
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

    if (!exercicioAtual) {
      const personalizado = await prisma.exercicioPersonalizado.findUnique({ where: { id } });
      if (!personalizado) return res.status(404).json({ message: "Exercício não encontrado." });
      if (personalizado.criadorUsuarioId !== userId) return res.status(403).json({ message: "Você não pode editar esse exercício." });
      exercicioAtual = await migrarPersonalizadoParaExercicio(personalizado, userId);
      if (!exercicioAtual) return res.status(500).json({ message: "Erro ao migrar exercício." });
    }

    if ((exercicioAtual as any).criadoPorId && (exercicioAtual as any).criadoPorId !== userId) {
      return res.status(403).json({ message: "Você não pode editar esse exercício." });
    }

    // ✅ Pega a URL do S3 caso um novo arquivo tenha sido enviado
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

    const faixasEtarias = parseArrayField(req.body.faixaEtaria);
    const faixasValidas = ["Sub-3", "Sub-5", "Sub-7", "Sub-9", "Sub-11", "Sub-13", "Sub-15", "Sub-16", "Livre"];

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

    const nomeDuplicadoPersonalizado = await prisma.exercicioPersonalizado.findFirst({ where: { nomeNormalizado, NOT: { id: idAtual } }, select: { id: true } });
    if (nomeDuplicadoPersonalizado) return res.status(400).json({ message: "Já existe um exercício personalizado com esse nome." });

    // ✅ Validação de duração LENDO DIRETO DA URL DO S3
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

    // ✅ Deleta do S3 o vídeo antigo se for substituído ou removido explicitamente
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

    const personalizados = favorito === true || (tipo && tipo !== "Todos") ? [] : await prisma.exercicioPersonalizado.findMany({
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
      if (existente.origem === "personalizado" && item.origem !== "personalizado") map.set(chave, item);
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
      if (userId && (exercicio as any).criadoPorId && (exercicio as any).criadoPorId !== userId) {
        return res.status(403).json({ message: "Você não pode acessar esse exercício." });
      }
      const usoMap = await mapUsoEmTreinos([id]);
      return res.json(toCardResponse(exercicio, usoMap[id] || 0));
    }

    const personalizado = await prisma.exercicioPersonalizado.findUnique({ where: { id } });
    if (!personalizado) return res.status(404).json({ message: "Exercício não encontrado." });
    if (userId && personalizado.criadorUsuarioId !== userId) return res.status(403).json({ message: "Você não pode acessar esse exercício." });

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

    const duplicado = await prisma.exercicio.create({
      data: {
        codigo: codigoUnico,
        nome: nomeUnico,
        objetivo: personalizado.descricao ?? null,
        nivel: (personalizado.nivel ?? "Base") as any,
        videoDemonstrativoUrl: personalizado.videoDemonstrativoUrl ?? null,
        criadoPorId: userId,
        favorito: false,
        tipo: null,
        faixaEtaria: { set: Array.isArray(personalizado.categorias) ? personalizado.categorias : [] },
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

    return res.status(201).json(toCardResponse(duplicado, 0));
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
      if (!personalizado) return res.status(404).json({ message: "Exercício não encontrado." });
      if (personalizado.criadorUsuarioId !== userId) return res.status(403).json({ message: "Você não pode favoritar esse exercício." });
      exercicio = await migrarPersonalizadoParaExercicio(personalizado, userId);
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
      if ((exercicio as any).criadoPorId && (exercicio as any).criadoPorId !== userId) {
        return res.status(403).json({ message: "Você não pode excluir esse exercício." });
      }
      await removePublicFileIfExists((exercicio as any).videoDemonstrativoUrl);
      await prisma.exercicio.delete({ where: { id } });
      return res.status(204).send();
    }

    const personalizado = await prisma.exercicioPersonalizado.findUnique({ where: { id } });
    if (!personalizado) return res.status(404).json({ message: "Exercício não encontrado." });
    if (personalizado.criadorUsuarioId !== userId) return res.status(403).json({ message: "Você não pode excluir esse exercício." });

    await removePublicFileIfExists(personalizado.videoDemonstrativoUrl);
    await prisma.exercicioPersonalizado.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir exercício:", error);
    res.status(500).json({ message: "Erro ao excluir exercício." });
  }
};