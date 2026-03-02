import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import Storage from "../../../../server/utils/storage.js";
import { API, APP } from "../../config.js";
import ProfileHeader from "../profile/ProfileHeader.js";
import { Link } from "wouter";
import { 
  Activity, 
  ChevronRight,
  CalendarClock,
  Trophy,
  CameraIcon as VideoCamera,
  PlusCircle,
  FileText,
  BookOpen } from "lucide-react";
import Avatar from "../shared/Avatar.js";
import TurmasManager from "../turmas/TurmasManager.js";
import ProfilePostsSection from "../perfil/ProfilePostsSection.js";
import DashboardOrganizacao from "../dashboard/DashboardOrganizacao.js";

const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

type Props = { idDaUrl?: string; usuarioId?: string | null };
type UsuarioMin = { id: string; nome: string; email: string; foto?: string | null };
type PayloadClube = {
  tipo: "Clube";
  usuario: UsuarioMin | null;
  clube: {
    id: string;
    usuarioId: string;
    nome: string;
    cnpj?: string | null;
    telefone1?: string | null;
    telefone2?: string | null;
    email?: string | null;
    siteOficial?: string | null;
    estadio?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    pais?: string | null;
    cep?: string | null;
    logo?: string | null;
    dataCriacao: string;
    categorias?: string[] | null;
    responsavel?: string | null;
    descricao?: string | null;
  };
  metrics: { atletas: number; eventos?: number; conquistas?: number };
};

type AbaTopo = "perfil" | "dashboard" | "eventos" | "atletas" | "professores" | "postagens";
type SubAbaAtletas = "vinculados" | "observados" | "solicitacoes";
type AtletaItem = {
  id: string;
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
  notaInterna?: string | null;
  alertarMudancas?: boolean | null;
  usuarioId?: string | null;
};

type Solicitacao = {
  id: string;
  remetenteId: string;
  remetente: { id: string; nomeDeUsuario: string; foto: string | null };
};

type ProfessorItem = {
  id: string;
  usuarioId?: string | null;
  nome: string;
  codigo?: string | null;
  cref?: string | null;
  fotoUrl?: string | null;
};

type Turma = {
  id: string;
  nome: string;
  categoria?: string | null;
  professorIds?: string[];
  professorNomes?: string[];
  professorNome?: string | null;
  alunosCount?: number;
};

type EventoPreview = {
  id: string;
  titulo: string;
  tipo?: string | null;
  status?: string | null;
  dataEvento: string;
  cidade?: string | null;
  estado?: string | null;
  descricao?: string | null;
};

type AtividadeRecenteTipo =
  | "Treino"
  | "Desafio"
  | "Vídeo"
  | "Video"
  | "Postagem"
  | "Evento"
  | "Metodologia"
  | "METODOLOGIA"
  | "metodologia";

type AtividadeRecente = {
  id: string;
  tipo: AtividadeRecenteTipo | string;
  titulo: string;
  createdAt?: string | null;   // ✅ nome certo
  criadoEm?: string | null;    // ✅ opcional, caso algum endpoint antigo use
  imagemUrl?: string | null;
  link?: string | null;
};

function parseDateSafe(it: any) {
  const raw =
    it?.createdAt ??
    it?.criadoEm ??
    it?.data ??
    it?.created_at ??
    null;

  const d = raw ? new Date(raw) : null;
  return d && !isNaN(+d) ? d : null;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center text-green-900/70 py-8">
      <Activity className="mx-auto mb-2 opacity-70" />
      <p>{text}</p>
    </div>
  );
}

