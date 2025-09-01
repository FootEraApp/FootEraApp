// server/controllers/perfilcontroller

import { Request, Response } from "express";
import { PrismaClient, PosicaoCampo } from "@prisma/client";
import { AuthenticatedRequest } from "server/middlewares/auth.js";
import { calcularPontuacaoPorUsuarioId, atualizarCachePontuacao } from "server/services/pontuacao.service.js";
import { AnyArn } from "aws-sdk/clients/groundstation.js";
const prisma = new PrismaClient();

/** util: aceita tanto id de Usuario quanto id da entidade específica */
async function resolveByUsuarioOrEntity(opts: {
  entity: "professor" | "clube" | "escolinha";
  usuarioOrEntityId: string;
  select: any;
}) {
  const { entity, usuarioOrEntityId, select } = opts;

  if (entity === "professor") {
    // 1) por usuarioId
    let row = await prisma.professor.findFirst({
      where: { usuarioId: usuarioOrEntityId },
      select,
    });
    if (row) return row;

    // 2) por id
    row = await prisma.professor.findUnique({
      where: { id: usuarioOrEntityId },
      select,
    });
    return row;
  }

  if (entity === "clube") {
    let row = await prisma.clube.findFirst({
      where: { usuarioId: usuarioOrEntityId },
      select,
    });
    if (row) return row;

    row = await prisma.clube.findUnique({
      where: { id: usuarioOrEntityId },
      select,
    });
    return row;
  }

  // entity === "escolinha"
  let row = await prisma.escolinha.findFirst({
    where: { usuarioId: usuarioOrEntityId },
    select,
  });
  if (row) return row;

  row = await prisma.escolinha.findUnique({
    where: { id: usuarioOrEntityId },
    select,
  });
  return row;
}


export async function getPontuacaoDetalhada(req: Request, res: Response) {
  try {
    const id = req.params.id;

    const atleta = await prisma.atleta.findFirst({
      where: { OR: [{ usuarioId: id }, { id }] },
      select: { id: true },
    });
    if (!atleta) return res.status(404).json({ error: "Atleta não encontrado" });

    const subsTreino = await prisma.submissaoTreino.findMany({
      where: { atletaId: atleta.id, aprovado: true as any },
      include: { treinoAgendado: { include: { treinoProgramado: { include: { exercicios: true } } } } },
      orderBy: { criadoEm: "desc" },
    });

    const historicoTreinos = subsTreino.map((s) => {
      const dur = s.duracaoMinutos ?? s.treinoAgendado?.treinoProgramado?.duracao ?? null;
      const pts =
        s.pontosCreditados ??
        s.pontuacaoSnapshot ??
        s.treinoAgendado?.treinoProgramado?.pontuacao ??
        s.treinoAgendado?.treinoProgramado?.exercicios?.length ??
        0;

      return {
        tipo: "Treino" as const,
        titulo: s.treinoAgendado?.treinoProgramado?.nome ?? s.treinoAgendado?.titulo ?? "Treino",
        status: "Treino Concluído",
        data: new Date(s.criadoEm).toLocaleDateString("pt-BR"),
        ts: +new Date(s.criadoEm),
        duracao: typeof dur === "number" && dur > 0 ? `${dur} min` : undefined,
        pontuacao: Number(pts) || 0,
      };
    });

    const subsDesafio = await prisma.submissaoDesafio.findMany({
      where: { atletaId: atleta.id, aprovado: true as any },
      include: { desafio: true },
      orderBy: { createdAt: "desc" },
    });

    const historicoDesafios = subsDesafio.map((s) => ({
      tipo: "Desafio" as const,
      status: "Desafio Concluído",
      data: new Date(s.createdAt).toLocaleDateString("pt-BR"),
      ts: +new Date(s.createdAt),
      titulo: s.desafio?.titulo ?? "Desafio",
      pontuacao: Number(s.desafio?.pontuacao ?? 0),
    }));

    const historico = [...historicoTreinos, ...historicoDesafios]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 20)
      .map(({ ts, ...rest }) => rest);

    const performanceFromHistorico = historico.reduce(
      (acc, h) => acc + (Number((h as any).pontuacao) || 0),
      0
    );
    const disciplinaFromHistorico = historicoTreinos.length * 2;
    const responsabilidadeFromHistorico = historicoDesafios.length * 2;

    return res.json({
      performance: performanceFromHistorico,
      disciplina: disciplinaFromHistorico,
      responsabilidade: responsabilidadeFromHistorico,
      historico,
      videos: [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao montar pontuação" });
  }
}

export const getPerfilUsuarioMe = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.userId;
  if (!id) return res.status(401).json({ error: "Sem autenticação" });
  (req as any).params = { ...(req as any).params, id };
  return getPerfilUsuario(req as any, res);
};

export const getPontuacaoMe = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.userId;
  if (!id) return res.status(401).json({ error: "Sem autenticação" });
  (req as any).params = { id };
  return getPontuacaoDetalhada(req as any, res);
};

