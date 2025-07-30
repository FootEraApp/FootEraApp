import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "server/middlewares/auth";

const prisma = new PrismaClient();

export const getAtividadesRecentes = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const atividades = await prisma.atividadeRecente.findMany({
      where: { usuarioId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        tipo: true,
        imagemUrl: true,
      },
    });

    const formatted = atividades.map((a: { id: string; tipo: string; imagemUrl: string | null }) => ({
      id: a.id,
      type: a.tipo,
      imageUrl: a.imagemUrl || null,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Erro ao buscar atividades:", err);
    res.status(500).json({ error: "Erro ao buscar atividades recentes." });
  }
};

export const getBadges = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const badges = [
      { id: "1", name: "Disciplina", icon: "stopwatch" },
      { id: "2", name: "Pontualidade", icon: "bullseye" },
      { id: "3", name: "Liderança", icon: "medal" },
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
    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId: id },
      include: { pontuacao: true },
    });

    if (!atleta || !atleta.pontuacao) {
      return res.status(404).json({
        performance: 0,
        discipline: 0,
        responsibility: 0,
      });
    }

    const { pontuacaoPerformance, pontuacaoDisciplina, pontuacaoResponsabilidade } = atleta.pontuacao;

    res.json({
      performance: pontuacaoPerformance,
      discipline: pontuacaoDisciplina,
      responsibility: pontuacaoResponsabilidade,
    });
  } catch (err) {
    console.error("Erro ao buscar pontuação:", err);
    res.status(500).json({ error: "Erro ao buscar pontuação." });
  }
};

export const getPontuacaoDetalhada = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) return res.status(404).json({ message: "Usuário não encontrado." });

    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId: id },
    });

    if (!atleta) return res.status(404).json({ message: "Atleta não encontrado." });

    const pontuacao = await prisma.pontuacaoAtleta.findUnique({
      where: { atletaId: atleta.id },
    });

    const historicoDesafios = await prisma.submissaoDesafio.findMany({
      where: { atletaId: atleta.id },
      include: {
        desafio: true,
      }
    });

    const historicoTreinos = await prisma.submissaoTreino.findMany({
      where: { atletaId: atleta.id },
      include: {
        treinoAgendado: {
          include: { treinoProgramado: true }
        }
      }
    });

    const videos = historicoDesafios.map(d => d.videoUrl).filter(Boolean);

    const historico = [
      ...historicoDesafios.map(d => ({
        tipo: "Desafio",
        status: d.aprovado ? "Aprovado" : "Pendente",
        data: d.createdAt.toLocaleDateString(),
        duracao: "N/A"
      })),
      ...historicoTreinos.map(t => ({
        tipo: "Treino",
        status: t.aprovado ? "Concluído" : "Pendente",
        data: t.createdAt.toLocaleDateString(),
        duracao: "N/A"
      })),
    ];

    return res.json({
      performance: pontuacao?.pontuacaoPerformance || 0,
      disciplina: pontuacao?.pontuacaoDisciplina || 0,
      responsabilidade: pontuacao?.pontuacaoResponsabilidade || 0,
      historico,
      videos,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao buscar pontuação detalhada." });
  }
};

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
            idade: tipo.idade,
            telefone1: tipo.telefone1,
            telefone2: tipo.telefone2,
            nacionalidade: tipo.nacionalidade,
            naturalidade: tipo.naturalidade,
            posicao: tipo.posicao,
            altura: tipo.altura,
            peso: tipo.peso,
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
