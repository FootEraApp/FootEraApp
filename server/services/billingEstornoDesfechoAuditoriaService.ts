
import type { Request } from "express";

export type DesfechoOperacional = {
  motivo?: string;
  requerConciliacao?: boolean;
  enviado?: boolean | null;
  podeReenviar?: boolean;
};

export type DadosAuditoriaDesfecho = {
  usuarioId: string;
  acao: string;
  entidade: "Pagamento";
  entidadeId: string;
  descricao: string;
  ip: string | null;
  userAgent: string;
  meta: {
    pagamentoId: string;
    origem: "ADMIN_HTTP";
    operacao: "EXECUCAO" | "CONCILIACAO";
    motivo: string | null;
    enviado: boolean | null;
    requerConciliacao: boolean | null;
    podeReenviar: false;
    falhou: boolean;
    codigoErro: string | null;
  };
};

export function construirAuditoriaDesfecho(
  req: Pick<Request, "ip" | "headers">,
  operadorId: string,
  pagamentoId: string,
  operacao: "EXECUCAO" | "CONCILIACAO",
  resultado?: DesfechoOperacional,
  erro?: unknown
): DadosAuditoriaDesfecho {
  return {
    usuarioId: operadorId,
    acao: `BILLING_ESTORNO_${operacao}_RESULTADO`,
    entidade: "Pagamento",
    entidadeId: pagamentoId,
    descricao:
      "Desfecho da operacao administrativa de estorno.",
    ip: req.ip ?? null,
    userAgent: String(req.headers["user-agent"] ?? ""),
    meta: {
      pagamentoId,
      origem: "ADMIN_HTTP",
      operacao,
      motivo: resultado?.motivo ?? null,
      enviado: resultado?.enviado ?? null,
      requerConciliacao:
        resultado?.requerConciliacao ?? null,
      podeReenviar: false,
      falhou: erro !== undefined,
      codigoErro:
        erro instanceof Error
          ? erro.message.slice(0, 160)
          : erro === undefined
            ? null
            : "ERRO_NAO_CLASSIFICADO",
    },
  };
}

export async function persistirAuditoriaDesfecho(
  dados: DadosAuditoriaDesfecho,
  gravar: (
    dados: DadosAuditoriaDesfecho
  ) => Promise<unknown>
): Promise<boolean> {
  try {
    await gravar(dados);
    return true;
  } catch {
    return false;
  }
}