export const getAtividadesRecentesMe = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.userId;
  if (!id) return res.status(401).json({ error: "Sem autenticação" });
  (req as any).params = { id };
  return getAtividadesRecentes(req as any, res);
};

export const getBadgesMe = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.userId;
  if (!id) return res.status(401).json({ error: "Sem autenticação" });
  (req as any).params = { id };
  return getBadges(req as any, res);
};

export const getTreinosPorUsuario = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const treinos = await prisma.treinoRealizado.findMany({
      where: {
        usuarioId: id,
      },
      include: {
        treino: true,
      },
      orderBy: {
        dataExpiracao: "desc",
      },
    });

    const resultado = treinos.map((t: any) => ({
      titulo: t.treino?.nome || "Treino",
      dataExpiracao: t.dataExpiracao,
      local: t.local || "Local não informado",
    }));

    return res.json(resultado);
  } catch (err) {
    console.error("Erro ao buscar treinos:", err);
    return res.status(500).json({ message: "Erro ao buscar treinos." });
  }
};

export const getAtividadesRecentes = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.params.id;

  const atleta = await prisma.atleta.findUnique({
    where: { usuarioId: userId },
    select: { id: true },
  });
  if (!atleta) return res.json([]);

  const [subsTreino, subsDesafio] = await Promise.all([
    prisma.submissaoTreino.findMany({
      where: { atletaId: atleta.id, aprovado: true },
      include: { treinoAgendado: { include: { treinoProgramado: { include: { exercicios: true } } } } },
      orderBy: { criadoEm: "desc" },
      take: 10,
    }),
    prisma.submissaoDesafio.findMany({
      where: { atletaId: atleta.id, aprovado: true },
      include: { desafio: true },
      orderBy: { createdAt: "desc" }, 
      take: 10,
    }),
  ]);

  const itens = [
    ...subsTreino.map((s: any) => {
      const dur = s.duracaoMinutos ?? s.treinoAgendado?.treinoProgramado?.duracao ?? null;
      const pts =
        s.pontosCreditados ??
        s.pontuacaoSnapshot ??
        s.treinoAgendado?.treinoProgramado?.pontuacao ??
        s.treinoAgendado?.treinoProgramado?.exercicios?.length ??
        0;

      return {
        id: `t-${s.id}`,
        tipo: "Treino" as const,
        imagemUrl: s.treinoAgendado?.treinoProgramado?.imagemUrl ?? null,
        nome: s.treinoAgendado?.treinoProgramado?.nome ?? s.treinoAgendado?.titulo ?? "Treino",
        data: s.criadoEm,
        duracao: typeof dur === "number" && dur > 0 ? `${dur} min` : undefined,
        pontuacao: Number(pts) || 0,                   
        categoria: s.tipoTreinoSnapshot ??
                   s.treinoAgendado?.treinoProgramado?.tipoTreino ?? null,
      };
    }),
    ...subsDesafio.map((s: any) => ({
      id: `d-${s.id}`,
      tipo: "Desafio" as const,
      imagemUrl: s.desafio?.imagemUrl ?? s.videoUrl ?? null,
      nome: s.desafio?.titulo ?? "Desafio",
      data: s.createdAt,
      duracao: undefined,
      pontuacao: Number(s.desafio?.pontuacao ?? 0),   
    })),
  ]
    .sort((a, b) => +new Date(b.data as any) - +new Date(a.data as any))
    .slice(0, 10);

  return res.json(itens);
};

