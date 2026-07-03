import { toast } from "@/lib/toast";
// client/src/pages/learning/evento/sala-copa.tsx
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Lock,
  Mail,
  Play,
  ShieldCheck,
  User,
  UserPlus,
  Eye,
  EyeOff,
  Users,
} from "lucide-react";
import { API } from "@/config.js";

type EtapaAcesso =
  | "FORMULARIO"
  | "INSCRITO"
  | "AGUARDANDO_PAGAMENTO"
  | "ACESSO_LIBERADO";

type SalaCopaForm = {
  nome: string;
  email: string;
  senha: string;
  receberEmail: boolean;
};

type SalaCopaEvento = {
  id?: string;
  aulaId?: string | null;
  titulo: string;
  descricao?: string | null;
  dataInicio?: string | null;
  inscricaoInicio?: string | null;
  inscricaoFim?: string | null;
  dataFim?: string | null;
  status?: "AGENDADA" | "AO_VIVO" | "FINALIZADA" | "CANCELADA";
  thumbUrl?: string | null;
  videoGravadoUrl?: string | null;
  replayDisponivel?: boolean;
  metodologiaId?: string | null;
  metodologiaAvulsaId?: string | null;
  origem?: "AVULSA" | "LEARNING";
  metodologiaTitulo?: string | null;
  preco?: number | null;
  criadorUsuario?: {
    id?: string;
    nome?: string | null;
    foto?: string | null;
  } | null;
  convidadoNome?: string | null;
  convidadoDescricao?: string | null;
  convidados?: Array<{
    id?: string;
    usuarioId?: string | null;
    nome?: string | null;
    descricao?: string | null;
    ordem?: number | null;
    usuario?: {
      id?: string;
      nome?: string | null;
      foto?: string | null;
      tipo?: string | null;
      nomeDeUsuario?: string | null;
    } | null;
  }>;
  temConvidado?: boolean;
  pessoaDestaqueLabel?: "Convidado" | "Creator";
  pessoaDestaqueNome?: string | null;
  pessoaDestaqueDescricao?: string | null;
  isOwner?: boolean;
  acesso?: {
    temAcesso?: boolean;
    isOwner?: boolean;
    isConvidadoFootEra?: boolean;
    precisaLogin?: boolean;
    precisaPagamento?: boolean;
    produtoTipo?: "METODOLOGIA" | "METODOLOGIA_AVULSA" | "AULA_AO_VIVO";
    planoId?: string | null;
    preco?: number | null;
    motivo?: string | null;
  };
};

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

function isLogado() {
  return !!getToken();
}

function isCreatorPreview() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("creator") === "1" ||
    params.get("studio") === "1" ||
    params.get("owner") === "1"
  );
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const TIMEZONE_BR = "America/Sao_Paulo";

