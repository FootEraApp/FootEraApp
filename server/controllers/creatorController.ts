import type { Request, Response } from "express";
import {
  Prisma,
  CreatorTipo,
  CreatorVendaStatus,
  StatusUsuarioPapel,
  TipoUsuario,
} from "@prisma/client";
import { avaliarPrivacidadePerfil } from "../utils/privacy.js";
import {
  getActiveContext,
} from "../services/activeContext.js";
import {
  hasRole,
} from "../services/roles.js";
import { prisma } from "../prisma.js";
import {
  CreatorContextError,
  resolverCreatorAdministravel,
} from "../services/creatorContextService.js";

function getAuthUserId(req: Request): string | null {
  const anyReq = req as any;

  const usuarioId =
    anyReq.user?.id ??
    anyReq.user?.userId ??
    anyReq.userId ??
    anyReq.usuario?.id ??
    anyReq.usuarioId ??
    null;

  return usuarioId
    ? String(usuarioId)
    : null;
}

function responderErroContextoCreator(
  res: Response,
  error: unknown,
  operacao: string
) {
  if (error instanceof CreatorContextError) {
    return res.status(error.status).json({
      code: error.code,
      message: error.message,
    });
  }

  console.error(`[creatorController.${operacao}]`, error);

  return res.status(500).json({
    code: "CREATOR_INTERNAL_ERROR",
    message: "Erro interno ao processar o Creator.",
  });
}

