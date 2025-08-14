import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "server/middlewares/auth";

const prisma = new PrismaClient();

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
  return getPontuacao(req as any, res);
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
        dataHora: "desc",
      },
    });

    const resultado = treinos.map((t: any) => ({
      titulo: t.treino?.nome || "Treino",
      dataHora: t.dataHora,
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

  const atividades = await prisma.atividadeRecente.findMany({
    where: { usuarioId: userId },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  const enriched = await Promise.all(atividades.map(async (a) => {
    let nome = "";
    if (a.tipo === "Treino") {
      const treino = await prisma.treinoProgramado.findFirst({
        where: { treinoAgendado: { some: { atleta: { usuarioId: userId } } } }
      });
      nome = treino?.nome || "Treino";
    } else if (a.tipo === "Desafio") {
      const desafio = await prisma.desafioOficial.findFirst({
        where: { imagemUrl: a.imagemUrl }
      });
      nome = desafio?.titulo || "Desafio";
    }

    return {
      id: a.id,
      tipo: a.tipo,
      imagemUrl: a.imagemUrl || "",
      nome
    };
  }));

  return res.json(enriched);
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

export const getPontuacao = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: { tipo: true }
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    if (usuario.tipo !== "Atleta") {
      return res.json({
        performance: 0,
        disciplina: 0,
        responsabilidade: 0,
      }); 
    }

    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId: id },
      include: { pontuacao: true }
    });

     if (!atleta || !atleta.pontuacao) {
      return res.json({
        performance: 0,
        disciplina: 0,
        responsabilidade: 0,
      });
    }

    return res.json({
      performance: atleta.pontuacao.pontuacaoPerformance,
      disciplina: atleta.pontuacao.pontuacaoDisciplina,
      responsabilidade: atleta.pontuacao.pontuacaoResponsabilidade,
    });
  } catch (err) {
    console.error("Erro ao buscar pontuação:", err);
    return res.status(500).json({ message: "Erro interno no servidor." });
  }
};

export async function getPontuacaoPerfil(req: Request, res: Response) {
  const { usuarioId } = req.params as { usuarioId: string };

  try {
    const atleta = await prisma.atleta.findFirst({
      where: { usuarioId },
      select: { id: true, usuarioId: true },
    });

    if (!atleta) {
      return res.status(404).json({ message: "Atleta não encontrado." });
    }

    const atletaId = atleta.id;

    const submissoesTreino = await prisma.submissaoTreino?.findMany({
      where: { atletaId, aprovado: true as any }, 
      include: {
        treinoAgendado: {
          include: {
            treinoProgramado: true,
          },
        },
      },
      orderBy: { criadoEm: "desc" },
    }).catch(() => [] as any[]);

    const submissoesDesafio = await prisma.submissaoDesafio?.findMany({
      where: { atletaId, aprovado: true as any },
      include: {
        desafio: true,
      },
    }).catch(() => [] as any[]);

      const pontosTreinos = (submissoesTreino || []).reduce((acc, s: any) => {
      const p = s?.treinoAgendado?.treinoProgramado?.pontuacao ?? 0;
      return acc + (Number(p) || 0);
    }, 0);

    const pontosDesafios = (submissoesDesafio || []).reduce((acc, s: any) => {
      const p = s?.desafio?.pontos ?? s?.desafio?.pontuacao ?? 0;
      return acc + (Number(p) || 0);
    }, 0);

    const performance = pontosTreinos + pontosDesafios;
    const disciplina = (submissoesTreino?.length || 0) * 2;
    const responsabilidade = (submissoesDesafio?.length || 0) * 2; 

    const historicoTreinos = (submissoesTreino || []).map((s: any) => ({
      tipo: "Treino",
      status: s.aprovado ? "Concluído" : "Pendente",
      data: new Date(s.criadoEm ?? s.dataCriacao ?? Date.now()).toLocaleDateString("pt-BR"),
      duracao: s.duracaoMinutos ? `${s.duracaoMinutos} min` : undefined,
      titulo: s?.treinoAgendado?.treinoProgramado?.nome ?? s?.treinoAgendado?.titulo ?? "Treino",
      pontos: s?.treinoAgendado?.treinoProgramado?.pontuacao ?? 0,
    }));

    const historicoDesafios = (submissoesDesafio || []).map((s: any) => ({
      tipo: "Desafio",
      status: "Concluído",
      data: new Date(s.criadoEm ?? s.dataCriacao ?? Date.now()).toLocaleDateString("pt-BR"),
      duracao: s.duracaoMinutos ? `${s.duracaoMinutos} min` : undefined,
      titulo: s?.desafio?.titulo ?? "Desafio",
      pontos: s?.desafio?.pontos ?? s?.desafio?.pontuacao ?? 0,
    }));

    const historico = [...historicoTreinos, ...historicoDesafios]

      .sort((a, b) => (a.data > b.data ? -1 : 1))
      .slice(0, 20);
    const postagensVideo = await prisma.postagem?.findMany({
      where: {
        usuarioId,
        OR: [
          { videoUrl: { not: null } },
          ],
      },
      select: { videoUrl: true },
      orderBy: { dataCriacao: "desc" },
      take: 30,
    }).catch(() => [] as any[]);

    const videos = (postagensVideo || []).flatMap((p: any) => {
      const list: string[] = [];
      if (p.videoUrl) list.push(p.videoUrl);
      return list;
    });

    return res.json({
      performance,
      disciplina,
      responsabilidade,
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
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    let dadosEspecificos = null;
    let tipoPerfil = null;

    const atleta = await prisma.atleta.findUnique({ where: { usuarioId: id } });
    if (atleta) {
      dadosEspecificos = {
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

  const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
  if (!usuario) return res.status(404).json({ error: "Usuário não encontrado" });

  const atleta = await prisma.atleta.findUnique({
    where: { usuarioId: userId },
    include: {
      SubmissaoTreino: {
        include: {
          treinoAgendado: {
            include: { treinoProgramado: true },
          },
        },
      },
     submissoesDesafio: {
        include: { desafio: true },
      },
    },
  });

  if (!atleta) return res.status(404).json({ error: "Atleta não encontrado" });

  const completos = atleta.SubmissaoTreino.length;

  const minutos = atleta.SubmissaoTreino.reduce((total, sub) => {
    const m =
      (sub as any).duracaoMinutos ??
      sub.treinoAgendado?.treinoProgramado?.duracao ??
      60; 
    return total + Number(m || 0);
  }, 0);
  const horas = Number((minutos / 60).toFixed(1));

  const desafios = atleta.submissoesDesafio.length;
  const pontos = atleta.submissoesDesafio.reduce((total, sub) => {
    const p = sub.desafio?.pontuacao ?? sub.desafio?.pontuacao ?? 0;
    return total + Number(p || 0);
  }, 0);

  const categorias: Record<"Fisico" | "Tecnico" | "Tatico" | "Mental", number> = {
    Fisico: 0,
    Tecnico: 0,
    Tatico: 0,
    Mental: 0,
  };

  for (const sub of atleta.SubmissaoTreino) {
    const tipo = sub.treinoAgendado?.treinoProgramado?.tipoTreino as string | undefined;
    switch (tipo) {
      case "Físico":  
        categorias.Fisico++;
        break;
      case "Tecnico":
        categorias.Tecnico++;
        break;
      case "Tatico":
        categorias.Tatico++;
        break;
      case "Mental":
        categorias.Mental++;
        break;
      default:
        break;
    }
  }

  return res.json({ completos, horas, desafios, pontos, categorias });
};
