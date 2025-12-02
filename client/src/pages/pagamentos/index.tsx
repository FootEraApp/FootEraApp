import React, { useEffect, useMemo, useState } from "react";
import { CreditCard, Landmark, QrCode, BadgeCheck, Gift, XCircle, RefreshCcw } from "lucide-react";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

type Periodicidade = "Mensal" | "Anual";
type MetodoPagamento = "PIX" | "CREDITO" | "DEBITO" | "BOLETO";

type Plan = {
  id: string;
  title: string;
  monthly: number;
  annual: number | null;
  benefits: string[];
};

type Assinatura = {
  id: string;
  usuarioId: string;
  plano: string;
  startsAt: string;
  canceledAt: string | null;
  ativo: boolean;
};

type Pagamento = {
  id: string;
  plano: string;
  periodicidade: Periodicidade;
  metodo: MetodoPagamento;
  status: "PENDENTE" | "APROVADO" | "FALHOU" | "CANCELADO" | "REEMBOLSADO";
  valor: string;
  moeda: string;
  criadoEm: string;
  pagoEm?: string | null;
  cupomId?: string | null;
};

type Pagador = { nome: string; email: string; cpf?: string; telefone?: string };
type Cartao = { numero: string; nomeImpresso: string; validade: string; cvv: string };

