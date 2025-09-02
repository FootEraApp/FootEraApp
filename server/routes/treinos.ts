import { Router } from "express";
import { Nivel, Categoria, TipoTreino, PrismaClient, PosicaoCampo } from "@prisma/client";
import { authenticateToken } from "server/middlewares/auth.js";
import { concluirTreino, getTreinosAgendados, treinosController, excluirTreinoAgendado, listarTodosTreinosProgramados, obterTreinoProgramadoPorId, agendarTreino } from "server/controllers/treinosController.js";

const router = Router();
const prisma = new PrismaClient;

interface CriarTreinoInput {
  nome: string;
  descricao?: string;
  nivel: Nivel;
  categoria?: Categoria[];
  tipoTreino?: string;
  objetivo?: string;
  duracao?: number;
  dataTreino?: string;
  dicas?: string[];
  exercicios: {
    exercicioId?: string;
    nome?: string;
    descricao?: string;
    series?: string;
    repeticoes: string;
  }[];
  tipoUsuarioId: string; 
}

router.post("/concluir", authenticateToken, concluirTreino);
router.post("/agendados", authenticateToken, agendarTreino);
router.delete('/agendados/:id', authenticateToken, excluirTreinoAgendado);
router.get("/agendados", authenticateToken, getTreinosAgendados);
router.get("/disponiveis", treinosController.disponiveis);
router.get("/programados", listarTodosTreinosProgramados);
router.get("/exercicios", async (req, res) => {
  try {
    const exercicios = await prisma.exercicio.findMany();
    return res.json(exercicios);
  } catch (err) {
    console.error("Erro ao buscar exercícios:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});
router.get("/atletas-vinculados", async (req, res) => {
  const { tipoUsuarioId } = req.query;

  if (!tipoUsuarioId || typeof tipoUsuarioId !== "string") {
    return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });
  }

  try {
    const relacoes = await prisma.relacaoTreinamento.findMany({
      where: {
        OR: [
          { professorId: tipoUsuarioId },
          { escolinhaId: tipoUsuarioId },
          { clubeId: tipoUsuarioId }
        ]
      },
      include: {
        atleta: {
          include: {
            usuario: true,
          }
        }
      }
    });

const atletas = relacoes
  .map((rel) => {
    const a = rel.atleta;
    if (!a) return null;
    return {
      id: a.usuario.id,
      atletaId: a.id,
      nome: a.usuario.nome,
      foto: a.usuario.foto,
      posicao: a.posicao,
      idade: a.idade,
      altura: a.altura,
      peso: a.peso,
    };
  })
  .filter(Boolean);
return res.json(atletas);

  } catch (error) {
    console.error("Erro ao buscar atletas vinculados:", error);
    return res.status(500).json({ error: "Erro ao buscar atletas vinculados" });
  }
});

router.get("/", async (req, res) => {
  try {
    const treinosProgramados = await prisma.treinoProgramado.findMany({
      include: {
        exercicios: {
          include: { exercicio: true }
        }
      }
    });

    const desafiosOficiais = await prisma.desafioOficial.findMany();

    const treinosFormatados = treinosProgramados.map((t) => ({
      id: t.id,
      nome: t.nome,
      descricao: t.descricao,
      nivel: t.nivel,
      dataAgendada: t.dataAgendada,
      professorId: t.professorId, 
      exercicios: t.exercicios.map((ex) => ({
        id: ex.exercicioId,
        nome: ex.exercicio.nome,
        repeticoes: ex.repeticoes
      }))
    }));

    return res.json({ treinosProgramados: treinosFormatados, desafiosOficiais });
  } catch (err) {
    console.error("Erro ao buscar treinos:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

router.post("/elencos", authenticateToken, async (req, res) => {
  try {
    const {
      nome,
      maxJogadores = 11,
      tipoUsuario,   
      tipoUsuarioId, 
      atletas,     
      escala,     
      ativo = true,
    } = req.body as {
      nome?: string;
      maxJogadores?: number;
      tipoUsuario?: "professor" | "escolinha" | "clube";
      tipoUsuarioId?: string;
      atletas?: { atletaId: string; posicao: PosicaoCampo }[];
      escala?: Record<PosicaoCampo, string | null>;
      ativo?: boolean;
    };

    if (!nome) return res.status(400).json({ error: "nome é obrigatório" });
    if (!tipoUsuarioId) return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });
    if (!tipoUsuario || !["professor", "escolinha", "clube"].includes(tipoUsuario)) {
      return res.status(400).json({ error: "tipoUsuario inválido" });
    }

    const dataCreate: any = {
      nome,
      maxJogadores,
      ativo,
    };
    if (tipoUsuario === "professor") dataCreate.professorId = tipoUsuarioId;
    if (tipoUsuario === "escolinha") dataCreate.escolinhaId = tipoUsuarioId;
    if (tipoUsuario === "clube") dataCreate.clubeId = tipoUsuarioId;

    const elenco = await prisma.elenco.create({ data: dataCreate });

    let vinculos: { atletaId: string; posicao: PosicaoCampo }[] = [];

    if (Array.isArray(atletas) && atletas.length) {
      vinculos = atletas;
    } else if (escala && typeof escala === "object") {
      vinculos = Object.entries(escala)
        .filter(([, atletaId]) => !!atletaId)
        .map(([pos, atletaId]) => ({
          posicao: pos as PosicaoCampo,
          atletaId: atletaId as string,
        }));
    }

    if (vinculos.length) {
      await prisma.atletaElenco.createMany({
        data: vinculos.map((v) => ({
          elencoId: elenco.id,
          atletaId: v.atletaId,
          posicao: v.posicao,
        })),
        skipDuplicates: true,
      });
    }

    return res.status(201).json({ ...elenco, atletasCount: vinculos.length });
  } catch (err) {
    console.error("Erro ao criar elenco:", err);
    return res.status(500).json({ error: "Erro ao criar elenco" });
  }
});

router.get("/elencos", authenticateToken, async (req, res) => {
  try {
    const { tipoUsuarioId } = req.query;

    if (!tipoUsuarioId || typeof tipoUsuarioId !== "string") {
      return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });
    }

    const elencos = await prisma.elenco.findMany({
      where: {
        OR: [
          { professorId: tipoUsuarioId },
          { escolinhaId: tipoUsuarioId },
          { clubeId: tipoUsuarioId },
        ],
        ativo: true,
      },
      orderBy: { dataCriacao: "desc" },
    });

    if (!elencos.length) return res.json([]);

    const elencoIds = elencos.map((e) => e.id);

    const vinculos = await prisma.atletaElenco.findMany({
      where: { elencoId: { in: elencoIds } },
    });

    const porElenco = new Map<string, { atletaId: string; posicao: PosicaoCampo }[]>();
    for (const v of vinculos) {
      const arr = porElenco.get(v.elencoId) ?? [];
      arr.push({ atletaId: v.atletaId, posicao: v.posicao });
      porElenco.set(v.elencoId, arr);
    }

    const resposta = elencos.map((e) => ({
      ...e,
      atletas: porElenco.get(e.id) ?? [],
    }));

    return res.json(resposta);
  } catch (err) {
    console.error("Erro ao listar elencos:", err);
    return res.status(500).json({ error: "Erro ao listar elencos" });
  }
});

router.put("/elencos/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nome,
      maxJogadores,
      ativo,
      atletas, 
      escala, 
    } = req.body as {
      nome?: string;
      maxJogadores?: number;
      ativo?: boolean;
      atletas?: { atletaId: string; posicao: PosicaoCampo }[];
      escala?: Record<PosicaoCampo, string | null>;
    };

    const exists = await prisma.elenco.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ error: "Elenco não encontrado" });

    const dataUpdate: any = {};
    if (typeof nome === "string") dataUpdate.nome = nome;
    if (typeof maxJogadores === "number") dataUpdate.maxJogadores = maxJogadores;
    if (typeof ativo === "boolean") dataUpdate.ativo = ativo;

    const elenco = await prisma.elenco.update({
      where: { id },
      data: dataUpdate,
    });

    let vinculos: { atletaId: string; posicao: PosicaoCampo }[] = [];
    if (Array.isArray(atletas) && atletas.length) {
      vinculos = atletas;
    } else if (escala && typeof escala === "object") {
      vinculos = Object.entries(escala)
        .filter(([, atletaId]) => !!atletaId)
        .map(([pos, atletaId]) => ({
          posicao: pos as PosicaoCampo,
          atletaId: atletaId as string,
        }));
    }

    await prisma.atletaElenco.deleteMany({ where: { elencoId: id } });

    if (vinculos.length) {
      await prisma.atletaElenco.createMany({
        data: vinculos.map((v) => ({
          elencoId: id,
          atletaId: v.atletaId,
          posicao: v.posicao,
        })),
        skipDuplicates: true,
      });
    }

    return res.json({ ...elenco, atletasCount: vinculos.length });
  } catch (err) {
    console.error("Erro ao atualizar elenco:", err);
    return res.status(500).json({ error: "Erro ao atualizar elenco" });
  }
});

