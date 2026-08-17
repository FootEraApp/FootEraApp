import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { calcularPerfilVerificado } from "../utils/perfilVerificado.js";
import { avaliarPrivacidadePerfil } from "../utils/privacy.js";

const usuarioExplorarSelect = {
  id: true,
  nome: true,
  nomeDeUsuario: true,
  email: true, 
  verified: true,
  destaque: true,
  foto: true,
  cidade: true,
  estado: true,
  dataCriacao: true,

  assinatura: {
    select: {
      plano: true,
      status: true,
      trialEndsAt: true,
      renovaEm: true,
      startsAt: true,
    },
  },
} as const;

function sanitizarItemExplorar(item: any) {
  if (!item) return item;

  const {
    email,
    emailPublico,
    ...rest
  } = item;

  const usuario = item.usuario
    ? (() => {
        const {
          email: _email,
          ...usuarioSemEmail
        } = item.usuario;

        return usuarioSemEmail;
      })()
    : item.usuario;

  return {
    ...rest,
    usuario,
  };
}

function getAssinaturaAtual<
  T extends {
    plano?: string | null;
    status?: string | null;
    trialEndsAt?: Date | string | null;
    renovaEm?: Date | string | null;
    startsAt?: Date | string | null;
  }
>(assinaturas: T[] | null | undefined): T | null {
  if (!assinaturas || assinaturas.length === 0) return null;

  const prioridadeStatus = ["ATIVA", "TRIAL", "SEM_ASSINATURA", "BLOQUEADA", "CANCELADA"];

  const ordenadas = [...assinaturas].sort((a, b) => {
    const statusA = String(a.status || "").toUpperCase();
    const statusB = String(b.status || "").toUpperCase();

    const pA = prioridadeStatus.indexOf(statusA);
    const pB = prioridadeStatus.indexOf(statusB);

    if (pA !== pB) {
      return (pA === -1 ? 999 : pA) - (pB === -1 ? 999 : pB);
    }

    const dataA = new Date((a.renovaEm || a.startsAt || a.trialEndsAt || 0) as any).getTime();
    const dataB = new Date((b.renovaEm || b.startsAt || b.trialEndsAt || 0) as any).getTime();

    return dataB - dataA;
  });

  return ordenadas[0] ?? null;
}

function calcIsPro(
  assinatura:
    | {
        plano?: string | null;
        status?: string | null;
        trialEndsAt?: Date | string | null;
      }
    | null
    | undefined
) {
  if (!assinatura) return false;

  const status = String(assinatura.status || "").trim().toUpperCase();
  const plano = String(assinatura.plano || "").trim().toUpperCase();

  if (
    status === "BLOQUEADA" ||
    status === "CANCELADA" ||
    status === "INATIVA" ||
    status === "SEM_ASSINATURA"
  ) {
    return false;
  }

  if (status === "ATIVA") return true;

  if (status === "TRIAL") {
    const trialEndsAt = assinatura.trialEndsAt ? new Date(assinatura.trialEndsAt) : null;

    if (trialEndsAt && !Number.isNaN(trialEndsAt.getTime())) {
      return new Date() <= trialEndsAt;
    }

    if (plano.includes("PRO")) return true;

    return true;
  }

  if (plano.includes("PRO")) return true;

  return false;
}

function isDestaqueItem(item: any) {
  return Boolean(
    item?.destaque === true ||
      item?.usuario?.destaque === true ||
      item?.perfilDestaque === true
  );
}

function ordenarDestaquesProNome<T>(
  items: T[],
  getName: (item: T) => string
): T[] {
  function prioridade(item: any) {
    if (isDestaqueItem(item)) {
      return 0;
    }

    if (item?.isPro === true) {
      return 1;
    }

    return 2;
  }

  return [...items].sort(
    (a: any, b: any) => {
      const prioridadeA =
        prioridade(a);

      const prioridadeB =
        prioridade(b);

      if (
        prioridadeA !==
        prioridadeB
      ) {
        return (
          prioridadeA -
          prioridadeB
        );
      }

      return getName(a).localeCompare(
        getName(b),
        "pt-BR",
        {
          sensitivity:
            "base",
        }
      );
    }
  );
}

async function filtrarPerfisVisiveis<T>(
  viewerId: string | null | undefined,
  items: T[],
  getUsuarioId: (item: T) => string | null | undefined
): Promise<T[]> {
  if (!viewerId) return [];

  const result = await Promise.all(
    items.map(async (item) => {
      const targetId = getUsuarioId(item);

      if (!targetId) return null;

      const acesso = await avaliarPrivacidadePerfil(
        viewerId,
        targetId
      );

      return acesso.podeVerPerfil
        ? item
        : null;
    })
  );

  return result.filter(Boolean) as T[];
}

