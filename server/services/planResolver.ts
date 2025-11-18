import { PrismaClient, TipoUsuario } from "@prisma/client";

const prisma = new PrismaClient();

export type PlanoName = string;

export interface UserPayload {
  id: string;
  tipo: TipoUsuario;
  tipoUsuarioId?: string | null;
  plano?: PlanoName | null;  
  isAdmin?: boolean;
}

function asPlano(p?: string | null): PlanoName {
  const s = String(p || "").toUpperCase();
  return s === "ORG" ? "ORG" : s === "PRO" ? "PRO" : "FREE";
}

export async function getPlano(usuarioId: string): Promise<PlanoName> {
  const [escolinha, clube, prof] = await Promise.all([
    prisma.escolinha.findFirst({ where: { usuarioId }, select: { id: true } }),
    prisma.clube.findFirst({ where: { usuarioId }, select: { id: true } }),
    prisma.professor.findFirst({ where: { usuarioId }, select: { id: true, escolinhaId: true, clubeId: true } }),
  ]);

  if (escolinha || clube || prof?.escolinhaId || prof?.clubeId) return "ORG";

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
      assinatura: true,
      administrador: true,
    },
  });

  if (!usuario) {
    throw new Error("Usuário não encontrado");
  }

  const plano: PlanoName =
    usuario.assinatura && usuario.assinatura.ativo
      ? (usuario.assinatura.plano as PlanoName)
      : "FREE";

  return {
    id: usuario.id,
    tipo: usuario.tipo,
    tipoUsuarioId: null,
    plano,
    isAdmin: !!usuario.administrador,
  };
}