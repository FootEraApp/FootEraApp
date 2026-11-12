
import {
  FuncaoMembroOrganizacao,
  Prisma,
  StatusResponsavelAtleta,
  StatusUsuarioPapel,
  TipoUsuario,
} from "@prisma/client";
import { prisma } from "../prisma.js";
import {
  getActiveContext,
  listarActiveContexts,
} from "./activeContext.js";
import {
  normalizarPapel,
  papelCanonico,
} from "./roles.js";

export class ExclusaoPapelError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const PAPEIS_LIBERADOS = new Set<TipoUsuario>([
  TipoUsuario.Atleta,
  TipoUsuario.Professor,
  TipoUsuario.Olheiro,
  TipoUsuario.Learning,
  TipoUsuario.Responsavel,
  TipoUsuario.Creator,
]);

async function validarVinculosExclusaoPapel(
  tx: Prisma.TransactionClient,
  usuarioId: string,
  papeis: TipoUsuario[],
) {
  if (papeis.includes(TipoUsuario.Responsavel)) {
    const totalVinculos =
      await tx.responsavelAtleta.count({
        where: {
          responsavelUsuarioId: usuarioId,
          status: {
            in: [
              StatusResponsavelAtleta.ATIVO,
              StatusResponsavelAtleta.PENDENTE,
            ],
          },
        },
      });

    if (totalVinculos > 0) {
      throw new ExclusaoPapelError(
        409,
        "RESPONSAVEL_HAS_PENDING_OR_ACTIVE_ATHLETES",
        "Este Responsável possui atletas vinculados ou solicitações pendentes. Encerre ou resolva todos os vínculos antes de excluir esse perfil.",
      );
    }
  }

  if (papeis.includes(TipoUsuario.Atleta)) {
    const atleta = await tx.atleta.findUnique({
      where: { usuarioId },
      select: {
        id: true,
        clubeId: true,
        escolinhaId: true,
      },
    });

    if (!atleta) {
      throw new ExclusaoPapelError(
        409,
        "ATHLETE_PROFILE_NOT_FOUND",
        "O perfil de Atleta não foi encontrado.",
      );
    }

    const totalResponsaveis =
      await tx.responsavelAtleta.count({
        where: {
          atletaId: atleta.id,
          status: {
            in: [
              StatusResponsavelAtleta.ATIVO,
              StatusResponsavelAtleta.PENDENTE,
            ],
          },
        },
      });

    if (totalResponsaveis > 0) {
      throw new ExclusaoPapelError(
        409,
        "ATHLETE_HAS_ACTIVE_GUARDIANS",
        "Este atleta possui responsáveis vinculados. Resolva os vínculos antes de excluir o perfil de Atleta.",
      );
    }

    if (atleta.clubeId || atleta.escolinhaId) {
      throw new ExclusaoPapelError(
        409,
        "ATHLETE_HAS_ORGANIZATION_LINKS",
        "Este atleta está vinculado a um clube ou escolinha. Encerre o vínculo antes de excluir o perfil.",
      );
    }

    const relacoesAtivas = await tx.relacaoTreinamento.count({
      where: {
        atletaId: atleta.id,
        ativo: true,
        encerradoEm: null,
      },
    });

    if (relacoesAtivas > 0) {
      throw new ExclusaoPapelError(
        409,
        "ATHLETE_HAS_ACTIVE_TRAINING_LINKS",
        "Este atleta possui vínculos de treinamento ativos. Encerre-os antes de excluir o perfil.",
      );
    }

    const [participacoesEmElencos, associacoesAtivas] =
      await Promise.all([
        tx.atletaElenco.count({
          where: {
            atletaId: atleta.id,
            elenco: {
              ativo: true,
            },
          },
        }),

        tx.membroOrganizacao.count({
          where: {
            usuarioId,
            ativo: true,
            funcao: FuncaoMembroOrganizacao.MEMBRO,
            organizacao: {
              ativo: true,
            },
          },
        }),
      ]);

    if (participacoesEmElencos > 0) {
      throw new ExclusaoPapelError(
        409,
        "ATHLETE_HAS_ACTIVE_SQUADS",
        "Este atleta participa de um elenco ativo. Encerre essa participação antes de excluir o perfil.",
      );
    }

    if (associacoesAtivas > 0) {
      throw new ExclusaoPapelError(
        409,
        "ATHLETE_HAS_ACTIVE_MEMBERSHIPS",
        "Este atleta possui associações organizacionais ativas. Resolva esses vínculos antes de excluir o perfil.",
      );
    }
  }
  if (papeis.includes(TipoUsuario.Creator)) {
    const creator = await tx.creator.findUnique({
      where: {
        usuarioId,
      },
      select: {
        id: true,
        ativo: true,
        tipo: true,
        organizacaoId: true,
      },
    });

    if (!creator) {
      throw new ExclusaoPapelError(
        409,
        "CREATOR_PROFILE_NOT_FOUND",
        "O perfil Creator não foi encontrado.",
      );
    }

    if (
      creator.tipo !== "PESSOA_FISICA" ||
      creator.organizacaoId !== null
    ) {
      throw new ExclusaoPapelError(
        409,
        "CREATOR_INSTITUCIONAL_TRANSFERIDO",
        "Este registro pertence a um Creator institucional. " +
          "A conta antiga não pode desativá-lo como Creator pessoal."
      );
    }
    
    const totalVendas = await tx.creatorVenda.count({
      where: {
        creatorId: creator.id,
      },
    });
    
    if (totalVendas > 0) {
      throw new ExclusaoPapelError(
        409,
        "CREATOR_FINANCIAL_REVIEW_REQUIRED",
        "Este Creator possui histórico de vendas. A desativação exige uma revisão financeira para preservar compras e obrigações existentes.",
      );
    }

    const [assinantesAtivos, aulasPendentes] =
      await Promise.all([
        tx.metodologiaAssinante.count({
          where: {
            status: "ATIVA",
            OR: [
              {
                metodologia: {
                  criadorUsuarioId: usuarioId,
                },
              },
              {
                metodologiaAvulsa: {
                  criadorUsuarioId: usuarioId,
                },
              },
            ],
          },
        }),

        tx.aulaAoVivo.count({
          where: {
            contextoKind: "PERSONAL",
            contextoTipo: "Creator",
            contextoPerfilId: creator.id,
            status: {
              in: ["AGENDADA", "AO_VIVO"],
            },
          },
        }),
      ]);

    if (assinantesAtivos > 0) {
      throw new ExclusaoPapelError(
        409,
        "CREATOR_HAS_ACTIVE_SUBSCRIBERS",
        "Este Creator possui assinantes ativos. Resolva os acessos antes de desativar o perfil.",
      );
    }

    if (aulasPendentes > 0) {
      throw new ExclusaoPapelError(
        409,
        "CREATOR_HAS_PENDING_LIVE_CLASSES",
        "Este Creator possui aulas agendadas ou em andamento. Encerre essas atividades antes de desativar o perfil.",
      );
    }

    const [
      assinantes,
      metodologiasPublicadas,
      avulsasPublicadas,
    ] = await Promise.all([
      tx.metodologiaAssinante.count({
        where: {
          OR: [
            { metodologia: { criadorUsuarioId: usuarioId } },
            { metodologiaAvulsa: { criadorUsuarioId: usuarioId } },
          ],
        },
      }),

      tx.metodologia.count({
        where: {
          criadorUsuarioId: usuarioId,
          ativo: true,
        },
      }),

      tx.metodologiaAvulsa.count({
        where: {
          criadorUsuarioId: usuarioId,
          ativo: true,
        },
      }),
    ]);

    if (
      assinantes > 0 ||
      metodologiasPublicadas > 0 ||
      avulsasPublicadas > 0
    ) {
      throw new ExclusaoPapelError(
        409,
        "CREATOR_HAS_CONTENT_OBLIGATIONS",
        "Este Creator possui conteúdos publicados, participantes ou aulas que precisam de revisão antes da desativação.",
      );
    }
  }
}