export const getBadges = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const badges = [
      { id: "1", nome: "Disciplina", icon: "stopwatch" },
      { id: "2", nome: "Pontualidade", icon: "bullseye" },
      { id: "3", nome: "Liderança", icon: "medal" },
    ];

    res.json(badges);
  } catch (err) {
    console.error("Erro ao buscar badges:", err);
    res.status(500).json({ error: "Erro ao buscar badges." });
  }
};

async function calcularPontuacaoBase(usuarioId: string) {
  const atleta = await prisma.atleta.findFirst({
    where: { usuarioId },
    select: { id: true },
  });
  if (!atleta) {
    return { performance: 0, disciplina: 0, responsabilidade: 0, subsTreino: [], subsDesafio: [] as any[] };
  }

  const [subsTreino, subsDesafio] = await Promise.all([
    prisma.submissaoTreino.findMany({
      where: { atletaId: atleta.id, aprovado: true as any },
      include: { treinoAgendado: { include: { treinoProgramado: true } } },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.submissaoDesafio.findMany({
      where: { atletaId: atleta.id, aprovado: true as any },
      include: { desafio: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const pontosTreinos = subsTreino.reduce((acc, s: any) => {
    const p = s?.pontosCreditados ?? s?.pontuacaoSnapshot ?? s?.treinoAgendado?.treinoProgramado?.pontuacao ?? 0;
    return acc + (Number(p) || 0);
  }, 0);

  const pontosDesafios = subsDesafio.reduce((acc, s: any) => {
    const p = s?.desafio?.pontuacao ?? 0;
    return acc + (Number(p) || 0);
  }, 0);

  const performance = pontosTreinos + pontosDesafios;
  const disciplina = subsTreino.length * 2;
  const responsabilidade = subsDesafio.length * 2;

  return { performance, disciplina, responsabilidade, subsTreino, subsDesafio };
}

export async function getPontuacaoPerfil(req: Request, res: Response) {
  const { usuarioId } = req.params as { usuarioId: string };

  try {
    const atleta = await prisma.atleta.findFirst({
      where: { usuarioId },
      select: { id: true },
    });
    if (!atleta) {
      return res.json({
        performance: 0,
        disciplina: 0,
        responsabilidade: 0,
        historico: [],
        videos: [],
      });
    }

    const subsTreino = await prisma.submissaoTreino.findMany({
      where: { atletaId: atleta.id, aprovado: true as any },
      include: {
        treinoAgendado: {
          include: {
            treinoProgramado: { include: { exercicios: true } },
          },
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    const agIds = Array.from(new Set(subsTreino.map((s) => s.treinoAgendadoId).filter(Boolean)));
    const agRows = agIds.length
      ? await prisma.treinoAgendado.findMany({
          where: { id: { in: agIds } },
          select: { id: true, treinoProgramado: { select: { pontuacao: true, exercicios: true, duracao: true, nome: true } } },
        })
      : [];
    const progPontuacaoMap = new Map<string, { pontuacao: number; exerciciosCount: number }>(
      agRows.map((r) => [r.id, { pontuacao: r.treinoProgramado?.pontuacao ?? 0, exerciciosCount: r.treinoProgramado?.exercicios?.length ?? 0 }])
    );

    const historicoTreinos = subsTreino.map((s: any) => {
      const fromCredit = Number(s.pontosCreditados ?? 0);
      const fromSnap = Number(s.pontuacaoSnapshot ?? 0);
      const fromIncludeProg = Number(s.treinoAgendado?.treinoProgramado?.pontuacao ?? 0);
      const fromIncludeExLen = Number(s.treinoAgendado?.treinoProgramado?.exercicios?.length ?? 0);
      const fromMap = s.treinoAgendadoId && progPontuacaoMap.has(s.treinoAgendadoId) ? progPontuacaoMap.get(s.treinoAgendadoId)!.pontuacao : 0;
      const fromMapEx = s.treinoAgendadoId && progPontuacaoMap.has(s.treinoAgendadoId) ? progPontuacaoMap.get(s.treinoAgendadoId)!.exerciciosCount : 0;

      const pontos =
        fromCredit > 0 ? fromCredit :
        fromSnap > 0 ? fromSnap :
        fromIncludeProg > 0 ? fromIncludeProg :
        fromMap > 0 ? fromMap :
        fromIncludeExLen > 0 ? fromIncludeExLen :
        fromMapEx > 0 ? fromMapEx : 0;

      const dur = s.duracaoMinutos ?? s.treinoAgendado?.treinoProgramado?.duracao ?? null;
      const titulo = s.treinoAgendado?.treinoProgramado?.nome ?? s.treinoAgendado?.titulo ?? "Treino";

      return {
        tipo: "Treino" as const,
        status: "Concluído",
        data: new Date(s.criadoEm ?? Date.now()).toLocaleDateString("pt-BR"),
        ts: +new Date(s.criadoEm ?? Date.now()),
        duracao: typeof dur === "number" && dur > 0 ? `${dur} min` : undefined,
        titulo,
        pontuacao: Number(pontos) || 0,
        };
    });

    const subsDesafio = await prisma.submissaoDesafio.findMany({
      where: { atletaId: atleta.id, aprovado: true as any },
      include: { desafio: true },
      orderBy: { createdAt: "desc" },
    });

    const historicoDesafios = subsDesafio.map((s: any) => ({
      tipo: "Desafio" as const,
      status: "Concluído",
      data: new Date(s.createdAt ?? Date.now()).toLocaleDateString("pt-BR"),
      ts: +new Date(s.createdAt ?? Date.now()),
      titulo: s.desafio?.titulo ?? "Desafio",
      pontuacao: Number(s.desafio?.pontuacao ?? 0),
    }));

    const historico = [...historicoTreinos, ...historicoDesafios]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 20)
      .map(({ ts, ...rest }) => rest);

    const performanceFromHistorico = historico.reduce((acc, h) => acc + (Number((h as any).pontuacao) || 0), 0);
    const disciplinaFromHistorico = historicoTreinos.length * 2;
    const responsabilidadeFromHistorico = historicoDesafios.length * 2;
    const postagensVideo = await prisma.postagem.findMany({
      where: { usuarioId, OR: [{ videoUrl: { not: null } }] },
      select: { videoUrl: true },
      orderBy: { dataCriacao: "desc" },
      take: 30,
    });
    const videos = postagensVideo.flatMap((p) => (p.videoUrl ? [p.videoUrl] : []));

    return res.json({
      performance: performanceFromHistorico,
      disciplina: disciplinaFromHistorico,
      responsabilidade: responsabilidadeFromHistorico,
      historico,
      videos,
    });
  } catch (err) {
    console.error("getPontuacaoPerfil error:", err);
    return res.status(500).json({ message: "Erro ao carregar pontuação." });
  }
}

export const getPerfilUsuario = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: { id: true, nome: true, email: true, foto: true },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    let dadosEspecificos = null;
    let tipoPerfil = null;

    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId: id },
      select: {
        id: true,
        nome: true, sobrenome: true, idade: true, cpf: true,
        telefone1: true, telefone2: true,
        nacionalidade: true, naturalidade: true,
        posicao: true, altura: true, peso: true,
        seloQualidade: true, foto: true,
      }
    });

    if (atleta) {
      dadosEspecificos = {
        atletaId: atleta.id,
        nome: atleta.nome,
        sobrenome: atleta.sobrenome,
        idade: atleta.idade,
        cpf: atleta.cpf,
        telefone1: atleta.telefone1,
        telefone2: atleta.telefone2,
        nacionalidade: atleta.nacionalidade,
        naturalidade: atleta.naturalidade,
        posicao: atleta.posicao,
        altura: atleta.altura,
        peso: atleta.peso,
        seloQualidade: atleta.seloQualidade,
        foto: atleta.foto,
      };
      tipoPerfil = "Atleta";
    }

    const professor = await prisma.professor.findUnique({ where: { usuarioId: id } });
    if (professor) {
      dadosEspecificos = {
        nome: professor.nome,
        codigo: professor.codigo,
        cref: professor.cref,
        areaFormacao: professor.areaFormacao,
        escola: professor.escola,
        qualificacoes: professor.qualificacoes,
        certificacoes: professor.certificacoes,
        foto: professor.fotoUrl,
      };
      tipoPerfil = "Professor";
    }

    const escolinha = await prisma.escolinha.findUnique({ where: { usuarioId: id } });
    if (escolinha) {
      dadosEspecificos = {
        nome: escolinha.nome,
        email: escolinha.email,
        cidade: escolinha.cidade,
        estado: escolinha.estado,
        pais: escolinha.pais,
        bairro: escolinha.bairro,
        telefone1: escolinha.telefone1,
        telefone2: escolinha.telefone2,
        logo: escolinha.logo,
        siteOficial: escolinha.siteOficial,
      };
      tipoPerfil = "Escolinha";
    }

    const clube = await prisma.clube.findUnique({ where: { usuarioId: id } });
    if (clube) {
      dadosEspecificos = {
        nome: clube.nome,
        email: clube.email,
        cidade: clube.cidade,
        estado: clube.estado,
        pais: clube.pais,
        bairro: clube.bairro,
        telefone1: clube.telefone1,
        telefone2: clube.telefone2,
        estadio: clube.estadio,
        logo: clube.logo,
        siteOficial: clube.siteOficial,
      };
      tipoPerfil = "Clube";
    }

    return res.json({
      tipo: tipoPerfil,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        foto: usuario.foto,
      },
      dadosEspecificos,
    });

  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const atualizarPerfil = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userIdFromToken = req.userId;

  if (!userIdFromToken || id !== userIdFromToken) {
    return res.status(403).json({ error: "Você só pode editar o seu próprio perfil." });
  }

  const { usuario, tipo, tipoUsuario } = req.body;

  if (!usuario || !tipoUsuario || !tipo) {
    return res.status(400).json({ error: "Dados incompletos." });
  }

  try {
   await prisma.usuario.update({
      where: { id },
      data: {
        nome: usuario.nome,
        email: usuario.email,
        foto: usuario.foto,
        cidade: usuario.cidade,
        estado: usuario.estado,
        pais: usuario.pais,
        bairro: usuario.bairro
      }
    });

    switch (tipoUsuario) {
      case "atleta":
        await prisma.atleta.update({
          where: { usuarioId: id },
          data: {
            nome: tipo.nome,
            sobrenome: tipo.sobrenome,
            idade: isNaN(parseInt(tipo.idade)) ? undefined : parseInt(tipo.idade),
            telefone1: tipo.telefone1,
            telefone2: tipo.telefone2,
            nacionalidade: tipo.nacionalidade,
            naturalidade: tipo.naturalidade,
            posicao: tipo.posicao,
            altura: isNaN(parseInt(tipo.altura)) ? undefined : parseInt(tipo.altura),
            peso: isNaN(parseInt(tipo.peso)) ? undefined : parseInt(tipo.peso),
            seloQualidade: tipo.seloQualidade,
            foto: usuario.foto
          }
        });
        break;

      case "professor":
        await prisma.professor.update({
          where: { usuarioId: id },
          data: {
            nome: tipo.nome,
            cref: tipo.cref,
            areaFormacao: tipo.areaFormacao,
            escola: tipo.escola,
            qualificacoes: Array.isArray(tipo.qualificacoes)
              ? tipo.qualificacoes
              : tipo.qualificacoes?.split(',').map((q: string) => q.trim()),
            certificacoes: Array.isArray(tipo.certificacoes)
              ? tipo.certificacoes
              : tipo.certificacoes?.split(',').map((c: string) => c.trim()),
            fotoUrl: usuario.foto
          }
        });
        break;

      case "clube":
        await prisma.clube.update({
          where: { usuarioId: id },
          data: {
            nome: tipo.nome,
            telefone1: tipo.telefone1,
            telefone2: tipo.telefone2,
            email: tipo.email,
            siteOficial: tipo.siteOficial,
            sede: tipo.sede,
            estadio: tipo.estadio,
            logradouro: tipo.logradouro,
            numero: tipo.numero,
            complemento: tipo.complemento,
            bairro: tipo.bairro,
            cidade: tipo.cidade,
            estado: tipo.estado,
            pais: tipo.pais,
            cep: tipo.cep,
            logo: usuario.foto
          }
        });
        break;

      case "escola":
        await prisma.escolinha.update({
          where: { usuarioId: id },
          data: {
            nome: tipo.nome,
            telefone1: tipo.telefone1,
            telefone2: tipo.telefone2,
            email: tipo.email,
            siteOficial: tipo.siteOficial,
            sede: tipo.sede,
            logradouro: tipo.logradouro,
            numero: tipo.numero,
            complemento: tipo.complemento,
            bairro: tipo.bairro,
            cidade: tipo.cidade,
            estado: tipo.estado,
            pais: tipo.pais,
            cep: tipo.cep,
            logo: usuario.foto
          }
        });
        break;

      default:
        return res.status(400).json({ error: "Tipo de usuário inválido." });
    }

    return res.status(200).json({ message: "Perfil atualizado com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    return res.status(500).json({ error: "Erro interno ao atualizar perfil." });
  }
};

export const getProgressoTreinos = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId: id },
      include: {
        treinosRecebidos: {
          include: {
            treino: {
              include: {
                exercicios: {
                  include: { exercicio: true }
                }
              }
            }
          }
        }
      }
    });

    if (!atleta) {
      return res.status(404).json({ error: "Atleta não encontrado" });
    }

    const categoriaContagem: Record<string, number> = {
      fisico: 0,
      tecnico: 0,
      tatico: 0,
      mental: 0,
    };

    const desafiosCompletos = await prisma.submissaoDesafio.count({
      where: {
        atletaId: atleta.id,
        aprovado: true,
      },
    });

    const pontuacao = await prisma.pontuacaoAtleta.findUnique({
      where: { atletaId: atleta.id }
    });

    const pontosConquistados = pontuacao
      ? pontuacao.pontuacaoDisciplina + pontuacao.pontuacaoPerformance + pontuacao.pontuacaoResponsabilidade
      : 0;

    for (const recebido of atleta.treinosRecebidos) {
      for (const ex of recebido.treino.exercicios) {
        const categorias = ex.exercicio?.categorias || [];

        for (const cat of categorias) {
          const catLower = cat.toLowerCase();
          if (categoriaContagem[catLower] !== undefined) {
            categoriaContagem[catLower]++;
          }
        }
      }
    }

    return res.json({
      ...categoriaContagem,
      totalTreinos: atleta.treinosRecebidos.length,
      horasTreinadas: Number((atleta.treinosRecebidos.length * 0.5).toFixed(1)), 
      desafiosCompletos,
      pontosConquistados
    });
  } catch (err) {
    console.error("Erro ao buscar progresso dos treinos:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export const getTreinosResumo = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.params.id;

  const atleta = await prisma.atleta.findUnique({
    where: { usuarioId: userId },
    select: { id: true },
  });
  if (!atleta) return res.status(404).json({ error: "Atleta não encontrado" });

  const [subsTreino, desafios] = await Promise.all([
    prisma.submissaoTreino.findMany({
      where: { atletaId: atleta.id, aprovado: true },
      include: { treinoAgendado: { include: { treinoProgramado: true } } },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.submissaoDesafio.count({
      where: { atletaId: atleta.id, aprovado: true },
    }),
  ]);

  const completos = subsTreino.length;

  let minutos = 0;
  const categorias = { Fisico: 0, Tecnico: 0, Tatico: 0, Mental: 0 };

  for (const s of subsTreino as any[]) {
    minutos += Number(s.duracaoMinutos ?? s.treinoAgendado?.treinoProgramado?.duracao ?? 0) || 0;

    const raw =
      s.tipoTreinoSnapshot ??
      s.treinoAgendado?.treinoProgramado?.tipoTreino ??
      "";

    const norm = String(raw).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    if (norm.startsWith("fis")) categorias.Fisico++;
    else if (norm.startsWith("tec")) categorias.Tecnico++;
    else if (norm.startsWith("tat")) categorias.Tatico++;
    else if (norm.startsWith("men")) categorias.Mental++;
  }

  const horas = +(minutos / 60).toFixed(1);

  return res.json({
    completos,
    horas,
    desafios,
    categorias,
  });
};

export const getPosicaoAtualAtleta = async (req: AuthenticatedRequest, res: Response) => {
  const usuarioId = req.params?.id || req.userId;

  if (!usuarioId) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  try {
    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId },
      select: { id: true, posicao: true },
    });

    if (!atleta) {
      return res.status(404).json({ error: "Atleta não encontrado para este usuário." });
    }

    const vinculoMaisRecente = await prisma.atletaElenco.findFirst({
      where: { atletaId: atleta.id, elenco: { ativo: true } },
      include: {
        elenco: { select: { id: true, nome: true, ativo: true, dataCriacao: true } },
      },
      orderBy: [
        { elenco: { dataCriacao: "desc" } },
        { updatedAt: "desc" }, 
      ],           
    });

    if (vinculoMaisRecente && vinculoMaisRecente.posicao) {
      return res.json({
        origem: "elenco" as const,
        posicao: vinculoMaisRecente.posicao,
        atletaId: atleta.id,
        usuarioId,
        elenco: vinculoMaisRecente.elenco
          ? {
              id: vinculoMaisRecente.elenco.id,
              nome: vinculoMaisRecente.elenco.nome,
              ativo: vinculoMaisRecente.elenco.ativo,
            }
          : undefined,
        numeroCamisa: vinculoMaisRecente.numeroCamisa ?? null,
        updatedAt: vinculoMaisRecente.updatedAt?.toISOString?.() ?? null,
      });
    }

    return res.json({
      origem: "atleta" as const,
      posicao: (atleta.posicao as PosicaoCampo) ?? null,
      atletaId: atleta.id,
      usuarioId,
    });
  } catch (error) {
    console.error("Erro ao obter posição atual do atleta:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// PAGINA DE PERFIL TIPOS

export async function getPerfilProfessor(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const prof = await resolveByUsuarioOrEntity({
      entity: "professor",
      usuarioOrEntityId: id,
      select: {
        id: true,
        usuarioId: true,
        nome: true,
        codigo: true,
        cref: true,
        areaFormacao: true,
        escola: true,
        qualificacoes: true,
        certificacoes: true,
        fotoUrl: true,
        statusCref: true,
        usuario: { select: { id: true, nome: true, email: true, foto: true } },
        treinosProgramados: { select: { id: true } },
        relacoesTreinamento: { select: { id: true } },
      },
    });

  if (!prof) return res.status(404).json({ error: "Professor não encontrado" });

  // 🔒 Narrowing seguro para o usuário relacionado
  const usuarioMin: { id: string; nome: string; email: string; foto?: string | null } | null =
    (prof as any).usuario ?? null;

  // Foto prioriza foto do tipo e cai para a foto do usuário
  const fotoPerfil: string | null =
    (prof as any).fotoUrl ?? (usuarioMin?.foto ?? null);

  return res.json({
    tipo: "Professor" as const,
    usuario: usuarioMin,
    professor: {
      id: prof.id,
      usuarioId: prof.usuarioId,
      nome: prof.nome,
      codigo: prof.codigo,
      cref: prof.cref,
      areaFormacao: prof.areaFormacao,
      escola: prof.escola,
      qualificacoes: prof.qualificacoes ?? [],
      certificacoes: prof.certificacoes ?? [],
      fotoUrl: fotoPerfil,
      statusCref: prof.statusCref ?? null,
    },
    metrics: {
      treinosProgramados: (prof as any).treinosProgramados?.length ?? 0,
      alunosRelacionados: (prof as any).relacoesTreinamento?.length ?? 0,
    },
  });

  } catch (e) {
    console.error("getPerfilProfessor error:", e);
    return res.status(500).json({ error: "Erro interno ao buscar professor" });
  }
}

export async function getPerfilClube(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const clube = await resolveByUsuarioOrEntity({
      entity: "clube",
      usuarioOrEntityId: id,
      select: {
        id: true,
        usuarioId: true,
        usuario: { select: { id: true, nome: true, email: true, foto: true } },
        nome: true,
        cnpj: true,
        telefone1: true,
        telefone2: true,
        email: true,
        siteOficial: true,
        sede: true,
        estadio: true,
        logradouro: true,
        numero: true,
        complemento: true,
        bairro: true,
        cidade: true,
        estado: true,
        pais: true,
        cep: true,
        logo: true,
        dataCriacao: true,
        atletas: { select: { id: true } },
        treinoProgramado: { select: { id: true } },
        postagens: { select: { id: true } },
      },
    });

  if (!clube) return res.status(404).json({ error: "Clube não encontrado" });

  const usuarioMin: { id: string; nome: string; email: string; foto?: string | null } | null =
    (clube as any).usuario ?? null;

  const logoOuFoto: string | null =
    (clube as any).logo ?? (usuarioMin?.foto ?? null);

  return res.json({
    tipo: "Clube" as const,
    usuario: usuarioMin,
    clube: {
      id: clube.id,
      usuarioId: clube.usuarioId,
      nome: clube.nome,
      cnpj: clube.cnpj,
      telefone1: clube.telefone1,
      telefone2: clube.telefone2,
      email: clube.email,
      siteOficial: clube.siteOficial,
      sede: clube.sede,
      estadio: clube.estadio,
      logradouro: clube.logradouro,
      numero: clube.numero,
      complemento: clube.complemento,
      bairro: clube.bairro,
      cidade: clube.cidade,
      estado: clube.estado,
      pais: clube.pais,
      cep: clube.cep,
      logo: logoOuFoto,
      dataCriacao: clube.dataCriacao,
    },
    metrics: {
      atletas: (clube as any).atletas?.length ?? 0,
      treinosProgramados: (clube as any).treinoProgramado?.length ?? 0,
      postagens: (clube as any).postagens?.length ?? 0,
    },
  });

  } catch (e) {
    console.error("getPerfilClube error:", e);
    return res.status(500).json({ error: "Erro interno ao buscar clube" });
  }
}

export async function getPerfilEscola(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const escola = await resolveByUsuarioOrEntity({
      entity: "escolinha",
      usuarioOrEntityId: id,
      select: {
        id: true,
        usuarioId: true,
        usuario: { select: { id: true, nome: true, email: true, foto: true } },
        nome: true,
        cnpj: true,
        telefone1: true,
        telefone2: true,
        email: true,
        siteOficial: true,
        sede: true,
        logradouro: true,
        numero: true,
        complemento: true,
        bairro: true,
        cidade: true,
        estado: true,
        pais: true,
        cep: true,
        logo: true,
        dataCriacao: true,
        atletas: { select: { id: true } },
        treinoProgramado: { select: { id: true } },
        postagens: { select: { id: true } },
      },
    });

  if (!escola) return res.status(404).json({ error: "Escolinha não encontrada" });

  const usuarioMin: { id: string; nome: string; email: string; foto?: string | null } | null =
    (escola as any).usuario ?? null;

  const logoOuFoto: string | null =
    (escola as any).logo ?? (usuarioMin?.foto ?? null);

  return res.json({
    tipo: "Escolinha" as const,
    usuario: usuarioMin,
    escolinha: {
      id: escola.id,
      usuarioId: escola.usuarioId,
      nome: escola.nome,
      cnpj: escola.cnpj,
      telefone1: escola.telefone1,
      telefone2: escola.telefone2,
      email: escola.email,
      siteOficial: escola.siteOficial,
      sede: escola.sede,
      logradouro: escola.logradouro,
      numero: escola.numero,
      complemento: escola.complemento,
      bairro: escola.bairro,
      cidade: escola.cidade,
      estado: escola.estado,
      pais: escola.pais,
      cep: escola.cep,
      logo: logoOuFoto,
      dataCriacao: escola.dataCriacao,
    },
    metrics: {
      atletas: (escola as any).atletas?.length ?? 0,
      treinosProgramados: (escola as any).treinoProgramado?.length ?? 0,
      postagens: (escola as any).postagens?.length ?? 0,
    },
  });

  } catch (e) {
    console.error("getPerfilEscola error:", e);
    return res.status(500).json({ error: "Erro interno ao buscar escolinha" });
  }
}