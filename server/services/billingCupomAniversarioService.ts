import { prisma } from "../prisma.js";

export const CODIGO_PUBLICO_ANIVERSARIO = "20PARABENS";
export const PERCENTUAL_ANIVERSARIO = 20;

function dataBrasil(agora: Date) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  const ano = Number(valor("year"));
  const mes = Number(valor("month"));
  const dia = Number(valor("day"));
  if (!ano || !mes || !dia) throw new Error("BIRTHDAY_DATE_FORMAT_FAILED");
  return { ano, mes, dia };
}

function aniversarioNesteDia(nascimento: Date, hoje: ReturnType<typeof dataBrasil>) {
  // O banco deve armazenar dataNascimento como data civil, normalizada em UTC.
  // Confirme isso no cadastro/edição antes da publicação.
  const mes = nascimento.getUTCMonth() + 1;
  const dia = nascimento.getUTCDate();
  if (mes === 2 && dia === 29 && new Date(Date.UTC(hoje.ano, 1, 29)).getUTCMonth() !== 1) {
    // Regra explícita: nascidos em 29/02 comemoram em 28/02 nos anos não bissextos.
    return hoje.mes === 2 && hoje.dia === 28;
  }
  return hoje.mes === mes && hoje.dia === dia;
}

function inicioDiaSeguinteBR(hoje: ReturnType<typeof dataBrasil>): Date {
  // O aniversário é uma janela civil [00:00, 00:00 do dia seguinte) em Brasília.
  const inicio = new Date(
    `${hoje.ano}-${String(hoje.mes).padStart(2, "0")}-${String(hoje.dia).padStart(2, "0")}T00:00:00-03:00`
  );
  return new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
}

export class CupomAniversarioError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "CupomAniversarioError";
  }
}

export async function consultarBeneficioAniversario(
  usuarioId: string,
  agora = new Date()
) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
        dataNascimento: true,
        aniversarioElegivelApartirDe: true,
        verified: true,
        },
  });

  const hoje = dataBrasil(agora);

  const elegivelApartirDe =
    usuario?.aniversarioElegivelApartirDe ?? null;

    const prazoElegibilidadeCumprido =
    elegivelApartirDe instanceof Date &&
    elegivelApartirDe.getTime() <= agora.getTime();

    const elegivel = Boolean(
    usuario?.dataNascimento &&
    usuario.verified === true &&
    prazoElegibilidadeCumprido &&
    aniversarioNesteDia(usuario.dataNascimento, hoje)
    );

  const expiraEm = elegivel
    ? inicioDiaSeguinteBR(hoje).toISOString()
    : null;

  if (!elegivel) {
    return {
      elegivel: false,
      disponivel: false,
      codigo: null,
      percentual: null,
      expiraEm: null,
    };
  }

  const codigoInterno =
    `ANIVERSARIO_${hoje.ano}_${usuarioId}`;

  const cupom = await prisma.cupom.findUnique({
    where: { codigo: codigoInterno },
    select: {
      id: true,
      ativo: true,
      usosMax: true,
      usosAtuais: true,
      expiraEm: true,
      concedidoParaUsuarioId: true,
      tipo: true,
      descontoPerc: true,
      transferivel: true,
    },
  });

  let disponivel = true;

  if (cupom) {
    const [resgates, reservasAtivas] = await Promise.all([
      prisma.cupomResgate.count({
        where: {
          cupomId: cupom.id,
          usuarioId,
        },
      }),

      prisma.cupomReserva.count({
        where: {
          cupomId: cupom.id,
          usuarioId,
          status: {
            in: [
              "RESERVADA",
              "CONCILIACAO_PENDENTE",
            ],
          },
        },
      }),
    ]);

    disponivel =
        cupom.ativo === true &&
        cupom.concedidoParaUsuarioId === usuarioId &&
        cupom.tipo === "PERCENTUAL" &&
        cupom.descontoPerc === PERCENTUAL_ANIVERSARIO &&
        cupom.usosMax === 1 &&
        cupom.transferivel === false &&
        cupom.expiraEm !== null &&
        cupom.expiraEm > agora &&
        cupom.usosAtuais < 1 &&
        resgates === 0 &&
        reservasAtivas === 0;
  }

  return {
    elegivel: true,
    disponivel,
    codigo: CODIGO_PUBLICO_ANIVERSARIO,
    percentual: PERCENTUAL_ANIVERSARIO,
    expiraEm,
  };
}

