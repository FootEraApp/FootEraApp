import { useEffect, useMemo, useState, useRef } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  Gift,
  Landmark,
  QrCode,
  XCircle,
  CheckCircle2,
  Layers,
  BookOpen,
  Sparkles,
  Receipt,
} from "lucide-react";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";
import { Link } from "wouter";

type Periodicidade = "Mensal" | "Anual";
type MetodoPagamento = "PIX" | "CREDITO" | "DEBITO" | "BOLETO";

type Plan = {
  id: string;
  title: string;
  monthly: number;
  annual: number | null;
  benefits: string[];
};

type AssinaturaStatus = "TRIAL" | "ATIVA" | "BLOQUEADA" | "CANCELADA" | "PENDENTE" | string;

type Assinatura = {
  id: string;
  usuarioId: string;
  plano: string;
  planoId: string | null;
  periodicidade?: Periodicidade;
  startsAt: string;
  renovaEm?: string | null;
  status?: AssinaturaStatus;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  metodoPreferido?: MetodoPagamento | null;
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

type BillingState = {
  status: "TRIAL" | "ATIVA" | "BLOQUEADA" | string;
  trialAtivo: boolean;
  trialEndsAt: string | null;
  diasRestantes: number | null;
  precisaEscolherPagamento: boolean;
  metodoPreferido: MetodoPagamento | null;
  bloqueado: boolean;
  trialJaUsado?: boolean; 
};

type MetodologiaAvulsa = {
  id: string;
  titulo: string;
  descricao: string | null;
  nivel: "Base" | "Avancado" | "Performance" | string;
  totalSemanas: number | null;
  _count: { itens: number; assinantes: number };
  videoCount: number;
  treinoCount: number;
  precoAnual: number;
};

function PagamentoModal({
  open,
  onClose,
  method,
  setMethod,
  pagador,
  setPagador,
  cartao,
  setCartao,
  total,
  mostrarMsgTrial,
  bloquearCheckoutPorTrial,
  canFinalize,
  checkoutError,
  onFinalize,
  pixQrUrl,
  pixCopiaECola,
  boletoLinha,
  boletoPdf,
  sanitizeEmail,
  sanitizeCpf,
  sanitizePhone,
  sanitizeCardNumber,
  sanitizeCvv,
  formatValidade,
  onlyNameChars,
  brl,
}: {
  open: boolean;
  onClose: () => void;
  method: MetodoPagamento;
  setMethod: (m: MetodoPagamento) => void;
  pagador: Pagador;
  setPagador: React.Dispatch<React.SetStateAction<Pagador>>;
  cartao: Cartao;
  setCartao: React.Dispatch<React.SetStateAction<Cartao>>;
  total: number;
  mostrarMsgTrial: boolean;
  bloquearCheckoutPorTrial: boolean;
  polling: boolean;
  canFinalize: boolean;
  checkoutError: string | null;
  onFinalize: () => void;
  pixQrUrl: string | null;
  pixCopiaECola: string | null;
  setPixCopiaECola: React.Dispatch<React.SetStateAction<string | null>>;
  boletoLinha: string | null;
  boletoPdf: string | null;
  sanitizeEmail: (v: string) => string;
  sanitizeCpf: (v: string) => string;
  sanitizePhone: (v: string) => string;
  sanitizeCardNumber: (v: string) => string;
  sanitizeCvv: (v: string) => string;
  formatValidade: (v: string) => string;
  onlyNameChars: (v: string) => string;
  brl: (n: number | string) => string;
}) {
  if (!open) return null;
  return (
  <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
    <div
      className="absolute inset-0 bg-black/40"
      onMouseDown={onClose}
      role="presentation"
    />

    <div
      className="relative w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border max-h-[85vh] overflow-y-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="font-semibold">Pagamento</div>
        <button
          type="button"
          onClick={onClose}
          className="h-9 w-9 inline-flex items-center justify-center rounded-full hover:bg-gray-100"
          aria-label="Fechar"
          title="Fechar"
        >
          ✕
        </button>
      </div>

      <div className="p-4">
        {bloquearCheckoutPorTrial ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="font-semibold">Seu mês grátis está ativo ✅</div>
            <div className="mt-1">
              Quando faltar 7 dias, você poderá escolher a forma de pagamento.
            </div>
          </div>
        ) : (
          <>
            <div className="mb-2">
              <div className="font-semibold mb-2">Método de pagamento</div>
              <div className="flex flex-wrap gap-3">
                <label className={`px-3 py-2 border rounded-lg cursor-pointer flex items-center gap-2 ${method==="PIX"?"bg-green-50 border-green-300":""}`}>
                  <input type="radio" className="hidden" checked={method==="PIX"} onChange={() => setMethod("PIX")} />
                  PIX
                </label>
                <label className={`px-3 py-2 border rounded-lg cursor-pointer flex items-center gap-2 ${method==="CREDITO"?"bg-green-50 border-green-300":""}`}>
                  <input type="radio" className="hidden" checked={method==="CREDITO"} onChange={() => setMethod("CREDITO")} />
                  Crédito
                </label>
                <label className={`px-3 py-2 border rounded-lg cursor-pointer flex items-center gap-2 ${method==="DEBITO"?"bg-green-50 border-green-300":""}`}>
                  <input type="radio" className="hidden" checked={method==="DEBITO"} onChange={() => setMethod("DEBITO")} />
                  Débito
                </label>
                <label className={`px-3 py-2 border rounded-lg cursor-pointer flex items-center gap-2 ${method==="BOLETO"?"bg-green-50 border-green-300":""}`}>
                  <input type="radio" className="hidden" checked={method==="BOLETO"} onChange={() => setMethod("BOLETO")} />
                  Boleto
                </label>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-lg border bg-transparent">
              {method === "PIX" && (
                <div>
                  <div className="font-semibold mb-2">Pagar com PIX</div>

                  {mostrarMsgTrial && (
                    <p className="text-xs text-emerald-700 mt-1">
                      Seu mês grátis está ativo. A cobrança só começa após o fim do trial.
                    </p>
                  )}

                  <p className="text-sm text-gray-700 mb-3">
                    Total: <b>{brl(total)}</b>. Clique em <b>Finalizar</b> para gerar o QR Code e o “copia e cola”.
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
                      onChange={(e) => setPagador((p) => ({ ...p, nome: e.target.value }))}
                    />
                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="E-mail do titular"
                      value={pagador.email}
                      onChange={(e) => setPagador((p) => ({ ...p, email: sanitizeEmail(e.target.value) }))}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                    />
                  </div>
                </div>
              )}

              {(method === "CREDITO" || method === "DEBITO") && (
                <div>
                  <div className="font-semibold mb-2">
                    Pagar com {method === "CREDITO" ? "Cartão de Crédito" : "Cartão de Débito"}
                  </div>

                  <p className="text-sm text-gray-700 mb-3">
                    Total: <b>{brl(total)}</b>
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="Nome do titular"
                      value={pagador.nome}
                      onChange={(e) => setPagador((p) => ({ ...p, nome: onlyNameChars(e.target.value) }))}
                      autoComplete="name"
                    />

                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="E-mail do titular"
                      value={pagador.email}
                      onChange={(e) => setPagador((p) => ({ ...p, email: sanitizeEmail(e.target.value) }))}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                    />

                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="CPF (opcional)"
                      value={pagador.cpf || ""}
                      onChange={(e) => setPagador((p) => ({ ...p, cpf: sanitizeCpf(e.target.value) }))}
                      inputMode="numeric"
                      maxLength={11}
                    />
                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="Telefone (opcional)"
                      value={pagador.telefone || ""}
                      onChange={(e) => setPagador((p) => ({ ...p, telefone: sanitizePhone(e.target.value) }))}
                      inputMode="numeric"
                      maxLength={11}
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 mt-3">
                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="Número do cartão"
                      value={cartao.numero}
                      onChange={(e) => setCartao((c) => ({ ...c, numero: sanitizeCardNumber(e.target.value) }))}
                      inputMode="numeric"
                      autoComplete="cc-number"
                    />

                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="Nome impresso no cartão"
                      value={cartao.nomeImpresso}
                      onChange={(e) => setCartao((c) => ({ ...c, nomeImpresso: onlyNameChars(e.target.value) }))}
                      autoComplete="name"
                    />

                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="Validade (MM/AA)"
                      value={cartao.validade}
                      onChange={(e) => setCartao((c) => ({ ...c, validade: formatValidade(e.target.value) }))}
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      maxLength={5}
                    />

                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="CVV"
                      value={cartao.cvv}
                      onChange={(e) => setCartao((c) => ({ ...c, cvv: sanitizeCvv(e.target.value) }))}
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      maxLength={4}
                    />
                  </div>
                </div>
              )}

              {method === "BOLETO" && (
                <div>
                  <div className="font-semibold mb-2">Pagar com Boleto</div>

                  <p className="text-sm text-gray-700 mb-3">
                    Total: <b>{brl(total)}</b>
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="Seu nome completo"
                      value={pagador.nome}
                      onChange={(e) => setPagador((p) => ({ ...p, nome: e.target.value }))}
                    />
                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="E-mail do titular"
                      value={pagador.email}
                      onChange={(e) => setPagador((p) => ({ ...p, email: sanitizeEmail(e.target.value) }))}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                    />

                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="CPF"
                      value={pagador.cpf || ""}
                      onChange={(e) => setPagador((p) => ({ ...p, cpf: sanitizeCpf(e.target.value) }))}
                      inputMode="numeric"
                      maxLength={11}
                    />
                  </div>

                  {boletoLinha && (
                    <div className="mt-3">
                      <div className="text-xs text-gray-600 mb-1">Linha digitável:</div>
                      <input className="w-full border rounded-lg p-2 text-sm" readOnly value={boletoLinha} />
                    </div>
                  )}
                  {boletoPdf && (
                    <div className="mt-2">
                      <a className="text-green-800 underline" href={boletoPdf} target="_blank" rel="noreferrer">
                        Abrir boleto (PDF)
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t pt-3 mt-4">
              <div className="text-sm text-gray-600">
                Total: <b className="text-gray-900">{brl(total)}</b>
                {mostrarMsgTrial ? (
                  <span className="block text-xs text-emerald-700">
                    Trial ativo. Você só paga se escolher pagar agora.
                  </span>
                ) : null}
              </div>

              <button
                onClick={onFinalize}
                className="px-4 py-2 rounded-lg bg-green-800 text-white disabled:opacity-60"
                disabled={!canFinalize}
                title={checkoutError ?? ""}
              >
                Finalizar pagamento
              </button>
            </div>

            {checkoutError ? (
              <div className="mt-2 text-xs text-red-700">
                {checkoutError}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  </div>
);

}

function brl(n: number | string) {
  const v = typeof n === "string" ? Number(n) : n;
  const safe = Number.isFinite(v) ? v : 0;
  return safe.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function diasRestantesIso(dateIso?: string | null) {
  if (!dateIso) return null;
  const d = new Date(dateIso).getTime();
  const diff = d - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function toTs(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function formatDateBR(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR");
}

type RoleUI = "Atleta" | "Olheiro" | "Professor" | "Organizações";

function normalizeTipo(raw?: unknown) {
  return String(raw ?? "").trim().toLowerCase();
}

type MainTier = "PRO" | "LEARNING_1" | "LEARNING_3" | "METODO_1"; // METODO_1 só pra atleta

function planId(role: RoleUI, tier: MainTier) {
  const r =
    role === "Atleta"
      ? "ATLETA"
      : role === "Olheiro"
      ? "OLHEIRO"
      : role === "Professor"
      ? "PROFESSOR"
      : "ORGANIZACOES";

  return `${r}_${tier}`;
}

const storageRoleToUIRole: Record<string, RoleUI> = {
  atleta: "Atleta",
  olheiro: "Olheiro",
  professor: "Professor",
  escolinha: "Organizações",
  clube: "Organizações",
  organizacoes: "Organizações",
  organizações: "Organizações",
  admin: "Atleta",
};

const FALLBACK_PLANS: Record<string, Plan> = {
  // ✅ ATLETA
  ATLETA_PRO: {
    id: "ATLETA_PRO",
    title: "Atleta Pro",
    monthly: 19.9,          // <- mantenha o valor que você já usa no backend
    annual: null,
    benefits: ["Sem anúncios", "Recursos Pro do atleta", "Mais limites operacionais"],
  },
  ATLETA_LEARNING_1: {
    id: "ATLETA_LEARNING_1",
    title: "Atleta Learning 1",
    monthly: 44.9,
    annual: null,
    benefits: ["Tudo do Atleta Pro", "Escolher 1 metodologia por mês"],
  },
  ATLETA_LEARNING_3: {
    id: "ATLETA_LEARNING_3",
    title: "Atleta Learning 3",
    monthly: 64.9,
    annual: null,
    benefits: ["Tudo do Atleta Pro", "Escolher até 3 metodologias por mês"],
  },
  ATLETA_METODO_1: {
    id: "ATLETA_METODO_1",
    title: "1 Metodologia (mensal)",
    monthly: 29.9,
    annual: null,
    benefits: ["Escolher 1 metodologia por mês", "Sem benefícios do Pro"],
  },

  // ✅ PROFESSOR
  PROFESSOR_PRO: {
    id: "PROFESSOR_PRO",
    title: "Professor Pro",
    monthly: 39.9,          // <- você falou “em torno de 59,90”
    annual: null,
    benefits: ["Sem anúncios", "Recursos Pro do professor", "Mais limites operacionais"],
  },
  PROFESSOR_LEARNING_1: {
    id: "PROFESSOR_LEARNING_1",
    title: "Professor Learning 1",
    monthly: 59.9,          // se for diferente do Pro, troque aqui
    annual: null,
    benefits: ["Tudo do Professor Pro", "Escolher 1 metodologia por mês"],
  },
  PROFESSOR_LEARNING_3: {
    id: "PROFESSOR_LEARNING_3",
    title: "Professor Learning 3",
    monthly: 79.9,
    annual: null,
    benefits: ["Tudo do Professor Pro", "Escolher até 3 metodologias por mês"],
  },

  // ✅ ORGANIZAÇÕES
  ORGANIZACOES_PRO: {
    id: "ORGANIZACOES_PRO",
    title: "Organizações Pro",
    monthly: 79.9,          // mantenha ou ajuste
    annual: null,
    benefits: ["Sem anúncios", "Recursos Pro da organização", "Mais capacidade operacional"],
  },
  ORGANIZACOES_LEARNING_3: {
    id: "ORGANIZACOES_LEARNING_3",
    title: "Organizações Learning",
    monthly: 149.9,
    annual: null,
    benefits: ["Tudo do Pro", "Escolher até 3 metodologias por mês"],
  },

  // ✅ OLHEIRO (mantém)
  OLHEIRO_PRO: {
    id: "OLHEIRO_PRO",
    title: "Olheiro Pro",
    monthly: 24.9,
    annual: null,
    benefits: ["Sem anúncios", "Ferramentas Pro do olheiro", "Mais limites operacionais"],
  },
};

type CartItem = {
  planoId: string;
  periodicidade: Periodicidade;
  label: string;
  price: number;
  categoria: "PRO" | "LEARNING" | "PLUS" | "METODOLOGIA";
};

function uniqueCart(items: CartItem[]) {
  const map = new Map<string, CartItem>();
  for (const it of items) {
    const key = `${it.planoId}::${it.periodicidade}`;
    map.set(key, it);
  }
  return Array.from(map.values());
}

const LS_KEY = "footera:pagamentos:selecao:v1";

type PersistState = {
  roleSelected: RoleUI;
  periodPro: Periodicidade;
  periodLearning: Periodicidade;
  periodPlus: Periodicidade;
  pickPro: boolean;
  pickLearning: boolean;
  pickPlus: boolean;
  pickMetods: Record<string, boolean>;
  cupomInput: string;
  method: MetodoPagamento;
  selectedMain: string | null;
};

function readPersist(): PersistState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writePersist(s: PersistState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {}
}

export default function PagamentosPage() {
  const tipo = Storage.tipoSalvo; 
  const [tipoBackend, setTipoBackend] = useState<string | null>(null);

  const roleUI: RoleUI = useMemo(() => {
    const key = normalizeTipo(tipoBackend ?? tipo);
    return storageRoleToUIRole[key] ?? "Atleta";
  }, [tipoBackend, tipo]);

  const [roleSelected, setRoleSelected] = useState<RoleUI>(roleUI);
  const [metodologiasAvulsas, setMetodologiasAvulsas] = useState<MetodologiaAvulsa[]>([]);
  const [buscaMetod, setBuscaMetod] = useState("");
  const [filtroNivelMetod, setFiltroNivelMetod] = useState<"TODOS" | "Base" | "Avancado" | "Performance">("TODOS");
  const [filtroConteudoMetod, setFiltroConteudoMetod] = useState<"TODOS" | "VIDEOS" | "TREINOS" | "AMBOS">("TODOS");

  useEffect(() => {
    if (hadPersistRef.current) return;

    setRoleSelected(roleUI);
  }, [roleUI]);


  const token = Storage.token;

  const [loading, setLoading] = useState(true);
  const [apiPlans, setApiPlans] = useState<Plan[]>([]);
  const [assinaturaSingle, setAssinaturaSingle] = useState<Assinatura | null>(null);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [billingState, setBillingState] = useState<BillingState | null>(null);
  const [openPagamentoModal, setOpenPagamentoModal] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const hadPersistRef = useRef(false);
  const isOlheiro = roleSelected === "Olheiro";
  const allowLearning = !isOlheiro;
  const allowPlus = !isOlheiro;
  const allowMetodologias = !isOlheiro;

  const [periodPro, setPeriodPro] = useState<Periodicidade>("Mensal");
  const [periodLearning, setPeriodLearning] = useState<Periodicidade>("Mensal");
  const [periodPlus, setPeriodPlus] = useState<Periodicidade>("Mensal");
  const [pickPro, setPickPro] = useState(false);
  const [pickLearning, setPickLearning] = useState(false);
  const [pickPlus, setPickPlus] = useState(false);
  const [pickMetods, setPickMetods] = useState<Record<string, boolean>>({});
  const [selectedMain, setSelectedMain] = useState<string | null>(null); 
// exemplo: "ATLETA_PRO", "PROFESSOR_LEARNING_3", etc.

  const [cupomInput, setCupomInput] = useState("");
  const [cupomPreview, setCupomPreview] = useState<{ total: number; base: number; desconto: number; codigo: string; tipo: string } | null>(null);

  const [method, setMethod] = useState<MetodoPagamento>("PIX");
  const [pagador, setPagador] = useState<Pagador>({ nome: "", email: "", cpf: "", telefone: "" });
  const [cartao, setCartao] = useState<Cartao>({ numero: "", nomeImpresso: "", validade: "", cvv: "" });

  const [pixCopiaECola, setPixCopiaECola] = useState<string | null>(null);
  const [pixQrUrl, setPixQrUrl] = useState<string | null>(null);
  const [boletoLinha, setBoletoLinha] = useState<string | null>(null);
  const [boletoPdf, setBoletoPdf] = useState<string | null>(null);

  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  useEffect(() => {
    if (!billingState?.precisaEscolherPagamento) return;
    // ✅ força reescolher
    setPickMetods({});
  }, [billingState?.precisaEscolherPagamento]);

  useEffect(() => {
    if (!hydrated) return;

    // se mudou o tipo e o plano selecionado não existe mais, zera
    const validIdsForRole = (() => {
      if (roleSelected === "Olheiro") return ["OLHEIRO_PRO"];
      if (roleSelected === "Professor") return [
        planId("Professor", "PRO"),
        planId("Professor", "LEARNING_1"),
        planId("Professor", "LEARNING_3"),
      ];
      if (roleSelected === "Organizações") return [
        planId("Organizações", "PRO"),
        planId("Organizações", "LEARNING_3"),
      ];
      return [
        planId("Atleta", "PRO"),
        planId("Atleta", "LEARNING_1"),
        planId("Atleta", "LEARNING_3"),
        planId("Atleta", "METODO_1"),
      ];
    })();

    if (selectedMain && !validIdsForRole.includes(selectedMain)) {
      setSelectedMain(null);
    }
  }, [roleSelected, hydrated, selectedMain]);

  useEffect(() => {
    setCupomPreview(null);
  }, [
    cupomInput,
    pickPro, pickLearning, pickPlus,
    periodPro, periodLearning, periodPlus,
    pickMetods,
    roleSelected,
    selectedMain, // ✅ recomendado
  ]);

  function findApiPlan(planoId: string) {
    return apiPlans.find((p) => p.id === planoId);
  }

  function getPlan(planoId: string): Plan | undefined {
    const pApi = findApiPlan(planoId);
    if (pApi && ((pApi.monthly ?? 0) > 0 || (pApi.annual ?? 0) > 0)) return pApi;

    const pFallback = FALLBACK_PLANS[planoId];
    if (pFallback) return pFallback;

    if (pApi) return pApi;
    return undefined;
  }

  function getPrice(planoId: string, periodicidade: Periodicidade) {
    const p = getPlan(planoId);
    if (!p) return 0;
    if (periodicidade === "Mensal") return p.monthly ?? 0;
    return p.annual ?? 0;
  }

  function annualOk(planoId: string) {
    const p = getPlan(planoId);
    return !!p?.annual && (p.annual as number) > 0;
  }

  function buildCart(): CartItem[] {
    const items: CartItem[] = [];

    // ✅ plano principal (mensal sempre)
    if (selectedMain) {
      const price = getPrice(selectedMain, "Mensal");
      items.push({
        planoId: selectedMain,
        periodicidade: "Mensal",
        label: getPlan(selectedMain)?.title ?? selectedMain,
        price,
        categoria: "PRO", // pode deixar "PRO" ou criar categoria "MAIN"
      });
    }

    // ✅ metodologias avulsas (mantém como está por enquanto)
    Object.entries(pickMetods).forEach(([methId, checked]) => {
      if (!checked) return;
      const meth = metodologiasAvulsas.find((x) => x.id === methId);
      const price = meth?.precoAnual ?? 0;
      const label = `Metodologia: ${meth?.titulo ?? methId}`;
      items.push({ planoId: methId, periodicidade: "Anual", label, price, categoria: "METODOLOGIA" });
    });

    return uniqueCart(items);
  }

  const cart = useMemo(
    () => buildCart(),
    [
      selectedMain,
      pickPro, pickLearning, pickPlus,
      pickMetods,
      roleSelected,
      periodPro, periodLearning, periodPlus,
      apiPlans,
      metodologiasAvulsas, // ✅ ESSENCIAL
    ]
  );

  const cartTotalBase = useMemo(() => cart.reduce((s, it) => s + (it.price || 0), 0), [cart]);

  function totalComCupomLocal() {
    return cupomPreview ? cupomPreview.total : cartTotalBase;
  }

  const statusAssinatura = billingState?.status ?? assinaturaSingle?.status ?? "SEM_ASSINATURA";
  const nowTs = Date.now();

  const normStatus = (s?: unknown) => String(s ?? "").toUpperCase();

  const assinaturasAtivasDeVerdade = useMemo(() => {
    return (assinaturas || []).filter((a) => {
      const st = normStatus(a.status);
      return (st === "ATIVA" || st === "TRIAL") && a.ativo === true;
    });
  }, [assinaturas]);

  const canceladasComAcesso = useMemo(() => {
    return (assinaturas || []).filter((a) => {
      const st = normStatus(a.status);
      if (st !== "CANCELADA") return false;

      const renovaTs = toTs(a.renovaEm);
      return renovaTs != null && renovaTs > nowTs;
    });
  }, [assinaturas, nowTs]);

  const canceladaComAcessoMaisProxima = useMemo(() => {
    const arr = [...canceladasComAcesso];
    arr.sort((a, b) => (toTs(a.renovaEm) ?? Infinity) - (toTs(b.renovaEm) ?? Infinity));
    return arr[0] ?? null;
  }, [canceladasComAcesso]);

  const canceladasFinalizadas = useMemo(() => {
    return (assinaturas || []).filter((a) => {
      const st = normStatus(a.status);
      if (st !== "CANCELADA") return false;

      const renovaTs = toTs(a.renovaEm);
      if (renovaTs == null) return true;
      return renovaTs <= nowTs;
    });
  }, [assinaturas, nowTs]);

  const showCanceladoUI =
    canceladasFinalizadas.length > 0 &&
    assinaturasAtivasDeVerdade.length === 0 &&
    canceladasComAcesso.length === 0;

  const hasTrialFlag =
  Boolean(billingState?.trialAtivo) || String(statusAssinatura).toUpperCase() === "TRIAL";

  const trialAtivoAgora =
    hasTrialFlag &&
    !showCanceladoUI; 

  const bloquearCheckoutPorTrial =
    trialAtivoAgora &&
    (billingState?.diasRestantes ?? 0) > 7;

  const isTrial = trialAtivoAgora;
  const isBloqueada = billingState?.bloqueado || statusAssinatura === "BLOQUEADA";
  
  const trialJaUsado = Boolean(billingState?.trialJaUsado)
    || assinaturas.some((a) => Boolean(a.trialStartsAt || a.trialEndsAt))
    || Boolean(assinaturaSingle?.trialStartsAt || assinaturaSingle?.trialEndsAt);

  const trialDisponivel = !trialAtivoAgora && !trialJaUsado && !isBloqueada;

  async function loadMe() {
    const me = await fetch(`${API.BASE_URL}/api/billing/me`, { headers });
    const data = await me.json();

    const arr = Array.isArray(data.assinaturas)
      ? data.assinaturas
      : (data.assinatura ? [data.assinatura] : []);

    const dedup = Array.from(
      new Map<string, Assinatura>(
        arr.map((a: Assinatura) => [a.id, a])
      ).values()
    );

    setTipoBackend(data.tipoUsuario ?? null)
    setAssinaturaSingle(data.assinatura || null);
    setAssinaturas(dedup);
    setPagamentos(data.pagamentos || []);
    setBillingState(data.billingState || null);

    if (data.billingState?.metodoPreferido) setMethod(data.billingState.metodoPreferido);
  }

  useEffect(() => {
    (async () => {
      const saved = readPersist();
      hadPersistRef.current = !!saved;

      if (saved) {
        setRoleSelected(saved.roleSelected);
        setPeriodPro(saved.periodPro);
        setPeriodLearning(saved.periodLearning);
        setPeriodPlus(saved.periodPlus);
        setPickPro(saved.pickPro);
        setPickLearning(saved.pickLearning);
        setPickPlus(saved.pickPlus);
        setPickMetods(saved.pickMetods || {});
        setCupomInput(saved.cupomInput || "");
        setMethod(saved.method || "PIX");
        setSelectedMain(saved.selectedMain ?? null);
      } else {
        setPickPro(true);
        setPickLearning(false);
        setPickPlus(false);
        setSelectedMain(null);
        setPickMetods({});
      }
      setHydrated(true);

      try {
        const cat = await fetch(`${API.BASE_URL}/api/billing/plans`, { headers });
        const json = await cat.json().catch(() => ({}));
        setApiPlans(json?.plans || []);

        await loadMe();
        const rMet = await fetch(`${API.BASE_URL}/api/billing/metodologias-avulsas`, { headers });
        const jMet = await rMet.json().catch(() => ({}));
        setMetodologiasAvulsas(jMet.items || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  useEffect(() => {
    if (!hydrated) return;

    writePersist({
      roleSelected,
      periodPro,
      periodLearning,
      periodPlus,
      pickPro,
      pickLearning,
      pickPlus,
      pickMetods,
      cupomInput,
      method,
      selectedMain,
    });
  }, [
    hydrated,
    roleSelected,
    periodPro,
    periodLearning,
    periodPlus,
    pickPro,
    pickLearning,
    pickPlus,
    pickMetods,
    cupomInput,
    method,
    selectedMain,
  ]);

  function validarCamposAntesDoCheckout(): string | null {
    if (cart.length === 0) return "Selecione pelo menos uma assinatura/metodologia.";

    const zero = cart.find((c) => !c.price || c.price <= 0);
    if (zero) return `O item "${zero.label}" está sem preço (R$ 0,00). Ajuste o fallback ou crie o plano no backend.`;

    if (method === "PIX") {
      if (!pagador.nome || !pagador.email) return "Informe seu nome e e-mail para gerar o PIX.";
    }
    if (method === "BOLETO") {
      if (!pagador.nome || !pagador.email || !pagador.cpf) return "Informe nome, e-mail e CPF para gerar o boleto.";
    }
    if (method === "CREDITO" || method === "DEBITO") {
      if (!pagador.nome || !pagador.email) return "Informe nome e e-mail do titular para finalizar o pagamento.";
      if (!cartao.numero || !cartao.nomeImpresso || !cartao.validade || !cartao.cvv) return "Preencha todos os dados do cartão para finalizar o pagamento.";
    }
    if (pagador.nome && !isValidName(pagador.nome)) return "Nome inválido (não use números).";
    if (pagador.email && !isValidEmail(pagador.email)) return "E-mail inválido.";

    if (method === "BOLETO") {
      if (!pagador.cpf || sanitizeCpf(pagador.cpf).length !== 11) return "CPF inválido (11 dígitos).";
    }

    if (method === "CREDITO" || method === "DEBITO") {
      const parsedVal = parseValidade(cartao.validade);
      if (!parsedVal) return "Validade inválida (use MM/AA).";

      const STRICT_NEXT_MONTH = false; 
      if (!isValidadeNaoExpirada(cartao.validade, { strictNextMonth: STRICT_NEXT_MONTH })) {
        const min = validadeMinimaHoje({ strictNextMonth: STRICT_NEXT_MONTH });
        const minTxt = `${String(min.mm).padStart(2, "0")}/${String(min.yy).padStart(2, "0")}`;
        return `Cartão vencido. Validade mínima: ${minTxt}.`;
      }
      if (sanitizeCardNumber(cartao.numero).length < 13) return "Número do cartão parece inválido.";
      if (sanitizeCvv(cartao.cvv).length < 3) return "CVV inválido.";
    }

    return null;
  }

  const metodologiasFiltradas = useMemo(() => {
    const q = buscaMetod.trim().toLowerCase();

    return metodologiasAvulsas.filter((m) => {
      const okBusca =
        !q ||
        String(m.titulo).toLowerCase().includes(q) ||
        String(m.descricao ?? "").toLowerCase().includes(q) ||
        String(m.id).toLowerCase().includes(q);

      if (!okBusca) return false;

      if (filtroNivelMetod !== "TODOS") {
        if (String(m.nivel) !== filtroNivelMetod) return false;
      }

      if (filtroConteudoMetod !== "TODOS") {
        if (filtroConteudoMetod === "VIDEOS" && (m.videoCount ?? 0) <= 0) return false;
        if (filtroConteudoMetod === "TREINOS" && (m.treinoCount ?? 0) <= 0) return false;
        if (filtroConteudoMetod === "AMBOS" && !((m.videoCount ?? 0) > 0 && (m.treinoCount ?? 0) > 0)) return false;
      }

      return true;
    });
  }, [metodologiasAvulsas, buscaMetod, filtroNivelMetod, filtroConteudoMetod]);

  const checkoutError = useMemo(() => {
    if (bloquearCheckoutPorTrial) return "Trial ativo (aguarde faltar 7 dias).";
    return validarCamposAntesDoCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bloquearCheckoutPorTrial,
    cart,
    method,
    pagador.nome,
    pagador.email,
    pagador.cpf,
    pagador.telefone,
    cartao.numero,
    cartao.nomeImpresso,
    cartao.validade,
    cartao.cvv,
  ]);

  const canFinalize = !polling && !checkoutError;

  async function previewCoupon() {
    if (!cupomInput) return;

    const item = cart[0];

    try {
      const r = await fetch(`${API.BASE_URL}/api/billing/coupon/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          codigo: cupomInput.trim(),
          items: cart.map((c) => ({ planoId: c.planoId, periodicidade: c.periodicidade })),
        }),
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
        tipo: data.cupom.tipo,
      });
    } catch {
      alert("Erro ao validar cupom. Para ele ser usado so pode ter o atleta_pro no carrinho.");
    }
  }

  async function startTrial() {
    if (trialAtivoAgora) {
      alert("Seu mês grátis já está ativo ✅");
      return;
    }

    if (trialJaUsado) {
      alert("Você já usou o mês grátis nesta conta.");
      return;
    }

    if (isBloqueada) {
      alert("Sua conta está bloqueada. Finalize um pagamento para liberar.");
      return;
    }

    const principal = cart.find((c) => c.categoria !== "METODOLOGIA");
    if (!principal) {
      alert("Selecione um plano principal (Pro/Learning/Plus) para iniciar o mês grátis.");
      return;
    }

    try {
      const r = await fetch(`${API.BASE_URL}/api/billing/start-trial`, {
        method: "POST",
        headers,
        body: JSON.stringify({ planoId: principal.planoId, periodicidade: principal.periodicidade }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        alert(data.message || "Erro ao iniciar mês grátis");
        return;
      }

      alert("🎉 Mês grátis iniciado com sucesso!");
      await loadMe();
    } catch (e) {
      console.error(e);
      alert("Erro ao iniciar mês grátis");
    }
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

        const pago = (data.pagamentos || []).find((p: Pagamento) => p.id === pagamentoId);
        const status = data.billingState?.status ?? data.assinatura?.status;
        const isAtivaNow = status === "ATIVA";

        if (pago?.status === "APROVADO" || isAtivaNow) {
          alert("Pagamento aprovado! Assinatura ativada 🎉");
          setPixCopiaECola(null);
          setPixQrUrl(null);
          setBoletoLinha(null);
          setBoletoPdf(null);
          setPendingPaymentId(null);
          setPolling(false);
          await loadMe();
          localStorage.removeItem(LS_KEY);
          return;
        }

        await new Promise((r) => setTimeout(r, intervalMs));
      }
    } finally {
      setPolling(false);
    }
  }

  async function startCheckout() {
    if (bloquearCheckoutPorTrial) {
      alert(
        `Seu mês grátis está ativo. Você poderá escolher a forma de pagamento quando faltarem 7 dias para terminar.\n\nDias restantes: ${billingState?.diasRestantes}`
      );
      return;
    }

    const err = validarCamposAntesDoCheckout();
    if (err) return alert(err);

    setPixCopiaECola(null);
    setPixQrUrl(null);
    setBoletoLinha(null);
    setBoletoPdf(null);
    setPendingPaymentId(null);

    try {
      const bundlePayload = {
        items: cart.map((c) => ({ planoId: c.planoId, periodicidade: c.periodicidade })),
        metodo: method,
        cupom: cupomInput || null,
        pagador,
        cartao,
      };

      const rBundle = await fetch(`${API.BASE_URL}/api/billing/checkout-bundle`, {
        method: "POST",
        headers,
        body: JSON.stringify(bundlePayload),
      });

      if (rBundle.ok) {
        const data = await rBundle.json();

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

        alert(data.message || "Pagamento iniciado.");
        await loadMe();
        return;
      }

      if ((method === "PIX" || method === "BOLETO") && cart.length > 1) {
        alert(
          "Para PIX/Boleto com múltiplos itens, você precisa do endpoint /checkout-bundle no backend (1 cobrança só)."
        );
        return;
      }

      for (const item of cart) {
        const r = await fetch(`${API.BASE_URL}/api/billing/checkout`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            planoId: item.planoId,
            periodicidade: item.periodicidade,
            metodo: method,
            cupom: cart.length === 1 ? cupomInput || null : null,
            pagador,
            cartao,
          }),
        });

        const data = await r.json();

        if (!r.ok) {
          if (r.status === 403 && data.code === "TRIAL_ACTIVE") {
            alert(data.message || "Trial ativo. Volte quando faltarem 7 dias.");
            await loadMe();
            return;
          }
          alert(data.message || `Erro ao iniciar pagamento (${item.label})`);
          return;
        }

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
      }

      alert("Pagamento(s) iniciado(s). Atualizando status...");
      await loadMe();
    } catch (e) {
      console.error(e);
      alert("Erro ao iniciar pagamento");
    }
  }

  async function cancelSub(planoId?: string) {
    if (!confirm("Tem certeza que deseja cancelar essa assinatura?")) return;
    try {
      const r = await fetch(`${API.BASE_URL}/api/billing/cancel`, {
        method: "POST",
        headers,
        body: JSON.stringify({ planoId: planoId || null }),
      } as any);

      const data = await r.json().catch(() => ({}));
      if (!r.ok) return alert(data.message || "Erro ao cancelar");
      alert("Assinatura cancelada.");
      await loadMe();
    } catch {
      alert("Erro ao cancelar");
    }
  }

  async function salvarMetodoPreferido() {
    try {
      const r = await fetch(`${API.BASE_URL}/api/billing/preferred-method`, {
        method: "POST",
        headers,
        body: JSON.stringify({ metodoFinal: method }),
      });
      const data = await r.json();
      if (!r.ok) return alert(data.message || "Erro ao salvar método");
      alert("Método de pagamento salvo! ✅");
      await loadMe();
    } catch {
      alert("Erro ao salvar método preferido");
    }
  }

  if (loading) return <div className="p-6">Carregando pagamentos...</div>;

  const trialEndsAt = billingState?.trialEndsAt ?? assinaturaSingle?.trialEndsAt ?? null;
  const diasTrial = diasRestantesIso(trialEndsAt);

  const mostrarMsgTrial = trialAtivoAgora && !isBloqueada;
  const proId = planId(roleSelected, "PRO");
  const proPlan = getPlan(proId);

  function onlyDigits(v: string) {
    return (v || "").replace(/\D+/g, "");
  }

  function onlyNameChars(v: string) {
    return (v || "").replace(/[^A-Za-zÀ-ÿ' -]+/g, "");
  }

  function sanitizeEmail(v: string) {
    return (v || "").replace(/\s+/g, "");
  }

  function formatValidade(v: string) {
    const d = onlyDigits(v).slice(0, 4);
    if (d.length <= 2) return d;

    const mm = d.slice(0, 2);
    const aa = d.slice(2);

    const mmNum = Number(mm);
    if (mm.length === 2 && (mmNum < 1 || mmNum > 12)) {
      return mm.slice(0, 1);
    }

    return `${mm}/${aa}`;
  }

  function validadeMinimaHoje(opts?: { strictNextMonth?: boolean }) {
    const strictNextMonth = !!opts?.strictNextMonth;

    const now = new Date();
    let mm = now.getMonth() + 1; 
    let yy = now.getFullYear() % 100; 

    if (strictNextMonth) {
      mm += 1;
      if (mm === 13) {
        mm = 1;
        yy = (yy + 1) % 100;
      }
    }

    return { mm, yy };
  }

  function parseValidade(mmAA: string): { mm: number; yy: number } | null {
    const m = /^(\d{2})\/(\d{2})$/.exec(mmAA);
    if (!m) return null;
    const mm = Number(m[1]);
    const yy = Number(m[2]);
    if (!Number.isFinite(mm) || !Number.isFinite(yy)) return null;
    if (mm < 1 || mm > 12) return null;
    return { mm, yy };
  }

  function isValidadeNaoExpirada(mmAA: string, opts?: { strictNextMonth?: boolean }) {
    const parsed = parseValidade(mmAA);
    if (!parsed) return false;

    const min = validadeMinimaHoje({ strictNextMonth: opts?.strictNextMonth });

    if (parsed.yy > min.yy) return true;
    if (parsed.yy < min.yy) return false;
    return parsed.mm >= min.mm;
  }

  function sanitizeCpf(v: string) {
    return onlyDigits(v).slice(0, 11);
  }

  function sanitizePhone(v: string) {
    return onlyDigits(v).slice(0, 11); 
  }

  function sanitizeCardNumber(v: string) {
    return onlyDigits(v).slice(0, 19);
  }

  function sanitizeCvv(v: string) {
    return onlyDigits(v).slice(0, 4);
  }

  function isValidEmail(email: string) {
    const re = /^[A-Za-z][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return re.test(email);
  }

  function isValidName(name: string) {
    const re = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]*$/;
    return re.test(name.trim());
  }

  function isValidValidade(mmAA: string) {
    const parsed = parseValidade(mmAA);
    if (!parsed) return false;
    const STRICT_NEXT_MONTH = false;

    return isValidadeNaoExpirada(mmAA, { strictNextMonth: STRICT_NEXT_MONTH });
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <Link
        href="/perfil"
        aria-label="Voltar para perfil"
        title="Voltar para perfil"
        className="inline-flex h-10 w-10 items-center justify-center
          rounded-full border border-green-800 bg-white text-green-900
          shadow-sm hover:bg-green-50 focus:outline-none
          focus:ring-2 focus:ring-green-700/30 mt-2"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      <h1 className="text-2xl md:text-3xl font-bold mt-3">Assinaturas & Pagamentos</h1>
      <p className="text-sm text-gray-600 mb-6">
        Escolha <b>uma ou mais</b> assinaturas/metodologias. Você pode combinar como quiser: Pro, Learning, Plus e metodologias avulsas.
      </p>

      <div className="mb-6 rounded-lg border bg-emerald-50 text-emerald-900 p-3 text-sm">
        <ul className="list-disc pl-4 space-y-1">
          <li>Rede social aberta: posts/DMs ilimitados para todos. Vídeos ≤ 60s.</li>
          <li>Vinculação do atleta com 1 organização e 1 professor é sempre grátis.</li>
          <li>Limites valem para dados operacionais (treinos, templates, agendamentos), não para posts/DMs.</li>
        </ul>
      </div>

      <section className="mb-8 p-4 border rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <BadgeCheck className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Suas assinaturas ativas</h2>
        </div>

        {isBloqueada && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            Sua conta está <b>bloqueada</b>. Para liberar, finalize um pagamento aprovado.
          </div>
        )}

        {canceladaComAcessoMaisProxima && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <div className="font-semibold">
              Você cancelou. Permanece ativa até{" "}
              <b>{formatDateBR(canceladaComAcessoMaisProxima.renovaEm) ?? "—"}</b>.
            </div>
            <div className="mt-1 text-xs text-amber-900/80">
              Até essa data você continua com acesso normalmente.
            </div>
          </div>
        )}

        {assinaturasAtivasDeVerdade.length === 0 ? (
          <div className="text-gray-700">
            Você ainda não possui assinatura ativa.

            {showCanceladoUI && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <div className="font-semibold">Sua assinatura foi cancelada.</div>
                <div className="mt-1">
                  Para voltar a ter acesso, escolha um plano abaixo e finalize um novo pagamento.
                </div>
              </div>
            )}

            {trialAtivoAgora ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Seu mês grátis já está ativo ✅
              </div>
            ) : trialJaUsado ? (
              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                Você já usou o mês grátis nesta conta.
              </div>
            ) : (
              <div className="mt-3">
                <button
                  onClick={startTrial}
                  disabled={polling || !trialDisponivel}
                  className="px-4 py-2 rounded-lg bg-green-800 text-white font-semibold disabled:opacity-60"
                >
                  🎁 Começar mês grátis (1x por conta)
                </button>

                <p className="text-xs text-gray-500 mt-2">
                  Recomendado usar o trial em um plano principal (Pro/Learning/Plus).
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {assinaturasAtivasDeVerdade.map((a) => {
              const s = String(a.status ?? "—").toUpperCase();
              const isA = s === "ATIVA";
              const isT = s === "TRIAL";
              const ends = a.trialEndsAt ?? null;

              return (
                <div
                  key={a.id}
                  className="rounded-lg border p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                >
                  <div>
                    <div className="font-semibold">{a.plano}</div>
                    <div className="text-sm text-gray-600">
                      Status:{" "}
                      <span
                        className={
                          isA
                            ? "text-emerald-700 font-semibold"
                            : isT
                            ? "text-green-700 font-semibold"
                            : "text-gray-700"
                        }
                      >
                        {s}
                      </span>
                      {a.periodicidade ? ` · ${a.periodicidade}` : ""}
                    </div>

                    {isT && ends && (
                      <div className="text-xs text-gray-600 mt-1">
                        Trial termina em {formatDateBR(ends) ?? "—"}{" "}
                        {diasRestantesIso(ends) != null
                          ? `(faltam ${diasRestantesIso(ends)} dia(s))`
                          : ""}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => cancelSub(a.planoId ?? undefined)}
                      disabled={polling}
                      className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2 disabled:opacity-60"
                    >
                      <XCircle className="w-4 h-4" /> Cancelar
                    </button>
                  </div>
                </div>
              );
            })}

            {billingState?.precisaEscolherPagamento && !billingState?.bloqueado && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="font-semibold">Seu mês está acabando!</div>
                  <div className="mt-1">
                    Faltam <b>{billingState?.diasRestantes ?? "—"}</b> dia(s).
                    Para continuar, renove mais 1 mês e escolha novamente suas metodologias
                    (pode manter as mesmas ou trocar).
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setOpenPagamentoModal(true)}
                      className="px-3 py-2 rounded-lg border border-amber-300 bg-white text-amber-900 disabled:opacity-60"
                      disabled={polling}
                    >
                      Renovar agora
                    </button>
                  </div>
                </div>
              )}
          </div>
        )}

        {isTrial && trialEndsAt && (
          <div className="mt-3 text-sm text-gray-700">
            <div className="font-semibold text-emerald-800">Trial ativo ✅</div>
            <div className="text-gray-600">
              Termina em <b>{formatDateBR(trialEndsAt) ?? "—"}</b>{" "}
              {diasTrial != null ? `(faltam ${diasTrial} dia(s))` : ""}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Durante o trial, você só precisa pagar quando faltarem 7 dias.
            </div>
          </div>
        )}
      </section>

      <section className="mb-6 p-4 border rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Tipo de assinatura</h2>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          As assinaturas Pro/Learning/Plus mudam conforme o tipo de usuário. Metodologias são independentes.
        </p>

        <div className="flex flex-wrap gap-2">
          {(["Atleta", "Olheiro", "Professor", "Organizações"] as RoleUI[]).map((r) => {
            const disabled = r !== roleUI;

            return (
              <button
                key={r}
                disabled={disabled}
                onClick={() => setRoleSelected(r)}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold ${
                  roleSelected === r ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-800"
                } ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"}`}
                title={disabled ? "Seu tipo de conta não permite trocar" : ""}
              >
                {r}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-6 p-4 border rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Plano principal</h2>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          Escolha <b>1</b> plano mensal. Quando virar o mês, você poderá renovar e escolher novamente as metodologias do seu plano.
        </p>

        {(() => {
          const opts: { id: string; show: boolean }[] = [];

          if (roleSelected === "Olheiro") {
            opts.push({ id: "OLHEIRO_PRO", show: true });
          } else if (roleSelected === "Professor") {
            opts.push({ id: planId("Professor", "PRO"), show: true });
            opts.push({ id: planId("Professor", "LEARNING_1"), show: true });
            opts.push({ id: planId("Professor", "LEARNING_3"), show: true });
          } else if (roleSelected === "Organizações") {
            opts.push({ id: planId("Organizações", "PRO"), show: true });
            opts.push({ id: planId("Organizações", "LEARNING_3"), show: true });
          } else {
            // Atleta
            opts.push({ id: planId("Atleta", "PRO"), show: true });
            opts.push({ id: planId("Atleta", "LEARNING_1"), show: true });
            opts.push({ id: planId("Atleta", "LEARNING_3"), show: true });
            opts.push({ id: planId("Atleta", "METODO_1"), show: true });
          }

          return (
            <div className="grid md:grid-cols-2 gap-3">
              {opts.filter(o => o.show).map(({ id }) => {
                const p = getPlan(id);
                const title = p?.title ?? id;
                const price = p?.monthly ?? 0;
                const benefits = p?.benefits ?? [];

                return (
                  <label key={id} className="rounded-lg border p-3 cursor-pointer hover:bg-gray-50 flex gap-3">
                    <input
                      type="checkbox"
                      checked={selectedMain === id}
                      onChange={() => setSelectedMain((prev) => (prev === id ? null : id))}
                      className="mt-1 h-4 w-4 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="font-semibold">{title}</div>
                      <div className="text-sm text-gray-700 mt-1">Mensal: <b>{brl(price)}</b></div>
                      <ul className="list-disc pl-5 text-sm text-gray-600 mt-2 space-y-1">
                        {benefits.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                      <div className="text-xs text-gray-500 mt-2">ID: <b>{id}</b></div>
                    </div>
                  </label>
                );
              })}
            </div>
          );
        })()}
      </section>

      {allowMetodologias && (
      <section className="mb-8 p-4 border rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Receipt className="w-5 h-5 text-amber-700" />
          <h2 className="font-semibold text-lg">Metodologias avulsas</h2>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          Pague <b>por metodologia</b>. Você escolhe uma ou mais e paga um valor anual por cada uma.
        </p>

        {/* filtros (agora eles funcionam) */}
        <div className="grid gap-2 md:grid-cols-3 mb-3">
          <input
            value={buscaMetod}
            onChange={(e) => setBuscaMetod(e.target.value)}
            placeholder="Buscar metodologia..."
            className="border rounded-md px-3 py-2"
          />

          <select
            value={filtroNivelMetod}
            onChange={(e) => setFiltroNivelMetod(e.target.value as any)}
            className="border rounded-md px-3 py-2"
          >
            <option value="TODOS">Todos os níveis</option>
            <option value="Base">Base</option>
            <option value="Avancado">Avançado</option>
            <option value="Performance">Performance</option>
          </select>

          <select
            value={filtroConteudoMetod}
            onChange={(e) => setFiltroConteudoMetod(e.target.value as any)}
            className="border rounded-md px-3 py-2"
          >
            <option value="TODOS">Qualquer conteúdo</option>
            <option value="VIDEOS">Só vídeos</option>
            <option value="TREINOS">Só treinos</option>
            <option value="AMBOS">Vídeos + Treinos</option>
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {metodologiasFiltradas.map((m) => {
            const preco = Number(m.precoAnual ?? 0);

            return (
              <label key={m.id} className="rounded-lg border p-3 flex gap-3 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={!!pickMetods[m.id]}
                  onChange={(e) => setPickMetods((prev) => ({ ...prev, [m.id]: e.target.checked }))}
                  className="mt-1"
                />

                <div className="flex-1">
                  <div className="font-semibold">{m.titulo}</div>
                  {m.descricao ? <div className="text-sm text-gray-600">{m.descricao}</div> : null}

                  <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                    <span>Nível: <b>{m.nivel}</b></span>
                    <span>Semanas: <b>{m.totalSemanas ?? 0}</b></span>
                    <span>Vídeos: <b>{m.videoCount ?? 0}</b></span>
                    <span>Treinos: <b>{m.treinoCount ?? 0}</b></span>
                    <span>Itens: <b>{m._count?.itens ?? 0}</b></span>
                  </div>

                  <div className="text-sm text-gray-800 mt-2">
                    <b>Anual:</b> {brl(preco)}
                  </div>

                  <div className="text-xs text-gray-500 mt-1">
                    ID: <b>{m.id}</b>
                  </div>
                </div>
              </label>
            );
          })}

          {metodologiasFiltradas.length === 0 && (
            <div className="text-sm text-gray-600">
              Nenhuma metodologia encontrada com esses filtros.
            </div>
          )}
        </div>
      </section>
      )}

      <section className="mb-6 p-4 border rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Resumo do que você escolheu</h2>
        </div>

        {cart.length === 0 ? (
          <div className="text-sm text-gray-600">Selecione um ou mais planos/metodologias acima para montar seu pagamento.</div>
        ) : (
          <div className="mt-2">
            <div className="space-y-2">
              {cart.map((it) => (
                <div key={`${it.planoId}-${it.periodicidade}`} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-semibold">{it.label}</div>
                    <div className="text-xs text-gray-600">
                      {it.planoId} · {it.periodicidade}
                    </div>
                  </div>
                  <div className="font-semibold">{brl(it.price)}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <div className="text-sm text-gray-600">
                Total: <b className="text-gray-900">{brl(totalComCupomLocal())}</b>
                {mostrarMsgTrial ? (
                  <span className="block text-xs text-emerald-700">
                    Trial ativo: a cobrança pode começar só após o fim do mês grátis (conforme regra do backend).
                  </span>
                ) : null}
              </div>

              {trialAtivoAgora ? (
                  <div className="px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 text-sm font-semibold">
                    ✅ Mês grátis já está ativo
                  </div>
                ) : trialJaUsado ? (
                  <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm font-semibold">
                    Você já usou o mês grátis
                  </div>
                ) : (
                  <button
                    onClick={startTrial}
                    className="px-3 py-2 rounded-lg border border-green-800 text-green-900 font-semibold hover:bg-green-50 disabled:opacity-60"
                    disabled={polling || !trialDisponivel}
                    title="Inicia o mês grátis (1x por conta) em um plano principal (Pro/Learning/Plus)"
                  >
                    🎁 Usar mês grátis
                  </button>
                )}
            </div>
          </div>
        )}
      </section>

      <section className="mb-6 p-4 border rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Cupom</h2>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          No momento, cupom funciona por item (se o carrinho tiver 1 item).
        </p>

        <div className="flex gap-2">
          <input
            value={cupomInput}
            onChange={(e) => setCupomInput(e.target.value)}
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
      </section>

      {!openPagamentoModal && (
      <section className="mb-8 p-4 border rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Pagamento</h2>
        </div>

        {(canceladaComAcessoMaisProxima || showCanceladoUI) && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <div className="font-semibold">
              {canceladaComAcessoMaisProxima
                ? `Você cancelou sua assinatura. Ela permanece ativa até ${formatDateBR(canceladaComAcessoMaisProxima.renovaEm) ?? "breve"}.`
                : "Sua assinatura foi cancelada."}
            </div>
            <div className="mt-1">
              {canceladaComAcessoMaisProxima
                ? "Até essa data você continua com acesso. Depois disso, para voltar, escolha um plano e finalize um novo pagamento."
                : "Para voltar a ter acesso, escolha um plano e finalize o pagamento novamente."}
            </div>
          </div>
        )}
        {bloquearCheckoutPorTrial ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="font-semibold">Seu mês grátis está ativo ✅</div>
            <div className="mt-1">
              Faltam <b>{billingState?.diasRestantes}</b> dias para terminar.
              Quando faltar 7 dias, você poderá escolher a forma de pagamento.
            </div>
          </div>
        ) : (
          <>
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
                  {mostrarMsgTrial && (
                    <p className="text-xs text-emerald-700 mt-1">
                      Seu mês grátis está ativo. A cobrança só começa após o fim do trial.
                    </p>
                  )}

                  <p className="text-sm text-gray-700 mb-3">
                    Total: <b>{brl(totalComCupomLocal())}</b>. Clique em <b>Finalizar</b> para gerar o QR Code e o código “copia e cola”.
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
                      onChange={(e) => setPagador({ ...pagador, nome: e.target.value })}
                    />
                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="E-mail do titular"
                      value={pagador.email}
                      onChange={(e) =>
                        setPagador((p) => ({ ...p, email: sanitizeEmail(e.target.value) }))
                      }
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      pattern="^[A-Za-z][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
                    />

                  </div>
                </div>
              )}

              {(method === "CREDITO" || method === "DEBITO") && (
                <div>
                  <div className="font-semibold mb-2">
                    Pagar com {method === "CREDITO" ? "Cartão de Crédito" : "Cartão de Débito"}
                  </div>

                  <p className="text-sm text-gray-700 mb-3">
                    Total: <b>{brl(totalComCupomLocal())}</b>
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="Nome do titular"
                      value={pagador.nome}
                      onChange={(e) =>
                        setPagador((p) => ({ ...p, nome: onlyNameChars(e.target.value) }))
                      }
                      autoComplete="name"
                    />

                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="E-mail do titular"
                      value={pagador.email}
                      onChange={(e) =>
                        setPagador((p) => ({ ...p, email: sanitizeEmail(e.target.value) }))
                      }
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      pattern="^[A-Za-z][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
                    />

                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="CPF (opcional)"
                      value={pagador.cpf || ""}
                      onChange={(e) => setPagador((p) => ({ ...p, cpf: sanitizeCpf(e.target.value) }))}
                      inputMode="numeric"
                      maxLength={11}
                    />
                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="Telefone (opcional)"
                      value={pagador.telefone || ""}
                      onChange={(e) => setPagador((p) => ({ ...p, telefone: sanitizePhone(e.target.value) }))}
                      inputMode="numeric"
                      maxLength={11}
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 mt-3">
                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="Número do cartão"
                      value={cartao.numero}
                      onChange={(e) => setCartao((c) => ({ ...c, numero: sanitizeCardNumber(e.target.value) }))}
                      inputMode="numeric"
                      autoComplete="cc-number"
                    />

                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="Nome impresso no cartão"
                      value={cartao.nomeImpresso}
                      onChange={(e) => setCartao((c) => ({ ...c, nomeImpresso: onlyNameChars(e.target.value) }))}
                      autoComplete="name"
                    />
                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="Validade (MM/AA)"
                      value={cartao.validade}
                      onChange={(e) => setCartao((c) => ({ ...c, validade: formatValidade(e.target.value) }))}
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      maxLength={5}
                    />

                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="CVV"
                      value={cartao.cvv}
                      onChange={(e) => setCartao((c) => ({ ...c, cvv: sanitizeCvv(e.target.value) }))}
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      maxLength={4}
                    />
                  </div>
                </div>
              )}

              {method === "BOLETO" && (
                <div>
                  <div className="font-semibold mb-2">Pagar com Boleto</div>

                  <p className="text-sm text-gray-700 mb-3">
                    Total: <b>{brl(totalComCupomLocal())}</b>
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="Seu nome completo"
                      value={pagador.nome}
                      onChange={(e) => setPagador({ ...pagador, nome: e.target.value })}
                    />
                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="E-mail do titular"
                      value={pagador.email}
                      onChange={(e) =>
                        setPagador((p) => ({ ...p, email: sanitizeEmail(e.target.value) }))
                      }
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      pattern="^[A-Za-z][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
                    />

                    <input
                      className="border rounded-md px-3 py-2"
                      placeholder="CPF"
                      value={pagador.cpf || ""}
                      onChange={(e) => setPagador((p) => ({ ...p, cpf: sanitizeCpf(e.target.value) }))}
                      inputMode="numeric"
                      maxLength={11}
                    />
                  </div>

                  {boletoLinha && (
                    <div className="mt-3">
                      <div className="text-xs text-gray-600 mb-1">Linha digitável:</div>
                      <input className="w-full border rounded-lg p-2 text-sm" readOnly value={boletoLinha} />
                    </div>
                  )}
                  {boletoPdf && (
                    <div className="mt-2">
                      <a className="text-green-800 underline" href={boletoPdf} target="_blank" rel="noreferrer">
                        Abrir boleto (PDF)
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t pt-3 mt-4">
              <div className="text-sm text-gray-600">
                Total: <b className="text-gray-900">{brl(totalComCupomLocal())}</b>
                {mostrarMsgTrial ? (
                  <span className="block text-xs text-emerald-700">
                    Trial ativo. Você só paga se escolher pagar agora.
                  </span>
                ) : null}
              </div>

              <button
                onClick={startCheckout}
                className="px-4 py-2 ml-2 rounded-lg bg-green-800 text-white disabled:opacity-60"
                disabled={!canFinalize}
                title={checkoutError ?? ""}
              >
                Finalizar pagamento
              </button>
                {checkoutError ? (
                  <div className="mt-2 ml-2 text-xs text-red-700">
                    {checkoutError}
                  </div>
                ) : null}
            </div>
            <p className="mt-2 text-sm text-green-700 ">OBS: Depois que você apertar em finalizar pagamento ele irá verificar seus dados, caso não for PIX, e te enviará para a página do mercado pago, para o pagamento ser realmente efetuado, não se pode pular a próxima etapa se não, não irá ser realizado o pagamento.</p>
          </>
        )}
      </section>
      )}

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
                {pagamentos.map((pg) => (
                  <tr key={pg.id} className="border-b">
                    <td className="py-2">{new Date(pg.criadoEm).toLocaleString()}</td>
                    <td className="py-2">{pg.plano}</td>
                    <td className="py-2">{pg.periodicidade}</td>
                    <td className="py-2">{pg.metodo}</td>
                    <td className="py-2">
                      <span
                        className={
                          pg.status === "APROVADO"
                            ? "text-emerald-700"
                            : pg.status === "PENDENTE"
                            ? "text-amber-700"
                            : pg.status === "FALHOU"
                            ? "text-red-700"
                            : "text-gray-700"
                        }
                      >
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
      <PagamentoModal
        open={openPagamentoModal}
        onClose={() => setOpenPagamentoModal(false)}
        method={method}
        setMethod={setMethod}
        pagador={pagador}
        setPagador={setPagador}
        cartao={cartao}
        setCartao={setCartao}
        total={totalComCupomLocal()}
        mostrarMsgTrial={mostrarMsgTrial}
        bloquearCheckoutPorTrial={bloquearCheckoutPorTrial}
        polling={polling}
        canFinalize={canFinalize}
        checkoutError={checkoutError}
        onFinalize={startCheckout}
        pixQrUrl={pixQrUrl}
        pixCopiaECola={pixCopiaECola}
        setPixCopiaECola={setPixCopiaECola}
        boletoLinha={boletoLinha}
        boletoPdf={boletoPdf}
        sanitizeEmail={sanitizeEmail}
        sanitizeCpf={sanitizeCpf}
        sanitizePhone={sanitizePhone}
        sanitizeCardNumber={sanitizeCardNumber}
        sanitizeCvv={sanitizeCvv}
        formatValidade={formatValidade}
        onlyNameChars={onlyNameChars}
        brl={brl}
      />
    </div>
  );
}