export async function listarAtletasExplorar(req: Request, res: Response) {
  try {
    const authUserId = (req as any).userId as string | undefined;
    const excludeUsuarioId = (req.query.excludeUsuarioId as string) || authUserId || "";
    const excludeAtletaId = req.query.excludeAtletaId as string | undefined;
    const andFilters: any[] = [];

    if (excludeUsuarioId) andFilters.push({ usuarioId: { not: excludeUsuarioId } });
    if (excludeAtletaId) andFilters.push({ id: { not: excludeAtletaId } });

    const where = andFilters.length ? { AND: andFilters } : undefined;

    const atletas = await prisma.atleta.findMany({
      where,
      select: {
        id: true,
        usuarioId: true,
        idade: true,
        posicao: true,
        categoria: true,
        perfilTipoTreino: true,
        pontosTotal: true,
        clubeId: true,
        escolinhaId: true,
        foto: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            nomeDeUsuario: true,
            email: true,
            verified: true,
            destaque: true,
            foto: true,
            cidade: true,
            estado: true,
            dataCriacao: true,
            assinatura: {
              select: {
                plano: true,
                status: true,
                trialEndsAt: true,
                renovaEm: true,
                startsAt: true,
              },
            },
          },
        },
        pontuacao: {
          select: {
            pontuacaoTotal: true,
          },
        },
      },
      orderBy: { dataCriacao: "desc" },
      take: 100,
    });

    const payload = atletas.map((a) => {
      const pontuacaoTotal =
        a.pontuacao?.pontuacaoTotal ??
        a.pontosTotal ??
        0;
      const independente = !a.clubeId && !a.escolinhaId;
      const assinaturaAtual = getAssinaturaAtual(a.usuario?.assinatura);
      const isPro = calcIsPro(assinaturaAtual);

      const perfilVerificado = calcularPerfilVerificado({
        usuario: a.usuario
          ? {
              verified: a.usuario.verified,
              nome: a.usuario.nome,
              nomeDeUsuario: (a.usuario as any).nomeDeUsuario,
              email: (a.usuario as any).email,
              foto: a.foto ?? a.usuario.foto ?? null,
            }
          : null,
        tipo: "atleta",
        atleta: {
          posicao: a.posicao ?? null,
          categoria: a.categoria ?? [],
          idade: a.idade ?? null,
          telefone1: (a as any).telefone1 ?? null,
          nacionalidade: (a as any).nacionalidade ?? null,
          naturalidade: (a as any).naturalidade ?? null,
          altura: (a as any).altura ?? null,
          peso: (a as any).peso ?? null,
          seloQualidade: (a as any).seloQualidade ?? null,
        },
      });
      return {
        id: a.id,
        usuarioId: a.usuarioId,
        usuario: a.usuario,
        foto: a.foto ?? a.usuario?.foto ?? null,
        idade: a.idade ?? null,
        posicao: a.posicao ?? null,
        categoria: a.categoria ?? [],
        cidade: a.usuario?.cidade ?? null,
        estado: a.usuario?.estado ?? null,
        independente,
        pontuacao: pontuacaoTotal,
        categoriaBase: null,
        tipoTreino: a.perfilTipoTreino ?? null,
        isPro,
        perfilVerificado,
      };
    });

    const payloadVisivel =
      await filtrarPerfisVisiveis(
        authUserId,
        payload,
        (a: any) =>
          a.usuarioId ??
          a.usuario?.id
      );

    const payloadSeguro =
      payloadVisivel.map(
        sanitizarItemExplorar
      );

    res.json(
      ordenarDestaquesProNome(
        payloadSeguro,
        (a: any) =>
          a?.usuario?.nome ?? ""
      )
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao carregar atletas do explorar" });
  }
}

