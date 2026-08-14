import type { Request, Response } from "express";
import { PrismaClient, CreatorTipo, CreatorVendaStatus } from "@prisma/client";
import { avaliarPrivacidadePerfil } from "../utils/privacy.js";

const prisma = new PrismaClient();

function getAuthUserId(req: Request): string | null {
  const anyReq = req as any;
  return (
    anyReq.user?.id ||
    anyReq.user?.userId ||
    anyReq.usuario?.id ||
    anyReq.usuarioId ||
    req.headers["x-user-id"]?.toString() ||
    null
  );
}

function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function initials(name?: string | null) {
  if (!name) return "CR";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

async function findCreatorByUsuarioId(usuarioId: string) {
  return prisma.creator.findUnique({
    where: { usuarioId },
    include: { usuario: true },
  });
}

function resolverTipoCreator(tipoUsuario?: string | null) {
  const tipo = normalizarTipoUsuario(tipoUsuario);

  if (["clube", "escolinha", "escola", "federacao", "marca"].includes(tipo)) {
    return CreatorTipo.INSTITUCIONAL;
  }

  return CreatorTipo.PESSOA_FISICA;
}

function normalizarTipoUsuario(tipoUsuario?: string | null) {
  return String(tipoUsuario || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function podeSerCreator(tipoUsuario?: string | null) {
  const tipo = normalizarTipoUsuario(tipoUsuario);

  return [
    "professor",
    "olheiro",
    "clube",
    "escolinha",
    "federacao",
    "marca",
  ].includes(tipo);
}

export const ativarCreator = async (req: Request, res: Response) => {
  try {
    const usuarioId = getAuthUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Usuário não autenticado." });

    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) return res.status(404).json({ message: "Usuário não encontrado." });

    if (!podeSerCreator(usuario.tipo)) {
        return res.status(403).json({
            message: "Atletas não podem ativar perfil Creator.",
        });
    }
    const body = req.body ?? {};

    const tipoCreatorFinal =
        body.tipo === "INSTITUCIONAL" || body.tipo === "PESSOA_FISICA"
            ? body.tipo
            : resolverTipoCreator(usuario.tipo);

    const creator = await prisma.creator.upsert({
      where: { usuarioId },
      update: {
        ativo: true,
        nomePublico: body.nomePublico ?? usuario.nome,
        headline: body.headline ?? undefined,
        bio: body.bio ?? undefined,
        nicho: body.nicho ?? undefined,
        avatarUrl: body.avatarUrl ?? usuario.foto ?? undefined,
        bannerUrl: body.bannerUrl ?? undefined,
        siteUrl: body.siteUrl ?? undefined,
        instagramUrl: body.instagramUrl ?? undefined,
        youtubeUrl: body.youtubeUrl ?? undefined,
        tipo: tipoCreatorFinal,
      },
      create: {
        usuarioId,
        nomePublico: body.nomePublico ?? usuario.nome,
        headline: body.headline ?? "Creator FootEra",
        bio: body.bio ?? null,
        nicho: body.nicho ?? null,
        avatarUrl: body.avatarUrl ?? usuario.foto ?? null,
        bannerUrl: body.bannerUrl ?? null,
        siteUrl: body.siteUrl ?? null,
        instagramUrl: body.instagramUrl ?? null,
        youtubeUrl: body.youtubeUrl ?? null,
        tipo: tipoCreatorFinal,
      },
      include: { usuario: true },
    });

    return res.json({ ok: true, creator });
  } catch (error) {
    console.error("[creatorController.ativarCreator]", error);
    return res.status(500).json({ message: "Erro ao ativar Creator." });
  }
};

export const getMeuCreator = async (req: Request, res: Response) => {
  try {
    const usuarioId = getAuthUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Usuário não autenticado." });

    const creator = await findCreatorByUsuarioId(usuarioId);

    return res.json({
      ok: true,
      creator,
      isCreator: !!creator?.ativo,
    });
  } catch (error) {
    console.error("[creatorController.getMeuCreator]", error);
    return res.status(500).json({ message: "Erro ao buscar Creator." });
  }
};

export const atualizarCreator = async (req: Request, res: Response) => {
  try {
    const usuarioId = getAuthUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Usuário não autenticado." });

    const creator = await prisma.creator.findUnique({ where: { usuarioId } });
    if (!creator) return res.status(404).json({ message: "Creator ainda não ativado." });

    const body = req.body ?? {};

    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) return res.status(404).json({ message: "Usuário não encontrado." });

    if (!podeSerCreator(usuario.tipo)) {
        return res.status(403).json({
            message: "Atletas não podem usar perfil Creator.",
        });
    }
    const tipoCreatorFinal =
        body.tipo === "INSTITUCIONAL" || body.tipo === "PESSOA_FISICA"
            ? body.tipo
            : resolverTipoCreator(usuario.tipo);
            
    const atualizado = await prisma.creator.update({
      where: { usuarioId },
      data: {
        nomePublico: body.nomePublico,
        headline: body.headline,
        bio: body.bio,
        nicho: body.nicho,
        avatarUrl: body.avatarUrl,
        bannerUrl: body.bannerUrl,
        siteUrl: body.siteUrl,
        instagramUrl: body.instagramUrl,
        youtubeUrl: body.youtubeUrl,
        tipo: tipoCreatorFinal,
      },
      include: { usuario: true },
    });

    return res.json({ ok: true, creator: atualizado });
  } catch (error) {
    console.error("[creatorController.atualizarCreator]", error);
    return res.status(500).json({ message: "Erro ao atualizar Creator." });
  }
};

export const getPerfilPublicoCreator = async (req: Request, res: Response) => {
  try {
    const { usuarioId } = req.params;

    const creator = await prisma.creator.findUnique({
      where: { usuarioId },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            nomeDeUsuario: true,
            email: true,
            foto: true,
            verified: true,
            tipo: true,
            configuracoesPrivacidade: true,
            cep: true,
            pais: true,
            estado: true,
            cidade: true,
            logradouro: true,
            cpf: true,
            clube: true,
            professor: true,
            escolinha: true,
            atleta: true,
            marca: true,
            federacao: true,
            olheiro: true,
            learningProfile: true,
          },
        },
      },
    });

    if (!creator || !creator.ativo) {
      return res.status(404).json({ message: "Creator não encontrado." });
    }

    if (!podeSerCreator(creator.usuario.tipo)) {
        return res.status(404).json({
            message: "Creator não encontrado.",
        });
    }

    const viewerId = (req as any)?.userId
      ? String((req as any).userId)
      : null;

    const acesso = await avaliarPrivacidadePerfil(
      viewerId,
      usuarioId
    );

    if (!acesso.podeVerPerfil) {
      return res.status(403).json({
        code: "PROFILE_PRIVATE",
        message: "Este perfil está privado.",
      });
    }

    const configuracoesPrivacidade =
      (creator.usuario as any)
        .configuracoesPrivacidade;

    const mostrarEmailNoPerfil =
      configuracoesPrivacidade &&
      typeof configuracoesPrivacidade === "object"
        ? configuracoesPrivacidade
            .mostrarEmail === true
        : false;

    const [
      metodologias,
      avulsas,
      aulasAoVivo,
      vendasConfirmadas,
      totalAlunos,
      seguidores,
    ] = await Promise.all([
      prisma.metodologia.findMany({
        where: { criadorUsuarioId: usuarioId, ativo: true },
        orderBy: { criadoEm: "desc" },
        take: 12,
        select: {
            id: true,
            titulo: true,
            descricao: true,
            capaUrl: true,
            mediaAvaliacao: true,
            totalReviews: true,
            publicoAlvo: true,
            estruturaTipo: true,
            geraCertificado: true,
            geraBadge: true,
            criadoEm: true,
            _count: {
                select: {
                assinantes: true,
                },
            },
        },
      }),
      prisma.metodologiaAvulsa.findMany({
        where: { criadorUsuarioId: usuarioId, ativo: true },
        orderBy: { criadoEm: "desc" },
        take: 12,
        select: {
          id: true,
          titulo: true,
          descricao: true,
          capaUrl: true,
          mediaAvaliacao: true,
          totalReviews: true,
          precoAssinaturaMensal: true,
          publicoAlvo: true,
          estruturaTipo: true,
          geraCertificado: true,
          geraBadge: true,
          criadoEm: true,
          _count: {
            select: {
              assinantes: true,
            },
          },
        },
      }),
      prisma.aulaAoVivo.findMany({
        where: {
          OR: [
            { criadorUsuarioId: usuarioId },
            { metodologia: { criadorUsuarioId: usuarioId } },
            { metodologiaAvulsa: { criadorUsuarioId: usuarioId } },
          ],
          status: {
            in: ["AGENDADA", "AO_VIVO", "FINALIZADA"],
          },
        },
        orderBy: {
          dataInicio: "asc",
        },
        take: 20,
        select: {
          id: true,
          titulo: true,
          descricao: true,
          dataInicio: true,
          dataFim: true,
          status: true,
          thumbUrl: true,
          replayDisponivel: true,
          gravacaoAtiva: true,
          totalParticipantes: true,

          metodologiaId: true,
          metodologiaAvulsaId: true,
          itemId: true,
          itemAvulsaId: true,
          estruturaId: true,
          estruturaAvulsaId: true,

          convidadoUsuarioId: true,
          convidadoNome: true,
          convidadoDescricao: true,

          convidadoUsuario: {
            select: {
              id: true,
              nome: true,
              nomeDeUsuario: true,
              email: true,
              foto: true,
              tipo: true,
            },
          },

          convidados: {
            orderBy: {
              ordem: "asc",
            },
            include: {
              usuario: {
                select: {
                  id: true,
                  nome: true,
                  nomeDeUsuario: true,
                  email: true,
                  foto: true,
                  tipo: true,
                },
              },
            },
          },

          metodologia: {
            select: {
              id: true,
              titulo: true,
              capaUrl: true,
              criadorUsuarioId: true,
            },
          },

          metodologiaAvulsa: {
            select: {
              id: true,
              titulo: true,
              capaUrl: true,
              criadorUsuarioId: true,
            },
          },
        },
      }),
      prisma.creatorVenda.findMany({
        where: {
          creatorId: creator.id,
          status: CreatorVendaStatus.CONFIRMADA,
        },
        select: {
          valorBruto: true,
          valorCreator: true,
          valorFootera: true,
        },
      }),
      prisma.metodologiaAssinante.count({
        where: {
          OR: [
            { metodologia: { criadorUsuarioId: usuarioId } },
            { metodologiaAvulsa: { criadorUsuarioId: usuarioId } },
          ],
        },
      }),
      prisma.seguidor.count({
        where: { seguidoUsuarioId: usuarioId },
      }).catch(() => 0),
    ]);

    const receitaBruta = vendasConfirmadas.reduce((acc, v) => acc + toNumber(v.valorBruto), 0);
    const ganhoCreator = vendasConfirmadas.reduce((acc, v) => acc + toNumber(v.valorCreator), 0);

    const tipoCorrigido = resolverTipoCreator(creator.usuario.tipo);

    if (creator.tipo !== tipoCorrigido) {
        await prisma.creator.update({
            where: { id: creator.id },
            data: { tipo: tipoCorrigido },
        });

        creator.tipo = tipoCorrigido;
    }

    const ocultarEmailEntidade = (
      entidade: any
    ) => {
      if (!entidade) return entidade;

      return {
        ...entidade,

        ...(Object.prototype.hasOwnProperty.call(
          entidade,
          "email"
        )
          ? {
              email:
                acesso.podeMostrarEmail
                  ? entidade.email
                  : null,
            }
          : {}),

        ...(Object.prototype.hasOwnProperty.call(
          entidade,
          "emailPublico"
        )
          ? {
              emailPublico:
                acesso.podeMostrarEmail
                  ? entidade.emailPublico
                  : null,
            }
          : {}),
      };
    };

    const {
      cpf: _cpf,
      cep: _cep,
      logradouro: _logradouro,
      ...usuarioBase
    } = creator.usuario as any;

    const sanitizarEmailEntidade = (
      entidade: any
    ) => {
      if (!entidade) {
        return entidade;
      }

      const copia = {
        ...entidade,
      };

      if ("email" in copia) {
        copia.email =
          mostrarEmailNoPerfil
            ? copia.email
            : null;
      }

      if ("emailPublico" in copia) {
        copia.emailPublico =
          mostrarEmailNoPerfil
            ? copia.emailPublico
            : null;
      }

      return copia;
    };

    const usuarioPublico: any = {
      ...creator.usuario,

      email: mostrarEmailNoPerfil
        ? creator.usuario.email
        : null,

      marca: sanitizarEmailEntidade(
        (creator.usuario as any).marca
      ),

      federacao: sanitizarEmailEntidade(
        (creator.usuario as any).federacao
      ),

      clube: sanitizarEmailEntidade(
        (creator.usuario as any).clube
      ),

      escolinha: sanitizarEmailEntidade(
        (creator.usuario as any).escolinha
      ),

      professor: sanitizarEmailEntidade(
        (creator.usuario as any).professor
      ),

      olheiro: sanitizarEmailEntidade(
        (creator.usuario as any).olheiro
      ),

      learningProfile: sanitizarEmailEntidade(
        (creator.usuario as any)
          .learningProfile
      ),

      atleta: sanitizarEmailEntidade(
        (creator.usuario as any).atleta
      ),
    };

    /*
    * Configuração interna.
    * Não precisamos mandar isso para
    * o frontend.
    */
    delete usuarioPublico
      .configuracoesPrivacidade;

    return res.json({
      ok: true,
      creator: {
        id: creator.id,
        usuarioId: creator.usuarioId,
        nomePublico: creator.nomePublico ?? creator.usuario.nome,
        headline: creator.headline,
        bio: creator.bio,
        nicho: creator.nicho,
        avatarUrl: creator.avatarUrl ?? creator.usuario.foto,
        bannerUrl: creator.bannerUrl,
        tipo: creator.tipo,
        verificado: creator.verificado || creator.usuario.verified,
        instituicaoOficial: creator.instituicaoOficial,
        initials: initials(creator.nomePublico ?? creator.usuario.nome),
        usuario: usuarioPublico,
        perfilOriginal: {
          ...usuarioPublico,
          tipo: usuarioPublico.tipo,
          marca:
            usuarioPublico.marca ?? null,
          federacao:
            usuarioPublico.federacao ?? null,
          clube:
            usuarioPublico.clube ?? null,
          escolinha:
            usuarioPublico.escolinha ?? null,
          professor:
            usuarioPublico.professor ?? null,
          olheiro:
            usuarioPublico.olheiro ?? null,
          learning:
            usuarioPublico.learningProfile ??
            null,
          atleta:
            usuarioPublico.atleta ?? null,
        },
    },
      metricas: {
        seguidores,
        cursos: metodologias.length + avulsas.length,
        alunos: totalAlunos,
        vendas: vendasConfirmadas.length,
        receitaBruta,
        ganhoCreator,
        views: creator.views ?? 0,
      },
      conteudos: [
        ...metodologias.map((m) => ({
            ...m,
            origem: "LEARNING",
            preco: null,
            totalAssinantes: m._count?.assinantes ?? 0,
        })),
        ...avulsas.map((m) => ({
          ...m,
          origem: "PREMIUM",
          preco: toNumber(m.precoAssinaturaMensal),
          totalAssinantes: m._count?.assinantes ?? 0,
        })),
      ],
       eventosAoVivo: aulasAoVivo.map((aula) => ({
        id: aula.id,
        titulo: aula.titulo,
        descricao: aula.descricao,
        dataInicio: aula.dataInicio,
        dataFim: aula.dataFim,
        status: aula.status,
        thumbUrl: aula.thumbUrl,
        replayDisponivel: aula.replayDisponivel,
        gravacaoAtiva: aula.gravacaoAtiva,
        totalParticipantes: aula.totalParticipantes,

        metodologiaId: aula.metodologiaId,
        metodologiaAvulsaId: aula.metodologiaAvulsaId,
        itemId: aula.itemId,
        itemAvulsaId: aula.itemAvulsaId,
        estruturaId: aula.estruturaId,
        estruturaAvulsaId: aula.estruturaAvulsaId,

        convidadoUsuarioId: aula.convidadoUsuarioId,
        convidadoNome: aula.convidadoNome,
        convidadoDescricao: aula.convidadoDescricao,
        convidadoUsuario: aula.convidadoUsuario,
        convidados: aula.convidados,

        metodologia: aula.metodologia,
        metodologiaAvulsa: aula.metodologiaAvulsa,
      })),
    });
  } catch (error) {
    console.error("[creatorController.getPerfilPublicoCreator]", error);
    return res.status(500).json({ message: "Erro ao buscar perfil público do Creator." });
  }
};