router.get("/elencos/:id/escala", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const elenco = await prisma.elenco.findUnique({ where: { id } });
    if (!elenco) return res.status(404).json({ error: "Elenco não encontrado" });

    const vinculos = await prisma.atletaElenco.findMany({
      where: { elencoId: id },
      include: {
        atleta: {
          include: { usuario: true },
        },
      },
    });

    const posicoes: PosicaoCampo[] = [
      "GOL","LD","ZD","ZE","LE","VOL1","VOL2","MEI","PD","CA","PE"
    ];

    const escala = posicoes.reduce((acc, pos) => {
      acc[pos] = null as any;
      return acc;
    }, {} as Record<PosicaoCampo, {
      atletaId: string;
      usuarioId: string;
      nome: string;
      foto?: string | null;
      idade?: number | null;
      posicao?: string | null;
    } | null>);

    for (const v of vinculos) {
      const a = v.atleta;
      const u = a?.usuario;
      if (!u) continue;
      escala[v.posicao] = {
        atletaId: a.id, 
        usuarioId: u.id,  
        nome: u.nome,
        foto: u.foto,
        idade: a.idade ?? null,
        posicao: a.posicao ?? null,
      };
    }

    return res.json({
      id: elenco.id,
      nome: elenco.nome,
      maxJogadores: elenco.maxJogadores,
      escala,             
      atletasCount: vinculos.length,
    });
  } catch (err) {
    console.error("Erro ao buscar escala do elenco:", err);
    return res.status(500).json({ error: "Erro ao buscar escala do elenco" });
  }
});

