import { toast } from "@/lib/toast";
import { useEffect, useState } from "react";
import axios from "axios";
import {
  ChevronRight,
  CalendarClock,
  Activity,
  Trophy,
  Shield,
  PlusCircle,
  BookOpen,
  FileText,
  CameraIcon
} from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API, FLAGS } from "../../config.js";
import ProfileHeader from "../profile/ProfileHeader.js";
import { Link } from "wouter";
import Avatar from "../shared/Avatar.js";
import TurmasManager from "../turmas/TurmasManager.js";
import ProfilePostsSection from "../perfil/ProfilePostsSection.js";
import DashboardOrganizacao from "../dashboard/DashboardOrganizacao.js"; 

type Props = { idDaUrl?: string; hasCreator?: boolean; creatorUsuarioId?: string | null };
type UsuarioMin = {
  id: string;
  nome: string;
  email: string;
  foto?: string | null;
};
type Escolinha = {
  id: string;
  usuarioId?: string | null;
  nome: string;
  cnpj?: string | null;
  telefone1?: string | null;
  telefone2?: string | null;
  email?: string | null;
  siteOficial?: string | null;
  sede?: string | null;
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
};
type Metrics = {
  atletas: number;
  treinosProgramados: number;
  postagens: number;
  conquistas?: number;
};
type PayloadEscola = {
  tipo: "Escolinha";
  usuario: UsuarioMin | null;
  escolinha: Escolinha;
  metrics: Metrics;
};

type AtletaItem = {
  id: string; 
  usuarioId: string;
  nome: string;
  foto?: string | null;
  posicao?: string | null;
  idade?: number | null;
  altura?: number | null;
  peso?: number | null;
  observadoEm?: string;
  categoria?: string | null;
  pontuacao?: number | null;
  observadoId?: string;      
  atletaId?: string;       
  notaInterna?: string | null;
  alertarMudancas?: boolean | null;
};

type SolicitacaoItem = {
  id: string;
  remetenteId: string;
  remetente: { id: string; nomeDeUsuario: string; foto: string | null };
  status?: "PENDENTE" | "APROVADO" | "REJEITADO";
  criadaEm?: string;
};

type AtividadeRecente = {
  id: string;
  tipo: "Treino" | "Desafio" | "Vídeo" | "Postagem" | "Evento" | "Metodologia";
  titulo: string;
  createdAt: string;
  imagemUrl?: string | null;
  link?: string | null;
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
  ownerTipo?: "Clube" | "Escolinha" | null;
  ownerId?: string | null;
  professorIds?: string[];      
  professorNomes?: string[];    
  professorNome?: string | null;
  alunosCount?: number | null;
};

type EventoItem = {
  id: string;
  titulo: string;
  tipo?: string | null;
  dataEvento?: string | null;
  inicio?: string | null;
  cidade?: string | null;
  estado?: string | null;
  endereco?: string | null;
  descricao?: string | null;
  status?: string | null;

  origem?: "EVENTO_ESCOLINHA" | "AULA_AO_VIVO_CREATOR";
  thumbUrl?: string | null;
  totalParticipantes?: number | null;

  criadorLabel?: string | null;
  convidadosLabel?: string | null;
};

type CertificadoResumo = {
  id: string;
  tituloMetodologia: string;
  emitidoEm: string;
  codigoValidacao: string;
  pdfUrl?: string | null;
};