function formatarData(value?: string | null) {
  if (!value) return "Data em breve";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";

  return date.toLocaleDateString("pt-BR", {
    timeZone: TIMEZONE_BR,
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatarDiaSemana(value?: string | null) {
  if (!value) return "evento Learning";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "evento Learning";

  return date.toLocaleDateString("pt-BR", {
    timeZone: TIMEZONE_BR,
    weekday: "long",
  });
}

function formatarHora(value?: string | null) {
  if (!value) return "Horário em breve";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Horário inválido";

  return date.toLocaleTimeString("pt-BR", {
    timeZone: TIMEZONE_BR,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statusButtonLabel(status?: string, replayDisponivel?: boolean) {
  if (status === "AO_VIVO") return "Entrar ao vivo";
  if (status === "FINALIZADA" && replayDisponivel) return "Assistir replay";
  if (status === "FINALIZADA") return "Ver detalhes";
  return "Acessar evento";
}

function getAulaIdSalaCopa() {
  const params = new URLSearchParams(window.location.search);
  return params.get("aulaId") || "";
}

export default function SalaCopaEventoPage() {
  const aulaId = useMemo(() => getAulaIdSalaCopa(), []);

  const usuarioLogado = isLogado();

  const [form, setForm] = useState<SalaCopaForm>({
    nome: "",
    email: "",
    senha: "",
    receberEmail: true,
  });

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [etapa, setEtapa] = useState<EtapaAcesso>("FORMULARIO");
  const [loading, setLoading] = useState(false);
  const [carregandoEvento, setCarregandoEvento] = useState(true);
  const [erro, setErro] = useState("");
  const [evento, setEvento] = useState<SalaCopaEvento | null>(null);

  const preco = Number(evento?.acesso?.preco ?? evento?.preco ?? 0);
  const temPreco = Number.isFinite(preco) && preco > 0;

  const produtoTipo = evento?.acesso?.produtoTipo;

  const nomeProdutoParaLiberar =
    evento?.metodologiaTitulo ||
    evento?.titulo ||
    "este conteúdo";

  const pagamentoTitulo =
    produtoTipo === "METODOLOGIA_AVULSA"
      ? "Metodologia avulsa necessária"
      : produtoTipo === "METODOLOGIA"
        ? "Plano Learning necessário"
        : produtoTipo === "AULA_AO_VIVO"
          ? "Acesso único ao evento"
          : "Acesso Premium";

  const pagamentoDescricao =
    produtoTipo === "METODOLOGIA_AVULSA"
      ? `Para liberar esta Sala Copa, escolha e compre a metodologia avulsa "${nomeProdutoParaLiberar}". Depois do pagamento, o acesso à live e ao replay será liberado.`
      : produtoTipo === "METODOLOGIA"
        ? `Esta Sala Copa pertence à metodologia "${nomeProdutoParaLiberar}". Para liberar, assine o plano Learning e escolha essa metodologia dentro do Learning.`
        : produtoTipo === "AULA_AO_VIVO"
          ? `Você está comprando acesso único ao evento "${nomeProdutoParaLiberar}". Depois do pagamento, o acesso à live e ao replay será liberado.`
          : "Depois do pagamento, o acesso ao vivo e ao replay será liberado.";

  const pagamentoValorLabel =
    produtoTipo === "METODOLOGIA"
      ? temPreco
        ? formatMoney(preco)
        : "Plano Learning"
      : temPreco
        ? formatMoney(preco)
        : "Gratuito";

  const tituloEvento = evento?.titulo || "Sala Copa";

  const subtituloFixo =
  "Encontros ao vivo para quem quer aprender, debater e evoluir no esporte.";

  const descricaoEvento =
    evento?.descricao ||
    "Análises, bastidores e debates ao vivo com convidados especiais, interação e conteúdo exclusivo pelo Learning.";
    
  const dataEvento = formatarData(evento?.dataInicio);
  const diaSemanaEvento = formatarDiaSemana(evento?.dataInicio);
  const horarioEvento = formatarHora(evento?.dataInicio);
  const inicioInscricaoTexto =
    evento?.inscricaoInicio
      ? `${formatarData(evento.inscricaoInicio)} às ${formatarHora(evento.inscricaoInicio)}`
      : "Inscrições abertas";

  const fimInscricaoTexto =
    evento?.inscricaoFim
      ? `${formatarData(evento.inscricaoFim)} às ${formatarHora(evento.inscricaoFim)}`
      : "Sem prazo definido";

  const dataEventoCompletaTexto =
    evento?.dataInicio
      ? `${formatarData(evento.dataInicio)} às ${formatarHora(evento.dataInicio)}`
      : "Data em breve";

  const fimEventoCompletoTexto =
    evento?.dataFim
      ? `${formatarData(evento.dataFim)} às ${formatarHora(evento.dataFim)}`
      : "Fim em breve";

  const labelPessoa =
  evento?.pessoaDestaqueLabel ||
  (evento?.temConvidado || evento?.convidadoNome ? "Convidado" : "Creator");

  const pessoaDestaqueNome =
    evento?.pessoaDestaqueNome ||
    evento?.convidadoNome ||
    evento?.criadorUsuario?.nome ||
    "Creator FootEra";

  const pessoaDestaqueDescricao =
    evento?.pessoaDestaqueDescricao ||
    evento?.convidadoDescricao ||
    (labelPessoa === "Convidado"
      ? "Convidado FootEra"
      : evento?.metodologiaTitulo || "Creator do evento");

  const convidadosLista = Array.isArray(evento?.convidados)
    ? evento.convidados.filter((c) => c?.nome || c?.usuario?.nome)
    : [];

  const temMaisDeUmConvidado = convidadosLista.length > 1;

  const tituloPessoa =
    convidadosLista.length > 0
      ? convidadosLista.length === 1
        ? convidadosLista[0]?.nome || "Convidado"
        : `${convidadosLista.length} convidados`
      : pessoaDestaqueNome;

  const descricaoPessoa =
    convidadosLista.length > 0
      ? convidadosLista
          .map((c) => {
            const nome = c.nome || c.usuario?.nome || "Convidado";
            const descricao = c.descricao || (c.usuario ? "Convidado FootEra" : "");
            return descricao ? `${nome} — ${descricao}` : nome;
          })
          .join(" • ")
      : pessoaDestaqueDescricao;

  const capaUrl = evento?.thumbUrl || "";
  const isOwner = !!evento?.isOwner || !!evento?.acesso?.isOwner;

  useEffect(() => {
    carregarSalaCopa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aulaId]);

  async function carregarSalaCopa() {
    try {
      setCarregandoEvento(true);
      setErro("");

      const token = getToken();

      const url = aulaId
        ? `${API.BASE_URL}/api/learning/eventos/sala-copa?aulaId=${encodeURIComponent(aulaId)}`
        : `${API.BASE_URL}/api/learning/eventos/sala-copa`;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || "Erro ao carregar Sala Copa.");
      }

      const item = json?.evento || json?.item || json;
      setEvento(item);

      if (item?.acesso?.temAcesso || item?.acesso?.isOwner) {
        setEtapa("ACESSO_LIBERADO");
      } else if (usuarioLogado) {
        setEtapa("AGUARDANDO_PAGAMENTO");
      } else {
        setEtapa("FORMULARIO");
      }
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar Sala Copa.");
    } finally {
      setCarregandoEvento(false);
    }
  }

  function set<K extends keyof SalaCopaForm>(key: K, value: SalaCopaForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function salvarSessao(json: any) {
    if (json?.token) {
      localStorage.setItem("token", json.token);
    }

    if (json?.usuario?.id) {
      localStorage.setItem("usuarioId", json.usuario.id);
      localStorage.setItem("userId", json.usuario.id);
    }

    if (json?.usuario?.tipo) {
      localStorage.setItem("tipoUsuario", json.usuario.tipo);
    }

    if (json?.usuario?.tipoUsuarioId) {
      localStorage.setItem("tipoUsuarioId", json.usuario.tipoUsuarioId);
    }
  }

  async function criarContaLearningOuInscrever() {
    setErro("");

    const usuarioJaLogado = isLogado();

    if (!usuarioJaLogado) {
      if (!form.nome.trim()) {
        setErro("Digite seu nome completo.");
        return;
      }

      if (!form.email.trim()) {
        setErro("Digite seu e-mail.");
        return;
      }

      if (!form.senha.trim()) {
        setErro("Digite uma senha para criar sua conta Learning.");
        return;
      }
    }

    try {
      setLoading(true);

      const token = getToken();
      const params = new URLSearchParams(window.location.search);

      const payload = {
        nome: form.nome.trim(),
        email: form.email.trim(),
        senha: form.senha,
        tipo: "learning",
        receberEmail: form.receberEmail,
        origem: "SALA_COPA",
        aulaId: params.get("aulaId") || null,
        metodologiaId:
          params.get("origem") !== "avulsa" ? params.get("metodologiaId") : null,
        metodologiaAvulsaId:
          params.get("origem") === "avulsa" ? params.get("metodologiaId") : null,
      };

      const res = await fetch(`${API.BASE_URL}/api/learning/eventos/sala-copa/inscrever`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || "Erro ao se inscrever na Sala Copa.");
      }

      salvarSessao(json);

      await carregarSalaCopa();

      setEtapa("AGUARDANDO_PAGAMENTO");
    } catch (e: any) {
      setErro(e?.message || "Erro ao se inscrever na Sala Copa.");
    } finally {
      setLoading(false);
    }
  }

  function irParaPagamento() {
    setErro("");

    const planoId = evento?.acesso?.planoId;

    if (!planoId) {
      setErro("Não foi possível identificar o produto para pagamento.");
      return;
    }

    const redirect = `${window.location.pathname}${window.location.search}`;

    window.location.href = `/pagamentos?planoId=${encodeURIComponent(
      planoId
    )}&redirect=${encodeURIComponent(redirect)}`;
  }

  function entrarNaLive() {
    if (!aulaId) {
      toast.error(
        "Ainda falta vincular esta página a uma AulaAoVivo real. Abra a página assim: /learning/evento/sala-copa?aulaId=ID_DA_AULA"
      );
      return;
    }

    if (isOwner || isCreatorPreview()) {
      window.location.href = `/learning/live-studio?aulaId=${aulaId}`;
      return;
    }

    window.location.href = `/learning/live?aulaId=${aulaId}`;
  }

  function voltar() {
    window.history.back();
  }

  if (carregandoEvento) {
    return (
      <div className="min-h-screen bg-[#062b1d] flex items-center justify-center text-white font-bold">
        Carregando Sala Copa...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f2e8] text-[#082f20]">
      <section className="relative overflow-hidden bg-[#062b1d] text-white">
        <div className="absolute inset-0 opacity-25">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(77,181,111,0.45),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.18),transparent_25%),linear-gradient(135deg,#031911,#0b422c)]" />
          <div className="absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-black/70 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 py-6">
          <button
            type="button"
            onClick={voltar}
            className="mb-8 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="pb-8">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#2e8b45] px-3 py-1 text-xs font-black uppercase tracking-wide">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  Ao vivo
                </span>

                <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">
                  Evento aberto
                </span>
              </div>

              <h1 className="max-w-3xl text-6xl font-black leading-none tracking-tight sm:text-7xl lg:text-8xl">
                {tituloEvento}
              </h1>

              <p className="mt-5 max-w-2xl text-xl leading-relaxed text-white/85">
                {subtituloFixo}
              </p>

              <div className="mt-8 grid max-w-3xl gap-5 sm:grid-cols-3">
                <InfoHero
                  icon={<CalendarDays className="h-6 w-6" />}
                  label="Data"
                  value={dataEvento}
                  sub={diaSemanaEvento}
                />

                <InfoHero
                  icon={<Clock className="h-6 w-6" />}
                  label="Horário"
                  value={horarioEvento}
                  sub="horário de Brasília"
                />

                <InfoHero
                  icon={<User className="h-6 w-6" />}
                  label={convidadosLista.length > 0 ? "Convidados" : labelPessoa}
                  value={tituloPessoa}
                  sub={descricaoPessoa}
                />
              </div>

              <p className="mt-8 max-w-2xl text-base leading-relaxed text-white/80">
                {descricaoEvento}
              </p>

              <div className="mt-8 flex flex-wrap gap-5 text-sm text-white/75">
                <MiniFeature icon={<Users className="h-4 w-4" />} label="Encontro ao vivo e interativo" />
                <MiniFeature icon={<Play className="h-4 w-4" />} label="Replay disponível depois" />
                <MiniFeature icon={<ShieldCheck className="h-4 w-4" />} label="Acesso pelo Learning" />
              </div>

              <div className="relative z-20 mt-8 w-full rounded-3xl border border-slate-200 bg-white px-6 py-8 text-[#082f20] shadow-xl">
                <h2 className="text-center text-xl font-black">
                  Como é simples participar
                </h2>

                <div className="mx-auto mt-2 h-0.5 w-12 bg-green-700" />

                <div className="mt-8 grid gap-8 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-start">
                  <StepCard
                    number="1"
                    icon={<UserPlus className="h-8 w-8" />}
                    title="Inscreva-se"
                    text="Preencha seus dados em segundos e garanta sua vaga."
                  />

                  <StepArrow />

                  <StepCard
                    number="2"
                    icon={<Play className="h-8 w-8" />}
                    title="Acesse a live"
                    text="No dia e horário do evento, acesse pelo link que vamos enviar."
                  />

                  <StepArrow />

                  <StepCard
                    number="3"
                    icon={<CalendarDays className="h-8 w-8" />}
                    title="Assista ao replay depois"
                    text="O replay ficará disponível na plataforma para você rever quando quiser."
                  />
                </div>
              </div>
            </div>

            <div className="relative z-10 lg:pt-6">
              <div className="rounded-3xl border border-white/20 bg-white p-5 text-[#082f20] shadow-2xl">
                <div className="mb-5 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-800">
                    <User className="h-8 w-8" />
                  </div>

                  <h2 className="text-2xl font-black">
                    {etapa === "ACESSO_LIBERADO"
                      ? "Seu acesso está liberado"
                      : etapa === "AGUARDANDO_PAGAMENTO"
                        ? "Finalize sua inscrição"
                        : "Inscreva-se para o evento"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    {etapa === "FORMULARIO"
                      ? "Crie sua conta para acessar o Learning"
                      : etapa === "AGUARDANDO_PAGAMENTO"
                        ? "Garanta seu acesso ao vivo e ao replay"
                        : "Entre na sala ao vivo pelo Learning"}
                  </p>

                  <p className="text-xs font-bold text-green-700">
                    É rápido, simples e sem burocracia.
                  </p>
                </div>

                {erro ? (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                    {erro}
                  </div>
                ) : null}

                {etapa === "FORMULARIO" ? (
                  <div className="grid gap-4">
                    <InputField
                      label="Nome"
                      icon={<User className="h-4 w-4" />}
                      value={form.nome}
                      onChange={(v) => set("nome", v)}
                      placeholder="Digite seu nome completo"
                    />

                    <InputField
                      label="E-mail"
                      icon={<Mail className="h-4 w-4" />}
                      value={form.email}
                      onChange={(v) => set("email", v)}
                      placeholder="seu@email.com"
                      type="email"
                    />

                    {!usuarioLogado ? (
                      <InputField
                        label="Senha"
                        icon={<Lock className="h-4 w-4" />}
                        value={form.senha}
                        onChange={(v) => set("senha", v)}
                        placeholder="Crie uma senha"
                        type={mostrarSenha ? "text" : "password"}
                        rightSlot={
                          <button
                            type="button"
                            onClick={() => setMostrarSenha((prev) => !prev)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-green-800"
                            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                            title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {mostrarSenha ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        }
                      />
                    ) : null}

                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.receberEmail}
                        onChange={(e) => set("receberEmail", e.target.checked)}
                        className="h-4 w-4 accent-green-700"
                      />
                      Quero receber o link de acesso por e-mail
                    </label>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={criarContaLearningOuInscrever}
                      className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#073d2a] px-4 text-base font-black text-white shadow-lg hover:bg-[#052f20] disabled:opacity-60"
                    >
                      {loading ? "Processando..." : "Inscrever-se"}
                      <ChevronRight className="h-5 w-5" />
                    </button>

                    {!usuarioLogado ? (
                      <button
                        type="button"
                        onClick={() => {
                          const redirect = `${window.location.pathname}${window.location.search}`;
                          window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
                        }}
                        className="w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-900 hover:bg-emerald-50"
                      >
                        Já tenho cadastro
                      </button>
                    ) : null}

                    <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                      <Lock className="h-3 w-3" />
                      Seus dados estão seguros com a gente.
                    </div>
                  </div>
                ) : null}

                {etapa === "AGUARDANDO_PAGAMENTO" ? (
                  <div className="grid gap-4">
                    <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                      <div className="text-sm font-black text-slate-700">
                        {pagamentoTitulo}
                      </div>

                      <div className="mt-1 text-3xl font-black text-green-900">
                        {pagamentoValorLabel}
                      </div>

                      <div className="mt-3 rounded-xl bg-white/70 p-3 text-sm leading-relaxed text-green-950">
                        <span className="font-black">
                          {produtoTipo === "METODOLOGIA_AVULSA"
                            ? "Metodologia avulsa: "
                            : produtoTipo === "METODOLOGIA"
                              ? "Metodologia Learning: "
                              : produtoTipo === "AULA_AO_VIVO"
                                ? "Evento ao vivo: "
                                : "Conteúdo: "}
                        </span>
                        {nomeProdutoParaLiberar}
                      </div>

                      <p className="mt-3 text-sm leading-relaxed text-green-900/75">
                        {pagamentoDescricao}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={irParaPagamento}
                      className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#073d2a] px-4 text-base font-black text-white shadow-lg hover:bg-[#052f20] disabled:opacity-60"
                    >
                      {loading
                        ? "Processando..."
                        : produtoTipo === "METODOLOGIA"
                          ? "Assinar plano Learning"
                          : produtoTipo === "METODOLOGIA_AVULSA"
                            ? "Escolher metodologia avulsa"
                            : "Ir para pagamento"}
                      <ChevronRight className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setEtapa("FORMULARIO")}
                      className="text-sm font-bold text-green-800 underline"
                    >
                      Voltar para os dados
                    </button>
                  </div>
                ) : null}

                {etapa === "ACESSO_LIBERADO" ? (
                  <div className="grid gap-4">
                    <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-green-800">
                          <Check className="h-5 w-5" />
                        </div>

                        <div>
                          <div className="font-black">Inscrição confirmada</div>
                          <p className="mt-1 text-sm text-green-900/75">
                            Você pode acessar a live quando estiver disponível e
                            assistir o replay depois.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={entrarNaLive}
                      className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#073d2a] px-4 text-base font-black text-white shadow-lg hover:bg-[#052f20]"
                    >
                      {isOwner
                        ? evento?.status === "AO_VIVO"
                          ? "Gerenciar transmissão"
                          : "Preparar transmissão"
                        : statusButtonLabel(evento?.status, evento?.replayDisponivel)}
                      <ChevronRight className="h-5 w-5" />
                    </button>

                    {!aulaId ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                        Para o botão abrir a live real, acesse esta página com:
                        <br />
                        <span className="font-mono">
                          /learning/evento/sala-copa?aulaId=ID_DA_AULA
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 border-t pt-4">
                  <div className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-800">
                      <Check className="h-5 w-5" />
                    </div>

                    <div>
                      <div className="text-sm font-black">Sem seleção de perfil</div>
                      <p className="text-xs leading-relaxed text-slate-600">
                        Aqui, você não precisa escolher tipo de perfil. Você pode
                        completar seu perfil depois, quando quiser.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-3xl border border-white/15 bg-[#073d2a] p-4 text-white shadow-xl">
                <div className="flex gap-4">
                  <div className="relative h-28 w-36 shrink-0 overflow-hidden rounded-2xl bg-black">
                    {capaUrl ? (
                      <img src={capaUrl} alt="" className="h-full w-full object-cover opacity-80" />
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.35),transparent_25%),linear-gradient(135deg,#13251d,#876c1f,#071e16)]" />
                    )}

                    <div className="absolute left-2 top-2 rounded-md bg-red-600 px-2 py-1 text-[10px] font-black uppercase">
                      {evento?.status === "FINALIZADA" ? "Replay" : "Ao vivo"}
                    </div>

                    {!capaUrl ? (
                      <div className="absolute inset-x-0 bottom-4 text-center text-4xl">
                        🏆
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-0 py-1">
                    <h3 className="line-clamp-2 text-lg font-black">{tituloEvento}</h3>
                    <p className="text-sm text-white/75">
                      {evento?.metodologiaTitulo || "Encontro ao vivo"}
                    </p>
                    <div className="mt-2 grid gap-1 text-[11px] leading-snug text-white/80">
                      <div>
                        <span className="font-black text-white">Início inscrições:</span>{" "}
                        {inicioInscricaoTexto}
                      </div>

                      <div>
                        <span className="font-black text-white">Fim inscrições:</span>{" "}
                        {fimInscricaoTexto}
                      </div>

                      <div>
                        <span className="font-black text-white">Início evento:</span>{" "}
                        {dataEventoCompletaTexto}
                      </div>

                      <div>
                        <span className="font-black text-white">Fim evento:</span>{" "}
                        {fimEventoCompletoTexto}
                      </div>

                      <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-white/75">
                        <ShieldCheck className="h-3 w-3" />
                        Acesso pelo Learning
                      </span>
                    </div>

                    <span className="mt-2 inline-flex rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold">
                      Replay disponível depois
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoHero({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex gap-3 border-white/15 sm:border-r sm:last:border-r-0">
      <div className="text-white/90">{icon}</div>
      <div>
        <div className="text-[10px] font-black uppercase tracking-wide text-white/55">
          {label}
        </div>
        <div className="text-sm font-black text-white">{value}</div>
        {sub ? <div className="text-xs text-white/65">{sub}</div> : null}
      </div>
    </div>
  );
}

function MiniFeature({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {icon}
      {label}
    </span>
  );
}

function InputField({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
  rightSlot,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-black">{label}</span>
      <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-green-700">
        <span className="text-slate-400">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
    </label>
  );
}

function StepCard({
  number,
  icon,
  title,
  text,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-green-800">
        {icon}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-700 text-xs font-black text-white">
          {number}
        </span>
        <h3 className="text-sm font-black"> {title}</h3>
      </div>

      <p className="mx-auto mt-2 max-w-[190px] text-xs leading-relaxed text-slate-600">
        {text}
      </p>
    </div>
  );
}

function StepArrow() {
  return (
    <div className="hidden pt-8 text-slate-300 md:block">
      <ChevronRight className="h-8 w-8" />
    </div>
  );
}