export async function explorar(req: Request, res: Response) {
  try {
    const { q } = req.query;
    const userIdLogado = (req as any).userId || null;
    const termo = q ? String(q).trim() : "";

    const excludeUsuarioId =
      (req.query.excludeUsuarioId as string) ||
      ((req as any).userId as string) ||
      "";

    const atletasRaw = await prisma.atleta.findMany({
      where: excludeUsuarioId ? { usuarioId: { not: excludeUsuarioId } } : undefined,
      select: {
        id: true,
        usuarioId: true,
        idade: true,
        posicao: true,
        categoria: true,
        perfilTipoTreino: true,
        pontosTotal: true,
        clubeId: true,
        escolinhaId: true,
        telefone1: true,
        nacionalidade: true,
        naturalidade: true,
        altura: true,
        peso: true,
        seloQualidade: true,
        foto: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            nomeDeUsuario: true,
            email: true,
            verified: true,
            destaque: true,
            foto: true,
            cidade: true,
            estado: true,
            dataCriacao: true,
            assinatura: {
              select: {
                plano: true,
                status: true,
                trialEndsAt: true,
                renovaEm: true,
                startsAt: true,
              },
            },
          },
        },
        pontuacao: {
          select: {
            pontuacaoTotal: true,
          },
        },
      },
      orderBy: { dataCriacao: "desc" },
      take: 200,
    });

    const atletas = atletasRaw.map((a) => {
      const pontuacaoTotal =
        a.pontuacao?.pontuacaoTotal ??
        a.pontosTotal ??
        0;
      const independente = !a.clubeId && !a.escolinhaId;
      const assinaturaAtual = getAssinaturaAtual(a.usuario?.assinatura);
      const isPro = calcIsPro(assinaturaAtual);

      const perfilVerificado = calcularPerfilVerificado({
        usuario: a.usuario
          ? {
              verified: a.usuario.verified,
              nome: a.usuario.nome ?? null,
              nomeDeUsuario: a.usuario.nomeDeUsuario ?? null,
              email: a.usuario.email ?? null,
              foto: a.foto ?? a.usuario.foto ?? null,
            }
          : null,
        tipo: "atleta",
        atleta: {
          posicao: a.posicao ?? null,
          categoria: a.categoria ?? [],
          idade: a.idade ?? null,
          telefone1: a.telefone1 ?? null,
          nacionalidade: a.nacionalidade ?? null,
          naturalidade: a.naturalidade ?? null,
          altura: a.altura ?? null,
          peso: a.peso ?? null,
          seloQualidade: a.seloQualidade ?? null,
        },
      });

      return {
        id: a.id,
        usuarioId: a.usuarioId,
        usuario: a.usuario,
        foto: a.foto ?? a.usuario?.foto ?? null,
        idade: a.idade ?? null,
        posicao: a.posicao ?? null,
        categoria: a.categoria ?? [],
        cidade: a.usuario?.cidade ?? null,
        estado: a.usuario?.estado ?? null,
        independente,
        pontuacao: pontuacaoTotal,
        categoriaBase: null,
        tipoTreino: a.perfilTipoTreino ?? null,
        isPro,
        perfilVerificado,
      };
    });

    const clubesRaw = await prisma.clube.findMany({
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            nomeDeUsuario: true,
            email: true,
            verified: true,
            destaque: true,
            foto: true,
            cidade: true,
            estado: true,
            dataCriacao: true,
            assinatura: {
              select: {
                plano: true,
                status: true,
                trialEndsAt: true,
                renovaEm: true,
                startsAt: true,
              },
            },
          },
        },
      },
      where: termo ? { usuario: { nome: { contains: termo, mode: "insensitive" } } } : {},
      orderBy: { nome: "asc" },
      take: 100,
    });

    const clubes = clubesRaw.map((c) => ({
      ...c,
      isPro: calcIsPro(getAssinaturaAtual(c.usuario?.assinatura)),
      perfilVerificado: calcularPerfilVerificado({
        usuario: c.usuario
          ? {
              verified: c.usuario.verified,
              nome: c.usuario.nome ?? c.nome ?? null,
              nomeDeUsuario: (c.usuario as any).nomeDeUsuario,
              email: (c.usuario as any).email ?? c.email ?? null,
              foto: c.logo ?? c.usuario.foto ?? null,
            }
          : null,
        tipo: "clube",
        clube: {
          nome: c.nome ?? null,
          cnpj: (c as any).cnpj ?? null,
          email: (c as any).email ?? null,
          telefone1: (c as any).telefone1 ?? null,
          siteOficial: (c as any).siteOficial ?? null,
          sede: (c as any).sede ?? null,
          cidade: (c as any).cidade ?? null,
          estado: (c as any).estado ?? null,
          bairro: (c as any).bairro ?? null,
          pais: (c as any).pais ?? null,
          cep: (c as any).cep ?? null,
          logo: (c as any).logo ?? null,
        },
      }),
    }));

    const federacoesRaw = await prisma.federacao.findMany({
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            nomeDeUsuario: true,
            email: true,
            verified: true,
            destaque: true,
            foto: true,
            cidade: true,
            estado: true,
            dataCriacao: true,
            assinatura: {
              select: {
                plano: true,
                status: true,
                trialEndsAt: true,
                renovaEm: true,
                startsAt: true,
              },
            },
          },
        },
      },
      where: {
        usuario: {
          tipo: "Federacao" as any,
        },
        ...(termo
          ? {
              OR: [
                { nome: { contains: termo, mode: "insensitive" } },
                { usuario: { nome: { contains: termo, mode: "insensitive" } } },
                { usuario: { nomeDeUsuario: { contains: termo, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { nome: "asc" },
      take: 100,
    });

    const federacoes = federacoesRaw.map((f) => ({
      ...f,
      isPro: calcIsPro(getAssinaturaAtual(f.usuario?.assinatura)),
      perfilVerificado: calcularPerfilVerificado({
        usuario: f.usuario
          ? {
              verified: f.usuario.verified,
              nome: f.usuario.nome ?? f.nome ?? null,
              nomeDeUsuario: f.usuario.nomeDeUsuario,
              email: f.usuario.email ?? null,
              foto: f.logo ?? f.usuario.foto ?? null,
            }
          : null,
        tipo: "clube",
        clube: {
          nome: f.nome ?? null,
          cnpj: null,
          email: f.usuario?.email ?? null,
          telefone1: null,
          siteOficial: f.siteOficial ?? null,
          sede: null,
          cidade: f.cidade ?? null,
          estado: f.estado ?? null,
          bairro: null,
          pais: null,
          cep: null,
          logo: f.logo ?? null,
        },
      }),
    }));

    const marcasRaw = await prisma.marca.findMany({
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            nomeDeUsuario: true,
            email: true,
            verified: true,
            destaque: true,
            foto: true,
            cidade: true,
            estado: true,
            dataCriacao: true,
            assinatura: {
              select: {
                plano: true,
                status: true,
                trialEndsAt: true,
                renovaEm: true,
                startsAt: true,
              },
            },
          },
        },
      },
      where: {
        usuario: {
          tipo: "Marca" as any,
        },
        ...(termo
          ? {
              OR: [
                { nome: { contains: termo, mode: "insensitive" } },
                { usuario: { nome: { contains: termo, mode: "insensitive" } } },
                { usuario: { nomeDeUsuario: { contains: termo, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { nome: "asc" },
      take: 100,
    });

    const marcas = marcasRaw.map((m) => ({
      ...m,
      isPro: calcIsPro(getAssinaturaAtual(m.usuario?.assinatura)),
        perfilVerificado: calcularPerfilVerificado({
        usuario: m.usuario
          ? {
              verified: m.usuario.verified,
              nome: m.usuario.nome ?? m.nome ?? null,
              nomeDeUsuario: m.usuario.nomeDeUsuario,
              email: m.usuario.email ?? null,
              foto: m.logo ?? m.usuario.foto ?? null,
            }
          : null,
        tipo: "clube",
        clube: {
          nome: m.nome ?? null,
          cnpj: null,
          email: m.usuario?.email ?? null,
          telefone1: null,
          siteOficial: m.siteOficial ?? null,
          sede: null,
          cidade: m.cidade ?? null,
          estado: m.estado ?? null,
          bairro: null,
          pais: null,
          cep: null,
          logo: m.logo ?? null,
        },
      }),
    }));

    const escolasRaw = await prisma.escolinha.findMany({
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            nomeDeUsuario: true,
            email: true,
            verified: true,
            destaque: true,
            foto: true,
            cidade: true,
            estado: true,
            dataCriacao: true,
            assinatura: {
              select: {
                plano: true,
                status: true,
                trialEndsAt: true,
                renovaEm: true,
                startsAt: true,
              },
            },
          },
        },
      },
      where: termo ? { usuario: { nome: { contains: termo, mode: "insensitive" } } } : {},
      orderBy: { nome: "asc" },
      take: 100,
    });

    const escolas = escolasRaw.map((e) => ({
      ...e,
      isPro: calcIsPro(getAssinaturaAtual(e.usuario?.assinatura)),
      perfilVerificado: calcularPerfilVerificado({
        usuario: e.usuario
          ? {
              verified: e.usuario.verified,
              nome: e.usuario.nome ?? e.nome ?? null,
              nomeDeUsuario: (e.usuario as any).nomeDeUsuario,
              email: (e.usuario as any).email ?? e.email ?? null,
              foto: e.logo ?? e.usuario.foto ?? null,
            }
          : null,
        tipo: "escolinha",
        escolinha: {
          nome: e.nome ?? null,
          cnpj: (e as any).cnpj ?? null,
          email: (e as any).email ?? null,
          telefone1: (e as any).telefone1 ?? null,
          siteOficial: (e as any).siteOficial ?? null,
          cidade: (e as any).cidade ?? null,
          estado: (e as any).estado ?? null,
          bairro: (e as any).bairro ?? null,
          pais: (e as any).pais ?? null,
          cep: (e as any).cep ?? null,
          logo: (e as any).logo ?? null,
        },
      }),
    }));

    const professoresRaw = await prisma.professor.findMany({
      select: {
        id: true,
        nome: true,
        areaFormacao: true,
        cref: true,
        statusCref: true,
        dataNascimento: true,
        escola: true,
        qualificacoes: true,
        certificacoes: true,
        fotoUrl: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            nomeDeUsuario: true,
            email: true,
            verified: true,
            destaque: true,
            foto: true,
            cidade: true,
            estado: true,
            dataCriacao: true,
            assinatura: {
              select: {
                plano: true,
                status: true,
                trialEndsAt: true,
                renovaEm: true,
                startsAt: true,
              },
            },
          },
        },
      },
      where: termo ? { usuario: { nome: { contains: termo, mode: "insensitive" } } } : {},
      orderBy: { usuario: { nome: "asc" } },
      take: 100,
    });

    const professores = professoresRaw.map((p) => ({
      ...p,
      isPro: calcIsPro(getAssinaturaAtual(p.usuario?.assinatura)),
      perfilVerificado: calcularPerfilVerificado({
        usuario: p.usuario
          ? {
              verified: p.usuario.verified,
              nome: p.usuario.nome ?? p.nome ?? null,
              nomeDeUsuario: (p.usuario as any).nomeDeUsuario,
              email: (p.usuario as any).email,
              foto: p.fotoUrl ?? p.usuario.foto ?? null,
            }
          : null,
        tipo: "professor",
        professor: {
          areaFormacao: p.areaFormacao ?? null,
          cref: p.cref ?? null,
          statusCref: p.statusCref ?? null,
          dataNascimento: (p as any).dataNascimento ?? null,
          escola: p.escola ?? null,
          qualificacoes: p.qualificacoes ?? null,
          certificacoes: p.certificacoes ?? null,
          fotoUrl: p.fotoUrl ?? null,
        },
      }),
    }));

    const olheirosRaw = await prisma.olheiro.findMany({
      select: {
        id: true,
        fotoUrl: true,
        areaAtuacao: true,
        anosExperiencia: true,
        emailPublico: true,
        telefonePublico: true,
        descricao: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            nomeDeUsuario: true,
            email: true,
            verified: true,
            destaque: true,
            foto: true,
            cidade: true,
            estado: true,
            dataCriacao: true,
            assinatura: {
              select: {
                plano: true,
                status: true,
                trialEndsAt: true,
                renovaEm: true,
                startsAt: true,
              },
            },
          },
        },
      },
      where: termo ? { usuario: { nome: { contains: termo, mode: "insensitive" } } } : {},
      orderBy: { usuario: { nome: "asc" } },
      take: 100,
    });

    const olheiros = olheirosRaw.map((o) => ({
      ...o,
      isPro: calcIsPro(getAssinaturaAtual(o.usuario?.assinatura)),
      perfilVerificado: calcularPerfilVerificado({
        usuario: o.usuario
          ? {
              verified: o.usuario.verified,
              nome: o.usuario.nome ?? null,
              nomeDeUsuario: (o.usuario as any).nomeDeUsuario,
              email: (o.usuario as any).email ?? null,
              foto: o.fotoUrl ?? o.usuario.foto ?? null,
            }
          : null,
        tipo: "olheiro",
        olheiro: {
          areaAtuacao: o.areaAtuacao ?? null,
          anosExperiencia: o.anosExperiencia ?? null,
          emailPublico: o.emailPublico ?? null,
          telefonePublico: o.telefonePublico ?? null,
          descricao: o.descricao ?? null,
          fotoUrl: o.fotoUrl ?? o.usuario.foto ?? null,
        },
      }),
    }));

    const learningRaw: any[] = await prisma.learningProfile.findMany({
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            nomeDeUsuario: true,
            email: true,
            tipo: true,
            verified: true,
            destaque: true,
            foto: true,
            cidade: true,
            estado: true,
            dataCriacao: true,
            assinatura: {
              select: {
                plano: true,
                status: true,
                trialEndsAt: true,
                renovaEm: true,
                startsAt: true,
              },
            },
          },
        },
      },
      where: {
        usuario: {
          tipo: "Learning" as any,
          ...(termo
            ? {
                OR: [
                  { nome: { contains: termo, mode: "insensitive" } },
                  { nomeDeUsuario: { contains: termo, mode: "insensitive" } },
                  { email: { contains: termo, mode: "insensitive" } },
                ],
              }
            : {}),
        },
      },
      orderBy: { criadoEm: "desc" },
      take: 100,
    });

    const learning = learningRaw.map((l: any) => {
      const usuario = l.usuario ?? null;

      return {
        ...l,
        tipoOutro: "Learning",
        nome: usuario?.nome ?? usuario?.nomeDeUsuario ?? "Learning",
        usuarioId: l.usuarioId,
        logo: usuario?.foto ?? null,
        cidade: usuario?.cidade ?? null,
        estado: usuario?.estado ?? null,
        usuario,
        isPro: calcIsPro(getAssinaturaAtual(usuario?.assinatura)),
        perfilVerificado: calcularPerfilVerificado({
          usuario: usuario
            ? {
                verified: usuario.verified,
                nome: usuario.nome ?? null,
                nomeDeUsuario: usuario.nomeDeUsuario ?? null,
                email: usuario.email ?? null,
                foto: usuario.foto ?? null,
              }
            : null,
          tipo: "learning",
        } as any),
      };
    });

    const agora = new Date();
    const whereEvento: any = {
      status: "ABERTO",
      dataEvento: { gte: agora },
    };

    if (termo) {
      whereEvento.OR = [
        { titulo: { contains: termo, mode: "insensitive" } },
        { cidade: { contains: termo, mode: "insensitive" } },
        { estado: { contains: termo, mode: "insensitive" } },
        { pais: { contains: termo, mode: "insensitive" } },
        { local: { contains: termo, mode: "insensitive" } },
      ];
    }

    const eventosRaw = await prisma.evento.findMany({
      where: whereEvento,
      include: {
        clube: { select: { id: true, nome: true, logo: true } },
        escolinha: { select: { id: true, nome: true, logo: true } },
        inscricoes: { select: { usuarioId: true } },
      },
      orderBy: { dataEvento: "asc" },
      take: 50,
    });

    const eventos = eventosRaw.map((e: any) => ({
      ...e,
      dataEvento: e.dataEvento?.toISOString?.() ?? e.dataEvento,
      inscricaoInicio: e.inscricaoInicio?.toISOString?.() ?? e.inscricaoInicio,
      inscricaoFim: e.inscricaoFim?.toISOString?.() ?? e.inscricaoFim,
      inscrito: e.inscricoes?.some(
        (i: any) => String(i.usuarioId) === String(userIdLogado)
      ),
    }));

    const [
      atletasVisiveis,
      clubesVisiveis,
      escolasVisiveis,
      professoresVisiveis,
      olheirosVisiveis,
      federacoesVisiveis,
      marcasVisiveis,
      learningVisiveis,
    ] = await Promise.all([
      filtrarPerfisVisiveis(
        userIdLogado,
        atletas,
        (x: any) => x.usuarioId ?? x.usuario?.id
      ),

      filtrarPerfisVisiveis(
        userIdLogado,
        clubes,
        (x: any) => x.usuarioId ?? x.usuario?.id
      ),

      filtrarPerfisVisiveis(
        userIdLogado,
        escolas,
        (x: any) => x.usuarioId ?? x.usuario?.id
      ),

      filtrarPerfisVisiveis(
        userIdLogado,
        professores,
        (x: any) => x.usuarioId ?? x.usuario?.id
      ),

      filtrarPerfisVisiveis(
        userIdLogado,
        olheiros,
        (x: any) => x.usuarioId ?? x.usuario?.id
      ),

      filtrarPerfisVisiveis(
        userIdLogado,
        federacoes,
        (x: any) => x.usuarioId ?? x.usuario?.id
      ),

      filtrarPerfisVisiveis(
        userIdLogado,
        marcas,
        (x: any) => x.usuarioId ?? x.usuario?.id
      ),

      filtrarPerfisVisiveis(
        userIdLogado,
        learning,
        (x: any) => x.usuarioId ?? x.usuario?.id
      ),
    ]);

    return res.json({
      atletas: ordenarDestaquesProNome(
        atletasVisiveis,
        (a: any) =>
          a?.usuario?.nome ?? ""
      ).map(sanitizarItemExplorar),

      clubes: ordenarDestaquesProNome(
        clubesVisiveis,
        (c: any) =>
          c?.nome ??
          c?.usuario?.nome ??
          ""
      ).map(sanitizarItemExplorar),

      escolas: ordenarDestaquesProNome(
        escolasVisiveis,
        (e: any) =>
          e?.nome ??
          e?.usuario?.nome ??
          ""
      ).map(sanitizarItemExplorar),

      professores: ordenarDestaquesProNome(
        professoresVisiveis,
        (p: any) =>
          p?.usuario?.nome ??
          p?.nome ??
          ""
      ).map(sanitizarItemExplorar),

      olheiros: ordenarDestaquesProNome(
        olheirosVisiveis,
        (o: any) =>
          o?.usuario?.nome ?? ""
      ).map(sanitizarItemExplorar),

      eventos,

      federacoes: ordenarDestaquesProNome(
        federacoesVisiveis,
        (f: any) =>
          f?.nome ??
          f?.usuario?.nome ??
          ""
      ).map(sanitizarItemExplorar),

      marcas: ordenarDestaquesProNome(
        marcasVisiveis,
        (m: any) =>
          m?.nome ??
          m?.usuario?.nome ??
          ""
      ).map(sanitizarItemExplorar),

      learning: ordenarDestaquesProNome(
        learningVisiveis,
        (l: any) =>
          l?.nome ??
          l?.usuario?.nome ??
          ""
      ).map(sanitizarItemExplorar),
    });
  } catch (error) {
    console.error("Erro em /api/explorar:", error);
    return res.status(500).json({ error: "Erro ao carregar dados do explorar" });
  }
}

