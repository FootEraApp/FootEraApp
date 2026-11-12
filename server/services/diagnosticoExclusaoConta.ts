
import {
  FuncaoMembroOrganizacao,
  TipoOrganizacao,
} from "@prisma/client";
import { prisma } from "../prisma.js";

export type CategoriaExclusao =
  | "ADMIN"
  | "ORGANIZACAO"
  | "RESPONSAVEL"
  | "ATLETA"
  | "PROFESSOR"
  | "CREATOR"
  | "ASSINATURA"
  | "FINANCEIRO"
  | "TRANSFERENCIA"
  | "LEARNING"
  | "EVENTO"
  | "OLHEIRO"
  | "CONTEUDO";

export type ImpedimentoExclusao = {
  codigo: string;
  categoria: CategoriaExclusao;
  titulo: string;
  descricao: string;
  orientacao: string;
  organizacaoId?: string | null;
  legadoId?: string | null;
  tipoOrganizacao?: TipoOrganizacao;
};

type Legado = {
  id: string;
  nome: string;
  organizacaoId: string | null;
};

export async function diagnosticarExclusaoConta(
  usuarioId: string,
) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      deletedAt: true,
      administrador: {
        select: {
          id: true,
          cargo: true,
          nivel: true,
        },
      },
      clube: {
        select: {
          id: true,
          nome: true,
          organizacaoId: true,
        },
      },
      escolinha: {
        select: {
          id: true,
          nome: true,
          organizacaoId: true,
        },
      },
      marca: {
        select: {
          id: true,
          nome: true,
          organizacaoId: true,
        },
      },
      federacao: {
        select: {
          id: true,
          nome: true,
          organizacaoId: true,
        },
      },
    },
  });

  if (!usuario) {
    return {
        encontrado: false,
        excluido: false,
        diagnosticoCompleto: false,
        podeSolicitarExclusao: false,
        impedimentos: [] as ImpedimentoExclusao[],
        avisos: [] as ImpedimentoExclusao[],
    };
    }

  const membros = await prisma.membroOrganizacao.findMany({
    where: {
      usuarioId,
      ativo: true,
      funcao: FuncaoMembroOrganizacao.PROPRIETARIO,
    },
    select: {
      organizacaoId: true,
      organizacao: {
        select: {
          nome: true,
          tipo: true,
          ativo: true,
        },
      },
    },
  });

  const impedimentos: ImpedimentoExclusao[] = [];

  // Históricos e avisos que exigem preservação ou revisão,
  // mas não são automaticamente bloqueios da exclusão lógica.
  const avisos: ImpedimentoExclusao[] = [];

  if (usuario.administrador) {
    impedimentos.push({
      codigo: "ADMIN_ACCOUNT_PROTECTED",
      categoria: "ADMIN",
      titulo: "Acesso administrativo à FootEra",
      descricao:
        "Esta conta ainda possui privilégios de administrador.",
      orientacao:
        "Solicite ao superadministrador a revogação do acesso administrativo ou o procedimento de desativação de uma conta exclusivamente Admin.",
    });
  }

  const organizacoesRegistradas = new Set<string>();
  const legadosRegistrados = new Set<string>();

  for (const membro of membros) {
    const organizacao = membro.organizacao;

    impedimentos.push({
      codigo: "ORGANIZATION_OWNER",
      categoria: "ORGANIZACAO",
      titulo: `${organizacao.nome} — ${organizacao.tipo}`,
      descricao:
        "Você é proprietário desta organização.",
      orientacao:
        "Transfira a propriedade para outro usuário autorizado ou solicite o encerramento institucional.",
      organizacaoId: membro.organizacaoId,
      tipoOrganizacao: organizacao.tipo,
    });

    organizacoesRegistradas.add(membro.organizacaoId);
  }

  const legados: Array<{
    tipo: TipoOrganizacao;
    registro: Legado | null;
  }> = [
    {
      tipo: TipoOrganizacao.CLUBE,
      registro: usuario.clube,
    },
    {
      tipo: TipoOrganizacao.ESCOLA,
      registro: usuario.escolinha,
    },
    {
      tipo: TipoOrganizacao.MARCA,
      registro: usuario.marca,
    },
    {
      tipo: TipoOrganizacao.FEDERACAO,
      registro: usuario.federacao,
    },
  ];

  for (const { tipo, registro } of legados) {
    if (!registro) continue;

    const chave = `${tipo}:${registro.id}`;

    if (legadosRegistrados.has(chave)) continue;
    legadosRegistrados.add(chave);

    // Organização já identificada como propriedade atual.
    if (
        registro.organizacaoId &&
        organizacoesRegistradas.has(registro.organizacaoId)
    ) {
        continue;
    }

    if (registro.organizacaoId) {
        // A propriedade atual vem de MembroOrganizacao,
        // não do usuarioId histórico da entidade legada.
        const proprietariosAtuais =
        await prisma.membroOrganizacao.findMany({
            where: {
            organizacaoId: registro.organizacaoId,
            ativo: true,
            funcao: FuncaoMembroOrganizacao.PROPRIETARIO,
            },
            select: {
            usuarioId: true,
            },
        });

        const pertenceAoUsuario =
        proprietariosAtuais.some(
            (membro) => membro.usuarioId === usuarioId
        );

        if (
        proprietariosAtuais.length > 0 &&
        !pertenceAoUsuario
        ) {
        // A organização pertence a outra pessoa.
        // O vínculo legado será preservado como histórico,
        // mas não impede a exclusão lógica dessa conta.
        avisos.push({
            codigo: "ORGANIZATION_LEGACY_TRANSFERRED",
            categoria: "ORGANIZACAO",
            titulo: `${registro.nome} — organização transferida`,
            descricao:
            "Esta organização está vinculada historicamente " +
            "à conta, mas possui outro proprietário ativo.",
            orientacao:
            "Nenhuma nova transferência é necessária. " +
            "Preserve os históricos institucionais e não " +
            "exclua os dados da organização.",
            organizacaoId: registro.organizacaoId,
            legadoId: registro.id,
            tipoOrganizacao: tipo,
        });

        continue;
        }
    }

    // Sem proprietário atual diferente comprovado:
    // manter impedimento até regularizar a titularidade.
    impedimentos.push({
        codigo: "ORGANIZATION_LEGACY_OWNER",
        categoria: "ORGANIZACAO",
        titulo: `${registro.nome} — ${tipo}`,
        descricao:
        "Esta entidade institucional ainda aparece vinculada " +
        "à conta sem comprovação de transferência concluída " +
        "para outro proprietário ativo.",
        orientacao:
        "Verifique a titularidade da organização. " +
        "Se ela ainda pertencer a esta conta, transfira a " +
        "propriedade ou regularize seu encerramento.",
        organizacaoId: registro.organizacaoId,
        legadoId: registro.id,
        tipoOrganizacao: tipo,
    });
    }

    const [
        vinculosComoResponsavel,
        atleta,
        professor,
        assinaturasAtivas,
        pagamentosPendentes,
        transferenciasPendentes,
        creatorPessoal,
    ] = await Promise.all([
        prisma.responsavelAtleta.count({
        where: {
            responsavelUsuarioId: usuarioId,
            status: {
            in: ["ATIVO", "PENDENTE"],
            },
        },
        }),

        prisma.atleta.findUnique({
        where: { usuarioId },
        select: {
            id: true,
            clubeId: true,
            escolinhaId: true,
        },
        }),

        prisma.professor.findUnique({
        where: { usuarioId },
        select: { id: true },
        }),

        prisma.assinatura.count({
        where: {
            usuarioId,
            ativo: true,
            canceledAt: null,
        },
        }),

        prisma.pagamento.count({
        where: {
            usuarioId,
            status: "PENDENTE",
        },
        }),

        prisma.transferenciaPropriedade.count({
        where: {
            status: "PENDENTE",
            OR: [
            { proprietarioAtualId: usuarioId },
            { destinatarioId: usuarioId },
            ],
        },
        }),

        prisma.creator.findFirst({
        where: {
            usuarioId,
            tipo: "PESSOA_FISICA",
            organizacaoId: null,
        },
        select: {
            id: true,
            ativo: true,
        },
        }),
    ]);

    // RESPONSÁVEL
    if (vinculosComoResponsavel > 0) {
        impedimentos.push({
        codigo: "RESPONSAVEL_VINCULOS_PENDENTES",
        categoria: "RESPONSAVEL",
        titulo: "Responsabilidade por atletas",
        descricao:
            `Existem ${vinculosComoResponsavel} vínculos ou solicitações ` +
            "de responsabilidade ativos ou pendentes.",
        orientacao:
            "Regularize cada vínculo com os atletas, respeitando " +
            "a supervisão dos menores, antes de encerrar a conta.",
        });
    }

    // ATLETA
    if (atleta) {
        const [
        responsaveisDoAtleta,
        relacoesTreinamento,
        participacoesElenco,
        ] = await Promise.all([
        prisma.responsavelAtleta.count({
            where: {
            atletaId: atleta.id,
            status: {
                in: ["ATIVO", "PENDENTE"],
            },
            },
        }),

        prisma.relacaoTreinamento.count({
            where: {
            atletaId: atleta.id,
            ativo: true,
            encerradoEm: null,
            },
        }),

        prisma.atletaElenco.count({
            where: {
            atletaId: atleta.id,
            elenco: { ativo: true },
            },
        }),
        ]);

        if (
        responsaveisDoAtleta > 0 ||
        relacoesTreinamento > 0 ||
        participacoesElenco > 0 ||
        atleta.clubeId ||
        atleta.escolinhaId
        ) {
        impedimentos.push({
            codigo: "ATLETA_VINCULOS_PENDENTES",
            categoria: "ATLETA",
            titulo: "Vínculos do atleta",
            descricao:
            `Responsáveis: ${responsaveisDoAtleta}. ` +
            `Treinamentos ativos: ${relacoesTreinamento}. ` +
            `Elencos ativos: ${participacoesElenco}. ` +
            `Clube vinculado: ${atleta.clubeId ? "sim" : "não"}. ` +
            `Escolinha vinculada: ${atleta.escolinhaId ? "sim" : "não"}.`,
            orientacao:
            "Regularize os vínculos de responsabilidade, " +
            "treinamento e participação em organizações. " +
            "Para menores, preserve as autorizações necessárias.",
        });
        }
    }

    // PROFESSOR
    if (professor) {
        const [gestorias, treinamentos] =
        await Promise.all([
            prisma.organizacaoGestor.count({
            where: {
                professorId: professor.id,
                ativo: true,
            },
            }),

            prisma.relacaoTreinamento.count({
            where: {
                professorId: professor.id,
                ativo: true,
                encerradoEm: null,
            },
            }),
        ]);

        if (gestorias > 0 || treinamentos > 0) {
        impedimentos.push({
            codigo: "PROFESSOR_RESPONSABILIDADES_ATIVAS",
            categoria: "PROFESSOR",
            titulo: "Responsabilidades de Professor",
            descricao:
            `Gestorias ativas: ${gestorias}. ` +
            `Relações de treinamento: ${treinamentos}.`,
            orientacao:
            "Transfira ou encerre as responsabilidades " +
            "com organizações e atletas antes da exclusão.",
        });
        }
    }

    // CREATOR PESSOAL
    if (creatorPessoal) {
        const vendas = await prisma.creatorVenda.count({
        where: {
            creatorId: creatorPessoal.id,
        },
        });

        if (vendas > 0) {
        avisos.push({
            codigo: "CREATOR_REQUER_REVISAO_FINANCEIRA",
            categoria: "CREATOR",
            titulo: "Histórico comercial do Creator pessoal",
            descricao:
            `Foram encontradas ${vendas} vendas associadas ` +
            "ao Creator pessoal.",
            orientacao:
            "O histórico de vendas precisa ser preservado. " +
            "Antes de autorizar a exclusão, o financeiro deverá " +
            "verificar recebíveis, estornos, disputas e repasses. " +
            "Vendas liquidadas não impedem automaticamente " +
            "o encerramento lógico da conta.",
        });
        }
    }

    // ASSINATURAS
    if (assinaturasAtivas > 0) {
        impedimentos.push({
        codigo: "ASSINATURAS_ATIVAS",
        categoria: "ASSINATURA",
        titulo: "Assinaturas ainda ativas",
        descricao:
            `Existem ${assinaturasAtivas} assinaturas ` +
            "registradas como ativas.",
        orientacao:
            "Consulte suas assinaturas, cancele as renovações " +
            "e confirme se existem obrigações de pagamento " +
            "ou acesso que precisam ser encerradas.",
        });
    }

    // PAGAMENTOS
    if (pagamentosPendentes > 0) {
        impedimentos.push({
        codigo: "PAGAMENTOS_PENDENTES",
        categoria: "FINANCEIRO",
        titulo: "Pagamentos pendentes",
        descricao:
            `Existem ${pagamentosPendentes} pagamentos ` +
            "com status pendente.",
        orientacao:
            "Verifique a situação dos pagamentos com " +
            "o financeiro antes de solicitar a exclusão.",
        });
    }

    // TRANSFERÊNCIAS
    if (transferenciasPendentes > 0) {
        impedimentos.push({
        codigo: "TRANSFERENCIAS_PENDENTES",
        categoria: "TRANSFERENCIA",
        titulo: "Transferências de propriedade pendentes",
        descricao:
            `Existem ${transferenciasPendentes} solicitações ` +
            "de transferência aguardando uma decisão.",
        orientacao:
            "Conclua, recuse ou cancele as solicitações " +
            "pendentes, conforme sua participação e permissões.",
        });
    }
 
    /*
   * ETAPA 2.3 — Conteúdos e obrigações operacionais.
   *
   * Conteúdos pessoais não possuem vínculos com
   * Clube, Escolinha, Marca ou Federação.
   *
   * Isso evita responsabilizar automaticamente o
   * antigo proprietário por conteúdos institucionais
   * transferidos para outra pessoa.
   */

  const conteudoPessoal = {
    criadorUsuarioId: usuarioId,
    clubeId: null,
    escolinhaId: null,
    federacaoId: null,
    marcaId: null,
  };

  const [
    metodologiasLearning,
    metodologiasAvulsas,
    aulasPessoaisPendentes,
    eventosPessoaisPendentes,
    inscricoesPendentes,
    olheiro,
  ] = await Promise.all([
    prisma.metodologia.findMany({
      where: conteudoPessoal,
      select: {
        id: true,
        titulo: true,
        ativo: true,
      },
    }),

    prisma.metodologiaAvulsa.findMany({
      where: conteudoPessoal,
      select: {
        id: true,
        titulo: true,
        ativo: true,
      },
    }),

    prisma.aulaAoVivo.count({
      where: {
        criadorUsuarioId: usuarioId,
        contextoKind: "PERSONAL",
        status: {
          in: ["AGENDADA", "AO_VIVO"],
        },
      },
    }),

    prisma.evento.count({
      where: {
        creatorUsuarioId: usuarioId,
        organizacaoId: null,
        clubeId: null,
        escolinhaId: null,
        marcaId: null,
        federacaoId: null,
        status: {
          in: ["ABERTO"],
        },
      },
    }),

    prisma.inscricaoEvento.count({
      where: {
        usuarioId,
        status: "PENDENTE",
      },
    }),

    prisma.olheiro.findUnique({
      where: { usuarioId },
      select: {
        id: true,
        colaboracaoClubeId: true,
        colaboracaoEscolinhaId: true,
        colaboracaoProfessorId: true,
      },
    }),
  ]);

  const idsLearning =
    metodologiasLearning.map((m) => m.id);

  const idsAvulsas =
    metodologiasAvulsas.map((m) => m.id);

  const [
    assinantesLearning,
    assinantesAvulsas,
  ] = await Promise.all([
    idsLearning.length > 0
      ? prisma.metodologiaAssinante.count({
          where: {
            metodologiaId: { in: idsLearning },
            status: "ATIVA",
          },
        })
      : Promise.resolve(0),

    idsAvulsas.length > 0
      ? prisma.metodologiaAssinante.count({
          where: {
            metodologiaAvulsaId: { in: idsAvulsas },
            status: "ATIVA",
          },
        })
      : Promise.resolve(0),
  ]);

  const totalAssinantes =
    assinantesLearning + assinantesAvulsas;

  const totalMetodologiasPublicadas =
    metodologiasLearning.filter((m) => m.ativo).length +
    metodologiasAvulsas.filter((m) => m.ativo).length;

  // METODOLOGIAS PESSOAIS
  if (
    totalAssinantes > 0 ||
    totalMetodologiasPublicadas > 0
  ) {
    impedimentos.push({
      codigo: "CONTEUDOS_PESSOAIS_COM_OBRIGACOES",
      categoria: "CONTEUDO",
      titulo: "Metodologias e assinantes",
      descricao:
        `Metodologias publicadas: ${totalMetodologiasPublicadas}. ` +
        `Assinaturas de metodologia ativas: ${totalAssinantes}.`,
      orientacao:
        "Revise as metodologias e garanta a continuidade " +
        "do acesso dos assinantes. Conteúdos vendidos não " +
        "devem ser apagados automaticamente.",
    });
  }

  // AULAS AO VIVO
  if (aulasPessoaisPendentes > 0) {
    impedimentos.push({
      codigo: "AULAS_PESSOAIS_PENDENTES",
      categoria: "LEARNING",
      titulo: "Aulas ao vivo pendentes",
      descricao:
        `Existem ${aulasPessoaisPendentes} aulas ` +
        "pessoais agendadas ou em andamento.",
      orientacao:
        "Conclua ou cancele as aulas, verificando " +
        "antes inscrições, pagamentos e acessos adquiridos.",
    });
  }

  // EVENTOS PESSOAIS
  if (eventosPessoaisPendentes > 0) {
    impedimentos.push({
      codigo: "EVENTOS_PESSOAIS_ABERTOS",
      categoria: "EVENTO",
      titulo: "Eventos em aberto",
      descricao:
        `Existem ${eventosPessoaisPendentes} eventos ` +
        "pessoais com inscrições abertas.",
      orientacao:
        "Conclua ou encerre os eventos e resolva " +
        "inscrições e pagamentos envolvidos.",
    });
  }

  // INSCRIÇÕES DO USUÁRIO
  if (inscricoesPendentes > 0) {
    impedimentos.push({
      codigo: "INSCRICOES_PENDENTES",
      categoria: "EVENTO",
      titulo: "Inscrições em eventos pendentes",
      descricao:
        `Existem ${inscricoesPendentes} inscrições ` +
        "em eventos aguardando resolução.",
      orientacao:
        "Consulte suas inscrições e resolva as solicitações " +
        "pendentes antes da exclusão.",
    });
  }

  // OLHEIRO
  if (olheiro) {
    const indicacoesPendentes =
      await prisma.indicacao.count({
        where: {
          olheiroId: olheiro.id,
          status: "PENDENTE",
        },
      });

    const possuiColaboracao =
      Boolean(
        olheiro.colaboracaoClubeId ||
        olheiro.colaboracaoEscolinhaId ||
        olheiro.colaboracaoProfessorId
      );

    if (
      indicacoesPendentes > 0 ||
      possuiColaboracao
    ) {
      impedimentos.push({
        codigo: "OLHEIRO_COMPROMISSOS_PENDENTES",
        categoria: "OLHEIRO",
        titulo: "Compromissos do Olheiro",
        descricao:
          `Indicações pendentes: ${indicacoesPendentes}. ` +
          `Colaboração cadastrada: ${possuiColaboracao ? "sim" : "não"}.`,
        orientacao:
          "Resolva as indicações pendentes e formalize " +
          "o encerramento das colaborações profissionais.",
      });
    }
  }

  return {
    encontrado: true,
    excluido: Boolean(usuario.deletedAt),
    diagnosticoCompleto: false,
    podeSolicitarExclusao: false,
    impedimentos,
    avisos,
  };
}