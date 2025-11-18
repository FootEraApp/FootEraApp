// server/services/planResolver.ts
import { PrismaClient, TipoUsuario } from "@prisma/client";

const prisma = new PrismaClient();
export type PlanoName = "FREE" | "PRO" | "ORG";

function asPlano(p?: string | null): PlanoName {
  const s = String(p || "").toUpperCase();
  return s === "ORG" ? "ORG" : s === "PRO" ? "PRO" : "FREE";
}

// Regras:
// - Dono de Escolinha/Clube ou Professor lotado em org => ORG
// - Senão, Assinatura {ativo:true} e (canceledAt null) => PRO
// - Senão, último Pagamento APROVADO ainda válido pela periodicidade => PRO
// - Senão => FREE
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

  // Fallback via Pagamento (janela por periodicidade)
  const pg = await prisma.pagamento.findFirst({
    where: { usuarioId, status: "APROVADO" },
    orderBy: { pagoEm: "desc" },
    select: { periodicidade: true, pagoEm: true },
  });
  if (pg?.pagoEm) {
    const pago = pg.pagoEm.getTime();
    const agora = Date.now();
    const janela = pg.periodicidade === "Anual" ? 365 : 31; // dias
    if (agora - pago <= janela * 24 * 60 * 60 * 1000) return "PRO";
  }

  return "FREE";
}

export async function resolveUserContext(usuarioId: string) {
  // Busca tipo + ids relacionados de forma compatível com o schema
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      tipo: true,
      administrador: { select: { id: true } },
      atleta:    { select: { id: true } },
      professor: { select: { id: true } },
      clube:     { select: { id: true } },
      escolinha: { select: { id: true } },
      olheiro:   { select: { id: true } },
    },
  });

  if (!u) return { id: usuarioId, tipo: "Atleta" as TipoUsuario, tipoUsuarioId: null, plano: "FREE" as PlanoName, isAdmin: false };

  const isAdmin =
    !!u.administrador || u.tipo === "Admin";

  const tipo: TipoUsuario =
    u.tipo ??
    (u.atleta ? "Atleta" :
     u.professor ? "Professor" :
     u.clube ? "Clube" :
     u.escolinha ? "Escolinha" : "Olheiro");

  const tipoUsuarioId =
    u.atleta?.id ?? u.professor?.id ?? u.clube?.id ?? u.escolinha?.id ?? u.olheiro?.id ?? null;

  const plano = await getPlano(usuarioId);

  return { id: usuarioId, tipo, tipoUsuarioId, plano, isAdmin };
}
