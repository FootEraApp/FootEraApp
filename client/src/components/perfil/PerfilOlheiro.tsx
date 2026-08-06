import { toast } from "@/lib/toast";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Activity, CalendarClock, PlusCircle, ChevronRight, Save, Loader2, X
} from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API, APP } from "../../config.js";
import ProfileHeader from "../profile/ProfileHeader.js";
import { Link } from "wouter";
import Avatar from "../shared/Avatar.js";
import ProfilePostsSection from "../perfil/ProfilePostsSection.js";
import ProfileReplaysSection from "../perfil/ProfileReplaysSection.js";

const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

type UsuarioMin = { id: string; nome: string; email: string; foto?: string | null; nomeDeUsuario?: string };
type Note = { texto: string; saving: boolean; dirty: boolean };
type PayloadOlheiro = {
  tipo: "Olheiro";
  usuario: UsuarioMin | null;
  olheiro: {
    id: string;
    usuarioId?: string | null;
    fotoUrl?: string | null;
    headline?: string | null;
    descricao?: string | null;
    areaAtuacao?: string | null;
    anosExperiencia: number;
    emailPublico?: string | null;
    telefonePublico?: string | null;
    siteOuLinkedin?: string | null;
    colaboracaoClube?: { id: string; usuarioId?: string | null; nome: string; logo?: string | null } | null;
    reputacaoScore?: number;
    totalIndicacoes?: number;
  };
  metrics: {
    atletasAcompanhados?: number;
    observados?: number;          
    indicacoesEnviadas?: number;
    indicacoes?: number;          
    reputacaoScore?: number;
    reputacao?: number;          
    indicacoesAprovadas?: number;
    taxaAprovacao?: number;
    atletasAssinados?: number | null;
  };
};

type AtletaItem = {
  id: string;
  usuarioId?: string;
  atletaId: string;
  nome: string;
  foto?: string | null;
  posicao?: string | null;
  idade?: number | null;
  altura?: number | null;
  peso?: number | null;
  observadoEm?: string;
  categoria?: string | null;
  pontuacao?: number | null;
};

type IndicacaoDestino = {
  id: string;
  nome: string;
  logo?: string | null;
  usuarioId?: string | null;
  tipo?: "Clube" | "Escolinha" | string | null;
};

type IndicacaoItem = {
  id: string;
  criadoEm?: string;
  status?: "PENDENTE" | "APROVADA" | "REJEITADA";
  atleta: {
    id: string;
    usuarioId?: string | null;
    nome?: string | null;
    foto?: string | null;
    usuario?: {
      id?: string | null;
      nome?: string | null;
      nomeDeUsuario?: string | null;
      foto?: string | null;
    } | null;
  };
  clube?: IndicacaoDestino | null;
  escolinha?: IndicacaoDestino | null;
};

type AtividadeRecente = {
  id: string;
  tipo: "Treino" | "Desafio" | "Vídeo" | "Postagem";
  titulo: string;
  criadoEm: string;
  imagemUrl?: string | null;
};

type ResultadoBuscaDestino = {
  id: string;
  tipo: "Clube" | "Escolinha";
  nome: string;
  username: string;
  fotoUrl: string | null;
};

type EventoPerfilItem = {
  id: string;
  origem: "EVENTO" | "AULA_AO_VIVO";
  titulo: string;
  descricao?: string | null;
  data: string;
  tipoLabel: string;
  status: string;
  cidade?: string | null;
  estado?: string | null;
  totalParticipantes?: number | null;
};

function SectionCard({
  title, children, right,
}: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="bg-white/90 rounded-2xl shadow-sm border border-green-100">
      <div className="px-4 py-3 flex items-center justify-between border-b border-green-100">
        <h3 className="font-semibold text-green-900">{title}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center text-green-900/70 py-8">
      <Activity className="mx-auto mb-2 opacity-70" />
      <p>{text}</p>
    </div>
  );
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms = 400) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function withAvatarFallback(foto?: string | null) {
  const valor = String(foto ?? "").trim();
  return valor || AVATAR_FALLBACK;
}