function SectionCard({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="bg-white/90 rounded-2xl shadow-sm border border-green-100">
      <div className="px-3 sm:px-4 py-3 flex items-center justify-between border-b border-green-100">
        <h3 className="font-semibold text-green-900">{title}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

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

function normalizeImg(raw?: string | null) {
  if (!raw) return null;
  const u = String(raw).trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API.BASE_URL}${u}`;
  return `${API.BASE_URL}/${u}`;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center text-green-900/70 py-8">
      <Activity className="mx-auto mb-2 opacity-70" />
      <p>{text}</p>
    </div>
  );
}

export default function PerfilEscola({ idDaUrl, hasCreator = false, creatorUsuarioId = null }: Props) {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const isOwn =
    !idDaUrl ||
    idDaUrl === Storage.usuarioId ||
    idDaUrl === Storage.tipoUsuarioId;
  const canEdit = isOwn;
  const targetId = isOwn ? (Storage.tipoUsuarioId || "me") : (idDaUrl as string);

  const [data, setData] = useState<PayloadEscola | null>(null);
  const [loading, setLoading] = useState(true);

  type Aba = "visao" | "eventos" | "atletas" | "conquistas" | "professores" | "postagens";
  const [aba, setAba] = useState<Aba>("visao");

  type SubAba = "vinculados" | "observados" | "solicitacoes";
  const [subAba, setSubAba] = useState<SubAba>("vinculados");

  const [vinculados, setVinculados] = useState<AtletaItem[] | null>(null);
  const [observados, setObservados] = useState<AtletaItem[] | null>(null);
  const [obsDraft, setObsDraft] = useState<Record<string, { nota: string; alertar: boolean }>>({});
  const [obsSaving, setObsSaving] = useState<Record<string, boolean>>({});
  const [obsMsg, setObsMsg] = useState<Record<string, string>>({});
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoItem[] | null>(
    null
  );
  const [contagensAtletas, setContagensAtletas] = useState({
    vinculados: 0,
    observados: 0,
    solicitacoes: 0,
  });
  const [atividades, setAtividades] = useState<AtividadeRecente[] | null>(null);
  const [professores, setProfessores] = useState<ProfessorItem[]>([]);
  const [professoresLoading, setProfessoresLoading] = useState(false);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmasLoading, setTurmasLoading] = useState(false);
  const [turmasOpen, setTurmasOpen] = useState(false);
  const [professorSelecionado, setProfessorSelecionado] = useState<
    string | undefined
  >();

  const [eventos, setEventos] = useState<EventoItem[] | null>(null);
  const [eventosLoading, setEventosLoading] = useState(false);
  const [conquistasReal, setConquistasReal] = useState<number>(0);
  const [privacidade, setPrivacidade] = useState<{
    perfilVisivel: boolean;
    permitirMensagens: boolean;
    mostrarEmail: boolean;
  } | null>(null);

  const [earnedBadges, setEarnedBadges] = useState<any[]>([]);
  const [certificados, setCertificados] = useState<CertificadoResumo[] | null>(null);

  const escolinhaId = (isOwn ? Storage.tipoUsuarioId : data?.escolinha?.id) ?? null;
  const entidadeUsuarioId = (isOwn ? Storage.usuarioId : data?.escolinha?.usuarioId) ?? null;
  
  function extrairListaResposta(
    payload: any,
    chaves: string[] = []
  ): any[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    for (const chave of chaves) {
      if (Array.isArray(payload?.[chave])) {
        return payload[chave];
      }
    }

    return [];
  }

  async function carregarContagensAtletas() {
    if (!token || !escolinhaId || !canEdit) return;

    const [vinculadosResult, observadosResult, solicitacoesResult] =
      await Promise.allSettled([
        axios.get(`${API.BASE_URL}/api/gerenciar/atletas`, {
          headers,
          params: {
            vinculo: "escolinha",
            id: escolinhaId,
          },
        }),

        axios.get(`${API.BASE_URL}/api/observados`, {
          headers,
          params: {
            tipoUsuarioId: escolinhaId,
            tipo: "Escolinha",
          },
        }),

        axios.get(
          `${API.BASE_URL}/api/solicitacoes-treino/recebidas`,
          { headers }
        ),
      ]);

    const vinculadosLista =
      vinculadosResult.status === "fulfilled"
        ? extrairListaResposta(
            vinculadosResult.value.data,
            ["atletas", "items", "data"]
          )
        : null;

    const observadosLista =
      observadosResult.status === "fulfilled"
        ? extrairListaResposta(
            observadosResult.value.data,
            ["observados", "items", "data"]
          )
        : null;

    const solicitacoesLista =
      solicitacoesResult.status === "fulfilled"
        ? extrairListaResposta(
            solicitacoesResult.value.data,
            ["solicitacoes", "items", "data"]
          )
        : null;

    setContagensAtletas((prev) => ({
      vinculados:
        vinculadosLista !== null
          ? vinculadosLista.length
          : prev.vinculados,

      observados:
        observadosLista !== null
          ? observadosLista.length
          : prev.observados,

      solicitacoes:
        solicitacoesLista !== null
          ? solicitacoesLista.length
          : prev.solicitacoes,
    }));
  }

  async function buscarPontuacaoRealDoUsuario(usuarioId: string): Promise<number | null> {
    if (!token || !usuarioId) return null;

    try {
      const { data } = await axios.get(
        `${API.BASE_URL}/api/perfil/${encodeURIComponent(usuarioId)}/pontuacao`,
        { headers }
      );

      const performance = Number(data?.performance) || 0;
      const disciplina = Number(data?.disciplina) || 0;
      const responsabilidade = Number(data?.responsabilidade) || 0;

      return performance + disciplina + responsabilidade;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (
      aba !== "atletas" ||
      !token ||
      !escolinhaId ||
      !canEdit
    ) {
      return;
    }

    void carregarContagensAtletas();

    const intervalId = window.setInterval(() => {
      void carregarContagensAtletas();
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [aba, token, escolinhaId, canEdit]);

  useEffect(() => {
    if (!token || !escolinhaId || !canEdit) return;

    function atualizarDadosDosAtletas() {
      setVinculados(null);
      setObservados(null);
      setSolicitacoes(null);

      void carregarContagensAtletas();
    }

    function aoAlterarVisibilidade() {
      if (document.visibilityState === "visible") {
        atualizarDadosDosAtletas();
      }
    }

    window.addEventListener(
      "focus",
      atualizarDadosDosAtletas
    );

    window.addEventListener(
      "footera:vinculo-treino-alterado",
      atualizarDadosDosAtletas
    );

    document.addEventListener(
      "visibilitychange",
      aoAlterarVisibilidade
    );

    return () => {
      window.removeEventListener(
        "focus",
        atualizarDadosDosAtletas
      );

      window.removeEventListener(
        "footera:vinculo-treino-alterado",
        atualizarDadosDosAtletas
      );

      document.removeEventListener(
        "visibilitychange",
        aoAlterarVisibilidade
      );
    };
  }, [token, escolinhaId, canEdit]);

  useEffect(() => {
    setVinculados(null);
    setObservados(null);
    setSolicitacoes(null);
    setAtividades(null);
    setEventos(null);
  }, [isOwn, data?.escolinha?.id, data?.usuario?.id]);

  useEffect(() => {
    if (aba === "visao") setAtividades(null);
  }, [aba]);

  useEffect(() => {
    if (!token) return;

    const usuarioIdEnt = isOwn ? Storage.usuarioId : (data?.escolinha?.usuarioId ?? null);
    if (!usuarioIdEnt) return;

    let cancel = false;

    (async () => {
      try {
        const { data: resp } = await axios.get(
          `${API.BASE_URL}/api/conquistas/${encodeURIComponent(usuarioIdEnt)}?onlyConcluidas=1`,
          { headers, withCredentials: true }
        );

        const earnedArr = Array.isArray(resp?.earned) ? resp.earned : [];
        if (!cancel) {
          setEarnedBadges(earnedArr);
          setConquistasReal(earnedArr.length);
        }
      } catch {
        if (!cancel) {
          setEarnedBadges([]);
          setConquistasReal(0);
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [token, isOwn, data?.escolinha?.usuarioId]);

  useEffect(() => {
    if (!token) return;

    const usuarioIdEnt = isOwn ? Storage.usuarioId : (data?.escolinha?.usuarioId ?? null);
    if (!usuarioIdEnt) return;

    let cancel = false;

    (async () => {
      try {
        const { data: resp } = await axios.get(
          `${API.BASE_URL}/api/conquistas/certificados/${encodeURIComponent(usuarioIdEnt)}`,
          { headers }
        );

        const items = Array.isArray(resp?.items) ? resp.items : [];
        if (!cancel) setCertificados(items);
      } catch {
        if (!cancel) setCertificados([]);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [token, isOwn, data?.escolinha?.usuarioId]);

  useEffect(() => {
    if (!token) return;

    function onFocus() {
      if (aba === "visao") setAtividades(null);
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [token, aba]);

  useEffect(() => {
    if (!Array.isArray(observados)) return;

    setObsDraft((prev) => {
      const next = { ...prev };

      for (const a of observados) {
        const key = String(a.observadoId ?? a.atletaId ?? a.id);
        if (!next[key]) {
          next[key] = {
            nota: typeof a.notaInterna === "string" ? a.notaInterna : "",
            alertar: !!a.alertarMudancas,
          };
        }
      }
      return next;
    });
  }, [observados]);

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await axios.get<PayloadEscola>(
          `${API.BASE_URL}/api/perfil/escola/${targetId}`,
          { headers }
        );
        if (!cancel) setData(resp.data);
      } catch (e) {
        console.error("PerfilEscola GET error:", e);
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

    let cancel = false;

    (async () => {
      try {
        const { data } = await axios.get(
          `${API.BASE_URL}/api/configuracoes-perfil/privacidade`,
          { headers }
        );

        if (cancel) return;

        setPrivacidade({
          perfilVisivel: data?.perfilVisivel ?? true,
          permitirMensagens: data?.permitirMensagens ?? true,
          mostrarEmail: data?.mostrarEmail ?? false,
        });
      } catch {
        if (cancel) return;

        setPrivacidade({
          perfilVisivel: true,
          permitirMensagens: true,
          mostrarEmail: false,
        });
      }
    })();

    return () => {
      cancel = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const cancel = { v: false };
    const targetUserForActivities =
      isOwn ? "me" : (data?.usuario?.id ?? data?.escolinha?.usuarioId ?? "");

    async function loadAtividadesIfNeeded() {
      if (aba !== "visao" || atividades != null || !targetUserForActivities)
        return;
      try {
        const { data: itens } = await axios.get<AtividadeRecente[]>(
          `${API.BASE_URL}/api/perfil/${targetUserForActivities}/atividades`,
          { headers }
        );
         if (!cancel.v) {
          const arr = Array.isArray(itens) ? itens : [];
          const seen = new Set<string>();

          const dedup = arr.filter((it: any) => {
            const key =
              (it.link && String(it.link).toLowerCase()) ||
              `${it.tipo}:${it.id}`.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          setAtividades(dedup);
        }
      } catch {
        if (!cancel.v) setAtividades([]);
      }
    }

    async function fetchVinculados() {
      const entidadeId = isOwn ? Storage.tipoUsuarioId : data?.escolinha?.id;
      if (!entidadeId) return;

      try {
        const { data: resp } = await axios.get<{ atletas: AtletaItem[] }>(
          `${API.BASE_URL}/api/gerenciar/atletas`,
          {
            headers,
            params: {
              vinculo: "escolinha",
              id: entidadeId,
              order: "pontuacao_desc",
            },
          }
        );

        const base = Array.isArray(resp?.atletas) ? resp.atletas : [];
        const comPontuacaoReal = await Promise.all(
          base.map(async (a) => {
            const uid = String(a.usuarioId || "").trim();
            const pts = uid ? await buscarPontuacaoRealDoUsuario(uid) : null;

            return {
              ...a,
              pontuacao: typeof pts === "number" ? pts : (a.pontuacao ?? null),
            };
          })
        );

        setVinculados(comPontuacaoReal);
      } catch {
        setVinculados([]);
      }
    }

    async function fetchObservados() {
      const tipoId = escolinhaId;
      if (!tipoId) return;

      try {
        const { data: lista } = await axios.get<AtletaItem[]>(
          `${API.BASE_URL}/api/observados`,
          {
            headers,
            params: {
              tipoUsuarioId: tipoId,
              incluirPontuacao: 1,
              incluirNotas: 1, 
            },
          }
        );

        const arr = Array.isArray(lista) ? lista : [];
        const normalizados = arr.map((a: any) => ({
          ...a,
          notaInterna: typeof a.notaInterna === "string" ? a.notaInterna : "",
          alertarMudancas: !!a.alertarMudancas,
          observadoId: a.observadoId ? String(a.observadoId) : undefined,
          atletaId: a.atletaId ? String(a.atletaId) : undefined,
        }));

        if (!cancel.v) setObservados(normalizados);
      } catch {
        if (!cancel.v) setObservados([]);
      }
    }

    async function fetchSolicitacoes() {
      try {
        const { data } = await axios.get<SolicitacaoItem[]>(
          `${API.BASE_URL}/api/solicitacoes-treino/recebidas`,
          { headers }
        );
        if (!cancel.v) setSolicitacoes(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Erro ao carregar solicitações recebidas:", e);
        if (!cancel.v) setSolicitacoes([]);
      }
    }

    if (aba === "visao") loadAtividadesIfNeeded();

    if (aba === "eventos" && eventos == null && !eventosLoading) {
      loadEventosEscolinha();
    }

    if (aba === "atletas") {
      if (subAba === "vinculados" && vinculados == null) fetchVinculados();
      if (subAba === "observados" && observados == null) fetchObservados();
      if (subAba === "solicitacoes" && solicitacoes == null)
        fetchSolicitacoes();
    }

    return () => {
      cancel.v = true;
    };
  }, [
    aba,
    subAba,
    token,
    isOwn,
    data?.usuario?.id,
    data?.escolinha?.id,
    escolinhaId,
    atividades,
    eventos,
    eventosLoading
  ]);

  async function loadProfessores() {
    if (!token) return;

    if (!entidadeUsuarioId) {
      setProfessores([]);
      return;
    }

    setProfessoresLoading(true);
    try {
      const res = await axios.get(`${API.BASE_URL}/api/gerenciar/professores`, {
        headers,
        params: {
          vinculo: "escolinha",
          id: entidadeUsuarioId, 
          limit: 200,
        },
      });

      let lista = (res.data?.professores || res.data || []) as any[];

      if (!lista.length && escolinhaId) {
        const { data } = await axios.get(`${API.BASE_URL}/api/professores`, {
          headers,
          params: {
            organizacaoId: escolinhaId,
            tipoUsuarioId: escolinhaId,
            escolinhaId: escolinhaId,
          },
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

  async function salvarObservado(a: AtletaItem) {
    if (!token) return;

    const key = String(a.observadoId ?? a.atletaId ?? a.id);
    const draft = obsDraft[key] ?? { nota: "", alertar: false };
    const idParaPatch = String(a.observadoId ?? a.atletaId ?? a.id);

    setObsSaving((p) => ({ ...p, [key]: true }));
    setObsMsg((p) => ({ ...p, [key]: "" }));

    try {
      await axios.patch(
        `${API.BASE_URL}/api/observados/${idParaPatch}`,
        {
          notaInterna: draft.nota,
          alertarMudancas: draft.alertar,
          tipo: "Escolinha",
          tipoUsuarioId: escolinhaId,
        },
        { headers }
      );

      setObservados((prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((x) => {
          const kx = String(x.observadoId ?? x.atletaId ?? x.id);
          if (kx !== key) return x;
          return { ...x, notaInterna: draft.nota, alertarMudancas: draft.alertar };
        });
      });

      setObsMsg((p) => ({ ...p, [key]: "Salvo com sucesso!" }));
    } catch (err: any) {
      setObsMsg((p) => ({
        ...p,
        [key]: err?.response?.data?.message ?? "Não foi possível salvar.",
      }));
    } finally {
      setObsSaving((p) => ({ ...p, [key]: false }));
    }
  }

  const TIMEZONE_BR = "America/Sao_Paulo";

  function getDiaBR(value?: string | null) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE_BR,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  function getNomePessoa(item?: any) {
    if (!item) return "";

    return String(
      item.nome ||
        item.nomePublico ||
        item.nomeDeUsuario ||
        item.email ||
        ""
    ).trim();
  }

  function getCriadorLabelFromCreator(resp?: any) {
    if (!resp) return "";

    return (
      getNomePessoa(resp.creator) ||
      getNomePessoa(resp.creator?.usuario) ||
      getNomePessoa(resp.usuario) ||
      getNomePessoa(resp)
    );
  }

  function getConvidadosLabelFromAula(aula?: any) {
    if (!aula) return "";

    const convidadosArray = Array.isArray(aula.convidados)
      ? aula.convidados
          .map((c: any) => {
            const nome =
              String(c.nome || "").trim() ||
              getNomePessoa(c.usuario) ||
              getNomePessoa(c.convidadoUsuario);

            const descricao = String(c.descricao || "").trim();

            if (!nome) return "";

            return descricao ? `${nome} — ${descricao}` : nome;
          })
          .filter(Boolean)
      : [];

    if (convidadosArray.length > 0) {
      return convidadosArray.join(" • ");
    }

    const convidadoUnico =
      String(aula.convidadoNome || "").trim() ||
      getNomePessoa(aula.convidadoUsuario);

    if (!convidadoUnico) return "";

    const descricao = String(aula.convidadoDescricao || "").trim();

    return descricao ? `${convidadoUnico} — ${descricao}` : convidadoUnico;
  }

  async function loadEventosEscolinha() {
    if (!token) return;
    if (eventosLoading) return;

    const escolaId =
      (isOwn ? Storage.tipoUsuarioId : data?.escolinha?.id) ?? null;

    const usuarioCreatorId =
      creatorUsuarioId ||
      data?.escolinha?.usuarioId ||
      entidadeUsuarioId ||
      Storage.usuarioId ||
      "";

    if (!escolaId && !usuarioCreatorId) {
      setEventos([]);
      return;
    }

    setEventosLoading(true);

    try {
      const requests: Promise<any>[] = [];

      if (escolaId) {
        requests.push(
          axios.get(`${API.BASE_URL}/api/eventos/escolas/${escolaId}`, {
            headers,
            params: {
              ownerTipo: "Escolinha",
              ownerId: escolaId,
            },
          })
        );
      }

      if (hasCreator && usuarioCreatorId) {
        requests.push(
          axios.get(
            `${API.BASE_URL}/api/creator/profile/${encodeURIComponent(
              usuarioCreatorId
            )}`
          )
        );
      }

      const results = await Promise.allSettled(requests);

      const eventosResp =
        results[0]?.status === "fulfilled" ? results[0].value.data : [];

      const creatorResp =
        hasCreator && results.length > 1 && results[1]?.status === "fulfilled"
          ? results[1].value.data
          : null;

      const arr =
        Array.isArray(eventosResp)
          ? eventosResp
          : Array.isArray(eventosResp?.items)
          ? eventosResp.items
          : Array.isArray(eventosResp?.eventos)
          ? eventosResp.eventos
          : [];

      const eventosNormais: EventoItem[] = (arr ?? []).map((e: any) => {
        const dt = e.dataEvento ?? e.data ?? e.inicio ?? null;

        return {
          id: String(e.id),
          titulo: String(e.titulo ?? e.nome ?? "Evento"),
          tipo: e.tipo ?? null,
          dataEvento: dt,
          inicio: e.inicio ?? null,
          cidade: e.cidade ?? null,
          estado: e.estado ?? null,
          endereco: e.endereco ?? null,
          descricao: e.descricao ?? null,
          status: e.status ?? null,
          origem: "EVENTO_ESCOLINHA",
          criadorLabel: data?.escolinha?.nome || data?.usuario?.nome || null,
          convidadosLabel: null,
        };
      });

      const criadorCreatorLabel =
      getCriadorLabelFromCreator(creatorResp) ||
      data?.escolinha?.nome ||
      data?.usuario?.nome ||
      "";

    const aulasAoVivoCreator: EventoItem[] = Array.isArray(
      creatorResp?.eventosAoVivo
    )
      ? creatorResp.eventosAoVivo.map((aula: any) => ({
          id: String(aula.id),
          titulo: String(aula.titulo ?? "Aula ao vivo"),
          tipo: "Aula ao vivo",
          dataEvento: String(aula.dataInicio ?? ""),
          inicio: String(aula.dataInicio ?? ""),
          cidade: null,
          estado: null,
          endereco: null,
          descricao: aula.descricao ?? null,
          status: aula.status ?? null,
          origem: "AULA_AO_VIVO_CREATOR",
          thumbUrl: aula.thumbUrl ?? null,
          totalParticipantes: aula.totalParticipantes ?? null,
          criadorLabel: criadorCreatorLabel,
          convidadosLabel: getConvidadosLabelFromAula(aula),
        }))
      : [];

      const hojeBR = getDiaBR(new Date().toISOString());

      const filtradosOrdenados = [...eventosNormais, ...aulasAoVivoCreator]
        .filter((e) => {
          const raw = e.dataEvento || e.inicio;
          const diaEventoBR = getDiaBR(raw);
          return !!diaEventoBR && diaEventoBR >= hojeBR;
        })
        .sort((a, b) => {
          const da = new Date(a.dataEvento || a.inicio || 0).getTime();
          const db = new Date(b.dataEvento || b.inicio || 0).getTime();
          return da - db;
        });

      setEventos(filtradosOrdenados);
    } catch (err) {
      console.error("Erro ao carregar eventos da escolinha:", err);
      setEventos([]);
    } finally {
      setEventosLoading(false);
    }
  }

  function invalidateAtividades() {
    setAtividades(null);
  }

  async function loadTurmas() {
    if (!token || !escolinhaId) return;
    setTurmasLoading(true);
    try {
      const { data } = await axios.get(`${API.BASE_URL}/api/turmas`, {
        headers,
        params: { ownerTipo: "Escolinha", ownerId: escolinhaId },
      });
      const arr = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
      setTurmas(
        (arr ?? []).map((t: any) => ({
          id: String(t.id),
          nome: String(t.nome ?? t.titulo ?? "Turma"),
          ownerTipo: t.ownerTipo ?? "Escolinha",
          ownerId: t.ownerId ?? escolinhaId,
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
  }, [aba, canEdit, escolinhaId, token, entidadeUsuarioId]);

  useEffect(() => {
    if (!token) return;

    const ownerId = (isOwn ? Storage.tipoUsuarioId : data?.escolinha?.id) ?? null;

    if (!ownerId) {
      setConquistasReal(0);
      return;
    }

    let cancel = false;

    (async () => {
      try {
        const { data: resp } = await axios.get(
          `${API.BASE_URL}/api/conquistas/count`,
          {
            headers,
            params: { ownerTipo: "Escolinha", ownerId },
          }
        );

        const count = Number(resp?.count ?? 0);
        if (!cancel) setConquistasReal(Number.isFinite(count) ? count : 0);
      } catch (e) {
        if (!cancel) setConquistasReal(0);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [token, isOwn, data?.escolinha?.id]);

  if (loading)
    return (
      <div className="text-center p-10 text-green-800">
        Carregando perfil...
      </div>
    );
  if (!data || !data.escolinha)
    return (
      <div className="text-center p-10 text-red-600">
        Escolinha não encontrada.
      </div>
    );

  const nome = data.escolinha.nome || data.usuario?.nome || "Escola";
  const headerFoto: string | undefined =
    (typeof data.escolinha.logo === "string" && data.escolinha.logo) ||
    (typeof data.usuario?.foto === "string" && data.usuario.foto) ||
    undefined;

  const perfilUsuarioId: string =
    (data.usuario && data.usuario.id) ||
    data.escolinha.usuarioId ||
    "";

  const localidade = data.escolinha.cidade
    ? `${data.escolinha.cidade}${
        data.escolinha.estado ? " - " + data.escolinha.estado : ""
      }`
    : undefined;

  const escolinhaIdStr = data.escolinha.id;
  const ownerIdDashboard = (isOwn ? Storage.tipoUsuarioId : data?.escolinha?.id) ?? data.escolinha.id;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <ProfileHeader
        nome={nome}
        time="Escola de Futebol"
        isOwnProfile={isOwn}
        foto={headerFoto}
        conquistasCount={conquistasReal}
        kpis={[
          { label: "Atletas", value: data.metrics.atletas ?? 0 },
          { label: "Treinos", value: data.metrics.treinosProgramados ?? 0 },
          { label: "Conquistas", value: conquistasReal },
        ]}
        perfilId={perfilUsuarioId}
        perfilTipoProp="escolinha"
        perfilTipoIdProp={data.escolinha.id}
        isVerified={(data as any)?.perfilVerificado}
        isPro={(data as any)?.isPro}
        hasCreator={hasCreator}
        creatorUsuarioId={creatorUsuarioId}
      />

      <div className="mt-4 px-3 sm:px-4">
        <div className="bg-white/90 rounded-xl p-1 border border-green-100">
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-1">
            {(canEdit
              ? [
                  { id: "visao", label: "Visão Geral" },
                  { id: "eventos", label: "Eventos" },
                  { id: "atletas", label: "Atletas" },
                  { id: "professores", label: "Professores" },
                  { id: "conquistas", label: "Conquistas" },
                  { id: "postagens", label: "Postagens" },
                ]
              : [
                  { id: "visao", label: "Visão Geral" },
                  { id: "eventos", label: "Eventos" },
                  { id: "conquistas", label: "Conquistas" },
                  { id: "postagens", label: "Postagens" },
                ]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  const next = t.id as Aba;
                  setAba(next);

                  if (next === "visao") {
                    invalidateAtividades();
                  }
                }}
                className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  aba === t.id ? "bg-green-600 text-white" : "text-green-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {aba === "visao" && (
        <div className="mt-4 px-3 sm:px-4 grid gap-4">
          <SectionCard title="Informações da Escola">
            <ul className="text-sm text-green-900/90 space-y-2">
              <li>
                <b>Nome:</b> {data.escolinha.nome}
              </li>
              <li>
                <b>Tipo:</b> Escola de Futebol
              </li>
              {localidade && (
                <li>
                  <b>Local:</b> {localidade}
                </li>
              )}
              {privacidade?.mostrarEmail ? (
                <li>
                  <b>Email:</b> {data.escolinha.email ?? data.usuario?.email ?? "Não informado"}
                </li>
              ) : null}

              {data.escolinha.siteOficial && (
                <li>
                  <b>Site:</b> {data.escolinha.siteOficial}
                </li>
              )}
              {(data.escolinha.telefone1 || data.escolinha.telefone2) && (
                <li>
                  <b>Telefones:</b>{" "}
                  {[data.escolinha.telefone1, data.escolinha.telefone2]
                    .filter(Boolean)
                    .join(" / ")}
                </li>
              )}
              {(data.escolinha.logradouro ||
                data.escolinha.bairro ||
                data.escolinha.cidade) && (
                <li>
                  <b>Endereço:</b>{" "}
                  {[
                    data.escolinha.logradouro,
                    data.escolinha.numero,
                    data.escolinha.complemento,
                    data.escolinha.bairro,
                    data.escolinha.cidade,
                    data.escolinha.estado,
                    data.escolinha.cep,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </li>
              )}
            </ul>
          </SectionCard>

          <SectionCard title="Dashboard da Escolinha">
            {ownerIdDashboard ? (
              <DashboardOrganizacao ownerTipo="Escolinha" ownerId={ownerIdDashboard} />
            ) : (
              <div className="text-sm text-green-900/70">Sem ID da escolinha para carregar o dashboard.</div>
            )}
          </SectionCard>

          {canEdit && (
            <SectionCard
              title="FootEra Formadores"
              right={
                FLAGS.FORMADORES_ENABLED ? (
                  <Link href="/formadores">
                    <button
                      className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-green-600 text-white"
                      onClick={() => {}}
                    >
                      <Shield className="w-4 h-4" />
                      Acessar Módulo Formadores
                    </button>
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-gray-300 text-gray-600 cursor-not-allowed"
                    onClick={() => toast.error("A página FootEra Formadores está em atualização no momento.")}
                  >
                    <Shield className="w-4 h-4" />
                    Módulo Formadores em manuntenção
                  </button>
                )
              }
            >
              <p className="text-sm text-green-900/90">
                Gerencie vínculos de formação de atletas e documentos para
                mecanismo de solidariedade.
              </p>
            </SectionCard>
          )}

          <SectionCard
            title="Treinos"
            right={
              <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                <Link
                  href="/treinos"
                  className="min-w-[92px] text-center text-sm font-semibold px-4 py-2 rounded-xl
                            border border-green-300 bg-white text-green-900
                            hover:bg-green-50 active:scale-[0.99] transition"
                >
                  Ver todos
                </Link>

                {canEdit && (
                  <>
                    <Link
                      href="/perfil/GerenciarProfessores"
                      className="min-w-[160px] text-center text-sm font-semibold px-4 py-2 rounded-xl
                                border border-green-300 bg-white text-green-900
                                hover:bg-green-50 active:scale-[0.99] transition
                                inline-flex items-center justify-center gap-2"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Gerenciar Professores
                    </Link>

                    <Link
                      href="/treinos/novo"
                      className="min-w-[150px] text-center text-sm font-semibold px-4 py-2 rounded-xl
                                bg-green-600 text-white
                                hover:bg-green-700 active:scale-[0.99] transition
                                inline-flex items-center justify-center gap-2"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Criar novo treino
                    </Link>
                  </>
                )}
              </div>
            }
          >
            <p className="text-sm text-green-900/90 mt-2">
              Crie treinos e agrupe seus atletas em <b>turmas</b>. Vincule cada
              turma a um professor para facilitar a condução do treino.
            </p>
          </SectionCard>

          <SectionCard title="Atividade Recente">
            {atividades && atividades.length > 0 ? (
              <ul className="space-y-3">
                {atividades.slice(0, 6).map((a) => {
                  const d = parseDateSafe(a);
                  const label = d ? d.toLocaleDateString("pt-BR") : "—";

                  const content = (
                    <div className="flex items-center gap-3">
                        {a.tipo === "Evento" ? (
                          <CalendarClock className="w-5 h-5 text-green-700" />
                        ) : a.tipo === "Treino" ? (
                          <Activity className="w-5 h-5 text-green-700" />
                        ) : a.tipo === "Desafio" ? (
                          <Trophy className="w-5 h-5 text-green-700" />
                        ) : a.tipo === "Metodologia" ? (
                          <BookOpen className="w-5 h-5 text-green-700" />
                        ) : a.tipo === "Vídeo" ? (
                          <CameraIcon className="w-5 h-5 text-green-700" />
                        ) : a.tipo === "Postagem" ? (
                          <FileText className="w-5 h-5 text-green-700" />
                        ) : (
                          <Activity className="w-5 h-5 text-green-700" />
                        )}

                        {a.imagemUrl ? (
                          <img
                            src={normalizeImg(a.imagemUrl) ?? undefined}
                            alt={a.titulo}
                            className="w-10 h-10 rounded-lg object-cover border border-green-100"
                          />
                        ) : null}

                        <div className="text-sm">
                        <div className="font-medium text-green-900">{a.titulo}</div>
                        <div className="text-xs text-green-900/70">
                          {d ? d.toLocaleString("pt-BR") : "Data não informada"}
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
          </SectionCard>
        </div>
      )}

      {aba === "eventos" && (
        <div className="mt-4 px-3 sm:px-4 grid gap-4">
          <SectionCard
            title="Eventos"
            right={
              <Link
                href={hasCreator ? "/creator/eventos" : `/eventos/escolas/${escolinhaIdStr}`}
                className="text-sm px-3 py-1 rounded-lg bg-green-100 text-green-900"
              >
                Ver todos
              </Link>
            }
          >
            <p className="text-sm text-green-900/80 mt-1">
              Crie e gerencie seus eventos, peneiras, amistosos e avaliações.
            </p>

            {isOwn && (
              <div className="mt-4">
                <Link
                  href={hasCreator ? "/creator/eventos/novo" : `/eventos/escolas/${escolinhaIdStr}/novo`}
                  className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 text-green-900 font-semibold px-3 sm:px-4 py-2"
                >
                  <span>+</span> Criar novo evento
                </Link>
              </div>
            )}

            <div className="mt-5">
              {eventosLoading ? (
                <div className="text-sm text-green-900/70">Carregando eventos…</div>
              ) : eventos && eventos.length > 0 ? (
                <ul className="grid grid-cols-1 gap-3">
                  {eventos
                    .slice()
                    .sort((a, b) => {
                      const da = new Date(a.dataEvento || a.inicio || 0).getTime();
                      const db = new Date(b.dataEvento || b.inicio || 0).getTime();
                      return da - db;
                    })
                    .slice(0, 8)
                    .map((e) => {
                      const dt = e.dataEvento || e.inicio || "";
                      const when = dt ? new Date(dt).toLocaleString() : "Data não informada";
                      const where = [e.endereco, e.cidade, e.estado].filter(Boolean).join(" • ");
                      const tipoLabel =
                        e.origem === "AULA_AO_VIVO_CREATOR"
                          ? "Aula ao vivo Creator"
                          : e.tipo;

                      const participantes =
                        e.origem === "AULA_AO_VIVO_CREATOR" &&
                        typeof e.totalParticipantes === "number"
                          ? `${e.totalParticipantes} participantes`
                          : "";

                      return (
                        <li
                          key={e.id}
                          className="flex items-center gap-3 rounded-xl border border-green-100 p-3 hover:bg-green-50"
                        >
                          <CalendarClock className="w-5 h-5 text-green-700" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-green-900 truncate">
                              {e.titulo}
                            </div>
                            <div className="text-xs text-green-900/70">
                              {[tipoLabel, when, where, participantes].filter(Boolean).join(" • ")}
                            </div>
                            {e.criadorLabel ? (
                              <div className="mt-1 text-xs text-green-900/80">
                                <b>Criador:</b> {e.criadorLabel}
                              </div>
                            ) : null}

                            {e.convidadosLabel ? (
                              <div className="mt-1 text-xs text-green-900/80">
                                <b>Convidados:</b> {e.convidadosLabel}
                              </div>
                            ) : null}
                          </div>

                          <Link
                            href={
                              e.origem === "AULA_AO_VIVO_CREATOR"
                                ? `/learning/evento/${e.id}`
                                : `/eventos/${e.id}`
                            }
                            className="text-sm text-green-800 inline-flex items-center gap-1"
                          >
                            Abrir <ChevronRight className="w-4 h-4" />
                          </Link>

                          {isOwn && (
                            <Link
                              href={`/eventos/convocar?eventoId=${e.id}&returnTo=/perfil/escola`}
                              className="ml-2 text-xs px-2 py-1 rounded-md border border-green-200 text-green-900"
                            >
                              Convocar
                            </Link>
                          )}
                        </li>
                      );
                    })}
                </ul>
              ) : (
                <EmptyState text="Nenhum evento cadastrado ainda." />
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {aba === "atletas" && (
        <div className="mt-4 px-3 sm:px-4">
          <div className="bg-white/90 rounded-xl p-1 grid grid-cols-3 gap-1 border border-green-100">
            {[
              {
                id: "vinculados",
                label: "Vinculados",
                count: contagensAtletas.vinculados,
              },
              {
                id: "observados",
                label: "Observados",
                count: contagensAtletas.observados,
              },
              {
                id: "solicitacoes",
                label: "Solicitações",
                count: contagensAtletas.solicitacoes,
              },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSubAba(t.id as SubAba)}
                className={`py-2 rounded-lg text-sm font-medium ${
                  subAba === t.id ? "bg-green-600 text-white" : "text-green-900"
                }`}
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  <span>{t.label}</span>

                  <span
                    className={`inline-flex min-w-5 h-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                      subAba === t.id
                        ? "bg-white/20 text-white"
                        : "bg-green-100 text-green-900"
                    }`}
                  >
                    {t.count}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4">
            {subAba === "vinculados" && (
              <SectionCard
                title="Atletas Vinculados"
                right={
                  <Link
                    href="/perfil/GerenciarAtletas"
                    className="text-sm text-green-800"
                  >
                    Gerenciar Atletas
                  </Link>
                }
              >
                {vinculados && vinculados.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-3">
                    {vinculados.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-3 rounded-xl border border-green-100 p-3"
                      >
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
                              a.idade ? `${a.idade} anos` : null,
                              a.categoria,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        </div>
                        {typeof a.pontuacao === "number" && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">
                            {a.pontuacao} pts
                          </span>
                        )}
                        <Link
                          href={`/perfil/${a.usuarioId}`}
                          className="ml-2 text-sm text-green-800 inline-flex items-center gap-1"
                        >
                          Ver perfil <ChevronRight className="w-4 h-4" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div>
                    <EmptyState text="Nenhum atleta vinculado ainda" />
                    <div className="flex justify-center">
                      <Link href="/explorar">
                        <button className="px-3 sm:px-4 py-2 rounded-md border border-green-200 text-green-900">
                          Ver atletas
                        </button>
                      </Link>
                    </div>
                  </div>
                )}
              </SectionCard>
            )}

            {subAba === "observados" && (
              <SectionCard
                title="Atletas Observados"
                right={
                  <Link
                    href="/explorar"
                    className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-amber-500 text-white"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Descobrir novos atletas
                  </Link>
                }
              >
                {observados && observados.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-3">
                    {observados.map((a) => {
                      const key = String(a.observadoId ?? a.atletaId ?? a.id);
                      const draft = obsDraft[key] ?? { nota: "", alertar: false };
                      const saving = !!obsSaving[key];
                      const msg = obsMsg[key];

                      return (
                        <li
                          key={key}
                          className="rounded-2xl border border-green-100 p-3 bg-white"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar foto={a.foto ?? null} alt={a.nome} className="w-10 h-10" />

                            <div className="flex-1">
                              <div className="text-sm font-medium text-green-900">{a.nome}</div>
                              <div className="text-xs text-green-900/70">
                                {[a.posicao ?? "-", a.idade ? `${a.idade} anos` : null, a.categoria]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </div>
                            </div>

                            <Link
                              href={`/perfil/${a.usuarioId}`}
                              className="text-sm text-green-800 inline-flex items-center gap-1"
                            >
                              Ver perfil <ChevronRight className="w-4 h-4" />
                            </Link>
                          </div>

                          <div className="mt-3">
                            <div className="text-xs font-semibold text-green-900 mb-1">
                              Nota interna
                            </div>

                            <input
                              value={draft.nota}
                              onChange={(e) =>
                                setObsDraft((p) => ({
                                  ...p,
                                  [key]: { ...draft, nota: e.target.value },
                                }))
                              }
                              className="w-full rounded-xl border border-green-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
                              placeholder="Escreva uma nota interna..."
                            />
                          </div>

                          <label className="mt-3 flex items-start gap-2 text-sm text-green-900">
                            <input
                              type="checkbox"
                              checked={draft.alertar}
                              onChange={(e) =>
                                setObsDraft((p) => ({
                                  ...p,
                                  [key]: { ...draft, alertar: e.target.checked },
                                }))
                              }
                              className="mt-1"
                            />
                            <span className="text-green-900/90">
                              Notificar mudanças (pontuação, posição, idade, novos treinos/desafios)
                            </span>
                          </label>

                          <div className="mt-3 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => salvarObservado(a)}
                              disabled={saving}
                              className={`px-4 py-2 rounded-xl text-white font-semibold text-sm ${
                                saving ? "bg-green-400" : "bg-green-600 hover:bg-green-700"
                              }`}
                            >
                              {saving ? "Salvando..." : "Salvar"}
                            </button>

                            {msg ? (
                              <div
                                className={`text-sm ${
                                  msg.toLowerCase().includes("sucesso")
                                    ? "text-green-700"
                                    : "text-red-600"
                                }`}
                              >
                                {msg}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div>
                    <EmptyState text="Você ainda não observa nenhum atleta" />
                    <div className="flex justify-center">
                      <Link href="/explorar">
                        <button className="px-3 sm:px-4 py-2 rounded-md border border-green-200 text-green-900">
                          Ver atletas observados
                        </button>
                      </Link>
                    </div>
                  </div>
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
                  <div className="space-y-3">
                    <ul className="grid grid-cols-1 gap-3">
                      {solicitacoes.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center gap-3 rounded-xl border border-green-100 p-3 hover:bg-green-50"
                        >
                          <Link
                            href={`/perfil/${s.remetenteId}`}
                            className="flex items-center gap-3 flex-1"
                          >
                            <Avatar
                              foto={s.remetente.foto ?? null}
                              alt={s.remetente.nomeDeUsuario}
                              className="w-10 h-10"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-green-900">
                                {s.remetente.nomeDeUsuario}
                              </div>
                              <div className="text-xs text-green-900/70">
                                {s.criadaEm
                                  ? new Date(
                                      s.criadaEm
                                    ).toLocaleString()
                                  : "—"}
                                {s.status ? ` • ${s.status}` : ""}
                              </div>
                              <div className="text-xs text-green-900/80">
                                quer treinar junto com você
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-green-800" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <EmptyState text="Nenhuma solicitação pendente de atletas" />
                )}
              </SectionCard>
            )}
          </div>
        </div>
      )}

      {aba === "conquistas" && (
        <div className="mt-4 px-3 sm:px-4 grid gap-4">
          <SectionCard
            title="Conquistas e Troféus"
            right={
              <Link href="/perfil/conquistas" className="text-sm text-green-800">
                Ver conquistas
              </Link>
            }
          >
            {earnedBadges.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {earnedBadges.slice(0, 4).map((item: any) => (
                  <div
                    key={item.id}
                    className="rounded-xl p-4 border border-green-100 text-center"
                  >
                    <Trophy className="mx-auto mb-2 text-green-800" />
                    <div className="text-sm font-medium text-green-900">
                      {item?.conquista?.titulo ?? "Conquista"}
                    </div>
                    <div className="text-xs text-green-900/70">
                      {item?.conquista?.descricao ?? ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="Nenhuma conquista registrada ainda." />
            )}
          </SectionCard>

          <SectionCard
            title="Certificados emitidos"
            right={
              <Link href="/perfil/conquistas" className="text-sm text-green-800">
                Ver certificados
              </Link>
            }
          >
            {certificados && certificados.length > 0 ? (
              <div className="text-green-900 font-medium">
                {certificados.length} certificado{certificados.length > 1 ? "s" : ""} emitido{certificados.length > 1 ? "s" : ""}
              </div>
            ) : (
              <EmptyState text="Nenhum certificado emitido ainda." />
            )}
          </SectionCard>
        </div>
      )}

      {aba === "postagens" && (
        <div className="mt-4 px-3 sm:px-4 grid gap-4">
          <SectionCard title="Postagens">
            <ProfilePostsSection usuarioId={perfilUsuarioId} />
          </SectionCard>
        </div>
      )}

      {aba === "professores" && canEdit && (
        <div className="mt-4 px-3 sm:px-4 grid gap-4">
          <SectionCard
            title="Professores da Escolinha"
            right={
              <Link href="/perfil/GerenciarProfessores">
                <button
                  className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white inline-flex items-center gap-1"
                  type="button"
                >
                  <PlusCircle className="w-4 h-4" />
                  Gerenciar professores
                </button>
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
                      <button
                        onClick={() => {
                          setProfessorSelecionado(String(p.id));
                          setTurmasOpen(true);
                        }}
                        className="text-sm px-3 py-1.5 rounded-md border border-green-200 text-green-900"
                      >
                        Administrar turmas
                      </button>
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
              <EmptyState text="Nenhum professor vinculado à escolinha." />
            )}
          </SectionCard>

          <SectionCard title="Turmas da Escolinha">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-green-900/80">
                Crie turmas e defina o professor responsável. Alunos vinculados
                à escolinha podem ser adicionados às turmas.
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
                              toast.success("Professores atualizados na turma!");
                            } catch (err) {
                              console.error(err);
                              toast.error("Não foi possível atualizar os professores.");
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
              <EmptyState text="Nenhuma turma cadastrada na escolinha." />
            )}
          </SectionCard>
        </div>
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
            escolinhaId
              ? { tipo: "Escolinha", id: escolinhaId }
              : undefined
          }
          professorId={professorSelecionado}
        />
      )}

      <div className="h-6" />
    </div>
  );
}