// client/src/pages/learning/evento/evento-ao-vivo.tsx
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
  Radio,
  ShieldCheck,
  User,
  UserPlus,
  Users,
  Video,
  Eye,
  EyeOff,
} from "lucide-react";
import { API } from "@/config.js";

type AulaStatus = "AGENDADA" | "AO_VIVO" | "FINALIZADA" | "CANCELADA";

type EventoLanding = {
  id: string;
  titulo: string;
  isOwner?: boolean;
  descricao?: string | null;
  status: AulaStatus;
  dataInicio: string;
  dataFim?: string | null;
  inscricaoInicio?: string | null;
  inscricaoFim?: string | null;
  thumbUrl?: string | null;
  urlStream?: string | null;
  videoGravadoUrl?: string | null;
  replayDisponivel?: boolean;
  chatAtivo?: boolean;
  gravacaoAtiva?: boolean;
  convidadoUsuario?: {
    id?: string;
    nome?: string | null;
    foto?: string | null;
    tipo?: string | null;
    nomeDeUsuario?: string | null;
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
  metodologia?: {
    id: string;
    titulo: string;
    descricao?: string | null;
    capaUrl?: string | null;
    precoAssinaturaMensal?: number | null;
    origem: "LEARNING";
    criadorUsuario?: {
      id: string;
      nome?: string | null;
      foto?: string | null;
    } | null;
  } | null;
  metodologiaAvulsa?: {
    id: string;
    titulo: string;
    descricao?: string | null;
    capaUrl?: string | null;
    precoAssinaturaMensal?: number | null;
    origem: "AVULSA";
    criadorUsuario?: {
      id: string;
      nome?: string | null;
      foto?: string | null;
    } | null;
  } | null;
    acesso?: {
      temAcesso: boolean;
      isOwner: boolean;
      isConvidadoFootEra?: boolean;
      precisaLogin?: boolean;
      precisaPagamento?: boolean;
      produtoTipo?: "METODOLOGIA" | "METODOLOGIA_AVULSA" | "AULA_AO_VIVO";
      planoId?: string | null;
      preco?: number | null;
      motivo?: string | null;
    };
};

type Form = {
  nome: string;
  email: string;
  senha: string;
  receberEmail: boolean;
};

type EtapaAcesso =
  | "FORMULARIO"
  | "INSCRITO"
  | "AGUARDANDO_PAGAMENTO"
  | "LOADING"
  | "ACESSO_LIBERADO";

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

function isLogado() {
  return !!getToken();
}

function getAulaIdFromPathOrQuery() {
  const params = new URLSearchParams(window.location.search);
  const queryId = params.get("aulaId") || params.get("id");
  if (queryId) return queryId;

  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

const TIMEZONE_BR = "America/Sao_Paulo";

function formatarData(value?: string | null) {
  if (!value) return "Data em breve";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Data inválida";

  return d.toLocaleDateString("pt-BR", {
    timeZone: TIMEZONE_BR,
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatarHora(value?: string | null) {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleTimeString("pt-BR", {
    timeZone: TIMEZONE_BR,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function statusLabel(status?: AulaStatus, replayDisponivel?: boolean) {
  if (status === "AO_VIVO") return "Ao vivo agora";
  if (status === "FINALIZADA") {
    return replayDisponivel ? "Replay disponível" : "Evento finalizado";
  }
  if (status === "CANCELADA") return "Evento cancelado";
  return "Evento agendado";
}

function statusButtonLabel(status?: AulaStatus, replayDisponivel?: boolean) {
  if (status === "AO_VIVO") return "Entrar ao vivo";
  if (status === "FINALIZADA" && replayDisponivel) return "Assistir replay";
  if (status === "FINALIZADA") return "Ver detalhes";
  return "Acessar evento";
}

export default function LearningEventoAoVivoPage() {
  const aulaId = useMemo(() => getAulaIdFromPathOrQuery(), []);

  const [evento, setEvento] = useState<EventoLanding | null>(null);
  const [etapa, setEtapa] = useState<EtapaAcesso>("FORMULARIO");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const [form, setForm] = useState<Form>({
    nome: "",
    email: "",
    senha: "",
    receberEmail: true,
  });
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const origem = evento?.metodologiaAvulsa ? "avulsa" : "learning";
  const metodologiaId =
    evento?.metodologiaAvulsa?.id || evento?.metodologia?.id || "";

  const metodologiaTitulo =
    evento?.metodologiaAvulsa?.titulo ||
    evento?.metodologia?.titulo ||
    "FootEra Learning";

  const capaUrl =
    evento?.thumbUrl ||
    evento?.metodologiaAvulsa?.capaUrl ||
    evento?.metodologia?.capaUrl ||
    "";

  const criadorNome =
    evento?.metodologiaAvulsa?.criadorUsuario?.nome ||
    evento?.metodologia?.criadorUsuario?.nome ||
    "Creator FootEra";
  
  const labelPessoa =
    evento?.pessoaDestaqueLabel ||
    (evento?.temConvidado || evento?.convidadoNome || evento?.convidadoUsuario?.nome
        ? "Convidado"
        : "Creator");

  const convidadoOuCreatorNome =
    evento?.pessoaDestaqueNome ||
    evento?.convidadoNome ||
    evento?.convidadoUsuario?.nome ||
    criadorNome;

  const convidadoOuCreatorDescricao =
    evento?.pessoaDestaqueDescricao ||
    evento?.convidadoDescricao ||
    (labelPessoa === "Convidado" ? "Convidado FootEra" : metodologiaTitulo);

  const convidadosLista = Array.isArray(evento?.convidados)
    ? evento.convidados.filter((c) => c?.nome || c?.usuario?.nome)
    : [];

  const tituloPessoa =
    convidadosLista.length > 0
        ? convidadosLista.length === 1
        ? convidadosLista[0]?.nome || "Convidado"
        : `${convidadosLista.length} convidados`
        : convidadoOuCreatorNome;

  const descricaoPessoa =
    convidadosLista.length > 0
        ? convidadosLista
            .map((c) => {
            const nome = c.nome || c.usuario?.nome || "Convidado";
            const descricao = c.descricao || (c.usuario ? "Convidado FootEra" : "");
            return descricao ? `${nome} — ${descricao}` : nome;
            })
            .join(" • ")
        : convidadoOuCreatorDescricao;
        
  const subtituloFixo =
    "Encontros ao vivo para quem quer aprender, debater e evoluir no esporte.";

  const descricaoDetalhada =
    evento?.descricao ||
    evento?.metodologiaAvulsa?.descricao ||
    evento?.metodologia?.descricao ||
    "Participe de uma aula ao vivo pelo Learning, interaja no chat e assista ao replay depois.";
  
  const preco = Number(
    evento?.acesso?.preco ??
      evento?.metodologiaAvulsa?.precoAssinaturaMensal ??
      evento?.metodologia?.precoAssinaturaMensal ??
      0
  );

  const temPreco = Number.isFinite(preco) && preco > 0;
  const isOwner = !!evento?.isOwner || !!evento?.acesso?.isOwner;

  const produtoTipo = evento?.acesso?.produtoTipo;

  const nomeProdutoParaLiberar =
    evento?.metodologiaAvulsa?.titulo ||
    evento?.metodologia?.titulo ||
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
      ? `Para liberar esta aula ao vivo, escolha e compre a metodologia avulsa "${nomeProdutoParaLiberar}". Depois do pagamento, o acesso à live e ao replay será liberado.`
      : produtoTipo === "METODOLOGIA"
        ? `Esta aula pertence à metodologia "${nomeProdutoParaLiberar}". Para liberar, assine o plano Learning e escolha essa metodologia dentro do Learning.`
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
      
  useEffect(() => {
    carregarEvento();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aulaId]);

  async function carregarEvento() {
    if (!aulaId) {
      setErro("Aula ao vivo não encontrada.");
      setEtapa("FORMULARIO");
      return;
    }

    try {
      setLoading(true);
      setErro("");

      const token = getToken();

      const usuarioLogado = isLogado();

      const res = await fetch(`${API.BASE_URL}/api/learning/eventos/aulas/${aulaId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || "Erro ao carregar evento ao vivo.");
      }

      const item = json?.item || json?.evento || json;
      setEvento(item);

      const acesso = item?.acesso || json?.acesso || {};

      if (acesso?.temAcesso || acesso?.isOwner) {
        setEtapa("ACESSO_LIBERADO");
      } else if (usuarioLogado) {
        setEtapa("AGUARDANDO_PAGAMENTO");
      } else {
        setEtapa("FORMULARIO");
      }
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar evento.");
      setEtapa("FORMULARIO");
    } finally {
      setLoading(false);
    }
  }

  function set<K extends keyof Form>(key: K, value: Form[K]) {
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

  async function inscrever() {
    setErro("");

    if (!isLogado()) {
      if (!form.nome.trim()) {
        setErro("Digite seu nome.");
        return;
      }

      if (!form.email.trim()) {
        setErro("Digite seu e-mail.");
        return;
      }

      if (!form.senha.trim()) {
        setErro("Digite uma senha.");
        return;
      }
    }

    try {
      setLoading(true);

      const token = getToken();

      const res = await fetch(`${API.BASE_URL}/api/learning/eventos/aulas/${aulaId}/inscrever`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          nome: form.nome.trim(),
          email: form.email.trim(),
          senha: form.senha,
          receberEmail: form.receberEmail,
          metodologiaId: origem === "learning" ? metodologiaId : null,
          metodologiaAvulsaId: origem === "avulsa" ? metodologiaId : null,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || "Erro ao inscrever no evento.");
      }

      salvarSessao(json);

      setEtapa("AGUARDANDO_PAGAMENTO");
      await carregarEvento();
    } catch (e: any) {
      setErro(e?.message || "Erro ao inscrever no evento.");
    } finally {
      setLoading(false);
    }
  }

  async function comprar() {
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

  function entrarNaLiveOuReplay() {
    if (!aulaId) return;

    if (isOwner) {
        window.location.href = `/learning/live-studio?aulaId=${aulaId}`;
        return;
    }

    window.location.href = `/learning/live?aulaId=${aulaId}`;
  }

  function voltar() {
    window.history.back();
  }

  if (etapa === "LOADING") {
    return (
      <div className="min-h-screen bg-[#f5f2e8] flex items-center justify-center text-green-900">
        Carregando evento...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f2e8] text-[#082f20]">
      <section className="relative overflow-hidden bg-[#062b1d] text-white">
        <div className="absolute inset-0 opacity-25">
          {capaUrl ? (
            <img src={capaUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(77,181,111,0.45),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.18),transparent_25%),linear-gradient(135deg,#031911,#0b422c)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
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
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${
                    evento?.status === "AO_VIVO"
                      ? "bg-red-600"
                      : evento?.status === "FINALIZADA"
                        ? "bg-slate-700"
                        : "bg-[#2e8b45]"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  {statusLabel(evento?.status, evento?.replayDisponivel)}
                </span>

                <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">
                  Learning ao vivo
                </span>
              </div>

              <h1 className="max-w-3xl text-5xl font-black leading-none tracking-tight sm:text-6xl lg:text-7xl">
                {evento?.titulo || "Evento ao vivo"}
              </h1>

              <p className="mt-5 max-w-2xl text-xl leading-relaxed text-white/85">
                {subtituloFixo}
              </p>

              <div className="mt-8 grid max-w-3xl gap-5 sm:grid-cols-3">
                {evento?.inscricaoFim ? (
                  <div className="mt-2 text-sm text-white/70">
                    Inscrições até {formatarData(evento.inscricaoFim)} às {formatarHora(evento.inscricaoFim)}
                  </div>
                ) : null}

                <InfoHero
                  icon={<CalendarDays className="h-6 w-6" />}
                  label="Data"
                  value={formatarData(evento?.dataInicio)}
                  sub="evento Learning"
                />

                <InfoHero
                  icon={<Clock className="h-6 w-6" />}
                  label="Horário"
                  value={formatarHora(evento?.dataInicio) || "Em breve"}
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
                {descricaoDetalhada}
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
                    text="Entre com sua conta FootEra ou crie uma conta Learning rápida."
                />

                <StepArrow />

                <StepCard
                    number="2"
                    icon={<Play className="h-8 w-8" />}
                    title="Assista ao vivo"
                    text="Quando o evento começar, o botão leva direto para a sala da live."
                />

                <StepArrow />

                <StepCard
                    number="3"
                    icon={<CalendarDays className="h-8 w-8" />}
                    title="Veja o replay"
                    text="Depois da live, o replay pode ficar disponível para assistir novamente."
                />
                </div>
            </div>
            </div>

            <div className="relative z-10 lg:pt-6">
              <div className="rounded-3xl border border-white/20 bg-white p-5 text-[#082f20] shadow-2xl">
                <div className="mb-5 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-800">
                    {evento?.status === "AO_VIVO" ? (
                      <Radio className="h-8 w-8" />
                    ) : evento?.status === "FINALIZADA" ? (
                      <Video className="h-8 w-8" />
                    ) : (
                      <User className="h-8 w-8" />
                    )}
                  </div>

                  <h2 className="text-2xl font-black">
                    {etapa === "ACESSO_LIBERADO"
                      ? "Seu acesso está liberado"
                      : etapa === "AGUARDANDO_PAGAMENTO"
                        ? "Finalize seu acesso"
                        : "Inscreva-se para o evento"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    {etapa === "FORMULARIO"
                      ? "Crie uma conta rápida ou entre com sua conta FootEra"
                      : etapa === "AGUARDANDO_PAGAMENTO"
                        ? "Garanta o acesso ao vivo e ao replay"
                        : "Acesse pelo Learning quando quiser"}
                  </p>
                </div>

                {erro ? (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                    {erro}
                  </div>
                ) : null}

                {etapa === "FORMULARIO" ? (
                  <div className="grid gap-4">
                    {!isLogado() ? (
                      <>
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
                      </>
                    ) : (
                      <div className="rounded-2xl border border-green-100 bg-green-50 p-4 text-sm text-green-900">
                        Você já está logado. Clique abaixo para continuar.
                      </div>
                    )}

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
                      onClick={inscrever}
                      className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#073d2a] px-4 text-base font-black text-white shadow-lg hover:bg-[#052f20] disabled:opacity-60"
                    >
                      {loading ? "Processando..." : "Continuar"}
                      <ChevronRight className="h-5 w-5" />
                    </button>

                    {!isLogado() ? (
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
                      onClick={comprar}
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
                          <div className="font-black">Acesso confirmado</div>
                          <p className="mt-1 text-sm text-green-900/75">
                            Você pode acessar o evento ao vivo quando estiver disponível e assistir o replay depois.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                        type="button"
                        onClick={entrarNaLiveOuReplay}
                        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#073d2a] px-4 text-base font-black text-white shadow-lg hover:bg-[#052f20]"
                    >
                        {isOwner
                            ? evento?.status === "AO_VIVO"
                            ? "Gerenciar transmissão"
                            : "Preparar transmissão"
                            : statusButtonLabel(evento?.status, evento?.replayDisponivel)}
                        <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                ) : null}

                <div className="mt-5 border-t pt-4">
                  <div className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-800">
                      <Check className="h-5 w-5" />
                    </div>

                    <div>
                      <div className="text-sm font-black">Conta Learning rápida</div>
                      <p className="text-xs leading-relaxed text-slate-600">
                        Quem veio pelo link não precisa escolher perfil completo agora. Pode completar o perfil depois.
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
                  </div>

                  <div className="min-w-0 py-1">
                    <h3 className="line-clamp-2 text-lg font-black">
                      {evento?.titulo || "Evento ao vivo"}
                    </h3>
                    <p className="text-sm text-white/75">{metodologiaTitulo}</p>

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
        <h3 className="text-sm font-black">{title}</h3>
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