function resolveImg(raw?: string | null) {
  if (!raw) return null;
  const u = String(raw).trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API.BASE_URL}${u}`;
  return `${API.BASE_URL}/${u}`;
}

function SectionCard({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
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

async function fetchPontuacaoTotalByUsuarioId(
  usuarioId: string,
  headers: any
): Promise<number | null> {
  if (!usuarioId) return null;

  try {
    const r = await fetch(
      `${API.BASE_URL}/api/perfil/${encodeURIComponent(usuarioId)}/pontuacao`,
      { headers }
    );
    if (!r.ok) return null;
    const data = await r.json();

    const performance = Number(data?.performance) || 0;
    const disciplina = Number(data?.disciplina) || 0;
    const responsabilidade = Number(data?.responsabilidade) || 0;

    return performance + disciplina + responsabilidade; // ✅ igual ProfileHeader
  } catch {
    return null;
  }
}

export default function PerfilClube({ idDaUrl, usuarioId }: Props) {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const isOwn = !idDaUrl || idDaUrl === Storage.usuarioId;
  const canEdit = isOwn;
  const targetId = isOwn ? (Storage.tipoUsuarioId || "me") : (idDaUrl as string);

  const [data, setData] = useState<PayloadClube | null>(null);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<AbaTopo>(canEdit ? "dashboard" : "perfil");
  const [subAba, setSubAba] = useState<SubAbaAtletas>("vinculados");
  const [vinculados, setVinculados] = useState<AtletaItem[] | null>(null);
  const [observados, setObservados] = useState<AtletaItem[] | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[] | null>(null);
  const [vinculadosPreview, setVinculadosPreview] = useState<AtletaItem[]>([]);
  const [observadoEdits, setObservadoEdits] = useState<
    Record<string, { notaInterna: string; alertarMudancas: boolean }>
  >({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [errorById, setErrorById] = useState<Record<string, string | null>>({});
  const [atletasHeaderCount, setAtletasHeaderCount] = useState<number | null>(
    null
  );
  const [professores, setProfessores] = useState<ProfessorItem[]>([]);
  const [professoresLoading, setProfessoresLoading] = useState(false);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmasLoading, setTurmasLoading] = useState(false);
  const [turmasOpen, setTurmasOpen] = useState(false);
  const [professorSelecionado, setProfessorSelecionado] = useState<
    string | undefined
  >();
  const [eventosPreview, setEventosPreview] = useState<EventoPreview[]>([]);
  const [eventosLoading, setEventosLoading] = useState(false);
  const [eventosErro, setEventosErro] = useState<string>("");
  const [atividades, setAtividades] = useState<AtividadeRecente[] | null>(null);
  const [conquistasCount, setConquistasCount] = useState<number | null>(null);
  const [eventosCount, setEventosCount] = useState<number | null>(null);
  const [privacidade, setPrivacidade] = useState<{
    perfilVisivel: boolean;
    permitirMensagens: boolean;
    mostrarEmail: boolean;
  } | null>(null);

  const clubeId = (isOwn ? Storage.tipoUsuarioId : data?.clube?.id) ?? null;
  const entidadeUsuarioId = isOwn
    ? Storage.usuarioId
    : data?.clube?.usuarioId ?? null;

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
    if (!clubeId) return;

    let cancel = false;

    (async () => {
      try {
        const { data } = await axios.get(
          `${API.BASE_URL}/api/eventos/clubes/${clubeId}`,
          { headers }
        );

        const arr = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
        if (!cancel) setEventosCount((arr ?? []).length);
      } catch {
        if (!cancel) setEventosCount(0);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [token, clubeId]);

  useEffect(() => {
    if (!token) return;

    const usuarioIdEnt = isOwn ? Storage.usuarioId : (data?.clube?.usuarioId ?? null);
    if (!usuarioIdEnt) return;

    let cancel = false;

    (async () => {
      try {
        const { data: resp } = await axios.get(
          `${API.BASE_URL}/api/conquistas/${encodeURIComponent(usuarioIdEnt)}?onlyConcluidas=1`,
          { headers, withCredentials: true }
        );

        const earnedArr = Array.isArray(resp?.earned) ? resp.earned : [];
        if (!cancel) setConquistasCount(earnedArr.length); 
      } catch {
        if (!cancel) setConquistasCount(0);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [token, isOwn, data?.clube?.usuarioId]);

  useEffect(() => {
    if (!token) return;

    let cancel = false;
    (async () => {
      const idEntidade = clubeId; // ✅ clubeId mesmo
      if (!idEntidade) {
        if (!cancel) {
          setAtletasHeaderCount(0);
          setVinculadosPreview([]);
        }
        return;
      }

      try {
        const params: any = {
          vinculo: "clube",
          id: idEntidade,
          order: "pontuacao_desc",
          incluirPontuacao: 1,
        };

        const resp = await axios.get(`${API.BASE_URL}/api/gerenciar/atletas`, {
          headers,
          params,
        });

        const rows: any[] = Array.isArray(resp.data?.atletas)
          ? resp.data.atletas
          : Array.isArray(resp.data)
          ? resp.data
          : Array.isArray(resp.data?.items)
          ? resp.data.items
          : [];

        if (cancel) return;

        setAtletasHeaderCount(rows.length);

        // ✅ Só pro preview (5) — busca a pontuação REAL igual ao ProfileHeader
        const top5 = rows.slice(0, 5);

        const mapped = await Promise.all(
          top5.map(async (r) => {
            const usuarioIdRow =
              String(r.usuarioId ?? r.usuario?.id ?? r.usuario?.usuarioId ?? "").trim();

            const pontuacaoTotal =
              usuarioIdRow
                ? await fetchPontuacaoTotalByUsuarioId(usuarioIdRow, headers)
                : null;

            return {
              id: r.id || r.atletaId,
              atletaId: r.atletaId || r.id,
              usuarioId: usuarioIdRow || null,
              nome: r.nome,
              foto: r.foto ?? null,
              posicao: r.posicao ?? null,
              categoria: r.categoria ?? null,

              // ✅ aqui é o que você quer: mesmo número do ProfileHeader (ex.: 171)
              pontuacao:
                (typeof pontuacaoTotal === "number" ? pontuacaoTotal : null) ??
                (typeof r.pontuacao === "number" ? r.pontuacao : null) ??
                (typeof r.pontuacaoTotal === "number" ? r.pontuacaoTotal : null) ??
                (typeof r.pontos === "number" ? r.pontos : null) ??
                null,
            };
          })
        );

        if (cancel) return;
        setVinculadosPreview(mapped);
      } catch {
        if (!cancel) {
          setAtletasHeaderCount(0);
          setVinculadosPreview([]);
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [token, clubeId]); // ✅ dependências corretas

  useEffect(() => {
    setAtividades(null);
  }, [targetId, isOwn, data?.usuario?.id, data?.clube?.usuarioId]);

  useEffect(() => {
    if (!token) return;

    function onFocus() {
      if (aba === "perfil") setAtividades(null);
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [token, aba]);

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await axios.get<PayloadClube>(
          `${API.BASE_URL}/api/perfil/clube/${targetId}`,
          { headers }
        );
        if (!cancel) setData(resp.data);
      } catch {
        if (!cancel) setData(null);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [targetId, token]);

  useEffect(() => {
    if (!token) return;
    const cancel = { v: false };

    const targetUserForActivities = isOwn
      ? "me"
      : (data?.usuario?.id ?? data?.clube?.usuarioId ?? "");

    async function loadAtividadesIfNeeded() {
      if (aba !== "perfil") return;
      if (atividades != null) return;
      if (!targetUserForActivities) return;

      try {
        const { data: itens } = await axios.get<AtividadeRecente[]>(
          `${API.BASE_URL}/api/perfil/${targetUserForActivities}/atividades`,
          { headers }
        );

        if (cancel.v) return;

        const arr = Array.isArray(itens) ? itens : [];

        // ✅ normaliza a data para sempre cair em createdAt
        const normalized: AtividadeRecente[] = arr.map((it: any) => ({
          ...it,
          createdAt:
            it?.createdAt ??
            it?.criadoEm ??
            it?.createAt ??      // caso algum lugar antigo ainda mande assim
            it?.created_at ??
            null,
        }));

        setAtividades(normalized);
      } catch {
        if (!cancel.v) setAtividades([]);
      }
    }

    loadAtividadesIfNeeded();

    return () => {
      cancel.v = true;
    };
  }, [aba, token, isOwn, data?.usuario?.id, data?.clube?.usuarioId, atividades]);

  useEffect(() => {
    if (!token) return;
    const cancel = { v: false };

    async function fetchVinculados() {
      const tipoId = clubeId;
      if (!tipoId) {
        if (!cancel.v) setVinculados([]);
        return;
      }
      try {
        const { data: lista } = await axios.get<AtletaItem[]>(
          `${API.BASE_URL}/api/treinos/atletas-vinculados`,
          { headers, params: { tipoUsuarioId: tipoId, incluirPontuacao: 1 } }
        );
        if (!cancel.v) setVinculados(Array.isArray(lista) ? lista : []);
      } catch {
        if (!cancel.v) setVinculados([]);
      }
    }

    async function fetchObservados() {
      const tipoId = clubeId;
      if (!tipoId) {
        if (!cancel.v) setObservados([]);
        return;
      }
      try {
        const { data: lista } = await axios.get<AtletaItem[]>(
          `${API.BASE_URL}/api/observados`,
          {
            headers,
            params: {
              tipoUsuarioId: tipoId,
              tipo: "Clube",
              incluirPontuacao: 1,
              incluirNotas: 1,
            },
          }
        );
        if (!cancel.v) {
          setObservados(Array.isArray(lista) ? lista : []);
          const seed: Record<
            string,
            { notaInterna: string; alertarMudancas: boolean }
          > = {};
          (Array.isArray(lista) ? lista : []).forEach((a) => {
            seed[a.atletaId] = {
              notaInterna: a.notaInterna ?? "",
              alertarMudancas: !!a.alertarMudancas,
            };
          });
          setObservadoEdits(seed);
        }
      } catch {
        if (!cancel.v) setObservados([]);
      }
    }

    async function fetchSolicitacoes() {
      try {
        const { data } = await axios.get<Solicitacao[]>(
          `${API.BASE_URL}/api/solicitacoes-treino/recebidas`,
          { headers }
        );
        if (!cancel.v) setSolicitacoes(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Erro ao carregar solicitações recebidas:", e);
        if (!cancel.v) setSolicitacoes([]);
      }
    }

    if (aba === "atletas") {
      if (subAba === "vinculados" && vinculados == null) fetchVinculados();
      if (subAba === "observados" && observados == null) fetchObservados();
      if (subAba === "solicitacoes" && solicitacoes == null) fetchSolicitacoes();
    }
    return () => {
      cancel.v = true;
    };
  }, [aba, subAba, token, clubeId, vinculados, observados, solicitacoes]);

  async function loadProfessores() {
    if (!token) return;

    // ⚠️ IMPORTANTE:
    // /api/gerenciar/professores usa o USER ID da entidade (igual no GerenciarProfessores),
    // NÃO o clubeId (tipoUsuarioId).
    if (!entidadeUsuarioId) {
      setProfessores([]);
      return;
    }

    setProfessoresLoading(true);

    try {
      // ✅ IGUAL AO GERENCIAR PROFESSORES
      const res = await axios.get(`${API.BASE_URL}/api/gerenciar/professores`, {
        headers,
        params: {
          vinculo: "clube",
          id: entidadeUsuarioId, // ✅ user id do clube
          limit: 200,
        },
      });

      let lista = (res.data?.professores || res.data || []) as any[];

      // 🧯 fallback opcional: se vier vazio, tenta o endpoint antigo
      // (pode remover se quiser 100% igual ao GerenciarProfessores)
      if (!lista.length && clubeId) {
        const { data } = await axios.get(`${API.BASE_URL}/api/professores`, {
          headers,
          params: { ownerTipo: "Clube", ownerId: clubeId },
        });
        lista = (Array.isArray(data) ? data : data?.items ?? data?.data ?? []) as any[];
      }

      setProfessores(
        lista.map((p: any) => ({
          id: String(p.id),
          usuarioId: p.usuarioId ?? p.usuario?.id ?? null,
          nome: p.nome ?? p.usuario?.nome ?? "Professor",
          codigo: p.codigo ?? null,
          cref: p.cref ?? null,
          fotoUrl: p.fotoUrl ?? p.foto ?? p.usuario?.foto ?? null,
        }))
      );
    } catch {
      setProfessores([]);
    } finally {
      setProfessoresLoading(false);
    }
  }

  async function loadEventosPreview() {
    const id = clubeId; 
    if (!token || !id) return;

    setEventosErro("");
    setEventosLoading(true);
    try {
      const { data } = await axios.get(
        `${API.BASE_URL}/api/eventos/clubes/${id}`,
        { headers }
      );

      const arr = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const mapped: EventoPreview[] = (arr ?? [])
        .filter((ev: any) => {
          if (!ev?.dataEvento) return false;
          const dataEv = new Date(ev.dataEvento);
          dataEv.setHours(0, 0, 0, 0);
          return dataEv >= hoje;
        })
        .sort(
          (a: any, b: any) =>
            new Date(a.dataEvento).getTime() - new Date(b.dataEvento).getTime()
        )
        .map((ev: any) => ({
          id: String(ev.id),
          titulo: String(ev.titulo ?? "Evento"),
          tipo: ev.tipo ?? null,
          status: ev.status ?? null,
          dataEvento: String(ev.dataEvento ?? ""),
          cidade: ev.cidade ?? null,
          estado: ev.estado ?? null,
          descricao: ev.descricao ?? null,
        }));

      setEventosPreview(mapped.slice(0, 3));
      setEventosCount(mapped.length);
    } catch (e: any) {
      setEventosPreview([]);
      setEventosErro(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Não foi possível carregar os eventos agora."
      );
    } finally {
      setEventosLoading(false);
    }
  }

  function invalidateAtividades() {
    setAtividades(null);
  }

  async function loadTurmas() {
    if (!token || !clubeId) return;
    setTurmasLoading(true);
    try {
      const { data } = await axios.get(`${API.BASE_URL}/api/turmas`, {
        headers,
        params: { ownerTipo: "Clube", ownerId: clubeId },
      });
      const arr = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
      setTurmas(
        (arr ?? []).map((t: any) => ({
          id: String(t.id),
          nome: String(t.nome ?? t.titulo ?? "Turma"),
          ownerTipo: t.ownerTipo ?? "Clube",
          ownerId: t.ownerId ?? clubeId,
          professorIds: Array.isArray(t.professorIds) ? t.professorIds.map(String) : [],
          professorNomes: Array.isArray(t.professorNomes) ? t.professorNomes : [],
          professorNome:
            t.professorNome ??
            (Array.isArray(t.professorNomes) ? t.professorNomes.join(", ") : null) ??
            null,
          alunosCount: t.alunosCount ?? t.qtdAlunos ?? null,
        }))
      );
    } catch {
      setTurmas([]);
    } finally {
      setTurmasLoading(false);
    }
  }

  useEffect(() => {
    if (aba === "professores" && canEdit) {
      loadProfessores();
      loadTurmas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, canEdit, token, clubeId, entidadeUsuarioId]);

  useEffect(() => {
    if (aba === "eventos") {
      loadEventosPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, token, clubeId]);

  async function salvarObservado(atletaId: string) {
    if (!token || !clubeId) return;
    const edit =
      observadoEdits[atletaId] || {
        notaInterna: "",
        alertarMudancas: false,
      };

    setSavingById((s) => ({ ...s, [atletaId]: true }));
    setErrorById((e) => ({ ...e, [atletaId]: null }));
    try {
      await axios.patch(
        `${API.BASE_URL}/api/observados/${atletaId}`,
        {
          tipoUsuarioId: clubeId,
          tipo: "Clube",
          notaInterna: edit.notaInterna,
          alertarMudancas: edit.alertarMudancas,
        },
        { headers }
      );
      setObservados((prev) =>
        (prev || []).map((a) =>
          a.atletaId === atletaId
            ? {
                ...a,
                notaInterna: edit.notaInterna,
                alertarMudancas: edit.alertarMudancas,
              }
            : a
        )
      );
    } catch (err: any) {
      setErrorById((e) => ({
        ...e,
        [atletaId]:
          err?.response?.data?.message ||
          err?.message ||
          "Não foi possível salvar a nota/preferência agora.",
      }));
    } finally {
      setSavingById((s) => ({ ...s, [atletaId]: false }));
    }
  }

  if (loading)
    return (
      <div className="text-center p-10 text-green-800">
        Carregando perfil...
      </div>
    );
  if (!data || !data.clube)
    return (
      <div className="text-center p-10 text-red-600">
        Clube não encontrado.
      </div>
    );

  const nome = data.clube.nome || data.usuario?.nome || "Clube";
  const emailDoPerfil =
  (data?.usuario?.email && String(data.usuario.email)) ||
  (data?.clube?.email && String(data.clube.email)) ||
  "";

  const headerFoto =
    (typeof data.clube.logo === "string" && data.clube.logo) ||
    (typeof data.usuario?.foto === "string" && data.usuario.foto) ||
    undefined;

  const time = data.clube.cidade
    ? `${data.clube.cidade}${
        data.clube.estado ? " - " + data.clube.estado : ""
      }${data.clube.pais ? " - " + data.clube.pais : ""}`
    : undefined;

  const athletesCount = vinculados?.length ?? data.metrics?.atletas ?? 0;
  const kpis = [
    {
      label: "Atletas",
      value: atletasHeaderCount ?? athletesCount ?? data.metrics?.atletas ?? 0,
    },
    { label: "Eventos", value: (typeof eventosCount === "number" ? eventosCount : 0) },
    { label: "Conquistas", value: (typeof conquistasCount === "number" ? conquistasCount : 0) },
  ];
  const clubeIdStr = data.clube.id;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <ProfileHeader
        nome={nome}
        time={time}
        isOwnProfile={isOwn}
        foto={headerFoto}
        kpis={kpis}
        perfilId={data.usuario?.id || data.clube.usuarioId}
        perfilTipoProp="clube"
        perfilTipoIdProp={data.clube.id}
      />

      <div className="mt-4 grid grid-cols-6 gap-2">
        {(canEdit
          ? [
              { key: "perfil", label: "Perfil" },
              { key: "dashboard", label: "Dashboard" },
              { key: "eventos", label: "Eventos" },
              { key: "atletas", label: "Atletas" },
              { key: "professores", label: "Professores" },
              { key: "postagens", label: "Postagens" }
            ]
          : [
              { key: "perfil", label: "Perfil" },
              { key: "eventos", label: "Eventos" },
              { key: "postagens", label: "Postagens" },
            ]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => {
              const next = t.key as AbaTopo;
              setAba(next);

              if (next === "perfil") {
                invalidateAtividades();
              }
            }}
            className={`py-2 rounded-lg text-sm font-medium ${
              aba === t.key
                ? "bg-green-100 text-green-900"
                : "bg-white/70 text-green-900 hover:bg-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      
      {aba === "perfil" && (
        <section className="mt-4 grid gap-4">
          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">
              Informações do Clube
            </h3>
            <ul className="text-sm text-green-900/90 space-y-1">
              <li>
                <b>Nome:</b> {data.clube.nome}
              </li>
              {privacidade?.mostrarEmail && emailDoPerfil ? (
                <li>
                  <b>Email:</b> {emailDoPerfil}
                </li>
              ) : null}

              {data.clube.estadio && (
                <li>
                  <b>Estádio:</b> {data.clube.estadio}
                </li>
              )}
              {(data.clube.cidade ||
                data.clube.estado ||
                data.clube.pais) && (
                <li>
                  <b>Localização:</b>{" "}
                  {[data.clube.cidade, data.clube.estado, data.clube.pais]
                    .filter(Boolean)
                    .join(", ")}
                </li>
              )}
              {(data.clube.logradouro ||
                data.clube.bairro ||
                data.clube.cep) && (
                <li>
                  <b>Endereço:</b>{" "}
                  {[
                    data.clube.logradouro,
                    data.clube.numero,
                    data.clube.complemento,
                    data.clube.bairro,
                    data.clube.cep,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </li>
              )}
              {data.clube.siteOficial && (
                <li>
                  <b>Site:</b> {data.clube.siteOficial}
                </li>
              )}
            </ul>
          </div>

          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-1">
              FootEra Formadores
            </h3>
            <p className="text-sm text-green-900/80">
              Gerencie vínculos de formação de atletas e documentos para
              mecanismo de solidariedade
            </p>
            <div className="mt-3">
              <Link
                href="/formadores"
                className="inline-block rounded-lg bg-green-600 text-white px-4 py-2 font-semibold"
              >
                Acessar Módulo Formadores
              </Link>
            </div>
          </div>

          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">
              Sobre o Clube
            </h3>
            {data.clube.descricao?.trim() ? (
              <p className="text-sm text-green-900/90 whitespace-pre-wrap">
                {data.clube.descricao}
              </p>
            ) : (
              <p className="text-sm text-green-900/70">
                Sem descrição cadastrada.
              </p>
            )}
          </div>

          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">
              Categorias de Base
            </h3>
            {data.clube.categorias?.length ? (
              <div className="flex flex-wrap gap-2">
                {data.clube.categorias.map((c) => (
                  <span
                    key={c}
                    className="text-xs bg-green-100 text-green-900 px-2 py-1 rounded-full"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-green-900/70">
                Nenhuma categoria de base cadastrada.
              </p>
            )}
          </div>

          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">Contato</h3>
            <ul className="text-sm text-green-900/90 space-y-1">
              {(data.clube.responsavel || data.usuario?.nome) && (
                <li>
                  <b>Responsável:</b>{" "}
                  {data.clube.responsavel || data.usuario?.nome}
                </li>
              )}
              {privacidade?.mostrarEmail && (data.clube.email || data.usuario?.email) ? (
                <li>
                  <b>Email:</b> {data.clube.email || data.usuario?.email}
                </li>
              ) : null}
              {(data.clube.telefone1 || data.clube.telefone2) && (
                <li>
                  <b>Telefone:</b>{" "}
                  {[data.clube.telefone1, data.clube.telefone2]
                    .filter(Boolean)
                    .join(" / ")}
                </li>
              )}
            </ul>
          </div>

          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">
              Documentação
            </h3>
            {data.clube.cnpj ? (
              <p className="text-sm text-green-900/90">
                <b>CNPJ:</b> {data.clube.cnpj}
              </p>
            ) : (
              <p className="text-sm text-green-900/70">
                Sem CNPJ informado.
              </p>
            )}
          </div>

          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">Atividade Recente</h3>

            {atividades && atividades.length > 0 ? (
              <ul className="space-y-3">
                {atividades.slice(0, 6).map((a) => {
                  const tipoNorm = String(a.tipo || "").toUpperCase();

                   const Icon =
                    a.tipo === "Evento" ? CalendarClock :
                    a.tipo === "Metodologia" ? BookOpen :
                    a.tipo === "Desafio" ? Trophy :
                    a.tipo === "Vídeo" || a.tipo === "Video" ? VideoCamera :
                    a.tipo === "Treino" ? Activity :
                    a.tipo === "Postagem" ? FileText :
                    Activity;
                    
                  const tipoLabel =
                    tipoNorm === "METODOLOGIA" ? "Metodologia"
                    : tipoNorm === "VIDEO" ? "Vídeo"
                    : tipoNorm === "TREINO" ? "Treino"
                    : tipoNorm === "DESAFIO" ? "Desafio"
                    : tipoNorm === "POSTAGEM" ? "Postagem"
                    : tipoNorm === "EVENTO" ? "Evento"
                    : "Atividade";

                  const d = parseDateSafe(a);

                  const dataStr = d
                    ? d.toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  const content = (
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-green-700" />

                      {a.imagemUrl ? (
                        <img
                          src={resolveImg(a.imagemUrl) || AVATAR_FALLBACK}
                          alt={a.titulo}
                          className="w-10 h-10 rounded-lg object-cover border border-green-100"
                        />
                      ) : null}

                      <div className="text-sm">
                        <div className="font-medium text-green-900">{a.titulo}</div>
                        <div className="text-xs text-green-900/70">
                          {tipoLabel} • {dataStr}
                        </div>
                      </div>

                      {a.link ? (
                        <ChevronRight className="ml-auto w-4 h-4 text-green-800" />
                      ) : null}
                    </div>
                  );

                  return (
                    <li key={a.id}>
                      {a.link ? (
                        <Link
                          href={a.link}
                          className="block rounded-xl border border-green-100 p-3 hover:bg-green-50"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="rounded-xl border border-green-100 p-3">
                          {content}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState text="Nenhuma atividade recente" />
            )}
          </div>

        </section>
      )}

      {aba === "dashboard" && canEdit && clubeId && (
        <section className="mt-4">
          <DashboardOrganizacao ownerTipo="Clube" ownerId={clubeId} />
        </section>
      )}

      {aba === "eventos" && (
        <section className="mt-4 grid gap-4">
          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-green-900">Eventos</h3>

              <Link
                href={`/eventos/clubes/${clubeIdStr}`}
                className="text-sm px-3 py-1 rounded-lg bg-green-100 text-green-900"
              >
                Ver eventos
              </Link>
            </div>

            <p className="text-sm text-green-900/80 mt-1">
              Toque em um evento para ver todos os detalhes e gerenciar inscrições.
            </p>

            <div className="mt-3">
              {eventosLoading ? (
                <div className="text-sm text-green-900/70">Carregando eventos…</div>
              ) : eventosErro ? (
                <div className="text-sm text-red-600">{eventosErro}</div>
              ) : eventosPreview.length ? (
                <div className="grid gap-2">
                  {eventosPreview.map((ev) => {
                    const when = ev.dataEvento
                      ? new Date(ev.dataEvento).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";

                    const where = [ev.cidade, ev.estado].filter(Boolean).join(" - ");

                    return (
                      <Link
                        key={ev.id}
                        href={`/eventos/clubes/${clubeIdStr}`}
                        className="block rounded-xl border border-green-100 bg-white/70 p-3 hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-green-900 truncate">
                              {ev.titulo}
                            </div>
                            <div className="text-xs text-green-900/70">
                              {[ev.tipo, when, where].filter(Boolean).join(" • ")}
                            </div>

                            {ev.descricao?.trim() ? (
                              <div className="text-xs text-green-900/80 mt-2 line-clamp-2">
                                {ev.descricao}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            {ev.status ? (
                              <span className="text-[11px] px-2 py-1 rounded-full bg-green-50 text-green-900 border border-green-100">
                                {String(ev.status).toUpperCase()}
                              </span>
                            ) : null}
                            <ChevronRight className="w-4 h-4 text-green-800" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-green-900/70">
                  Nenhum evento criado ainda.
                </div>
              )}
            </div>

            {isOwn && (
              <div className="mt-4">
                <Link
                  href={`/eventos/clubes/${clubeIdStr}/novo`}
                  className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 text-green-900 font-semibold px-4 py-2"
                >
                  <span>+</span> Criar novo evento
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {aba === "postagens" && (
        <section className="mt-4">
          {(() => {
            const postsUserId = isOwn
              ? String(Storage.usuarioId || "")
              : String(data?.usuario?.id ?? data?.clube?.usuarioId ?? "");

            return postsUserId ? (
              <ProfilePostsSection usuarioId={postsUserId} />
            ) : (
              <div className="bg-white/70 rounded-xl p-4 shadow-sm text-sm text-green-900/70">
                Não foi possível carregar o usuário das postagens.
              </div>
            );
          })()}
        </section>
      )}

      {aba === "atletas" && (
        <section className="mt-4 grid gap-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "vinculados", label: "Vinculados" },
              { key: "observados", label: "Observados" },
              { key: "solicitacoes", label: "Solicitações" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setSubAba(t.key as SubAbaAtletas)}
                className={`py-2 rounded-lg text-sm font-medium ${
                  subAba === t.key
                    ? "bg-green-100 text-green-900"
                    : "bg-white/70 text-green-900 hover:bg-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {subAba === "vinculados" && (
            <SectionCard
              title={`Atletas Vinculados${
                typeof atletasHeaderCount === "number"
                  ? ` (${atletasHeaderCount})`
                  : ""
              }`}
              right={
                <Link
                  href="/perfil/GerenciarAtletas"
                  className="text-sm text-green-800"
                >
                  Gerenciar Atletas
                </Link>
              }
            >
              {vinculadosPreview.length > 0 ? (
                <ul className="space-y-2">
                  {vinculadosPreview.map((a) => (
                    <li
                      key={a.atletaId}
                      className="flex items-center gap-3"
                    >
                      <Avatar
                        foto={a.foto ?? null}
                        alt={a.nome}
                        className="w-9 h-9"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-green-900">
                          {a.nome}
                        </div>
                        <div className="text-xs text-green-900/70">
                          {[
                            a.posicao,
                            a.categoria,
                            a.pontuacao != null
                              ? `${a.pontuacao} pts`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      </div>
                      <Link
                        href={`/perfil/${a.usuarioId ?? a.id}`}
                        className="text-xs text-green-800"
                      
                      >
                        Ver
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-green-900/70">
                  Nenhum atleta vinculado ainda.
                </p>
              )}
            </SectionCard>
          )}

          {subAba === "observados" && (
            <SectionCard
              title={`Atletas Observados (${observados?.length ?? 0})`}
              
            >
              {observados && observados.length > 0 ? (
                <ul className="grid grid-cols-1 gap-3">
                  {observados.map((a) => {
                    const edit =
                      observadoEdits[a.atletaId] || {
                        notaInterna: a.notaInterna ?? "",
                        alertarMudancas: !!a.alertarMudancas,
                      };
                    const saving = !!savingById[a.atletaId];
                    const errMsg = errorById[a.atletaId] || null;

                    return (
                      <li
                        key={a.atletaId}
                        className="rounded-xl border border-green-100 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            foto={a.foto ?? null}
                            alt={a.nome}
                            className="w-10 h-10"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-green-900">
                              {a.nome}
                            </div>
                            <div className="text-xs text-green-900/70">
                              {[
                                a.posicao,
                                a.idade ? `${a.idade} anos` : "",
                                a.categoria ? `Cat. ${a.categoria}` : "",
                                a.pontuacao != null
                                  ? `${a.pontuacao} pts`
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" • ")}
                            </div>
                          </div>
                          <Link
                            href={`/perfil/${a.usuarioId ?? a.id}`}
                            className="text-sm text-green-800 inline-flex items-center gap-1"
                          >
                            Ver perfil{" "}
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>

                        <div className="mt-3 grid gap-2">
                          <label className="text-xs font-medium text-green-900">
                            Nota interna
                            <input
                              type="text"
                              value={edit.notaInterna}
                              onChange={(e) =>
                                setObservadoEdits((old) => ({
                                  ...old,
                                  [a.atletaId]: {
                                    ...edit,
                                    notaInterna: e.target.value,
                                  },
                                }))
                              }
                              placeholder="ex.: 'Bom 1x1, precisa evoluir passe longo'"
                              className="mt-1 w-full rounded-lg border border-green-200 px-3 py-2 text-sm text-green-900 placeholder:text-green-900/40 focus:outline-none focus:ring-2 focus:ring-green-300"
                            />
                          </label>

                          <label className="inline-flex items-center gap-2 text-sm text-green-900">
                            <input
                              type="checkbox"
                              checked={!!edit.alertarMudancas}
                              onChange={(e) =>
                                setObservadoEdits((old) => ({
                                  ...old,
                                  [a.atletaId]: {
                                    ...edit,
                                    alertarMudancas: e.target.checked,
                                  },
                                }))
                              }
                            />
                            Notificar mudanças (pontuação, posição, idade,
                            novos treinos/desafios)
                          </label>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => salvarObservado(a.atletaId)}
                              disabled={saving}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                                saving
                                  ? "bg-green-200 text-green-700 cursor-not-allowed"
                                  : "bg-green-600 text-white hover:bg-green-700"
                              }`}
                            >
                              {saving ? "Salvando..." : "Salvar"}
                            </button>
                            {errMsg && (
                              <span className="text-xs text-red-600">
                                {errMsg}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState text="Você ainda não observa nenhum atleta" />
              )}
            </SectionCard>
          )}

          {subAba === "solicitacoes" && (
            <SectionCard
              title="Solicitações de Atletas"
              right={
                <Link
                  href="/notificacoes"
                  className="text-sm text-green-800"
                >
                  Abrir notificações
                </Link>
              }
            >
              {solicitacoes && solicitacoes.length > 0 ? (
                <ul className="space-y-3">
                  {solicitacoes.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-green-100 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          foto={s.remetente.foto}
                          alt={s.remetente.nomeDeUsuario}
                          className="w-10 h-10"
                        />
                        <div>
                          <div className="text-sm font-medium text-green-900">
                            {s.remetente.nomeDeUsuario}
                          </div>
                          <div className="text-xs text-green-900/70">
                            quer treinar junto com você
                          </div>
                        </div>
                      </div>
                      <Link
                        href={`/perfil/${s.remetenteId}`}
                        className="text-sm text-green-800 inline-flex items-center gap-1"
                      >
                        Ver perfil{" "}
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState text="Nenhuma solicitação no momento." />
              )}
            </SectionCard>
          )}
        </section>
      )}

      {aba === "professores" && canEdit && (
        <section className="mt-4 grid gap-4">
          <SectionCard
            title="Professores do Clube"
            right={
              <Link
                href="/perfil/GerenciarProfessores"
                className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white inline-flex items-center gap-1"
              >
                <PlusCircle className="w-4 h-4" />
                Gerenciar Professores
              </Link>
            }
          >
            {professoresLoading ? (
              <div className="text-sm text-green-900/70">
                Carregando professores…
              </div>
            ) : professores.length ? (
              <ul className="grid grid-cols-1 gap-3">
                {professores.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-green-100 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        foto={p.fotoUrl ?? null}
                        alt={p.nome}
                        className="w-10 h-10"
                      />
                      <div>
                        <div className="text-sm font-medium text-green-900">
                          {p.nome}
                        </div>
                        <div className="text-xs text-green-900/70">
                          {[
                            p.codigo ? `Código ${p.codigo}` : "",
                            p.cref ? `CREF ${p.cref}` : "",
                          ]
                            .filter(Boolean)
                            .join(" • ") || "—"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/perfil/${p.usuarioId ?? p.id}`}
                        className="text-sm text-green-800 inline-flex items-center gap-1"
                      >
                        Ver perfil <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState text="Nenhum professor vinculado ao clube." />
            )}
          </SectionCard>

          <SectionCard title="Turmas do Clube">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-green-900/80">
                Gerencie turmas do clube e defina o professor responsável.
              </div>
              <button
                onClick={() => {
                  setProfessorSelecionado(undefined);
                  setTurmasOpen(true);
                }}
                className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white inline-flex items-center gap-1"
              >
                <PlusCircle className="w-4 h-4" />
                Nova turma
              </button>
            </div>

            {turmasLoading ? (
              <div className="text-sm text-green-900/70">
                Carregando turmas…
              </div>
            ) : turmas.length ? (
              <ul className="space-y-2">
                {turmas.map((t) => (
                  <li
                    key={t.id}
                    className="border rounded-xl p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-green-900">
                          {t.nome}
                        </div>
                        <div className="text-xs text-green-900/70">
                          {t.professorNome
                            ? `Professor: ${t.professorNome}`
                            : "Professor: —"}{" "}
                          •{" "}
                          {typeof t.alunosCount === "number"
                            ? `${t.alunosCount} alunos`
                            : "—"}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setProfessorSelecionado(t.professorIds?.[0]);
                          setTurmasOpen(true);
                        }}
                        className="text-sm px-3 py-1.5 rounded-md border border-green-200 text-green-900"
                      >
                        Administrar
                      </button>
                    </div>

                    {professores.length > 0 && (
                      <div className="flex items-center gap-2">
                        <select
                          multiple
                          className="border rounded px-3 py-2 text-sm"
                          value={t.professorIds ?? []}
                          onChange={async (e) => {
                            const selectedIds = Array.from(e.target.selectedOptions)
                              .map((o) => o.value)
                              .filter(Boolean);

                            try {
                              await axios.put(
                                `${API.BASE_URL}/api/turmas/${t.id}/atribuir-professores`,
                                { professorIds: selectedIds },
                                { headers }
                              );
                              await loadTurmas();
                              alert("Professores atualizados na turma!");
                            } catch (err) {
                              console.error(err);
                              alert("Não foi possível atualizar os professores.");
                            }
                          }}
                        >
                          {professores.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nome}
                              {p.cref ? ` • CREF ${p.cref}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState text="Nenhuma turma cadastrada no clube." />
            )}
          </SectionCard>
        </section>
      )}

      {canEdit && (
        <TurmasManager
          open={turmasOpen}
          onClose={() => {
            setTurmasOpen(false);
            loadTurmas();
            loadProfessores();
          }}
          owner={
            clubeId
              ? { tipo: "Clube", id: clubeId, usuarioId: data.usuario?.id }
              : undefined
          }
          professorId={professorSelecionado}
        />
      )}
    </div>
  );
}