export const buscarExplorar = async (req: Request, res: Response) => {
  const { q } = req.query;

  try {
    const termo = q ? String(q).trim() : "";
    const userIdLogado = (req as any).userId || null;

    const [atletas, clubes, escolas, professores, olheiros, federacoes, marcas, learning] = await Promise.all([
      prisma.atleta.findMany({
        where: termo
          ? { usuario: { nome: { contains: termo, mode: "insensitive" } } }
          : {},
        select: {
          id: true,
          usuarioId: true,
          idade: true,
          posicao: true,
          categoria: true,
          perfilTipoTreino: true,
          pontosTotal: true,
          clubeId: true,
          escolinhaId: true,
          usuario: {
            select: {
              id: true,
              nome: true,
              nomeDeUsuario: true,
              email: true,
              verified: true,
              destaque: true,
              foto: true,
              cidade: true,
              estado: true,
              dataCriacao: true,
              assinatura: {
                select: {
                  plano: true,
                  status: true,
                  trialEndsAt: true,
                  renovaEm: true,
                  startsAt: true,
                },
              },
            },
          },
          pontuacao: { select: { pontuacaoTotal: true } },
        },
        take: 50,
      }),

      prisma.clube.findMany({
        where: termo ? { nome: { contains: termo, mode: "insensitive" } } : {},
        include: { usuario: { select: usuarioExplorarSelect,} },
        take: 50,
      }),

      prisma.escolinha.findMany({
        where: termo ? { nome: { contains: termo, mode: "insensitive" } } : {},
        include: { usuario: { select: usuarioExplorarSelect,} },
        take: 50,
      }),

      prisma.professor.findMany({
        where: termo
          ? { usuario: { nome: { contains: termo, mode: "insensitive" } } }
          : {},
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              nomeDeUsuario: true,
              email: true,
              verified: true,
              destaque: true,
              foto: true,
              cidade: true,
              estado: true,
              dataCriacao: true,
              assinatura: {
                select: {
                  plano: true,
                  status: true,
                  trialEndsAt: true,
                  renovaEm: true,
                  startsAt: true,
                },
              },
            },
          },
        },
        take: 50,
      }),

      prisma.olheiro.findMany({
        where: termo
          ? { usuario: { nome: { contains: termo, mode: "insensitive" } } }
          : {},
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              nomeDeUsuario: true,
              email: true,
              verified: true,
              destaque: true,
              foto: true,
              cidade: true,
              estado: true,
              dataCriacao: true,
              assinatura: {
                select: {
                  plano: true,
                  status: true,
                  trialEndsAt: true,
                  renovaEm: true,
                  startsAt: true,
                },
              },
            },
          },
        },
        take: 50,
      }),
      prisma.federacao.findMany({
        where: termo
          ? {
              OR: [
                { nome: { contains: termo, mode: "insensitive" } },
                { usuario: { nome: { contains: termo, mode: "insensitive" } } },
                { usuario: { nomeDeUsuario: { contains: termo, mode: "insensitive" } } },
              ],
            }
          : {},
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              nomeDeUsuario: true,
              email: true,
              tipo: true,
              verified: true,
              destaque: true,
              foto: true,
              cidade: true,
              estado: true,
              dataCriacao: true,
              assinatura: {
                select: {
                  plano: true,
                  status: true,
                  trialEndsAt: true,
                  renovaEm: true,
                  startsAt: true,
                },
              },
            },
          },
        },
        take: 50,
      }),
            prisma.marca.findMany({
        where: termo
          ? {
              OR: [
                { nome: { contains: termo, mode: "insensitive" } },
                { usuario: { nome: { contains: termo, mode: "insensitive" } } },
                { usuario: { nomeDeUsuario: { contains: termo, mode: "insensitive" } } },
              ],
            }
          : {},
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              nomeDeUsuario: true,
              email: true,
              tipo: true,
              verified: true,
              destaque: true,
              foto: true,
              cidade: true,
              estado: true,
              dataCriacao: true,
              assinatura: {
                select: {
                  plano: true,
                  status: true,
                  trialEndsAt: true,
                  renovaEm: true,
                  startsAt: true,
                },
              },
            },
          },
        },
        take: 50,
      }),
      prisma.learningProfile.findMany({
        where: {
          usuario: {
            tipo: "Learning" as any,
            ...(termo
              ? {
                  OR: [
                    { nome: { contains: termo, mode: "insensitive" } },
                    { nomeDeUsuario: { contains: termo, mode: "insensitive" } },
                    { email: { contains: termo, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
        },
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              nomeDeUsuario: true,
              email: true,
              verified: true,
              destaque: true,
              foto: true,
              cidade: true,
              estado: true,
              dataCriacao: true,
              tipo: true,
              assinatura: {
                select: {
                  plano: true,
                  status: true,
                  trialEndsAt: true,
                  renovaEm: true,
                  startsAt: true,
                },
              },
            },
          },
        },
        orderBy: { criadoEm: "desc" },
        take: 50,
      }),
    ]);

    const atletasNormalizados = atletas.map((a: any) => ({
      ...a,

      pontuacao:
        a.pontosTotal ??
        a.pontuacao?.pontuacaoTotal ??
        0,
    }));

    const [
      atletasVisiveis,
      clubesVisiveis,
      escolasVisiveis,
      professoresVisiveis,
      olheirosVisiveis,
      federacoesVisiveis,
      marcasVisiveis,
      learningVisiveis,
    ] = await Promise.all([
      filtrarPerfisVisiveis(
        userIdLogado,
        atletasNormalizados,
        (x: any) =>
          x.usuarioId ??
          x.usuario?.id
      ),

      filtrarPerfisVisiveis(
        userIdLogado,
        clubes,
        (x: any) =>
          x.usuarioId ??
          x.usuario?.id
      ),

      filtrarPerfisVisiveis(
        userIdLogado,
        escolas,
        (x: any) =>
          x.usuarioId ??
          x.usuario?.id
      ),

      filtrarPerfisVisiveis(
        userIdLogado,
        professores,
        (x: any) =>
          x.usuarioId ??
          x.usuario?.id
      ),

      filtrarPerfisVisiveis(
        userIdLogado,
        olheiros,
        (x: any) =>
          x.usuarioId ??
          x.usuario?.id
      ),

      filtrarPerfisVisiveis(
        userIdLogado,
        federacoes,
        (x: any) =>
          x.usuarioId ??
          x.usuario?.id
      ),

      filtrarPerfisVisiveis(
        userIdLogado,
        marcas,
        (x: any) =>
          x.usuarioId ??
          x.usuario?.id
      ),

      filtrarPerfisVisiveis(
        userIdLogado,
        learning,
        (x: any) =>
          x.usuarioId ??
          x.usuario?.id
      ),
    ]);

    res.json({
      atletas: ordenarDestaquesProNome(
        atletasVisiveis,
        (a: any) =>
          a?.usuario?.nome ?? ""
      ).map(sanitizarItemExplorar),

      clubes: ordenarDestaquesProNome(
        clubesVisiveis,
        (c: any) =>
          c?.nome ??
          c?.usuario?.nome ??
          ""
      ).map(sanitizarItemExplorar),

      escolas: ordenarDestaquesProNome(
        escolasVisiveis,
        (e: any) =>
          e?.nome ??
          e?.usuario?.nome ??
          ""
      ).map(sanitizarItemExplorar),

      professores: ordenarDestaquesProNome(
        professoresVisiveis,
        (p: any) =>
          p?.usuario?.nome ??
          p?.nome ??
          ""
      ).map(sanitizarItemExplorar),

      olheiros: ordenarDestaquesProNome(
        olheirosVisiveis,
        (o: any) =>
          o?.usuario?.nome ?? ""
      ).map(sanitizarItemExplorar),

      federacoes: ordenarDestaquesProNome(
        federacoesVisiveis,
        (f: any) =>
          f?.nome ??
          f?.usuario?.nome ??
          ""
      ).map(sanitizarItemExplorar),

      marcas: ordenarDestaquesProNome(
        marcasVisiveis,
        (m: any) =>
          m?.nome ??
          m?.usuario?.nome ??
          ""
      ).map(sanitizarItemExplorar),

      learning: ordenarDestaquesProNome(
        learningVisiveis,
        (l: any) =>
          l?.nome ??
          l?.usuario?.nome ??
          ""
      ).map(sanitizarItemExplorar),
    });
  } catch (error) {
    console.error("Erro em /api/explorar/buscar:", error);
    res.status(500).json({ error: "Erro ao buscar dados" });
  }
};