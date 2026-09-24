// server/services/planResolve
import { PrismaClient, TipoUsuario, FuncaoMembroOrganizacao } from "@prisma/client";
import {
  getProfileIdForRole,
} from "./roles.js";
import {
  getActiveContext,
  type ActiveContext,
} from "./activeContext.js";

const prisma = new PrismaClient();

export type PlanoName = string;

export interface UserPayload {
  id: string;
  tipo: TipoUsuario;
  tipoUsuarioId?: string | null;
  plano?: PlanoName | null;  
  isAdmin?: boolean;
  parceiro: boolean;
  activeContext?: ActiveContext | null;
}

function asPlano(p?: string | null): PlanoName {
  const s = String(p || "").toUpperCase();
  return s === "ORG" ? "ORG" : s === "PRO" ? "PRO" : "FREE";
}

export async function getPlano(usuarioId: string): Promise<PlanoName> {
  const [
    membroOrganizacao,
    escolinha,
    clube,
    prof,
  ] =
    await Promise.all([
      prisma.membroOrganizacao.findFirst({
        where: {
          usuarioId,

          ativo:
            true,

          funcao: {
            in: [
              FuncaoMembroOrganizacao.PROPRIETARIO,
              FuncaoMembroOrganizacao.ADMINISTRADOR,
              FuncaoMembroOrganizacao.PROFESSOR,
            ],
          },
        },

        select: {
          id: true,
        },
      }),

      prisma.escolinha.findFirst({
        where: {
          usuarioId,
        },

        select: {
          id: true,
        },
      }),

      prisma.clube.findFirst({
        where: {
          usuarioId,
        },

        select: {
          id: true,
        },
      }),

      prisma.professor.findFirst({
        where: {
          usuarioId,
        },

        select: {
          id: true,
          escolinhaId: true,
          clubeId: true,
        },
      }),
    ]);

  if (
    membroOrganizacao ||
    escolinha ||
    clube ||
    prof?.escolinhaId ||
    prof?.clubeId
  ) {
    return "ORG";
  }
  
  const assinatura = await prisma.assinatura.findFirst({
    where: { usuarioId, ativo: true, canceledAt: null },
    select: { plano: true },
    orderBy: { startsAt: "desc" },
  });
  if (assinatura) return asPlano(assinatura.plano) === "FREE" ? "PRO" : asPlano(assinatura.plano);

  const pg = await prisma.pagamento.findFirst({
    where: { usuarioId, status: "APROVADO" },
    orderBy: { pagoEm: "desc" },
    select: { periodicidade: true, pagoEm: true },
  });
  if (pg?.pagoEm) {
    const pago = pg.pagoEm.getTime();
    const agora = Date.now();
    const janela = pg.periodicidade === "Anual" ? 365 : 31;
    if (agora - pago <= janela * 24 * 60 * 60 * 1000) return "PRO";
  }

  return "FREE";
}

export async function resolveUserContext(userId: string): Promise<UserPayload> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    include: {
      assinatura: {
        orderBy: [
          { ativo: "desc" },
          { renovaEm: "desc" },
          { startsAt: "desc" },
        ],
        take: 1,
      },
      administrador: true,
    },
  });

  if (!usuario) {
    throw new Error("Usuário não encontrado");
  }

  const assinaturaAtual = usuario.assinatura?.[0] ?? null;

  const plano: PlanoName =
    assinaturaAtual?.ativo
      ? asPlano(assinaturaAtual.plano)
    : "FREE";

  const activeContext =
    await getActiveContext(
      usuario.id
    );

  const tipo =
    activeContext
      ?.tipoUsuario ??
    usuario.tipo;

  const tipoUsuarioId =
    activeContext
      ?.tipoUsuarioId ??
    await getProfileIdForRole(
      usuario.id,
      usuario.tipo,
    );

  return {
    id: usuario.id,
    tipo,
    tipoUsuarioId,
    activeContext,
    plano,
    isAdmin: !!usuario.administrador,
    parceiro: usuario.parceiro,
  };
}