export default function PerfilOlheiro({
  idDaUrl,
  hasCreator = false,
  creatorUsuarioId = null,
}: {
  idDaUrl?: string;
  hasCreator?: boolean;
  creatorUsuarioId?: string | null;
}) {

  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const isOwn = !idDaUrl || idDaUrl === Storage.usuarioId;
  const targetId = isOwn ? (Storage.tipoUsuarioId || "me") : (idDaUrl as string);

  const [data, setData] = useState<PayloadOlheiro | null>(null);
  const [loading, setLoading] = useState(true);
  const [privacidade, setPrivacidade] = useState<{
    perfilVisivel: boolean;
    permitirMensagens: boolean;
    mostrarEmail: boolean;
  } | null>(null);

  type Aba = "visao" | "atletas" | "eventos" | "indicacoes" | "postagens";
  const [aba, setAba] = useState<Aba>("visao");
  type SubAbaAtletas = "observados";
  const [subAbaAtletas, setSubAbaAtletas] = useState<SubAbaAtletas>("observados");

  const [observados, setObservados] = useState<AtletaItem[] | null>(null);
  const [indicacoes, setIndicacoes] = useState<IndicacaoItem[] | null>(null);
  const [atividades, setAtividades] = useState<AtividadeRecente[] | null>(null);

  const [indicAtletaId, setIndicAtletaId] = useState("");
  const [clubeQuery, setClubeQuery] = useState("");
  const [destinos, setDestinos] = useState<ResultadoBuscaDestino[]>([]);
  const [destinoSel, setDestinoSel] = useState<ResultadoBuscaDestino | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [creatorAtivoLocal, setCreatorAtivoLocal] = useState(false);
  const [creatorUsuarioIdLocal, setCreatorUsuarioIdLocal] = useState<string | null>(null);
  const [eventos, setEventos] = useState<EventoPerfilItem[]>([]);

  const perfilUsuarioId = String(
    data?.usuario?.id || data?.olheiro?.usuarioId || ""
  ).trim();

  const usuarioCreatorDoPerfil = String(
    creatorUsuarioId ||
      creatorUsuarioIdLocal ||
      perfilUsuarioId ||
      (isOwn ? Storage.usuarioId : "") ||
      ""
  ).trim();

  const mostrarCreator = Boolean(
    (hasCreator && usuarioCreatorDoPerfil) ||
      (creatorAtivoLocal && creatorUsuarioIdLocal)
  );

  const creatorLinkUsuarioId = usuarioCreatorDoPerfil;
  const [eventosLoading, setEventosLoading] = useState(false);
  const [eventosErro, setEventosErro] = useState("");
  const [mostrarTodosEventos, setMostrarTodosEventos] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await axios.get<PayloadOlheiro>(
          `${API.BASE_URL}/api/perfil/olheiro/${targetId}`,
          { headers }
        );
        if (!cancel) setData(resp.data);
      } catch (e) {
        console.error("PerfilOlheiro GET error:", e);
        if (!cancel) setData(null);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [targetId, token]);

  useEffect(() => {
    if (aba === "atletas") setObservados(null);
  }, [aba]);

  useEffect(() => {
    if (!token) return;
    let cancel = false;

    (async () => {
      try {
        const { data } = await axios.get(
          `${API.BASE_URL}/api/configuracoes-perfil/privacidade`,
          { headers }
        );
        if (!cancel) setPrivacidade({
          perfilVisivel: data?.perfilVisivel ?? true,
          permitirMensagens: data?.permitirMensagens ?? true,
          mostrarEmail: data?.mostrarEmail ?? false,
        });
      } catch {
        if (!cancel) setPrivacidade({
          perfilVisivel: true,
          permitirMensagens: true,
          mostrarEmail: false,
        });
      }
    })();

    return () => { cancel = true; };
  }, [token]);
  
  useEffect(() => {
    if (!token) return;
    const cancel = { v: false };

    async function fetchAtividades() {
      try {
        const { data } = await axios.get<AtividadeRecente[]>(
          `${API.BASE_URL}/api/perfil/${targetId}/atividades`,
          { headers }
        );
        if (!cancel.v) setAtividades(Array.isArray(data) ? data : []);
      } catch {
        if (!cancel.v) setAtividades([]);
      }
    }

    async function fetchObservados() {
      const ownerId =
        (isOwn ? Storage.tipoUsuarioId : data?.olheiro?.id) ??
        data?.olheiro?.id ??
        Storage.tipoUsuarioId ??
        null;

      if (!ownerId) {
        if (!cancel.v) setObservados([]);
        return;
      }

      try {
        const { data: lista } = await axios.get<AtletaItem[]>(
          `${API.BASE_URL}/api/observados`,
          {
            headers,
            params: {
              incluirPontuacao: 1,
              ownerId,         
              tipo: "olheiro", 
            },
          }
        );

        if (!cancel.v) setObservados(Array.isArray(lista) ? lista : []);
      } catch (e) {
        if (!cancel.v) setObservados([]);
      }
    }

    async function fetchIndicacoes() {
      const tipoId = (isOwn ? Storage.tipoUsuarioId : data?.olheiro?.id) ?? null;
      if (!tipoId) { if (!cancel.v) setIndicacoes([]); return; }
      try {
        const { data: lista } = await axios.get<IndicacaoItem[]>(
          `${API.BASE_URL}/api/indicacoes/olheiros/${tipoId}/indicacoes`,
          { headers }
        );
        if (!cancel.v) setIndicacoes(Array.isArray(lista) ? lista : []);
      } catch {
        if (!cancel.v) setIndicacoes([]);
      }
    }

    if (aba === "visao" && atividades == null) fetchAtividades();
    if (aba === "atletas" && subAbaAtletas === "observados" && observados == null) {
      fetchObservados();
    }
    if (aba === "indicacoes" && indicacoes == null) fetchIndicacoes();

    return () => { cancel.v = true; };
  }, [
    aba, subAbaAtletas, targetId, token,
    data?.olheiro?.id, atividades, observados, indicacoes, isOwn
  ]);

  const buscarClubes = useMemo(
    () =>
      debounce(async (q: string) => {
        setFeedback(null);
        setDestinoSel(null);
        if (!q || q.trim().length < 2) return setDestinos([]);
        try {
          const r = await axios.get<any[]>(
            `${API.BASE_URL}/api/cadastro/buscar`,
            { params: { query: q }, headers }
          );
          const arr: ResultadoBuscaDestino[] = (Array.isArray(r.data) ? r.data : [])
        .filter(
          (x) =>
            x?.id &&
            x?.nome &&
            (x?.tipo === "Clube" || x?.tipo === "Escolinha")
        )
        .map((x) => ({
          id: String(x.id),
          tipo: x.tipo === "Escolinha" ? "Escolinha" : "Clube",
          nome: String(x.nome),
          username: String(x.username || ""),
          fotoUrl: x.fotoUrl ?? null,
        }));
          setDestinos(arr);
        } catch {
          setDestinos([]);
        }
      }, 400),
    [headers]
  );

  async function apagarIndicacao(
    indicacaoId: string
  ) {
    if (
      !confirm(
        "Deseja apagar esta indicação?"
      )
    ) {
      return;
    }

    try {
      await axios.delete(
        `${API.BASE_URL}/api/indicacoes/${encodeURIComponent(
          indicacaoId
        )}`,
        { headers }
      );

      setIndicacoes((anteriores) =>
        Array.isArray(anteriores)
          ? anteriores.filter(
              (indicacao) =>
                indicacao.id !==
                indicacaoId
            )
          : anteriores
      );

      const perfilAtualizado =
        await axios.get<PayloadOlheiro>(
          `${API.BASE_URL}/api/perfil/olheiro/${targetId}`,
          { headers }
        );

      setData(
        perfilAtualizado.data
      );
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error ||
          "Falha ao apagar indicação."
      );
    }
  }

  async function fetchNota(atletaId: string) {
    try {
      const { data } = await axios.get(
        `${API.BASE_URL}/api/observados/${encodeURIComponent(atletaId)}/nota`,
        { headers }
      );
      setNotes(p => ({ ...p, [atletaId]: { texto: data?.texto ?? "", saving: false, dirty: false } }));
    } catch {
      setNotes(p => ({ ...p, [atletaId]: { texto: "", saving: false, dirty: false } }));
    }
  }