export async function desativarPapelPessoal(
  usuarioId: string,
  papelInformado: string,
) {
  const papelRecebido = normalizarPapel(papelInformado);

  if (!papelRecebido) {
    throw new ExclusaoPapelError(
      400,
      "INVALID_ROLE",
      "Papel inválido.",
    );
  }

  const papel = papelCanonico(papelRecebido);

  if (!PAPEIS_LIBERADOS.has(papel)) {
    throw new ExclusaoPapelError(
      409,
      "ROLE_REQUIRES_SPECIAL_REVIEW",
      "A exclusão deste tipo de perfil exige verificações adicionais.",
    );
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      deletedAt: true,
      professor: {
        select: { id: true },
      },
    },
  });

  if (!usuario || usuario.deletedAt) {
    throw new ExclusaoPapelError(
      404,
      "USER_NOT_AVAILABLE",
      "Conta não encontrada ou em processo de exclusão.",
    );
  }

  const [registro, contextos, contextoAtual] =
    await Promise.all([
      prisma.usuarioPapel.findUnique({
        where: {
          usuarioId_papel: {
            usuarioId,
            papel,
          },
        },
        select: {
          id: true,
          status: true,
        },
      }),
      listarActiveContexts(usuarioId),
      getActiveContext(usuarioId),
    ]);

  if (registro?.status !== StatusUsuarioPapel.ATIVO) {
    throw new ExclusaoPapelError(
      409,
      "ROLE_NOT_ACTIVE",
      "Este perfil não está ativo na conta.",
    );
  }

  const outrosContextos = contextos.filter((contexto) => {
    if (contexto.key === `personal:${papel}`) {
      return false;
    }

    if (contexto.kind === "PERSONAL") {
      return true;
    }

    if (!contexto.organizationId) {
      return false;
    }

    if (
      papel === TipoUsuario.Professor &&
      contexto.organizationRole ===
        FuncaoMembroOrganizacao.PROFESSOR
    ) {
      return false;
    }

    if (
      papel === TipoUsuario.Atleta &&
      contexto.organizationRole ===
        FuncaoMembroOrganizacao.MEMBRO
    ) {
      return false;
    }

    return true;
  });

  if (outrosContextos.length === 0) {
    throw new ExclusaoPapelError(
      409,
      "LAST_CONTEXT",
      "Não existe outro perfil pessoal ou vínculo organizacional ativo disponível. Utilize a exclusão da conta inteira."
    );
  }

  if (papel === TipoUsuario.Professor && usuario.professor) {
    const professorId = usuario.professor.id;

    const [gestoresAtivos, relacoesAtivas, clubes, escolinhas] =
        await Promise.all([
        prisma.organizacaoGestor.count({
            where: {
            professorId,
            ativo: true,
            },
        }),

        prisma.relacaoTreinamento.count({
            where: {
            professorId,
            ativo: true,
            encerradoEm: null,
            },
        }),

        prisma.professorClube.count({
            where: { professorId },
        }),

        prisma.professorEscolinha.count({
            where: { professorId },
        }),
        ]);

    if (gestoresAtivos > 0 || relacoesAtivas > 0) {
        throw new ExclusaoPapelError(
        409,
        "PROFESSOR_HAS_ACTIVE_RESPONSIBILITIES",
        "Este Professor possui responsabilidades ativas. Encerre ou transfira esses vínculos antes de excluir o perfil.",
        );
    }

    console.info(
        "[exclusaoPapel] Desativando Professor:",
        {
        usuarioId,
        professorId,
        vinculosLegadosClubes: clubes,
        vinculosLegadosEscolinhas: escolinhas,
        },
    );
    }

  const proximoContexto =
    outrosContextos.find(
      (item) => item.key === contextoAtual?.key,
    ) ??
    outrosContextos.find(
      (item) => item.kind === "PERSONAL",
    ) ??
    outrosContextos[0];

  await prisma.$transaction(
    async (tx) => {
      if (proximoContexto.kind === "ORGANIZATION") {
        const vinculo = await tx.membroOrganizacao.findFirst({
          where: {
            usuarioId,
            organizacaoId: proximoContexto.organizationId!,
            ativo: true,
            organizacao: {
              is: {
                ativo: true,
              },
            },
          },
          select: { id: true },
        });

        if (!vinculo) {
          throw new ExclusaoPapelError(
            409,
            "NEXT_ORGANIZATION_CONTEXT_INVALID",
            "O vínculo com a organização não está mais ativo. Atualize a página.",
          );
        }
      }
      await validarVinculosExclusaoPapel(
        tx,
        usuarioId,
        [papel],
      );
      const alteracao = await tx.usuarioPapel.updateMany({
        where: {
          id: registro.id,
          usuarioId,
          status: StatusUsuarioPapel.ATIVO,
        },
        data: {
          status: StatusUsuarioPapel.INATIVO,
          desativadoEm: new Date(),
        },
      });

      if (alteracao.count !== 1) {
        throw new ExclusaoPapelError(
          409,
          "ROLE_CHANGED",
          "O estado do papel foi alterado. Atualize a página.",
        );
      }

      if (papel === TipoUsuario.Creator) {
        const resultadoCreator = await tx.creator.updateMany({
          where: {
            usuarioId,
            tipo: "PESSOA_FISICA",
            organizacaoId: null,
            ativo: true,
          },
          data: {
            ativo: false,
          },
        });

        if (resultadoCreator.count !== 1) {
          throw new ExclusaoPapelError(
            409,
            "CREATOR_STATE_CHANGED",
            "O estado do Creator foi alterado. Atualize a página.",
          );
        }
      }

      const contaAtualizada = await tx.usuario.updateMany({
        where: {
          id: usuarioId,
          deletedAt: null,
        },
        data: {
          tipo: proximoContexto.tipoUsuario,
          contextoOrganizacaoId:
            proximoContexto.kind === "ORGANIZATION"
              ? proximoContexto.organizationId ?? null
              : null,
          tokenVersion: { increment: 1 },
        },
      });

      if (contaAtualizada.count !== 1) {
        throw new ExclusaoPapelError(
          409,
          "ACCOUNT_STATE_CHANGED",
          "A conta foi alterada durante a operação. Atualize a página.",
        );
      }
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  const activeContext =
    await getActiveContext(usuarioId);

  return {
    ok: true,
    papelRemovido: papel,
    activeContext,
  };
}

export async function desativarPapeisPeloAdmin(
  usuarioId: string,
  papeisInformados: string[],
) {
  if (
    !Array.isArray(papeisInformados) ||
    papeisInformados.length === 0 ||
    papeisInformados.length > 10
  ) {
    throw new ExclusaoPapelError(
      400,
      "INVALID_ROLES",
      "Selecione de 1 a 10 papéis.",
    );
  }

  const papeis = papeisInformados.map((valor) => {
    if (typeof valor !== "string") {
      throw new ExclusaoPapelError(
        400,
        "INVALID_ROLE",
        "Todos os papéis devem ser textos válidos.",
      );
    }

    const normalizado = normalizarPapel(valor);

    if (!normalizado) {
      throw new ExclusaoPapelError(
        400,
        "INVALID_ROLE",
        `Papel inválido: ${valor}`,
      );
    }

    return papelCanonico(normalizado);
  });

  const papeisUnicos = Array.from(new Set(papeis));

  if (papeisUnicos.length !== papeis.length) {
    throw new ExclusaoPapelError(
      400,
      "DUPLICATE_ROLES",
      "Não envie papéis repetidos.",
    );
  }

  for (const papel of papeisUnicos) {
    if (!PAPEIS_LIBERADOS.has(papel)) {
      throw new ExclusaoPapelError(
        409,
        "ROLE_REQUIRES_SPECIAL_REVIEW",
        `O papel ${papel} ainda exige verificações específicas.`,
      );
    }
  }

  const contextos = await listarActiveContexts(usuarioId);
  const contextoAnterior = await getActiveContext(usuarioId);

  const outrosContextos = contextos.filter((contexto) => {
    if (contexto.kind === "PERSONAL") {
      return !papeisUnicos.includes(contexto.tipoUsuario);
    }

    if (!contexto.organizationId) {
      return false;
    }

    if (
      papeisUnicos.includes(TipoUsuario.Professor) &&
      contexto.organizationRole ===
        FuncaoMembroOrganizacao.PROFESSOR
    ) {
      return false;
    }

    if (
      papeisUnicos.includes(TipoUsuario.Atleta) &&
      contexto.organizationRole ===
        FuncaoMembroOrganizacao.MEMBRO
    ) {
      return false;
    }

    return true;
  });

  const candidato =
    outrosContextos.find(
      (contexto) => contexto.key === contextoAnterior?.key,
    ) ??
    outrosContextos[0];

  if (!candidato) {
    throw new ExclusaoPapelError(
      409,
      "LAST_PERSONAL_CONTEXT",
      "A conta precisa manter um perfil pessoal ativo. Para remover todos os perfis, utilize a exclusão da conta inteira.",
    );
  }

  await prisma.$transaction(
    async (tx) => {
      const usuario = await tx.usuario.findUnique({
        where: { id: usuarioId },
        select: {
          id: true,
          deletedAt: true,
          professor: {
            select: { id: true },
          },
        },
      });

      if (!usuario || usuario.deletedAt) {
        throw new ExclusaoPapelError(
          404,
          "USER_NOT_AVAILABLE",
          "Usuário não encontrado ou conta em exclusão.",
        );
      }

      const registros = await tx.usuarioPapel.findMany({
        where: {
          usuarioId,
          status: StatusUsuarioPapel.ATIVO,
        },
        select: {
          id: true,
          papel: true,
        },
      });

      for (const papel of papeisUnicos) {
        if (!registros.some((registro) => registro.papel === papel)) {
          throw new ExclusaoPapelError(
            409,
            "ROLE_NOT_ACTIVE",
            `O papel ${papel} não está ativo.`,
          );
        }
      }

      const proximoContextoValido =
        candidato.kind === "ORGANIZATION"
          ? Boolean(
              candidato.organizationId &&
              (await tx.membroOrganizacao.findFirst({
                where: {
                  usuarioId,
                  organizacaoId: candidato.organizationId,
                  ativo: true,
                  organizacao: {
                    is: {
                      ativo: true,
                    },
                  },
                  ...(
                    candidato.organizationRole ===
                    FuncaoMembroOrganizacao.PROFESSOR
                      ? {
                          funcao: FuncaoMembroOrganizacao.PROFESSOR,
                        }
                      : candidato.organizationRole ===
                          FuncaoMembroOrganizacao.MEMBRO
                        ? {
                            funcao: FuncaoMembroOrganizacao.MEMBRO,
                          }
                        : {}
                  ),
                },
                select: {
                  id: true,
                  funcao: true,
                },
              }))
            ) &&
            (
              candidato.organizationRole ===
              FuncaoMembroOrganizacao.PROFESSOR
                ? !papeisUnicos.includes(TipoUsuario.Professor)
                : candidato.organizationRole ===
                    FuncaoMembroOrganizacao.MEMBRO
                  ? !papeisUnicos.includes(TipoUsuario.Atleta)
                  : true
            )
          : registros.some(
              (registro) =>
                registro.papel === candidato.tipoUsuario &&
                !papeisUnicos.includes(registro.papel)
            );

      if (!proximoContextoValido) {
        throw new ExclusaoPapelError(
          409,
          "NEXT_CONTEXT_CHANGED",
          "O próximo perfil não está mais disponível. Atualize a página.",
        );
      }

      if (
        papeisUnicos.includes(TipoUsuario.Professor) &&
        usuario.professor
      ) {
        const professorId = usuario.professor.id;

        const [gestores, relacoes] = await Promise.all([
          tx.organizacaoGestor.count({
            where: {
              professorId,
              ativo: true,
            },
          }),
          tx.relacaoTreinamento.count({
            where: {
              professorId,
              ativo: true,
              encerradoEm: null,
            },
          }),
        ]);

        if (gestores > 0 || relacoes > 0) {
          throw new ExclusaoPapelError(
            409,
            "PROFESSOR_HAS_ACTIVE_RESPONSIBILITIES",
            "O Professor possui responsabilidades ativas que precisam ser transferidas ou encerradas.",
          );
        }
      }

      await validarVinculosExclusaoPapel(
        tx,
        usuarioId,
        papeisUnicos,
      );

      const alteracao = await tx.usuarioPapel.updateMany({
        where: {
          usuarioId,
          papel: { in: papeisUnicos },
          status: StatusUsuarioPapel.ATIVO,
        },
        data: {
          status: StatusUsuarioPapel.INATIVO,
          desativadoEm: new Date(),
        },
      });

      if (alteracao.count !== papeisUnicos.length) {
        throw new ExclusaoPapelError(
          409,
          "ROLES_CHANGED",
          "Os papéis foram alterados durante a operação.",
        );
      }

      if (papeisUnicos.includes(TipoUsuario.Creator)) {
        const resultadoCreator = await tx.creator.updateMany({
          where: {
            usuarioId,
            tipo: "PESSOA_FISICA",
            organizacaoId: null,
            ativo: true,
          },
          data: {
            ativo: false,
          },
        });

        if (resultadoCreator.count !== 1) {
          throw new ExclusaoPapelError(
            409,
            "CREATOR_STATE_CHANGED",
            "O estado do Creator foi alterado durante a operação.",
          );
        }
      }

      const atualizacao = await tx.usuario.updateMany({
        where: {
          id: usuarioId,
          deletedAt: null,
        },
        data: {
          tipo: candidato.tipoUsuario,
          contextoOrganizacaoId:
            candidato.kind === "ORGANIZATION"
              ? candidato.organizationId ?? null
              : null,
          tokenVersion: { increment: 1 },
        },
      });

      if (atualizacao.count !== 1) {
        throw new ExclusaoPapelError(
          409,
          "USER_CHANGED",
          "A conta foi modificada durante a operação.",
        );
      }
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  return {
    ok: true,
    papeisRemovidos: papeisUnicos,
    proximoContexto: candidato.key,
    sessoesInvalidadas: true,
    message:
      "Papéis desativados. A conta e seus históricos foram preservados.",
  };
}