router.get("/elencos/escala-por-dono", authenticateToken, async (req, res) => {
  try {
    const { tipoUsuarioId } = req.query;

    if (!tipoUsuarioId || typeof tipoUsuarioId !== "string") {
      return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });
    }

    const elenco = await prisma.elenco.findFirst({
      where: {
        ativo: true,
        OR: [
          { professorId: tipoUsuarioId },
          { escolinhaId: tipoUsuarioId },
          { clubeId: tipoUsuarioId },
        ],
      },
      orderBy: { dataCriacao: "desc" },
    });

    if (!elenco) {
      return res.json(null);
    }

    const vinculos = await prisma.atletaElenco.findMany({
      where: { elencoId: elenco.id },
      include: {
        atleta: {
          include: { usuario: true },
        },
      },
    });

    const posicoes: PosicaoCampo[] = [
      "GOL","LD","ZD","ZE","LE","VOL1","VOL2","MEI","PD","CA","PE"
    ];

    const escala = posicoes.reduce((acc, pos) => {
      acc[pos] = null as any;
      return acc;
    }, {} as Record<PosicaoCampo, {
      atletaId: string;
      usuarioId: string;
      nome: string;
      foto?: string | null;
      idade?: number | null;
      posicao?: string | null;
    } | null>);

    for (const v of vinculos) {
      const a = v.atleta;
      const u = a?.usuario;
      if (!u) continue;
      escala[v.posicao] = {
        atletaId: a.id,
        usuarioId: u.id,
        nome: u.nome,
        foto: u.foto,
        idade: a.idade ?? null,
        posicao: a.posicao ?? null,
      };
    }

    return res.json({
      id: elenco.id,
      nome: elenco.nome,
      maxJogadores: elenco.maxJogadores,
      escala,
      atletasCount: vinculos.length,
    });
  } catch (err) {
    console.error("Erro ao buscar escala por dono:", err);
    return res.status(500).json({ error: "Erro ao buscar escala por dono" });
  }
});