export const getDashboardCreator = async (req: Request, res: Response) => {
  try {
    const usuarioId = getAuthUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Usuário não autenticado." });

    const creator = await prisma.creator.findUnique({
      where: { usuarioId },
      include: { usuario: true },
    });

    if (!creator) {
      return res.status(404).json({ message: "Creator ainda não ativado." });
    }

    if (!podeSerCreator(creator.usuario.tipo)) {
    return res.status(403).json({
        message: "Este tipo de usuário não pode acessar o painel Creator.",
    });
    }

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [vendas, vendasMes, metodologiasCount, avulsasCount, alunos, metodologias, avulsas] =
      await Promise.all([
        prisma.creatorVenda.findMany({
          where: { creatorId: creator.id },
          orderBy: { criadoEm: "desc" },
          take: 50,
          include: {
            comprador: { select: { id: true, nome: true, email: true, foto: true } },
            metodologia: { select: { id: true, titulo: true, capaUrl: true } },
            metodologiaAvulsa: { select: { id: true, titulo: true, capaUrl: true } },
          },
        }),
        prisma.creatorVenda.findMany({
          where: {
            creatorId: creator.id,
            status: CreatorVendaStatus.CONFIRMADA,
            criadoEm: { gte: inicioMes },
          },
        }),
        prisma.metodologia.count({ where: { criadorUsuarioId: usuarioId } }),
        prisma.metodologiaAvulsa.count({ where: { criadorUsuarioId: usuarioId } }),
        prisma.metodologiaAssinante.count({
          where: {
            OR: [
              { metodologia: { criadorUsuarioId: usuarioId } },
              { metodologiaAvulsa: { criadorUsuarioId: usuarioId } },
            ],
          },
        }),
        prisma.metodologia.findMany({
          where: { criadorUsuarioId: usuarioId },
          orderBy: { criadoEm: "desc" },
          take: 10,
          select: {
            id: true,
            titulo: true,
            capaUrl: true,
            ativo: true,
            mediaAvaliacao: true,
            totalReviews: true,
            criadoEm: true,
          },
        }),
        prisma.metodologiaAvulsa.findMany({
          where: { criadorUsuarioId: usuarioId },
          orderBy: { criadoEm: "desc" },
          take: 10,
          select: {
            id: true,
            titulo: true,
            capaUrl: true,
            ativo: true,
            mediaAvaliacao: true,
            totalReviews: true,
            precoAssinaturaMensal: true,
            criadoEm: true,
          },
        }),
      ]);

    const confirmadas = vendas.filter((v) => v.status === CreatorVendaStatus.CONFIRMADA);
    const receitaTotal = confirmadas.reduce((acc, v) => acc + toNumber(v.valorBruto), 0);
    const valorCreatorTotal = confirmadas.reduce((acc, v) => acc + toNumber(v.valorCreator), 0);
    const valorFooteraTotal = confirmadas.reduce((acc, v) => acc + toNumber(v.valorFootera), 0);

    const receitaMes = vendasMes.reduce((acc, v) => acc + toNumber(v.valorBruto), 0);
    const valorCreatorMes = vendasMes.reduce((acc, v) => acc + toNumber(v.valorCreator), 0);
    const valorFooteraMes = vendasMes.reduce((acc, v) => acc + toNumber(v.valorFootera), 0);

    return res.json({
      ok: true,
      creator,
      resumo: {
        comissaoFootera: toNumber(creator.comissaoFootera),
        percentualCreator: 1 - toNumber(creator.comissaoFootera),
        receitaTotal,
        valorCreatorTotal,
        valorFooteraTotal,
        receitaMes,
        valorCreatorMes,
        valorFooteraMes,
        totalVendas: confirmadas.length,
        totalVendasMes: vendasMes.length,
        totalConteudos: metodologiasCount + avulsasCount,
        totalAlunos: alunos,
      },
      conteudos: [
        ...metodologias.map((m) => ({ ...m, origem: "LEARNING", preco: null })),
        ...avulsas.map((m) => ({
          ...m,
          origem: "PREMIUM",
          preco: toNumber(m.precoAssinaturaMensal),
        })),
      ],
      vendas,
    });
  } catch (error) {
    console.error("[creatorController.getDashboardCreator]", error);
    return res.status(500).json({ message: "Erro ao carregar dashboard Creator." });
  }
};