/**
 * Resolve o código público para um Cupom distinto por usuário e ano.
 * Isso preserva o índice único existente de CupomResgate(cupomId, usuarioId)
 * e permite uma nova utilização em um aniversário posterior.
 *
 * IMPORTANTE: o checkout e o webhook devem continuar usando o cupomId
 * persistido, não o código enviado pelo cliente.
 */
export async function obterCupomAniversario(
  usuarioId: string,
  codigoInformado: string,
  agora = new Date()
) {
  if (codigoInformado.trim().toUpperCase() !== CODIGO_PUBLICO_ANIVERSARIO) {
    return null;
  }

  const beneficio = await consultarBeneficioAniversario(usuarioId, agora);
  if (!beneficio.elegivel || !beneficio.expiraEm) {
    throw new CupomAniversarioError(
      "BIRTHDAY_COUPON_NOT_TODAY",
      "O cupom 20PARABENS só pode ser utilizado no dia do seu aniversário."
    );
  }

  const { ano } = dataBrasil(agora);
  const codigoInterno = `ANIVERSARIO_${ano}_${usuarioId}`;
  const cupom = await prisma.cupom.upsert({
    where: { codigo: codigoInterno },
    create: {
      codigo: codigoInterno,
      tipo: "PERCENTUAL",
      descontoPerc: PERCENTUAL_ANIVERSARIO,
      concedidoParaUsuarioId: usuarioId,
      expiraEm: new Date(beneficio.expiraEm),
      usosMax: 1,
      ativo: true,
      transferivel: false,
    },
    update: {},
  });

  // Segurança: um cupom interno de aniversário
    // não pode ter suas condições financeiras alteradas.

    if (
    cupom.concedidoParaUsuarioId !== usuarioId ||
    cupom.tipo !== "PERCENTUAL" ||
    cupom.descontoPerc !== PERCENTUAL_ANIVERSARIO ||
    cupom.usosMax !== 1 ||
    cupom.transferivel !== false ||
    cupom.expiraEm === null
    ) {
    throw new CupomAniversarioError(
        "BIRTHDAY_COUPON_INVALID_CONFIGURATION",
        "A configuração do cupom de aniversário é inválida."
    );
    }

    // Uma confirmação já contabilizada impede
    // novo uso, mesmo se o resgate estiver inconsistente.
    if (cupom.usosAtuais >= 1) {
    throw new CupomAniversarioError(
        "BIRTHDAY_COUPON_ALREADY_USED",
        "Você já utilizou seu cupom de aniversário deste ano."
    );
    }

  if (!cupom.ativo || cupom.expiraEm && cupom.expiraEm <= agora) {
    throw new CupomAniversarioError("BIRTHDAY_COUPON_EXPIRED", "Cupom de aniversário indisponível.");
  }

  const jaUsado = await prisma.cupomResgate.findUnique({
    where: { cupomId_usuarioId: { cupomId: cupom.id, usuarioId } },
    select: { id: true },
  });
  if (jaUsado) {
    throw new CupomAniversarioError(
      "BIRTHDAY_COUPON_ALREADY_USED",
      "Você já utilizou seu cupom de aniversário deste ano."
    );
  }

  const reservaAtiva = await prisma.cupomReserva.findFirst({
    where: {
        cupomId: cupom.id,
        usuarioId,
        status: {
        in: [
            "RESERVADA",
            "CONCILIACAO_PENDENTE",
        ],
        },
    },
    select: {
        id: true,
    },
    });

    if (reservaAtiva) {
    throw new CupomAniversarioError(
        "BIRTHDAY_COUPON_ALREADY_RESERVED",
        "Seu cupom de aniversário já está vinculado a um pagamento pendente."
    );
    }

  return cupom;
}

export function ehCupomAniversario(cupom: { codigo: string; concedidoParaUsuarioId: string | null } | null | undefined) {
  return Boolean(cupom?.codigo.startsWith("ANIVERSARIO_") && cupom.concedidoParaUsuarioId);
}