async function salvarNota(atletaId: string) {
  const texto = notes[atletaId]?.texto ?? "";

  setNotes(p => {
    const prev = p[atletaId] ?? { texto: "", saving: false, dirty: false };
    return { ...p, [atletaId]: { ...prev, saving: true } };
  });

  try {
    await axios.put(
      `${API.BASE_URL}/api/observados/${encodeURIComponent(atletaId)}/nota`,
      { texto },
      { headers: { "Content-Type": "application/json", ...(headers || {}) } }
    );

    setNotes(p => ({
      ...p,
      [atletaId]: { texto, saving: false, dirty: false },
    }));
  } catch {
    setNotes(p => ({
      ...p,
      [atletaId]: { texto, saving: false, dirty: true },
    }));
  }
}

  useEffect(() => {
    if (clubeQuery) buscarClubes(clubeQuery);
    else { setDestinos([]); setDestinoSel(null); }
  }, [clubeQuery]);

  useEffect(() => {
    if (!token) return;

    const usuarioIdParaChecar =
      data?.usuario?.id ||
      data?.olheiro?.usuarioId ||
      (!isOwn ? idDaUrl : Storage.usuarioId) ||
      "";

    if (!usuarioIdParaChecar) return;

    let cancel = false;

    fetch(`${API.BASE_URL}/api/creator/profile/${usuarioIdParaChecar}`, {
      headers,
    })
      .then((r) => {
        if (!cancel) {
          setCreatorAtivoLocal(r.ok);
          setCreatorUsuarioIdLocal(r.ok ? usuarioIdParaChecar : null);
        }
      })
      .catch(() => {
        if (!cancel) {
          setCreatorAtivoLocal(false);
          setCreatorUsuarioIdLocal(null);
        }
      });

    return () => {
      cancel = true;
    };
  }, [token, data?.usuario?.id, data?.olheiro?.usuarioId, idDaUrl, isOwn]);

  useEffect(() => {
    if (aba !== "eventos") return;

    if (!usuarioCreatorDoPerfil) {
      setEventos([]);
      setEventosErro("");
      setEventosLoading(false);
      return;
    }

    let cancelado = false;

    async function carregarEventosDoPerfil() {
      setEventosLoading(true);
      setEventosErro("");

      try {
        const requestHeaders = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;

        const [eventosResultado, livesResultado] =
          await Promise.allSettled([
            axios.get(`${API.BASE_URL}/api/eventos`, {
              params: {
                creatorUsuarioId: usuarioCreatorDoPerfil,
              },
              headers: requestHeaders,
            }),
            axios.get(
              `${API.BASE_URL}/api/creator/profile/${encodeURIComponent(
                usuarioCreatorDoPerfil
              )}`,
              { headers: requestHeaders }
            ),
          ]);

        if (cancelado) return;

        const eventosPayload =
          eventosResultado.status === "fulfilled"
            ? eventosResultado.value.data
            : [];

        const eventosArray = Array.isArray(eventosPayload)
          ? eventosPayload
          : Array.isArray(eventosPayload?.items)
          ? eventosPayload.items
          : Array.isArray(eventosPayload?.eventos)
          ? eventosPayload.eventos
          : Array.isArray(eventosPayload?.data)
          ? eventosPayload.data
          : [];

        const creatorPayload =
          livesResultado.status === "fulfilled"
            ? livesResultado.value.data
            : null;

        const eventosNormais: EventoPerfilItem[] = eventosArray.map(
          (evento: any) => ({
            id: String(evento.id),
            origem: "EVENTO",
            titulo: String(evento.titulo ?? evento.nome ?? "Evento"),
            descricao: evento.descricao ?? null,
            data: String(
              evento.dataEvento ?? evento.data ?? evento.inicio ?? ""
            ),
            tipoLabel: String(
              evento.tipoLabel ?? evento.tipo ?? "Evento"
            ),
            status: String(evento.status ?? "ABERTO"),
            cidade: evento.cidade ?? null,
            estado: evento.estado ?? null,
            totalParticipantes: null,
          })
        );

        const aulasAoVivo: EventoPerfilItem[] = Array.isArray(
          creatorPayload?.eventosAoVivo
        )
          ? creatorPayload.eventosAoVivo.map((aula: any) => ({
              id: String(aula.id),
              origem: "AULA_AO_VIVO",
              titulo: String(aula.titulo ?? "Aula ao vivo"),
              descricao: aula.descricao ?? null,
              data: String(aula.dataInicio ?? aula.inicio ?? ""),
              tipoLabel: "Aula ao vivo",
              status: String(aula.status ?? "AGENDADA"),
              cidade: null,
              estado: null,
              totalParticipantes:
                typeof aula.totalParticipantes === "number"
                  ? aula.totalParticipantes
                  : null,
            }))
          : [];

        const agora = Date.now();

        const proximos = [...eventosNormais, ...aulasAoVivo]
          .filter((evento) => {
            const status = String(evento.status || "").toUpperCase();

            if (status === "AO_VIVO") return true;

            if (
              [
                "FINALIZADA",
                "FINALIZADO",
                "ENCERRADO",
                "CANCELADA",
                "CANCELADO",
              ].includes(status)
            ) {
              return false;
            }

            const timestamp = new Date(evento.data).getTime();
            return Number.isFinite(timestamp) && timestamp >= agora;
          })
          .sort(
            (a, b) =>
              new Date(a.data).getTime() - new Date(b.data).getTime()
          );

        const unicos = Array.from(
          new Map(
            proximos.map((evento) => [
              `${evento.origem}:${evento.id}`,
              evento,
            ])
          ).values()
        );

        setEventos(unicos);

        if (
          eventosResultado.status === "rejected" &&
          livesResultado.status === "rejected"
        ) {
          setEventosErro("Não foi possível carregar os eventos agora.");
        }
      } catch (error) {
        console.error("Erro ao carregar eventos do olheiro:", error);

        if (!cancelado) {
          setEventos([]);
          setEventosErro("Não foi possível carregar os eventos agora.");
        }
      } finally {
        if (!cancelado) setEventosLoading(false);
      }
    }

    void carregarEventosDoPerfil();

    return () => {
      cancelado = true;
    };
  }, [aba, usuarioCreatorDoPerfil, token]);

  useEffect(() => {
    setMostrarTodosEventos(false);
  }, [usuarioCreatorDoPerfil]);

  const eventosVisiveis = mostrarTodosEventos
    ? eventos
    : eventos.slice(0, 5);


  async function enviarIndicacao() {
    setFeedback(null);
    if (!indicAtletaId) { setFeedback({ tipo: "erro", msg: "Informe o ID do atleta." }); return; }
    if (!destinoSel) { setFeedback({ tipo: "erro", msg: "Selecione um clube ou escolinha." }); return; }

    try {
      setEnviando(true);
      await axios.post(
        `${API.BASE_URL}/api/indicacoes`,
        {
          atletaId: indicAtletaId,
          clubeId: destinoSel?.tipo === "Clube" ? destinoSel.id : undefined,
          escolinhaId: destinoSel?.tipo === "Escolinha" ? destinoSel.id : undefined
        },
        { headers: { "Content-Type": "application/json", ...(headers || {}) } }
      );
      setFeedback({ tipo: "ok", msg: "Indicação enviada com sucesso!" });
      setIndicAtletaId("");
      setClubeQuery("");
      setDestinos([]);
      setDestinoSel(null);
      setIndicacoes(null);
      setAba("indicacoes");
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "Falha ao enviar indicação.";
      setFeedback({ tipo: "erro", msg });
    } finally {
      setEnviando(false);
    }
  }

  if (loading) return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  if (!data || !data.olheiro) return <div className="text-center p-10 text-red-600">Olheiro não encontrado.</div>;

  const nome = data.usuario?.nome || "Olheiro";
  const handle = data.usuario?.nomeDeUsuario ? `@${data.usuario.nomeDeUsuario}` : "";
  const emailDoPerfil =
  (data?.usuario?.email && String(data.usuario.email)) ||
  (data?.olheiro?.emailPublico && String(data.olheiro.emailPublico)) ||
  "";
  const headerFoto: string | undefined =
    (typeof data.usuario?.foto === "string" && data.usuario.foto) ||
    (typeof data.olheiro.fotoUrl === "string" && data.olheiro.fotoUrl) ||
    undefined;

  const clubeColab = data.olheiro.colaboracaoClube || null;

  const reputacaoScore =
    data.metrics?.reputacaoScore ??
    data.metrics?.reputacao ??
    data.olheiro.reputacaoScore ??
    0;

  const kpiIndicacoes =
    data.metrics?.indicacoesEnviadas ??
    data.metrics?.indicacoes ??
    data.olheiro.totalIndicacoes ??
    0;

  const atletasCount = (observados?.length ?? data.metrics?.observados ?? data.metrics?.atletasAcompanhados ?? 0);
  const time = clubeColab?.nome || "Olheiro";
  const indicacoesAprovadas = data.metrics?.indicacoesAprovadas ?? undefined;
  const taxaAprovacao = data.metrics?.taxaAprovacao ?? undefined;
  const atletasAssinados = data.metrics?.atletasAssinados ?? undefined;
  
  return (
    <div className="w-full max-w-2xl mx-auto pb-28">
      <ProfileHeader
        nome={nome}
        time={time}
        isOwnProfile={isOwn}
        foto={headerFoto}
        kpis={[
          { label: "Atletas", value: atletasCount },
          { label: "Indicações", value: kpiIndicacoes },
          { label: "Reputação", value: reputacaoScore },
        ]}
        perfilId={perfilUsuarioId}
        perfilTipoProp="olheiro"
        perfilTipoIdProp={data.olheiro.id}
        isVerified={(data as any)?.perfilVerificado}
        isPro={(data as any)?.isPro}
        hasCreator={mostrarCreator}
        creatorUsuarioId={creatorLinkUsuarioId}
      />
      {clubeColab && (
        <div className="px-4 mt-2">
          <Link
            href={`/perfil/${clubeColab.usuarioId ?? clubeColab.id}`}
            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-green-100 border border-green-200 text-green-900 hover:bg-green-200 transition"
          >
            {clubeColab.logo ? (
              <Avatar
                foto={clubeColab.logo}
                alt={clubeColab.nome}
                className="w-4 h-4 rounded border"
              />
            ) : null}
            Colabora com <b className="ml-1">{clubeColab.nome}</b>
          </Link>
        </div>
      )}

      <div className="mt-4 px-3 sm:px-4">
      <div className="bg-white/90 rounded-xl p-1 border border-green-100">
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-1">
          {[
            { id: "visao", label: "Visão Geral" },
            { id: "atletas", label: "Atletas" },
            { id: "indicacoes", label: "Indicações" },
            { id: "eventos", label: "Eventos" },
            { id: "postagens", label: "Postagens" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setAba(t.id as Aba)}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                aba === t.id
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-green-900 hover:bg-green-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      </div>

      {aba === "visao" && (
         <div className="mt-5 px-3 sm:px-4 grid gap-5 sm:gap-6">
          <SectionCard
            title="Informações do Olheiro"
            right={handle ? <span className="text-xs text-green-900/60">{handle}</span> : null}
          >
            <ul className="text-sm text-green-900/90 space-y-2">
              <li><b>Nome:</b> {nome}</li>

              {privacidade?.mostrarEmail && emailDoPerfil ? (
                <li>
                  <b>Email:</b> {emailDoPerfil}
                </li>
              ) : null}

              {data.olheiro.headline && <li><b>Headline:</b> {data.olheiro.headline}</li>}
              {data.olheiro.areaAtuacao && <li><b>Área de atuação:</b> {data.olheiro.areaAtuacao}</li>}
              <li>
                <b>Experiência:</b> {data.olheiro.anosExperiencia ?? 0} ano
                {(data.olheiro.anosExperiencia ?? 0) === 1 ? "" : "s"}
              </li>

              {clubeColab && (
                <li className="flex items-center gap-2">
                  <b>Colaboração:</b>
                  {clubeColab.logo ? (
                    <Avatar
                      foto={clubeColab.logo}
                      alt={clubeColab.nome}
                      className="w-5 h-5 rounded border"
                    />
                  ) : null}
                  <Link
                    href={`/perfil/${clubeColab.usuarioId ?? clubeColab.id}`}
                    className="underline text-green-800"
                  >
                    {clubeColab.nome}
                  </Link>
                </li>
              )}
            </ul>

            {data.olheiro.descricao && (
              <div className="mt-3">
                <div className="text-sm font-semibold text-green-900">Sobre: </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-green-900/90">
                  {data.olheiro.descricao}
                </p>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Reputação & Impacto"
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-green-100 p-3">
                <div className="text-xs text-green-900/70">Reputação</div>
                <div className="text-xl font-bold text-green-900">{reputacaoScore}</div>
              </div>
              <div className="rounded-lg border border-green-100 p-3">
                <div className="text-xs text-green-900/70">Indicações</div>
                <div className="text-xl font-bold text-green-900">{kpiIndicacoes}</div>
              </div>
              <div className="rounded-lg border border-green-100 p-3">
                <div className="text-xs text-green-900/70">Aprovadas</div>
                <div className="text-xl font-bold text-green-900">{indicacoesAprovadas ?? "—"}</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-green-900/70 mb-1">
                <span>Taxa de aprovação</span>
                <span>{typeof taxaAprovacao === "number" ? `${Math.round(taxaAprovacao * 100)}%` : "—"}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-green-100 overflow-hidden">
                <div
                  className="h-2 bg-green-600"
                  style={{ width: `${Math.max(0, Math.min(100, Math.round((taxaAprovacao ?? 0) * 100)))}%` }}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Contatos">
            <ul className="text-sm text-green-900/90 space-y-2">
              <li>
                <b>E-mail:</b>{" "}
                {data.olheiro.emailPublico ? (
                  <a className="text-green-800 underline" href={`mailto:${data.olheiro.emailPublico}`}>{data.olheiro.emailPublico}</a>
                ) : "—"}
              </li>
              <li><b>Telefone:</b> {data.olheiro.telefonePublico || "—"}</li>
              <li>
                <b>Site/LinkedIn:</b>{" "}
                {data.olheiro.siteOuLinkedin ? (
                  <a className="text-green-800 underline" href={data.olheiro.siteOuLinkedin} target="_blank" rel="noreferrer">
                    {data.olheiro.siteOuLinkedin}
                  </a>
                ) : "—"}
              </li>
            </ul>
          </SectionCard>
        </div>
      )}

      {aba === "atletas" && (
        <div className="mt-4 px-4">
          <div className="bg-white/90 rounded-xl p-1 grid grid-cols-1 gap-1 border border-green-100">
            <button
              onClick={() => setSubAbaAtletas("observados")}
              className={`py-2 rounded-lg text-sm font-medium ${
                subAbaAtletas === "observados" ? "bg-green-600 text-white" : "text-green-900"
              }`}
            >
              Observados
            </button>
          </div>

          <div className="mt-4 grid gap-4">
            <SectionCard
              title={`Atletas Observados (${observados?.length ?? 0})`}
              right={
                <Link
                  href="/explorar"
                  className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-amber-500 text-white"
                >
                  <PlusCircle className="w-4 h-4" />
                  Descobrir atletas
                </Link>
              }
            >
              {observados && observados.length > 0 ? (
                <ul className="grid grid-cols-1 gap-3">
                  {observados.map((a) => {
                    const atletaKey = a.atletaId || a.id;

                    return (
                      <li key={a.id} className="flex flex-col gap-2 rounded-xl border border-green-100 p-3">
                        <div className="flex items-center gap-3">
                          <Avatar foto={withAvatarFallback(a.foto)} alt={a.nome} className="w-10 h-10" />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-green-900">{a.nome}</div>
                            <div className="text-xs text-green-900/70">
                              {[a.posicao, a.idade ? `${a.idade} anos` : ""].filter(Boolean).join(" • ")}
                            </div>
                          </div>
                            <Link href={`/perfil/${a.usuarioId || a.id}`} className="text-sm text-green-800 inline-flex items-center gap-1">
                              Ver perfil <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {isOwn && (
                          <div>
                            <button
                              onClick={() => {
                                const willOpen = openNoteId !== atletaKey;
                                setOpenNoteId(willOpen ? atletaKey : null);
                                if (willOpen && notes[atletaKey] === undefined) fetchNota(atletaKey);
                              }}
                              className="text-xs px-2 py-1 rounded-md border border-green-200 text-green-900 hover:bg-green-50"
                            >
                              {openNoteId === atletaKey ? "Ocultar anotações" : "Anotações do atleta"}
                            </button>

                            {openNoteId === atletaKey && (
                              <div className="mt-2">
                                <textarea
                                  rows={4}
                                  className="w-full border rounded p-2 text-sm"
                                  placeholder="Suas observações (visível somente para você)"
                                  value={notes[atletaKey]?.texto ?? ""}
                                  onChange={(e) => {
                                    const texto = e.target.value;
                                    setNotes(p => {
                                      const prev = p[atletaKey] ?? { texto: "", saving: false, dirty: false };
                                      return { ...p, [atletaKey]: { ...prev, texto, dirty: true } };
                                    });
                                  }}
                                />

                                <div className="mt-2 flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => salvarNota(atletaKey)}
                                    disabled={!notes[atletaKey]?.dirty || notes[atletaKey]?.saving}
                                    className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                                  >
                                    {notes[atletaKey]?.saving ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Salvando...
                                      </>
                                    ) : (
                                      <>
                                        <Save className="w-4 h-4" />
                                        Salvar anotação
                                      </>
                                    )}
                                  </button>

                                  <div className="text-[11px] text-green-900/60">
                                    {notes[atletaKey]?.saving
                                      ? "Salvando…"
                                      : notes[atletaKey]?.dirty
                                      ? "Alterações pendentes"
                                      : "Salvo"}
                                  </div>
                                </div>

                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div>
                  <EmptyState text="Você ainda não observa nenhum atleta" />
                  <div className="flex justify-center">
                    <Link
                      href="/explorar"
                      className="px-4 py-2 rounded-md border border-green-200 text-green-900 inline-block"
                    >
                      Explorar atletas
                    </Link>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {aba === "indicacoes" && (
        <div className="mt-4 px-4 grid gap-4">
          <SectionCard title="Nova Indicação">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">ID do Atleta</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="ex: 1f2a3b4c-..."
                  value={indicAtletaId}
                  onChange={(e) => setIndicAtletaId(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Buscar Clube ou Escolinha</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="Digite ao menos 2 letras..."
                  value={clubeQuery}
                  onChange={(e) => setClubeQuery(e.target.value)}
                />
                {clubeQuery && destinos.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">Buscando organizações...</p>
                )}
                {destinos.length > 0 && (
                  <div className="max-h-44 overflow-auto border rounded mt-2">
                    {destinos.map((c) => {
                      const selected = destinoSel?.id === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-50 border-b last:border-b-0 ${
                            selected ? "bg-green-50" : ""
                          }`}
                          onClick={() => setDestinoSel(c)}
                        >
                          <Avatar foto={c.fotoUrl} alt={c.nome} className="w-7 h-7" />
                          <div className="text-sm">
                            <div className="font-medium">{c.nome}</div>
                            <div className="text-xs text-gray-500">@{c.username}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {destinoSel && (
                  <div className="mt-2 text-xs text-gray-600">
                    Selecionado: <span className="font-medium">{destinoSel.nome}</span>
                    <button className="ml-2 underline text-green-700" onClick={() => setDestinoSel(null)}>trocar</button>
                  </div>
                )}
              </div>
            </div>

            {feedback && (
              <p className={`mt-3 text-sm ${feedback.tipo === "ok" ? "text-green-700" : "text-red-600"}`}>
                {feedback.msg}
              </p>
            )}

            <div className="mt-4">
              <button
                onClick={enviarIndicacao}
                disabled={enviando}
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
              >
                {enviando ? "Enviando..." : "Enviar indicação"}
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Minhas Indicações">
            {indicacoes && indicacoes.length > 0 ? (
              <ul className="grid grid-cols-1 gap-3">
                {indicacoes.map((i) => {
                  const destino = i.clube ?? i.escolinha ?? null;
                  const destinoPerfilId = destino?.usuarioId ?? destino?.id ?? "";

                  const nomeAtleta =
                    i.atleta?.usuario?.nome ||
                    i.atleta?.nome ||
                    i.atleta?.usuario?.nomeDeUsuario ||
                    "Atleta";

                  const fotoAtleta =
                    i.atleta?.usuario?.foto ??
                    i.atleta?.foto ??
                    null;

                  const atletaPerfilId =
                    i.atleta?.usuario?.id ||
                    i.atleta?.usuarioId ||
                    i.atleta?.id ||
                    "";

                  return (
                    <li key={i.id} className="relative flex items-center gap-3 rounded-xl border border-green-100 p-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          apagarIndicacao(i.id);
                        }}
                        className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white border border-red-100 text-red-600 hover:bg-red-50"
                        title="Apagar indicação"
                        aria-label="Apagar indicação"
                      >
                        <X className="w-3 h-3" />
                      </button>
                     <Link
                        href={`/perfil/${atletaPerfilId}`}
                        className="flex min-w-0 flex-1 items-center gap-3 pr-8"
                      >
                        <Avatar
                          foto={withAvatarFallback(fotoAtleta)}
                          alt={nomeAtleta}
                          className="w-10 h-10 shrink-0"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-green-900">
                            {nomeAtleta}
                          </div>

                          <div className="text-xs text-green-900/70">
                            {i.criadoEm
                              ? new Date(i.criadoEm).toLocaleString("pt-BR")
                              : "—"}

                            {i.status
                              ? ` • ${i.status}`
                              : ""}
                          </div>
                        </div>
                      </Link>

                      {destino ? (
                        <Link
                          href={`/perfil/${destinoPerfilId}`}
                          className="flex items-center gap-2"
                        >
                          <Avatar
                            foto={withAvatarFallback(destino.logo)}
                            alt={destino.nome}
                            className="w-8 h-8"
                          />
                          <div className="text-xs text-green-900/80">{destino.nome}</div>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Avatar foto={AVATAR_FALLBACK} alt="Destino" className="w-8 h-8" />
                          <div className="text-xs text-green-900/50">Destino não encontrado</div>
                        </div>
                      )}

                      <ChevronRight className="w-4 h-4 text-green-800" />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState text="Você ainda não enviou indicações" />
            )}
          </SectionCard>
        </div>
      )}

      {aba === "eventos" && (
        <div className="mt-4 px-3 sm:px-4 grid gap-4">
          <SectionCard
            title="Eventos"
            right={
              <div className="flex flex-wrap gap-2">
                {isOwn ? (
                  <Link
                    href="/creator/eventos"
                    className="rounded-lg border border-green-200 px-3 py-2 text-sm font-semibold text-green-900 hover:bg-green-50"
                  >
                    Ver todos os eventos
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setMostrarTodosEventos((anterior) => !anterior)
                    }
                    className="rounded-lg border border-green-200 px-3 py-2 text-sm font-semibold text-green-900 hover:bg-green-50"
                  >
                    {mostrarTodosEventos
                      ? "Mostrar menos"
                      : "Ver todos os eventos"}
                  </button>
                )}

                {isOwn && mostrarCreator ? (
                  <Link
                    href="/creator/eventos/novo"
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Criar novo evento
                  </Link>
                ) : null}
              </div>
            }
          >
            {eventosLoading ? (
              <div className="text-sm text-green-900/70">
                Carregando eventos…
              </div>
            ) : eventosErro ? (
              <div className="text-sm text-red-600">{eventosErro}</div>
            ) : eventosVisiveis.length > 0 ? (
              <ul className="grid grid-cols-1 gap-3">
                {eventosVisiveis.map((evento) => {
                  const dataEvento = evento.data
                    ? new Date(evento.data).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Data não informada";

                  const local = [evento.cidade, evento.estado]
                    .filter(Boolean)
                    .join(" - ");

                  const participantes =
                    evento.origem === "AULA_AO_VIVO" &&
                    typeof evento.totalParticipantes === "number"
                      ? `${evento.totalParticipantes} participantes`
                      : "";

                  const href =
                    evento.origem === "AULA_AO_VIVO"
                      ? `/learning/evento/${evento.id}`
                      : `/eventos/${evento.id}`;

                  return (
                    <li key={`${evento.origem}:${evento.id}`}>
                      <Link
                        href={href}
                        className="flex items-center gap-3 rounded-xl border border-green-100 bg-white/70 p-3 hover:bg-green-50"
                      >
                        <CalendarClock className="h-5 w-5 shrink-0 text-green-700" />

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-green-900">
                            {evento.titulo}
                          </div>

                          <div className="text-xs text-green-900/70">
                            {[
                              evento.tipoLabel,
                              dataEvento,
                              local,
                              participantes,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>

                          {evento.descricao ? (
                            <div className="mt-1 line-clamp-2 text-xs text-green-900/70">
                              {evento.descricao}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-[11px] text-green-900">
                            {String(evento.status || "Evento").replaceAll(
                              "_",
                              " "
                            )}
                          </span>
                          <ChevronRight className="h-4 w-4 text-green-700" />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState text="Nenhum evento futuro cadastrado." />
            )}
          </SectionCard>

          {usuarioCreatorDoPerfil ? (
            <ProfileReplaysSection
              creatorUsuarioId={usuarioCreatorDoPerfil}
            />
          ) : null}
        </div>
      )}

      {aba === "postagens" && (
        <section className="mt-5 px-3 sm:px-4">
          {perfilUsuarioId ? (
            <ProfilePostsSection usuarioId={perfilUsuarioId} />
          ) : (
            <div className="bg-white/70 rounded-xl p-4 shadow-sm text-sm text-green-900/70">
              Não foi possível carregar o usuário das postagens.
            </div>
          )}
        </section>
      )}

      <div className="h-6" />
    </div>
  );
}