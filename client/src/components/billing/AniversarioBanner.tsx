import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Gift, Copy, Check, ArrowRight } from "lucide-react";
import { API } from "../../config.js";

type BeneficioAniversario = {
  elegivel: boolean;
  codigo: string | null;
  percentual: number | null;
  expiraEm: string | null;
  disponivel?: boolean;
};

type Props = {
  token: string | null | undefined;
};

export default function AniversarioBanner({ token }: Props) {
  const [beneficio, setBeneficio] = useState<BeneficioAniversario | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [copiado, setCopiado] = useState(false);

  const atualizar = useCallback(async (signal?: AbortSignal) => {
    if (!token) {
      setBeneficio(null);
      return;
    }

    try {
      const resposta = await fetch(`${API.BASE_URL}/api/billing/aniversario`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal,
        cache: "no-store",
      });

      if (!resposta.ok) {
        if (!signal?.aborted) setBeneficio(null);
        return;
      }

      const dados = (await resposta.json()) as BeneficioAniversario;
      if (!signal?.aborted) setBeneficio(dados);
    } catch (erro) {
      if (!signal?.aborted) {
        console.warn("[aniversario] Falha ao consultar benefício", erro);
        setBeneficio(null);
      }
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    void atualizar(controller.signal);
    const aoFocar = () => void atualizar();
    window.addEventListener("focus", aoFocar);
    const relogio = window.setInterval(() => {
      setAgora(Date.now());
    }, 30_000);
    return () => {
      controller.abort();
      window.removeEventListener("focus", aoFocar);
      window.clearInterval(relogio);
    };
  }, [atualizar]);

  const expiraMs = beneficio?.expiraEm ? new Date(beneficio.expiraEm).getTime() : NaN;
  const mostrar = Boolean(
    token &&
    beneficio?.elegivel &&
    beneficio?.disponivel === true &&
    beneficio.codigo &&
    beneficio.percentual === 20 &&
    Number.isFinite(expiraMs) &&
    agora < expiraMs
    );

  if (!mostrar || !beneficio?.codigo) return null;

  async function copiar() {
    if (!beneficio?.codigo) return;
    try {
      await navigator.clipboard.writeText(beneficio.codigo);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <section
      aria-label="Presente de aniversário FootEra"
      className="mb-4 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl bg-amber-100 p-3 text-amber-800">
          <Gift className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-emerald-950">Feliz aniversário! 🎉</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            Hoje é seu dia! O FootEra preparou <strong>20% de desconto</strong> em
            assinaturas, eventos, aulas e metodologias elegíveis. Adicione o
            que deseja ao carrinho e utilize o cupom abaixo.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Seu código de aniversário</p>
            <p className="select-all break-all font-bold tracking-widest text-emerald-900">
              {beneficio.codigo}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copiar()}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            aria-label="Copiar cupom de aniversário"
          >
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
        <Link
          href="/pagamentos"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900"
        >
          Ver assinaturas e ofertas <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <p className="mt-3 text-xs text-slate-600">
        Promoção válida somente no dia do aniversário, no horário de Brasília,
        sujeita à validação no checkout e à disponibilidade do cupom.
      </p>
    </section>
  );
}