function diasRestantes(renovaEm?: string | null) {
  if (!renovaEm) return null;
  const d = new Date(renovaEm).getTime();
  const hoje = Date.now();
  const diff = d - hoje;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function brl(n: number | string) {
  const v = typeof n === "string" ? Number(n) : n;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function computeRenovaEm(
  assinatura: Assinatura | null,
  pagamentos: Pagamento[]
): string | null {
  if (!assinatura) return null;

  const aprovadosMesmoPlano = pagamentos
    .filter((p) => p.status === "APROVADO" && p.plano === assinatura.plano);

  if (aprovadosMesmoPlano.length === 0) return null;

  const last = aprovadosMesmoPlano.sort(
    (a, b) =>
      new Date(b.pagoEm || b.criadoEm).getTime() -
      new Date(a.pagoEm || a.criadoEm).getTime()
  )[0];

  const baseDate = new Date(last.pagoEm || last.criadoEm);
  const meses = last.periodicidade === "Mensal" ? 1 : 12;
  const d = new Date(baseDate);
  d.setMonth(d.getMonth() + meses);
  return d.toISOString();
}

const roleToDefaultPlan: Record<string, string> = {
  Atleta: "ATLETA_PRO",
  Olheiro: "OLHEIRO_PRO",
  Professor: "PROFESSOR_PRO",
  Escolinha: "ESCOLINHA_PRO",
  Clube: "ESCOLINHA_PRO",
  Admin: "ATLETA_PRO",
};

export default function PagamentosPage() {
  const token = Storage.token;
  const tipo = Storage.tipoSalvo;

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [cupomInput, setCupomInput] = useState("");
  const [cupomPreview, setCupomPreview] = useState<{ total: number, base: number, desconto: number, codigo: string, tipo: string } | null>(null);

  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [period, setPeriod] = useState<Periodicidade>("Mensal");
  const [method, setMethod] = useState<MetodoPagamento>("PIX");
  const [giftCode, setGiftCode] = useState("");

  const [pixCopiaECola, setPixCopiaECola] = useState<string | null>(null);
  const [pixQrUrl, setPixQrUrl] = useState<string | null>(null);

  const [boletoLinha, setBoletoLinha] = useState<string | null>(null);
  const [boletoPdf, setBoletoPdf] = useState<string | null>(null);

  const [pagador, setPagador] = useState<Pagador>({ nome: "", email: "", cpf: "", telefone: "" });
  const [cartao, setCartao] = useState<Cartao>({ numero: "", nomeImpresso: "", validade: "", cvv: "" });

  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  type RoleKey = keyof typeof roleToDefaultPlan;

  useEffect(() => {
    setCupomPreview(null);
  }, [selectedPlan, period]);

  useEffect(() => {
    (async () => {
      try {
        const cat = await fetch(`${API.BASE_URL}/api/billing/plans`, { headers });
        const { plans: apiPlans } = await cat.json();
        setPlans(apiPlans);

        const initialPlan: string =
          (typeof tipo === "string" && (tipo as RoleKey) in roleToDefaultPlan)
            ? roleToDefaultPlan[tipo as RoleKey]
            : (apiPlans?.[0]?.id ?? "ATLETA_PRO");

        setSelectedPlan(initialPlan);
        if (initialPlan === "ESCOLINHA_PRO") setPeriod("Mensal");

        const me = await fetch(`${API.BASE_URL}/api/billing/me`, { headers });
        const data = await me.json();
        setAssinatura(data.assinatura || null);
        setPagamentos(data.pagamentos || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [headers, tipo]);

  const currentPlanPrice = useMemo(() => {
    const p = plans.find((p) => p.id === selectedPlan);
    if (!p) return 0;
    if (selectedPlan === "ESCOLINHA_PRO") return p.monthly;
    return period === "Mensal" ? p.monthly : p.annual ?? p.monthly;
  }, [plans, selectedPlan, period]);

  const selectedObj = useMemo(
    () => plans.find((p) => p.id === selectedPlan),
    [plans, selectedPlan]
  );

  async function previewCoupon() {
    if (!cupomInput) return;
    try {
      const r = await fetch(`${API.BASE_URL}/api/billing/coupon/apply`, {
        method: "POST",
        headers,
        body: JSON.stringify({ codigo: cupomInput.trim(), planoId: selectedPlan, periodicidade: period })
      });
      if (!r.ok) {
        const e = await r.json();
        alert(e.message || "Cupom inválido");
        setCupomPreview(null);
        return;
      }
      const data = await r.json();
      setCupomPreview({
        total: data.total,
        base: data.base,
        desconto: data.desconto,
        codigo: data.cupom.codigo,
        tipo: data.cupom.tipo
      });
    } catch {
      alert("Erro ao validar cupom");
    }
  }

  function totalComCupom() {
    const base = currentPlanPrice;
    return cupomPreview ? cupomPreview.total : base;
  }

  function validarCamposAntesDoCheckout(): string | null {
    if (method === "PIX") {
      if (!pagador.nome || !pagador.email) return "Informe seu nome e e-mail para gerar o PIX.";
    }
    if (method === "BOLETO") {
      if (!pagador.nome || !pagador.email || !pagador.cpf) return "Informe nome, e-mail e CPF para gerar o boleto.";
    }
    if (method === "CREDITO" || method === "DEBITO") {
      if (!pagador.nome || !pagador.email) return "Informe nome e e-mail do titular.";
      if (!cartao.numero || !cartao.nomeImpresso || !cartao.validade || !cartao.cvv) return "Preencha todos os dados do cartão.";
    }
    return null;
  }

  async function startCheckout() {
    const err = validarCamposAntesDoCheckout();
    if (err) return alert(err);

    try {
      const r = await fetch(`${API.BASE_URL}/api/billing/checkout`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          planoId: selectedPlan,
          periodicidade: period,
          metodo: method,
          cupom: cupomInput || null,
          pagador,
          cartao,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        alert(data.message || "Erro ao iniciar pagamento");
        return;
      }

      setPixCopiaECola(null);
      setPixQrUrl(null);
      setBoletoLinha(null);
      setBoletoPdf(null);

      if (data.pix?.copiaECola || data.pix?.qrCodeUrl) {
        setPendingPaymentId(data.pagamento?.id || null);
        setPixCopiaECola(data.pix?.copiaECola || null);
        setPixQrUrl(data.pix?.qrCodeUrl || null);
        if (data.pagamento?.id) pollPaymentStatus(data.pagamento.id);
        return;
      }

      if (data.boleto?.pdfUrl || data.boleto?.linhaDigitavel) {
        setPendingPaymentId(data.pagamento?.id || null);
        setBoletoLinha(data.boleto?.linhaDigitavel || null);
        setBoletoPdf(data.boleto?.pdfUrl || null);
        if (data.pagamento?.id) pollPaymentStatus(data.pagamento.id);
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      if (data.status === "APROVADO") {
        alert(
          data.freeTrial
            ? "Assinatura ativada com sucesso! Seu primeiro mês é gratuito. 🎉"
            : "Assinatura ativada com sucesso!"
        );
        reloadMe();
        return;
      }

      alert(data.message || "Pagamento iniciado.");
    } catch (e) {
      console.error(e);
      alert("Erro ao iniciar pagamento");
    }
  }

  async function redeemGift() {
    if (!giftCode) return alert("Informe o código do presente");
    try {
      const r = await fetch(`${API.BASE_URL}/api/billing/gift/redeem`, {
        method: "POST",
        headers,
        body: JSON.stringify({ codigo: giftCode.trim(), planoId: selectedPlan, periodicidade: period })
      });
      const data = await r.json();
      if (!r.ok) {
        alert(data.message || "Erro ao resgatar presente");
        return;
      }
      alert("Presente resgatado! Assinatura ativada.");
      setGiftCode("");
      reloadMe();
    } catch {
      alert("Erro ao resgatar presente");
    }
  }

  async function cancelSub() {
    if (!confirm("Tem certeza que deseja cancelar sua assinatura?")) return;
    try {
      const r = await fetch(`${API.BASE_URL}/api/billing/cancel`, { method: "POST", headers });
      const data = await r.json();
      if (!r.ok) return alert(data.message || "Erro ao cancelar");
      alert("Assinatura cancelada.");
      reloadMe();
    } catch {
      alert("Erro ao cancelar");
    }
  }

  async function renewSub() {
    try {
      const r = await fetch(`${API.BASE_URL}/api/billing/renew`, { method: "POST", headers });
      const data = await r.json();
      if (!r.ok) return alert(data.message || "Erro ao reativar");
      alert("Assinatura reativada!");
      reloadMe();
    } catch {
      alert("Erro ao reativar");
    }
  }

  async function switchPlan(novoPlano: string) {
    try {
      const r = await fetch(`${API.BASE_URL}/api/billing/switch-plan`, {
        method: "POST",
        headers,
        body: JSON.stringify({ novoPlano })
      });
      const data = await r.json();
      if (!r.ok) return alert(data.message || "Erro ao trocar plano");
      alert("Plano alterado!");
      reloadMe();
    } catch {
      alert("Erro ao trocar plano");
    }
  }

  async function reloadMe() {
    const me = await fetch(`${API.BASE_URL}/api/billing/me`, { headers });
    const data = await me.json();
    setAssinatura(data.assinatura || null);
    setPagamentos(data.pagamentos || []);
  }

  async function pollPaymentStatus(pagamentoId: string) {
    try {
      setPolling(true);
      const start = Date.now();
      const timeoutMs = 2 * 60 * 1000;
      const intervalMs = 12000;

      while (Date.now() - start < timeoutMs) {
        const me = await fetch(`${API.BASE_URL}/api/billing/me`, { headers });
        const data = await me.json();

        const pago = (data.pagamentos || []).find((p: any) => p.id === pagamentoId);
        const ativo = Boolean(data.assinatura?.ativo);

        if (pago?.status === "APROVADO" || ativo) {
          alert("Pagamento aprovado! Assinatura ativada 🎉");
          setPixCopiaECola(null);
          setPixQrUrl(null);
          setBoletoLinha(null);
          setBoletoPdf(null);
          setPendingPaymentId(null);
          setPolling(false);
          await reloadMe();
          return;
        }

        await new Promise((r) => setTimeout(r, intervalMs));
      }
    } finally {
      setPolling(false);
    }
  }

  if (loading) {
    return <div className="p-6">Carregando pagamentos...</div>;
  }

  const renovaEm = computeRenovaEm(assinatura, pagamentos);
  const dias = diasRestantes(renovaEm);
  const aviso =
    dias !== null && dias >= 0 && dias <= 7
      ? `Sua assinatura vence em ${dias} dia${dias === 1 ? "" : "s"}.`
      : dias !== null && dias < 0
      ? "Sua assinatura está vencida. Renove para continuar com os benefícios."
      : null;

  const p = selectedObj;
  const total = totalComCupom();
  const anualDisponivel =
    selectedPlan !== "ESCOLINHA_PRO" &&
    !!selectedObj?.annual &&
    (selectedObj.annual as number) > 0;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <Link
                href="/perfil"
                aria-label="Voltar para perfil"
                title="Voltar para perfil"
                className="inline-flex h-10 w-10 items-center justify-center
                  rounded-full border border-green-800 bg-white text-green-900
                  shadow-sm hover:bg-green-50 focus:outline-none
                  focus:ring-2 focus:ring-green-700/30 mt-2 ml-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
      <h1 className="text-2xl md:text-3xl font-bold mb-2">Assinaturas & Pagamentos</h1>
      <p className="text-sm text-gray-600 mb-6">
        Bem-vindo(a)! Aqui você escolhe seu plano, aplica cupons e acompanha o histórico.
      </p>

      {aviso && (
        <div
          className={`mb-4 text-sm font-medium rounded-md px-3 py-2 ${
            dias! < 0 ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"
          }`}
        >
          {aviso}
        </div>
      )}
      <div className="mb-6 rounded-lg border bg-emerald-50 text-emerald-900 p-3 text-sm">
        <ul className="list-disc pl-4 space-y-1">
          <li>Rede social aberta: posts/DMs ilimitados para todos. Vídeos ≤ 60s.</li>
          <li>Vinculação do atleta com 1 escolinha e 1 professor é sempre grátis.</li>
          <li>Limites valem para dados operacionais (treinos, templates, agendamentos), não para posts/DMs.</li>
        </ul>
      </div>

      <section className="mb-8 p-4 border rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <BadgeCheck className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Sua assinatura</h2>
        </div>
        {assinatura?.ativo ? (
          <div className="flex flex-col gap-2">
            <span className="text-green-700 font-semibold">ATIVA</span>
            <div>Plano: <b>{assinatura.plano}</b></div>
            <div>Início: {new Date(assinatura.startsAt).toLocaleDateString()}</div>
            {assinatura.canceledAt && <div>Cancelada em: {new Date(assinatura.canceledAt).toLocaleDateString()}</div>}
            <div className="flex flex-wrap gap-2 mt-2">
              <button onClick={cancelSub} className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                <XCircle className="w-4 h-4" /> Cancelar
              </button>
              <button onClick={renewSub} className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 flex items-center gap-2">
                <RefreshCcw className="w-4 h-4" /> Reativar
              </button>
            </div>
          </div>
        ) : (
          <div className="text-gray-700">Você não possui assinatura ativa.</div>
        )}
      </section>

      <section className="mb-8 p-4 border rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Escolher plano</h2>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          {plans.map((pl) => (
            <button
              key={pl.id}
              onClick={() => {
                setSelectedPlan(pl.id);
                if (pl.id === "ESCOLINHA_PRO") setPeriod("Mensal");
              }}
              className={`px-3 py-2 rounded-lg border ${selectedPlan === pl.id ? "bg-green-700 text-white border-green-600" : "bg-white text-gray-800"}`}
            >
              {pl.title}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="flex items-center gap-2">
            <input type="radio" checked={period === "Mensal"} onChange={() => setPeriod("Mensal")} />
            Mensal ({brl(selectedObj?.monthly ?? 0)})
          </label>

          {anualDisponivel ? (
            <label className="flex items-center gap-2">
              <input type="radio" checked={period === "Anual"} onChange={() => setPeriod("Anual")} />
              Anual ({brl(selectedObj?.annual ?? 0)})
            </label>
          ) : (
            selectedPlan === "ESCOLINHA_PRO" && (
              <span className="text-sm text-gray-500">* Plano da organização é apenas mensal.</span>
            )
          )}
        </div>

        {p && (
          <ul className="list-disc pl-6 text-sm text-gray-700 mb-4">
            {p.benefits.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}

        <div className="mb-4 p-3 border rounded-lg bg-transparent">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-4 h-4" />
            <b>Cupom / Presente</b>
          </div>
          <div className="flex gap-2">
            <input
              value={cupomInput}
              onChange={e => setCupomInput(e.target.value)}
              placeholder="Digite seu cupom"
              className="flex-1 border rounded-md px-3 py-2"
            />
            <button onClick={previewCoupon} className="px-3 py-2 border rounded-md">
              Validar
            </button>
          </div>
          {cupomPreview && (
            <div className="mt-2 text-sm">
              <div>Preço base: <b>{brl(cupomPreview.base)}</b></div>
              <div>Desconto: <b>- {brl(cupomPreview.desconto)}</b></div>
              <div>Total: <b>{brl(cupomPreview.total)}</b></div>
              <div className="text-gray-600">Cupom "{cupomPreview.codigo}" ({cupomPreview.tipo})</div>
            </div>
          )}
        </div>

        <div className="mb-2">
          <div className="font-semibold mb-2">Método de pagamento</div>
          <div className="flex flex-wrap gap-3">
            <label className={`px-3 py-2 border rounded-lg cursor-pointer flex items-center gap-2 ${method==="PIX"?"bg-green-50 border-green-300":""}`}>
              <input type="radio" className="hidden" checked={method==="PIX"} onChange={() => setMethod("PIX")} />
              <QrCode className="w-4 h-4" /> PIX
            </label>
            <label className={`px-3 py-2 border rounded-lg cursor-pointer flex items-center gap-2 ${method==="CREDITO"?"bg-green-50 border-green-300":""}`}>
              <input type="radio" className="hidden" checked={method==="CREDITO"} onChange={() => setMethod("CREDITO")} />
              <CreditCard className="w-4 h-4" /> Cartão de Crédito
            </label>
            <label className={`px-3 py-2 border rounded-lg cursor-pointer flex items-center gap-2 ${method==="DEBITO"?"bg-green-50 border-green-300":""}`}>
              <input type="radio" className="hidden" checked={method==="DEBITO"} onChange={() => setMethod("DEBITO")} />
              <CreditCard className="w-4 h-4" /> Cartão de Débito
            </label>
            <label className={`px-3 py-2 border rounded-lg cursor-pointer flex items-center gap-2 ${method==="BOLETO"?"bg-green-50 border-green-300":""}`}>
              <input type="radio" className="hidden" checked={method==="BOLETO"} onChange={() => setMethod("BOLETO")} />
              <Landmark className="w-4 h-4" /> Boleto
            </label>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-lg border bg-transparent">
          {method === "PIX" && (
            <div>
              <div className="font-semibold mb-2">Pagar com PIX</div>
              <p className="text-xs text-emerald-700 mt-1">
                Seu primeiro mês em qualquer plano é gratuito. A cobrança começa só no próximo ciclo.
              </p>

              <p className="text-sm text-gray-700 mb-3">
                Valor: <b>{brl(total)}</b>. Clique em <b>Assinar agora</b> para gerar o QR Code e o código “copia e cola”.
              </p>

              {pixQrUrl && (
                <div className="mb-3">
                  <img src={pixQrUrl} alt="QR Code PIX" className="w-56 border rounded-lg" />
                </div>
              )}
              {pixCopiaECola && (
                <div className="mb-2">
                  <div className="text-xs text-gray-600 mb-1">Copia e cola:</div>
                  <textarea className="w-full border rounded-lg p-2 text-xs" rows={3} readOnly value={pixCopiaECola} />
                  <div className="flex justify-end">
                    <button
                      className="mt-2 px-3 py-2 border rounded-lg"
                      onClick={async () => {
                        await navigator.clipboard.writeText(pixCopiaECola);
                        alert("Código PIX copiado!");
                      }}
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2 mt-3">
                <input
                  className="border rounded-md px-3 py-2"
                  placeholder="Seu nome completo"
                  value={pagador.nome}
                  onChange={e => setPagador({ ...pagador, nome: e.target.value })}
                />
                <input
                  className="border rounded-md px-3 py-2"
                  placeholder="Seu e-mail"
                  value={pagador.email}
                  onChange={e => setPagador({ ...pagador, email: e.target.value })}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Após o pagamento, seu status será verificado automaticamente.
              </p>
            </div>
          )}

          {(method === "CREDITO" || method === "DEBITO") && (
            <div>
              <div className="font-semibold mb-2">
                Pagar com {method === "CREDITO" ? "Cartão de Crédito" : "Cartão de Débito"}
              </div>

              <p className="text-xs text-emerald-700 mt-1">
                Seu primeiro mês em qualquer plano é gratuito. A cobrança começa só no próximo ciclo.
              </p>

              <p className="text-sm text-gray-700 mb-3">
                Valor: <b>{brl(total)}</b>
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="border rounded-md px-3 py-2"
                  placeholder="Nome do titular"
                  value={pagador.nome}
                  onChange={e => setPagador({ ...pagador, nome: e.target.value })}
                />
                <input
                  className="border rounded-md px-3 py-2"
                  placeholder="E-mail do titular"
                  value={pagador.email}
                  onChange={e => setPagador({ ...pagador, email: e.target.value })}
                />
                <input
                  className="border rounded-md px-3 py-2"
                  placeholder="CPF (opcional)"
                  value={pagador.cpf || ""}
                  onChange={e => setPagador({ ...pagador, cpf: e.target.value })}
                />
                <input
                  className="border rounded-md px-3 py-2"
                  placeholder="Telefone (opcional)"
                  value={pagador.telefone || ""}
                  onChange={e => setPagador({ ...pagador, telefone: e.target.value })}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2 mt-3">
                <input
                  className="border rounded-md px-3 py-2"
                  placeholder="Número do cartão"
                  value={cartao.numero}
                  onChange={e => setCartao({ ...cartao, numero: e.target.value })}
                  inputMode="numeric"
                />
                <input
                  className="border rounded-md px-3 py-2"
                  placeholder="Nome impresso no cartão"
                  value={cartao.nomeImpresso}
                  onChange={e => setCartao({ ...cartao, nomeImpresso: e.target.value })}
                />
                <input
                  className="border rounded-md px-3 py-2"
                  placeholder="Validade (MM/AA)"
                  value={cartao.validade}
                  onChange={e => setCartao({ ...cartao, validade: e.target.value })}
                />
                <input
                  className="border rounded-md px-3 py-2"
                  placeholder="CVV"
                  value={cartao.cvv}
                  onChange={e => setCartao({ ...cartao, cvv: e.target.value })}
                  inputMode="numeric"
                />
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Continuaremos para a página de confirmação do pagamento (simulada).
              </p>
            </div>
          )}

          {method === "BOLETO" && (
            <div>
              <div className="font-semibold mb-2">Pagar com Boleto</div>

              <p className="text-xs text-emerald-700 mt-1">
                Seu primeiro mês em qualquer plano é gratuito. A cobrança começa só no próximo ciclo.
              </p>

              <p className="text-sm text-gray-700 mb-3">
                Valor: <b>{brl(total)}</b>
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="border rounded-md px-3 py-2"
                  placeholder="Seu nome completo"
                  value={pagador.nome}
                  onChange={e => setPagador({ ...pagador, nome: e.target.value })}
                />
                <input
                  className="border rounded-md px-3 py-2"
                  placeholder="Seu e-mail"
                  value={pagador.email}
                  onChange={e => setPagador({ ...pagador, email: e.target.value })}
                />
                <input
                  className="border rounded-md px-3 py-2 sm:col-span-2"
                  placeholder="CPF"
                  value={pagador.cpf || ""}
                  onChange={e => setPagador({ ...pagador, cpf: e.target.value })}
                />
              </div>

              {boletoLinha && (
                <div className="mt-3">
                  <div className="text-xs text-gray-600 mb-1">Linha digitável:</div>
                  <input className="w-full border rounded-lg p-2 text-sm" readOnly value={boletoLinha} />
                  <div className="flex justify-end">
                    <button
                      className="mt-2 px-3 py-2 border rounded-lg"
                      onClick={async () => {
                        await navigator.clipboard.writeText(boletoLinha);
                        alert("Linha digitável copiada!");
                      }}
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}
              {boletoPdf && (
                <div className="mt-2">
                  <a className="text-green-800 underline" href={boletoPdf} target="_blank" rel="noreferrer">
                    Abrir boleto (PDF)
                  </a>
                </div>
              )}

              <p className="text-xs text-gray-500 mt-2">
                O status será atualizado automaticamente após a compensação.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3 mt-4">
          <div className="text-sm text-gray-600">
            Total a pagar: <b className="text-gray-900">{brl(total)}</b>
            <span className="block text-xs text-emerald-700">
              Seu primeiro mês em qualquer plano é gratuito. Se esta for sua primeira assinatura, você não será cobrado agora.
            </span>
          </div>
          <button
            onClick={startCheckout}
            className="px-4 py-2 rounded-lg bg-green-800 text-white disabled:opacity-60"
            disabled={polling}
          >
            Assinar agora
          </button>
        </div>
      </section>

      <section className="mb-8 p-4 border rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Resgatar presente</h2>
        </div>
        <div className="flex gap-2">
          <input
            value={giftCode}
            onChange={e => setGiftCode(e.target.value)}
            placeholder="Código do presente"
            className="flex-1 border rounded-md px-3 py-2"
          />
          <button onClick={redeemGift} className="px-3 py-2 border rounded-md">
            Resgatar
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Se alguém comprou uma assinatura para você, digite o código recebido por e-mail/mensagem.
        </p>
      </section>

      <section className="mb-8 p-4 border rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <BadgeCheck className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Histórico</h2>
        </div>
        {pagamentos.length === 0 ? (
          <div className="text-gray-600">Você ainda não possui pagamentos.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Data</th>
                  <th className="py-2">Plano</th>
                  <th className="py-2">Período</th>
                  <th className="py-2">Método</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.map(pg => (
                  <tr key={pg.id} className="border-b">
                    <td className="py-2">{new Date(pg.criadoEm).toLocaleString()}</td>
                    <td className="py-2">{pg.plano}</td>
                    <td className="py-2">{pg.periodicidade}</td>
                    <td className="py-2">{pg.metodo}</td>
                    <td className="py-2">
                      <span className={
                        pg.status === "APROVADO" ? "text-emerald-700" :
                        pg.status === "PENDENTE" ? "text-amber-700" :
                        pg.status === "FALHOU" ? "text-red-700" : "text-gray-700"
                      }>
                        {pg.status}
                      </span>
                    </td>
                    <td className="py-2 text-right">{brl(pg.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}