async function exigirContextoCreator(
  req: Request,
  res: Response
): Promise<string | null> {
  const usuarioId = getAuthUserId(req);

  if (!usuarioId) {
    res.status(401).json({
      code: "UNAUTHENTICATED",
      message: "Usuário não autenticado.",
    });

    return null;
  }

  const activeContext =
    await getActiveContext(usuarioId);

  const ehCreatorPessoal =
    activeContext?.kind === "PERSONAL" &&
    activeContext.tipoUsuario === TipoUsuario.Creator;

  if (!ehCreatorPessoal) {
    res.status(403).json({
      code: "CREATOR_CONTEXT_REQUIRED",
      message:
        "Selecione seu perfil Creator para acessar esta área.",
    });

    return null;
  }

  const possuiCreator =
    await hasRole(
      usuarioId,
      TipoUsuario.Creator
    );

  if (!possuiCreator) {
    res.status(403).json({
      code: "CREATOR_ROLE_REQUIRED",
      message:
        "O perfil Creator não está ativo nesta conta.",
    });

    return null;
  }

  return usuarioId;
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

export const ativarCreator = async (req: Request, res: Response) => {
  const usuarioId = getAuthUserId(req);

  if (!usuarioId) {
    return res.status(401).json({
      code: "UNAUTHENTICATED",
      message: "Usuário não autenticado.",
    });
  }

  try {
    const body = req.body ?? {};

    if (body.tipo === "INSTITUCIONAL") {
      return res.status(409).json({
        code: "USE_INSTITUTIONAL_CREATOR_FLOW",
        message:
          "A ativação de Creator institucional deve ser realizada pelo perfil da organização.",
      });
    }

    const tipoCreatorFinal =
      body.tipo === "INSTITUCIONAL"
        ? CreatorTipo.INSTITUCIONAL
        : CreatorTipo.PESSOA_FISICA;

    const creator = await prisma.$transaction(
      async (tx) => {
        const usuario = await tx.usuario.findUnique({
          where: { id: usuarioId },
          select: {
            id: true,
            nome: true,
            foto: true,
            deletedAt: true,
          },
        });

        if (!usuario || usuario.deletedAt) {
          throw new Error("ACCOUNT_NOT_AVAILABLE");
        }

        const registro = await tx.usuarioPapel.findUnique({
          where: {
            usuarioId_papel: {
              usuarioId,
              papel: TipoUsuario.Creator,
            },
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (registro?.status === StatusUsuarioPapel.INATIVO) {
          throw new Error("CREATOR_REACTIVATION_REQUIRED");
        }

        const agora = new Date();

        const creatorExistente = await tx.creator.findUnique({
          where: { usuarioId },
          select: {
            id: true,
            tipo: true,
            organizacaoId: true,
          },
        });

        if (
          creatorExistente &&
          (
            creatorExistente.organizacaoId !== null ||
            creatorExistente.tipo === CreatorTipo.INSTITUCIONAL
          )
        ) {
          throw new Error(
            "LEGACY_INSTITUTIONAL_CREATOR_CANNOT_BE_REUSED"
          );
        }

        const creatorAtualizado = await tx.creator.upsert({
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
            ativo: true,
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

        if (registro) {
          const alteracao = await tx.usuarioPapel.updateMany({
            where: {
              id: registro.id,
              usuarioId,
              status: registro.status,
            },
            data: {
              status: StatusUsuarioPapel.ATIVO,
              ativadoEm: agora,
              desativadoEm: null,
              perfilCompletoEm: agora,
            },
          });

          if (alteracao.count !== 1) {
            throw new Error("CREATOR_ROLE_CHANGED");
          }
        } else {
          await tx.usuarioPapel.create({
            data: {
              usuarioId,
              papel: TipoUsuario.Creator,
              status: StatusUsuarioPapel.ATIVO,
              ativadoEm: agora,
              perfilCompletoEm: agora,
            },
          });
        }

        const contaAtualizada = await tx.usuario.updateMany({
          where: {
            id: usuarioId,
            deletedAt: null,
          },
          data: {
            tipo: TipoUsuario.Creator,
            contextoOrganizacaoId: null,
          },
        });

        if (contaAtualizada.count !== 1) {
          throw new Error("ACCOUNT_STATE_CHANGED");
        }

        return creatorAtualizado;
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    const activeContext = await getActiveContext(usuarioId);

    if (
      activeContext?.kind !== "PERSONAL" ||
      activeContext.tipoUsuario !== TipoUsuario.Creator
    ) {
      return res.status(409).json({
        code: "CREATOR_CONTEXT_NOT_AVAILABLE",
        message:
          "O Creator foi ativado, mas o contexto mudou. Atualize a sessão.",
      });
    }

    return res.json({
      ok: true,
      creator,
      activeContext,
      tipoUsuario: activeContext.tipoUsuario,
      tipoUsuarioId: activeContext.tipoUsuarioId,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "CREATOR_REACTIVATION_REQUIRED"
    ) {
      return res.status(409).json({
        code: "CREATOR_REACTIVATION_REQUIRED",
        message:
          "Este Creator foi desativado. Reative-o pela página Editar perfil.",
      });
    }

    if (
      error instanceof Error &&
      error.message === "ACCOUNT_NOT_AVAILABLE"
    ) {
      return res.status(403).json({
        code: "ACCOUNT_NOT_AVAILABLE",
        message: "Conta indisponível.",
      });
    }

    if (
      error instanceof Error &&
      (
        error.message === "CREATOR_ROLE_CHANGED" ||
        error.message === "ACCOUNT_STATE_CHANGED"
      )
    ) {
      return res.status(409).json({
        code: error.message,
        message: "O estado da conta mudou. Atualize a página.",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
        "LEGACY_INSTITUTIONAL_CREATOR_CANNOT_BE_REUSED"
    ) {
      return res.status(409).json({
        code: "LEGACY_INSTITUTIONAL_CREATOR_CANNOT_BE_REUSED",
        message:
          "Esta conta possui um vínculo histórico com um Creator institucional. Não é permitido convertê-lo em Creator pessoal. A criação de um Creator pessoal independente exige um fluxo específico.",
      });
    }

    console.error("[creatorController.ativarCreator]", error);

    return res.status(500).json({
      message: "Erro ao ativar Creator.",
    });
  }
};

export const getMeuCreator = async (
  req: Request,
  res: Response
) => {
  const usuarioId = getAuthUserId(req);

  if (!usuarioId) {
    return res.status(401).json({
      code: "UNAUTHENTICATED",
      message: "Usuário não autenticado.",
    });
  }

  try {
    const contexto = await resolverCreatorAdministravel(
      usuarioId
    );

    const creator = await prisma.creator.findUniqueOrThrow({
      where: { id: contexto.creatorId },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            foto: true,
            verified: true,
          },
        },
      },
    });

    return res.json({
      ok: true,
      creator,
      isCreator: true,
      tipoUsuario: TipoUsuario.Creator,

      creatorContext: {
        kind: contexto.kind,
        organizacaoId: contexto.organizacaoId,
        creatorId: contexto.creatorId,
      },
    });
  } catch (error) {
    return responderErroContextoCreator(
      res,
      error,
      "getMeuCreator"
    );
  }
};

export const atualizarCreator = async (
  req: Request,
  res: Response
) => {
  const usuarioId = getAuthUserId(req);

  if (!usuarioId) {
    return res.status(401).json({
      code: "UNAUTHENTICATED",
      message: "Usuário não autenticado.",
    });
  }

  try {
    const contexto = await resolverCreatorAdministravel(
      usuarioId
    );

    const body = req.body ?? {};

    // Não permitir que uma edição comum converta um
    // Creator institucional em pessoal ou vice-versa.
    // Essa transição exige um fluxo administrativo próprio.
    if (
      body.tipo !== undefined &&
      body.tipo !== contexto.creator.tipo
    ) {
      return res.status(409).json({
        code: "CREATOR_TYPE_CHANGE_NOT_ALLOWED",
        message:
          "Não é permitido alterar o tipo deste Creator por esta operação.",
      });
    }

    const atualizado = await prisma.$transaction(
      async (tx) => {
        if (contexto.kind === "ORGANIZATION") {
          if (!contexto.organizacaoId) {
            throw new CreatorContextError(
              403,
              "ORGANIZATION_CONTEXT_INVALID",
              "Organização inválida."
            );
          }

          const membro = await tx.membroOrganizacao.findUnique({
            where: {
              organizacaoId_usuarioId: {
                organizacaoId: contexto.organizacaoId,
                usuarioId,
              },
            },
            select: {
              ativo: true,
              funcao: true,
              organizacao: {
                select: { ativo: true },
              },
            },
          });

          const autorizado =
            membro?.ativo === true &&
            membro.organizacao.ativo === true &&
            (
              membro.funcao === "PROPRIETARIO" ||
              membro.funcao === "ADMINISTRADOR"
            );

          if (!autorizado) {
            throw new CreatorContextError(
              403,
              "CREATOR_ACCESS_REVOKED",
              "Seu vínculo com a organização não permite mais esta operação."
            );
          }
        }

        const resultado = await tx.creator.updateMany({
          where: {
            id: contexto.creatorId,
            ativo: true,
            tipo:
              contexto.kind === "ORGANIZATION"
                ? CreatorTipo.INSTITUCIONAL
                : CreatorTipo.PESSOA_FISICA,
            organizacaoId:
              contexto.kind === "ORGANIZATION"
                ? contexto.organizacaoId
                : null,
          },
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
          },
        });

        if (resultado.count !== 1) {
          throw new CreatorContextError(
            409,
            "CREATOR_STATE_CHANGED",
            "O Creator foi alterado. Atualize a página."
          );
        }

        return tx.creator.findUniqueOrThrow({
          where: { id: contexto.creatorId },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      }
    );

    return res.json({
      ok: true,
      creator: atualizado,
      creatorContext: {
        kind: contexto.kind,
        organizacaoId: contexto.organizacaoId,
      },
    });
  } catch (error) {
    return responderErroContextoCreator(
      res,
      error,
      "atualizarCreator"
    );
  }
};

export const getPerfilPublicoCreator = async (
  req: Request,
  res: Response
) => {
  try {
    const organizacaoId = String(
      req.params.organizacaoId ?? ""
    ).trim();

    const perfilInstitucional = Boolean(organizacaoId);

    const usuarioIdInformado = String(
      req.params.usuarioId ?? ""
    ).trim();

    const creator = await prisma.creator.findUnique({
      where: perfilInstitucional
        ? { organizacaoId }
        : { usuarioId: usuarioIdInformado },
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
              pais: true,
              estado: true,
              cidade: true,
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

    const usuarioId = String(
      creator?.usuarioId ?? usuarioIdInformado
    );

    const possuiPapelCreator = perfilInstitucional
      ? true
      : await hasRole(
          usuarioIdInformado,
          TipoUsuario.Creator
        );

    const tipoCreatorValido = perfilInstitucional
      ? creator?.tipo === CreatorTipo.INSTITUCIONAL &&
        creator.organizacaoId === organizacaoId
      : creator?.tipo === CreatorTipo.PESSOA_FISICA &&
        creator?.organizacaoId == null;

    if (
      !creator ||
      (!perfilInstitucional && !creator.usuario) ||
      !creator.ativo ||
      !possuiPapelCreator ||
      !tipoCreatorValido
    ) {
      return res.status(404).json({
        code: "CREATOR_NOT_FOUND",
        message: "Creator não encontrado.",
      });
    }

    if (perfilInstitucional) {
      const organizacao = await prisma.organizacao.findUnique({
        where: { id: organizacaoId },
        select: { ativo: true },
      });

      if (!organizacao?.ativo) {
        return res.status(404).json({
          code: "INSTITUTIONAL_CREATOR_NOT_FOUND",
          message: "Creator institucional não encontrado.",
        });
      }
    }

    const viewerId = getAuthUserId(req);

    const acesso = perfilInstitucional
      ? { podeVerPerfil: true }
      : await avaliarPrivacidadePerfil(
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
      creator.usuario?.configuracoesPrivacidade ?? null;

    const mostrarEmailNoPerfil =
      configuracoesPrivacidade !== null &&
      typeof configuracoesPrivacidade === "object" &&
      !Array.isArray(configuracoesPrivacidade) &&
      "mostrarEmail" in configuracoesPrivacidade &&
      configuracoesPrivacidade.mostrarEmail === true;

    const filtrosInstitucionais = perfilInstitucional
      ? await prisma.organizacao.findUnique({
          where: { id: organizacaoId },
          select: {
            tipo: true,
            clube: { select: { id: true } },
            escolinha: { select: { id: true } },
            marca: { select: { id: true } },
            federacao: { select: { id: true } },
          },
        })
      : null;

    const filtroAutoria = !perfilInstitucional
      ? { criadorUsuarioId: usuarioId }
      : filtrosInstitucionais?.tipo === "ESCOLA"
        ? { escolinhaId: filtrosInstitucionais.escolinha?.id ?? "" }
        : filtrosInstitucionais?.tipo === "CLUBE"
          ? { clubeId: filtrosInstitucionais.clube?.id ?? "" }
          : filtrosInstitucionais?.tipo === "MARCA"
            ? { marcaId: filtrosInstitucionais.marca?.id ?? "" }
            : { federacaoId: filtrosInstitucionais?.federacao?.id ?? "" };

    const [
      metodologias,
      avulsas,
      aulasAoVivo,
      vendasConfirmadas,
      totalAlunos,
      seguidores,
    ] = await Promise.all([
      prisma.metodologia.findMany({
        where: { ...filtroAutoria, ativo: true },
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
        where: { ...filtroAutoria, ativo: true },
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
          ...(perfilInstitucional
            ? {
                contextoKind: "ORGANIZATION",
                contextoOrganizacaoId: organizacaoId,
              }
            : {
                contextoKind: "PERSONAL",
                contextoTipo: "Creator",
                contextoPerfilId: creator.id,
              }),

          status: {
            in: [
              "AGENDADA",
              "AO_VIVO",
              "FINALIZADA",
            ],
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
            { metodologia: { ...filtroAutoria } },
            { metodologiaAvulsa: { ...filtroAutoria } },
          ],
        },
      }),
      prisma.seguidor.count({
        where: { seguidoUsuarioId: usuarioId },
      }).catch(() => 0),
    ]);

    const receitaBruta = vendasConfirmadas.reduce((acc, v) => acc + toNumber(v.valorBruto), 0);
    const ganhoCreator = vendasConfirmadas.reduce((acc, v) => acc + toNumber(v.valorCreator), 0);
    // Apenas campos explicitamente permitidos no perfil público.
    // Nunca retornar o objeto completo do usuário ou da entidade.
    const dadosUsuario = creator.usuario ?? {
      id: null,
      nome: creator.nomePublico ?? "Creator institucional",
      nomeDeUsuario: null,
      email: null,
      foto: creator.avatarUrl ?? null,
      verified: false,
      tipo: null,
      cidade: null,
      estado: null,
      pais: null,
      marca: null,
      federacao: null,
      clube: null,
      escolinha: null,
      professor: null,
      olheiro: null,
      learningProfile: null,
      atleta: null,
    };

    const sanitizarEntidadePublica = (entidade: any) => {
      if (!entidade) return null;

      return {
        id: entidade.id ?? null,
        nome: entidade.nome ?? null,
        nomePublico: entidade.nomePublico ?? null,
        logo: entidade.logo ?? null,
        foto: entidade.foto ?? null,
        fotoUrl: entidade.fotoUrl ?? null,
        descricao: entidade.descricao ?? null,
        bio: entidade.bio ?? null,
        siteOficial: entidade.siteOficial ?? null,
        site: entidade.site ?? null,
        cidade: entidade.cidade ?? null,
        estado: entidade.estado ?? null,
        pais: entidade.pais ?? null,
      };
    };

    const usuarioPublico = {
      id: dadosUsuario.id,
      nome: dadosUsuario.nome,
      nomeDeUsuario: dadosUsuario.nomeDeUsuario,
      foto: dadosUsuario.foto,
      verified: dadosUsuario.verified,
      tipo: dadosUsuario.tipo,

      email: mostrarEmailNoPerfil
        ? dadosUsuario.email
        : null,

      cidade: dadosUsuario.cidade,
      estado: dadosUsuario.estado,
      pais: dadosUsuario.pais,

      marca: sanitizarEntidadePublica(dadosUsuario.marca),
      federacao: sanitizarEntidadePublica(
        dadosUsuario.federacao
      ),
      clube: sanitizarEntidadePublica(dadosUsuario.clube),
      escolinha: sanitizarEntidadePublica(
        dadosUsuario.escolinha
      ),
      professor: sanitizarEntidadePublica(
        dadosUsuario.professor
      ),
      olheiro: sanitizarEntidadePublica(
        dadosUsuario.olheiro
      ),
      learningProfile: sanitizarEntidadePublica(
        dadosUsuario.learningProfile
      ),
      atleta: sanitizarEntidadePublica(dadosUsuario.atleta),
    };

    return res.json({
      ok: true,
      creator: {
        id: creator.id,
        usuarioId: creator.usuarioId,
        nomePublico:
          creator.nomePublico ??
          dadosUsuario.nome,
        headline: creator.headline,
        bio: creator.bio,
        nicho: creator.nicho,
        organizacaoId: creator.organizacaoId,
        avatarUrl:
          creator.avatarUrl?.trim() ||
          dadosUsuario.foto?.trim() ||
          null,
        bannerUrl: creator.bannerUrl,
        tipo: creator.tipo,
        verificado: creator.verificado || dadosUsuario.verified,
        instituicaoOficial: creator.instituicaoOficial,
        initials: initials(creator.nomePublico ?? dadosUsuario.nome),
        usuario: usuarioPublico,
        perfilOriginal: {
          ...(perfilInstitucional
            ? {
                id: organizacaoId,
                nome: creator.nomePublico,
                tipo: filtrosInstitucionais?.tipo === "ESCOLA"
                  ? "Escolinha"
                  : filtrosInstitucionais?.tipo === "CLUBE"
                    ? "Clube"
                    : filtrosInstitucionais?.tipo === "MARCA"
                      ? "Marca"
                      : "Federacao",
                foto: creator.avatarUrl,
              }
            : usuarioPublico),
          tipo: perfilInstitucional
            ? filtrosInstitucionais?.tipo === "ESCOLA"
              ? "Escolinha"
              : filtrosInstitucionais?.tipo === "CLUBE"
                ? "Clube"
                : filtrosInstitucionais?.tipo === "MARCA"
                  ? "Marca"
                  : "Federacao"
            : usuarioPublico.tipo,
          federacao: perfilInstitucional ? null : usuarioPublico.federacao ?? null,
          clube: perfilInstitucional ? null : usuarioPublico.clube ?? null,
          marca: perfilInstitucional ? null : usuarioPublico.marca ?? null,
          escolinha: perfilInstitucional ? null : usuarioPublico.escolinha ?? null,
          professor: perfilInstitucional ? null : usuarioPublico.professor ?? null,
          olheiro: perfilInstitucional ? null : usuarioPublico.olheiro ?? null,
          learning: perfilInstitucional ? null : usuarioPublico.learningProfile ?? null,
          atleta: perfilInstitucional ? null : usuarioPublico.atleta ?? null,
          usuario: perfilInstitucional ? null : usuarioPublico,
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

export const getDashboardCreator = async (
  req: Request,
  res: Response
) => {
  try {
    const usuarioId = getAuthUserId(req);

    if (!usuarioId) {
      return res.status(401).json({
        code: "UNAUTHENTICATED",
        message: "Usuário não autenticado.",
      });
    }

    // Resolve o Creator pessoal ou o institucional
    // conforme o contexto ativo e suas permissões.
    const contexto = await resolverCreatorAdministravel(
      usuarioId
    );

    const creator = contexto.creator;

    if (!creator.ativo) {
      return res.status(404).json({
        code: "CREATOR_INACTIVE",
        message: "Este Creator está inativo.",
      });
    }

    const ehInstitucional =
      contexto.kind === "ORGANIZATION";

    // A autoria pessoal continua separada da
    // propriedade administrativa da organização.
    let filtroAutoria:
      | { criadorUsuarioId: string }
      | { escolinhaId: string }
      | { clubeId: string }
      | { marcaId: string }
      | { federacaoId: string };

    if (!ehInstitucional) {
      filtroAutoria = {
        criadorUsuarioId: usuarioId,
      };
    } else {
      const organizacaoId = contexto.organizacaoId;

      if (!organizacaoId) {
        return res.status(403).json({
          code: "ORGANIZATION_CONTEXT_INVALID",
          message: "Organização não identificada.",
        });
      }

      const organizacao =
        await prisma.organizacao.findUnique({
          where: { id: organizacaoId },
          select: {
            id: true,
            tipo: true,
            ativo: true,
            escolinha: {
              select: { id: true },
            },
            clube: {
              select: { id: true },
            },
            marca: {
              select: { id: true },
            },
            federacao: {
              select: { id: true },
            },
          },
        });

      if (!organizacao?.ativo) {
        return res.status(404).json({
          code: "ORGANIZATION_UNAVAILABLE",
          message: "Organização indisponível.",
        });
      }

      switch (organizacao.tipo) {
        case "ESCOLA": {
          if (!organizacao.escolinha?.id) {
            return res.status(409).json({
              code: "ORGANIZATION_LEGACY_LINK_MISSING",
              message:
                "A Escolinha não possui vínculo de conteúdos configurado.",
            });
          }

          filtroAutoria = {
            escolinhaId: organizacao.escolinha.id,
          };
          break;
        }

        case "CLUBE": {
          if (!organizacao.clube?.id) {
            return res.status(409).json({
              code: "ORGANIZATION_LEGACY_LINK_MISSING",
              message:
                "O Clube não possui vínculo de conteúdos configurado.",
            });
          }

          filtroAutoria = {
            clubeId: organizacao.clube.id,
          };
          break;
        }

        case "MARCA": {
          if (!organizacao.marca?.id) {
            return res.status(409).json({
              code: "ORGANIZATION_LEGACY_LINK_MISSING",
              message:
                "A Marca não possui vínculo de conteúdos configurado.",
            });
          }

          filtroAutoria = {
            marcaId: organizacao.marca.id,
          };
          break;
        }

        case "FEDERACAO": {
          if (!organizacao.federacao?.id) {
            return res.status(409).json({
              code: "ORGANIZATION_LEGACY_LINK_MISSING",
              message:
                "A Federação não possui vínculo de conteúdos configurado.",
            });
          }

          filtroAutoria = {
            federacaoId: organizacao.federacao.id,
          };
          break;
        }

        default:
          return res.status(409).json({
            code: "INVALID_ORGANIZATION_TYPE",
            message:
              "Tipo de organização não suportado pelo Creator.",
          });
      }
    }

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [
      vendas,
      vendasMes,
      metodologiasCount,
      avulsasCount,
      alunos,
      metodologias,
      avulsas,
    ] = await Promise.all([
      // As vendas continuam associadas ao ID
      // original do Creator, não ao usuário atual.
      prisma.creatorVenda.findMany({
        where: {
          creatorId: creator.id,
        },
        orderBy: {
          criadoEm: "desc",
        },
        take: 50,
        include: {
          comprador: {
            select: {
              id: true,
              nome: true,
              foto: true,
            },
          },
          metodologia: {
            select: {
              id: true,
              titulo: true,
              capaUrl: true,
            },
          },
          metodologiaAvulsa: {
            select: {
              id: true,
              titulo: true,
              capaUrl: true,
            },
          },
        },
      }),

      prisma.creatorVenda.findMany({
        where: {
          creatorId: creator.id,
          status: CreatorVendaStatus.CONFIRMADA,
          criadoEm: {
            gte: inicioMes,
          },
        },
      }),

      prisma.metodologia.count({
        where: filtroAutoria,
      }),

      prisma.metodologiaAvulsa.count({
        where: filtroAutoria,
      }),

      prisma.metodologiaAssinante.count({
        where: {
          OR: [
            {
              metodologia: filtroAutoria,
            },
            {
              metodologiaAvulsa: filtroAutoria,
            },
          ],
        },
      }),

      prisma.metodologia.findMany({
        where: filtroAutoria,
        orderBy: {
          criadoEm: "desc",
        },
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
        where: filtroAutoria,
        orderBy: {
          criadoEm: "desc",
        },
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

    const confirmadas = vendas.filter(
      (v) =>
        v.status === CreatorVendaStatus.CONFIRMADA
    );

    const receitaTotal = confirmadas.reduce(
      (acc, v) => acc + toNumber(v.valorBruto),
      0
    );

    const valorCreatorTotal = confirmadas.reduce(
      (acc, v) => acc + toNumber(v.valorCreator),
      0
    );

    const valorFooteraTotal = confirmadas.reduce(
      (acc, v) => acc + toNumber(v.valorFootera),
      0
    );

    const receitaMes = vendasMes.reduce(
      (acc, v) => acc + toNumber(v.valorBruto),
      0
    );

    const valorCreatorMes = vendasMes.reduce(
      (acc, v) => acc + toNumber(v.valorCreator),
      0
    );

    const valorFooteraMes = vendasMes.reduce(
      (acc, v) => acc + toNumber(v.valorFootera),
      0
    );

    return res.json({
      ok: true,
      creatorContext: {
        kind: contexto.kind,
        organizacaoId: contexto.organizacaoId,
        creatorId: creator.id,
      },
      creator,
      resumo: {
        comissaoFootera:
          toNumber(creator.comissaoFootera),

        percentualCreator:
          1 - toNumber(creator.comissaoFootera),

        receitaTotal,
        valorCreatorTotal,
        valorFooteraTotal,
        receitaMes,
        valorCreatorMes,
        valorFooteraMes,
        totalVendas: confirmadas.length,
        totalVendasMes: vendasMes.length,
        totalConteudos:
          metodologiasCount + avulsasCount,
        totalAlunos: alunos,
      },
      conteudos: [
        ...metodologias.map((m) => ({
          ...m,
          origem: "LEARNING",
          preco: null,
        })),
        ...avulsas.map((m) => ({
          ...m,
          origem: "PREMIUM",
          preco: toNumber(
            m.precoAssinaturaMensal
          ),
        })),
      ],
      vendas,
    });
  } catch (error) {
    return responderErroContextoCreator(
      res,
      error,
      "getDashboardCreator"
    );
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

export const getCreatorPublicoOrganizacao = (
  req: Request,
  res: Response
) => getPerfilPublicoCreator(req, res);