export const registrarVendaCreator = async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};

    const creator = await prisma.creator.findUnique({
      where: { id: body.creatorId },
    });

    if (!creator) return res.status(404).json({ message: "Creator não encontrado." });

    const valorBruto = Number(body.valorBruto);
    if (!Number.isFinite(valorBruto) || valorBruto <= 0) {
      return res.status(400).json({ message: "valorBruto inválido." });
    }

    const percentualFootera = Number(creator.comissaoFootera || 0.15);
    const valorFootera = Number((valorBruto * percentualFootera).toFixed(2));
    const valorCreator = Number((valorBruto - valorFootera).toFixed(2));

    const venda = await prisma.creatorVenda.create({
      data: {
        creatorId: creator.id,
        compradorId: body.compradorId ?? null,
        metodologiaId: body.metodologiaId ?? null,
        metodologiaAvulsaId: body.metodologiaAvulsaId ?? null,
        valorBruto,
        percentualFootera,
        valorFootera,
        valorCreator,
        status: body.status ?? CreatorVendaStatus.CONFIRMADA,
        pagoEm: body.pagoEm ? new Date(body.pagoEm) : new Date(),
        provider: body.provider ?? null,
        providerRef: body.providerRef ?? null,
        meta: body.meta ?? undefined,
      },
    });

    return res.status(201).json({ ok: true, venda });
  } catch (error) {
    console.error("[creatorController.registrarVendaCreator]", error);
    return res.status(500).json({ message: "Erro ao registrar venda Creator." });
  }
};

export const registrarViewCreator = async (req: Request, res: Response) => {
  try {
    const { usuarioId } = req.params;

    const viewerId = getAuthUserId(req);

    if (viewerId && viewerId === usuarioId) {
      return res.json({ ok: true, counted: false });
    }

    const creator = await prisma.creator.findUnique({
      where: { usuarioId },
      select: { id: true, ativo: true },
    });

    if (!creator || !creator.ativo) {
      return res.status(404).json({ message: "Creator não encontrado." });
    }

    await prisma.creator.update({
      where: { usuarioId },
      data: {
        views: { increment: 1 },
      },
    });

    return res.json({ ok: true, counted: true });
  } catch (error) {
    console.error("[creatorController.registrarViewCreator]", error);
    return res.status(500).json({ message: "Erro ao registrar view." });
  }
};