router.get("/pontuacoes", authenticateToken, async (req, res) => {
  try {
    const raw = (req.query.atletaIds as string) || "";
    const atletaIds = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (!atletaIds.length) {
      return res.status(400).json({ error: "Informe 1+ atletaIds" });
    }

    const rows = await prisma.pontuacaoAtleta.findMany({
      where: { atletaId: { in: atletaIds } },
      select: {
        atletaId: true,
        pontuacaoTotal: true,
        pontuacaoPerformance: true,
        pontuacaoDisciplina: true,
        pontuacaoResponsabilidade: true,
        ultimaAtualizacao: true,
      },
    });

    const payload = rows.map((r) => {
      const mediaGeral = Math.round(
        (r.pontuacaoPerformance + r.pontuacaoDisciplina + r.pontuacaoResponsabilidade) / 3
      );
      return {
        atletaId: r.atletaId,
        total: r.pontuacaoTotal,
        performance: r.pontuacaoPerformance,
        disciplina: r.pontuacaoDisciplina,
        responsabilidade: r.pontuacaoResponsabilidade,
        mediaGeral,       
        ultimaAtualizacao: r.ultimaAtualizacao,
      };
    });

    return res.json(payload);
  } catch (err) {
    console.error("Erro ao buscar pontuações:", err);
    return res.status(500).json({ error: "Erro ao buscar pontuações" });
  }
});

router.post("/", async (req, res) => {
  const {
    nome,
    descricao,
    nivel,
    exercicios,
    usuarioId,
    categoria,
    tipoTreino,
    objetivo,
    duracao,
    dataTreino,
    dicas,
    tipoUsuario,
    tipoUsuarioId, 
  } = req.body;

   if (!nome || !nivel || !Array.isArray(exercicios) || !usuarioId || !tipoUsuarioId) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  if (
    categoria &&
    (!Array.isArray(categoria) ||
      !categoria.every((cat) => Object.values(Categoria).includes(cat as Categoria)))
  ) {
    return res.status(400).json({ error: "Categoria(s) inválida(s)" });
  }

  if (tipoTreino && !Object.values(TipoTreino).includes(tipoTreino as TipoTreino)) {
    return res.status(400).json({ error: "TipoTreino inválido" });
  }

  try {
    const dataCreate: any = {
      nome,
      descricao,
      nivel,
      codigo: `${nome}-${Date.now()}`,
      dataAgendada: dataTreino ? new Date(dataTreino) : undefined,
      objetivo,
      duracao,
      dicas,
      categoria: Array.isArray(categoria) ? (categoria as Categoria[]) : [],
      tipoTreino: tipoTreino as TipoTreino,
      exercicios: {
        create: exercicios
          .filter((ex) => ex.exercicioId)
          .map((ex, index) => ({
            exercicioId: ex.exercicioId!,
            repeticoes: ex.repeticoes,
            ordem: index + 1
          }))
      }
    };

    if (tipoUsuario === "professor") {
      dataCreate.professorId = tipoUsuarioId;
    } else if (tipoUsuario === "escolinha") {
      dataCreate.escolinhaId = tipoUsuarioId;
    } else if (tipoUsuario === "clube") {
      dataCreate.clubeId = tipoUsuarioId;
    }

    const treino = await prisma.treinoProgramado.create({
      data: dataCreate,
    });

    if (Array.isArray(req.body.atletasIds) && req.body.atletasIds.length > 0) {
      const dataAgendada = treino.dataAgendada ?? new Date();

      await Promise.all(
        req.body.atletasIds.map((atletaId: string) => {
          return prisma.treinoAgendado.create({
            data: {
              titulo: treino.nome,
              dataExpiracao: dataAgendada,
              dataTreino: dataAgendada,
              atletaId,
              treinoProgramadoId: treino.id,
            }
          });
        })
      );
    }
    return res.status(201).json(treino);
  } catch (err) {
    console.error("Erro ao criar treino:", err);
    return res.status(500).json({ error: "Erro ao criar treino" });
  }
});
router.post("/restaurar", authenticateToken, async (req, res) => {
  const { nomes } = req.body as { nomes: string[] };
  if (!Array.isArray(nomes) || nomes.length === 0) {
    return res.status(400).json({ error: "Informe 'nomes: string[]'." });
  }

  const ops = nomes.map((nome) =>
    prisma.treinoProgramado.upsert({
      where: { nome },
      update: { naoExpira: true, dataAgendada: null },
      create: {
        nome,
        codigo: `${nome}-${Date.now()}`,
        nivel: "Base",
        tipoTreino: "Fisico",
        categoria: [],
        duracao: 60,
        pontuacao: 15,
        dicas: [],
        naoExpira: true,
        dataAgendada: null,
      },
    })
  );

  await Promise.all(ops);
  return res.json({ ok: true, restaurados: nomes.length });
});


router.get("/:id", authenticateToken, obterTreinoProgramadoPorId);

export default router;