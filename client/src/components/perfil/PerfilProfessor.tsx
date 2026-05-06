import { useEffect, useMemo, useState, useCallback, ReactNode } from "react";
import axios from "axios";
import {
  CalendarClock,
  Activity,
  PlusCircle,
  ChevronRight,
  Trophy,
} from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import ProfileHeader from "../profile/ProfileHeader.js";
import { Link } from "wouter";
import Avatar from "../shared/Avatar.js";
import TurmasManager from "../turmas/TurmasManager.js";
import ProfilePostsSection from "../perfil/ProfilePostsSection.js";

const ACHIEVEMENTS: Record<
  string,
  { title: string; desc: string; tier?: "Bronze" | "Prata" | "Ouro" }
> = {
  primeiro_treino_programado: {
    title: "Primeiro Treino Programado",
    desc: "Criou 1 treino programado.",
    tier: "Bronze",
  },
  serie_de_treinos: {
    title: "Série de Treinos",
    desc: "Criou 5 treinos programados.",
    tier: "Bronze",
  },
  planejamento_solido: {
    title: "Planejamento Sólido",
    desc: "Criou 10 treinos programados.",
    tier: "Prata",
  },
  grupo_inicial: {
    title: "Grupo Inicial",
    desc: "Treina 5 atletas (vínculo).",
    tier: "Bronze",
  },
  organizador_de_grupo: {
    title: "Organizador de Desafios em Grupo",
    desc: "Criou pelo menos 1 desafio em grupo.",
    tier: "Bronze",
  },
};

type Organizacao = {
  id: string;
  usuarioId?: string | null;
  nome: string;
  tipo: "Escolinha" | "Clube";
};

type CertificadoResumo = {
  id: string;
  tituloMetodologia: string;
  emitidoEm: string;
  codigoValidacao: string;
  pdfUrl?: string | null;
};
type Props = { idDaUrl?: string };
type UsuarioMin = { id: string; nome: string; email: string; foto?: string | null };

type MetricsProf = {
  treinosProgramados: number;
  alunosRelacionados: number;
  conquistas?: number;
  conquistasUnlocked?: string[];
  gruposCriados?: number;
};

type PayloadProfessor = {
  tipo: "Professor";
  usuario: UsuarioMin | null;
  professor: {
    id: string;
    usuarioId?: string | null;
    nome: string;
    codigo?: string | null;
    cref?: string | null;
    areaFormacao: string;
    escola?: string | null;
    qualificacoes: string[];
    certificacoes: string[];
    fotoUrl?: string | null;
    statusCref?: string | null;
    clubeId?: string | null;
    escolinhaId?: string | null;
  };
  metrics: MetricsProf;
};

type AtletaItem = {
  id: string;
  observadoId?: string | null;
  usuarioId?: string | null;
  atletaId?: string | null;
  nome: string;
  foto?: string | null;
  posicao?: string | null;
  idade?: number | null;
  altura?: number | null;
  peso?: number | null;
  observadoEm?: string | null;
  categoria?: string | null;
  pontuacao?: number | null;
  notaInterna?: string | null;
  alertarMudancas?: boolean | null;
};

type SolicitacaoItem = {
  id: string;
  remetenteId: string;
  remetente: { id: string; usuarioId: string; nomeDeUsuario: string; foto: string | null };
  status?: "PENDENTE" | "APROVADO" | "REJEITADO";
  criadaEm?: string;
};

type AtividadeRecente = {
  id: string;
  tipo: "Treino" | "Desafio";
  nome: string;
  data: string;
  imagemUrl?: string | null;
  duracao?: string;
  pontuacao?: number;
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
  categoria?: string | null;
};

type TreinoCriado = {
  id: string;
  nome: string;
  criadoEm: string;
  categoria?: string | null;
  nivel?: string | null;
  alunos?: number | null;
  papel?: "Criador" | "Colaborador";
};

function pickPontuacao(raw: any): number | null {
  const candidates = [
    raw?.pontuacaoTotal,
    raw?.pontuacao,
    raw?.pontos,
    raw?.totalPontos,
    raw?.pontuacaoAtual,
    raw?.pontuacao_atual,

    raw?.atleta?.pontuacaoTotal,
    raw?.atleta?.pontuacao,
    raw?.atleta?.pontos,

    raw?.usuario?.pontuacaoTotal,
    raw?.usuario?.pontuacao,
    raw?.usuario?.pontos,
  ];

  for (const v of candidates) {
    const n = typeof v === "string" ? Number(v) : v;
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return null;
}

function pickPontuacaoFromPerfilPontuacaoEndpoint(raw: any): number | null {
  if (!raw) return null;

  // alguns backends já devolvem um "total"
  const totalDireto = pickPontuacao(raw);
  if (typeof totalDireto === "number") return totalDireto;

  // igual o ProfileHeader: performance + disciplina + responsabilidade
  const performance = Number(raw?.performance) || 0;
  const disciplina = Number(raw?.disciplina) || 0;
  const responsabilidade = Number(raw?.responsabilidade) || 0;

  const total = performance + disciplina + responsabilidade;
  return Number.isFinite(total) ? total : null;
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center text-green-900/70 py-8">
      <Activity className="mx-auto mb-2 opacity-70" />
      <p>{text}</p>
    </div>
  );
}

export default function PerfilProfessor({
  idDaUrl,
  hasCreator = false,
  creatorUsuarioId = null,
}: {
  idDaUrl?: string;
  hasCreator?: boolean;
  creatorUsuarioId?: string | null;
}) {
  const [data, setData] = useState<PayloadProfessor | null>(null);
  const [loading, setLoading] = useState(true);

  type Aba = "visao" | "atletas" | "conquistas" | "postagens";
  const [aba, setAba] = useState<Aba>("visao");

  type SubAba = "vinculados" | "observados" | "solicitacoes";
  const [subAba, setSubAba] = useState<SubAba>("vinculados");

  const [vinculados, setVinculados] = useState<AtletaItem[] | null>(null);
  const [observados, setObservados] = useState<AtletaItem[] | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoItem[] | null>(null);
  const [atividades, setAtividades] = useState<AtividadeRecente[] | null>(null);
  const [privacidade, setPrivacidade] = useState<{ mostrarEmail: boolean } | null>(null);
  const [notaPorAtleta, setNotaPorAtleta] = useState<Record<string, string>>({});
  const [notificarPorAtleta, setNotificarPorAtleta] = useState<Record<string, boolean>>({});
  const [salvandoNota, setSalvandoNota] = useState<Record<string, boolean>>({});

  const qtdVinculados = vinculados?.length ?? 0;
  const qtdObservados = observados?.length ?? 0;

  const [orgsDisponiveis, setOrgsDisponiveis] = useState<Organizacao[]>([]);
  const [orgsVinculadas, setOrgsVinculadas] = useState<Organizacao[]>([]);
  const [escolinhaSelecionada, setEscolinhaSelecionada] = useState<string>("");
  const [clubeSelecionado, setClubeSelecionado] = useState<string>("");

  const [buscaEscolinha, setBuscaEscolinha] = useState("");
  const [buscaClube, setBuscaClube] = useState("");
  const [treinosCriados, setTreinosCriados] = useState<TreinoCriado[] | null>(null);

  const [turmasOpen, setTurmasOpen] = useState(false);
  const [turmas, setTurmas] = useState<Turma[] | null>(null);
  const [turmasLoading, setTurmasLoading] = useState(false);
  const [certificados, setCertificados] = useState<CertificadoResumo[] | null>(null);

  const professorId = data?.professor?.id;
  const escolinhasDisponiveis = orgsDisponiveis.filter(
    (o) =>
      o.tipo === "Escolinha" &&
      o.nome.toLowerCase().includes(buscaEscolinha.toLowerCase())
  );

  const clubesDisponiveis = orgsDisponiveis.filter(
    (o) =>
      o.tipo === "Clube" &&
      o.nome.toLowerCase().includes(buscaClube.toLowerCase())
  );

  const escolinhaAtual = orgsDisponiveis.find((o) => o.id === escolinhaSelecionada);
  const clubeAtual = orgsDisponiveis.find((o) => o.id === clubeSelecionado);
  const escolinhaVinculada =
    orgsDisponiveis.find((o) => o.id === data?.professor?.escolinhaId) ||
    orgsVinculadas.find((o) => o.tipo === "Escolinha") ||
    null;

  const clubeVinculado =
    orgsDisponiveis.find((o) => o.id === data?.professor?.clubeId) ||
    orgsVinculadas.find((o) => o.tipo === "Clube") ||
    null;

  const abas = [
    { id: "visao", label: "Visão Geral" },
    { id: "atletas", label: "Atletas" },
    { id: "conquistas", label: "Conquistas" },
    { id: "postagens", label: "Postagens" },
  ] as const;

  const owner = useMemo(() => {
    const { clubeId, escolinhaId } = data?.professor ?? {};
    if (clubeId) return { tipo: "Clube" as const, id: clubeId };
    if (escolinhaId) return { tipo: "Escolinha" as const, id: escolinhaId };
    return undefined;
  }, [data?.professor?.clubeId, data?.professor?.escolinhaId]);

  const rawToken =
    Storage.token || localStorage.getItem("token") || sessionStorage.getItem("token") || "";

  const headers = useMemo(
    () => (rawToken ? { Authorization: `Bearer ${rawToken}` } : undefined),
    [rawToken]
  );

  const usuarioIdStorage =
    Storage.usuarioId || localStorage.getItem("usuarioId") || sessionStorage.getItem("usuarioId") || "";

  const tipoUsuarioIdStorage =
    Storage.tipoUsuarioId ||
    localStorage.getItem("tipoUsuarioId") ||
    sessionStorage.getItem("tipoUsuarioId") ||
    "";

  const isOwn = !idDaUrl || idDaUrl === usuarioIdStorage;
  const targetId = isOwn ? (tipoUsuarioIdStorage || "me") : (idDaUrl as string);

  useEffect(() => {
    setVinculados(null);
    setObservados(null);
    setSolicitacoes(null);
    setTreinosCriados(null);
    setAtividades(null);
    setTurmas(null);
  }, [targetId]);

  const canEdit = useMemo(() => {
    const tipoLocal = (
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario") ??
      ""
    ).toLowerCase();
    return isOwn || tipoLocal === "admin";
  }, [isOwn]);

  useEffect(() => {
    let cancel = false;
    const fetchPerfil = async () => {
      setLoading(true);
      if (!rawToken) {
        if (!cancel) setLoading(false);
        return;
      }
      try {
        const url = `${API.BASE_URL}/api/perfil/professor/${targetId}`;
        const r = await axios.get<PayloadProfessor>(url, { headers });
        if (!cancel) setData(r.data);
      } catch {
        if (!cancel) setData(null);
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    fetchPerfil();
    return () => {
      cancel = true;
    };
  }, [targetId, rawToken, headers]);

  const fetchTreinosCriados = useCallback(async () => {
    if (!rawToken) return;

    const h = { Authorization: `Bearer ${rawToken}` };
    const profId = String(data?.professor?.id ?? "").trim();
    if (!profId) return;

    try {
      const r = await axios.get(`${API.BASE_URL}/api/treinosprogramados`, {
        headers: h,
        params: {
          professorId: profId,
          incluirColabs: "1",
          order: "desc",
          limit: 6,
        },
      });

      const lista = Array.isArray(r.data) ? r.data : r.data?.items ?? r.data?.data ?? [];

      const parseDate = (x: any) =>
        x?.criadoEm || x?.createdAt || x?.dataCriacao || x?.created_at || new Date().toISOString();

      setTreinosCriados(
        (lista ?? []).map((t: any) => {
          const criadoPorMim =
            String(t?.professorId ?? "") === profId ||
            String(t?.criadorProfessorId ?? t?.criadorProfessor?.id ?? "") === profId;

          const souColab =
            Array.isArray(t?.professores) &&
            t.professores.some((p: any) => String(p?.professorId ?? p?.professor?.id ?? "") === profId);

          const papel: "Criador" | "Colaborador" =
            criadoPorMim ? "Criador" : souColab ? "Colaborador" : "Colaborador";

          return {
            id: String(t.id),
            nome: String(t.nome ?? t.titulo ?? "Treino"),
            criadoEm: String(parseDate(t)),
            categoria: t.categoria ?? null,
            nivel: t.nivel ?? t.level ?? null,
            alunos: t._count?.atletas ?? t._count?.agendamentos ?? t.alunosCount ?? null,
            papel,
          };
        })
      );

    } catch {
      setTreinosCriados([]);
    }
  }, [rawToken, data?.professor?.id]);

  const reloadTurmas = useCallback(async () => {
    if (!rawToken || !professorId) return;

    setTurmasLoading(true);

    const parse = (arr: any[]): Turma[] =>
      (arr ?? []).map((t: any) => {
        const professorIds = Array.isArray(t.professorIds)
          ? t.professorIds.map(String)
          : [];

        const professorNomes = Array.isArray(t.professorNomes)
          ? t.professorNomes
          : Array.isArray(t.professores)
          ? t.professores.map((p: any) => p?.nome ?? p?.usuario?.nome).filter(Boolean)
          : [];

        return {
          id: String(t.id),
          nome: String(t.nome ?? t.titulo ?? "Turma"),
          ownerTipo: t.ownerTipo ?? t.tipoOwner ?? null,
          ownerId: t.ownerId ?? t.clubeId ?? t.escolinhaId ?? null,
          professorIds,
          professorNomes,
          professorNome:
            t.professorNome ??
            (professorNomes.length ? professorNomes.join(", ") : null) ??
            null,
          alunosCount: t.alunosCount ?? t._count?.alunos ?? t.qtdAlunos ?? null,
          categoria: t.categoria ?? null,
        };
      });

    try {
      const params: any = {};

      if (owner?.tipo && owner?.id) {
        params.ownerTipo = owner.tipo;
        params.ownerId = owner.id;
      } else {
        params.professorId = professorId;
      }

      const r = await axios.get(`${API.BASE_URL}/api/turmas`, {
        headers,
        params,
      });

      const arr = Array.isArray(r.data) ? r.data : r.data?.items ?? r.data?.data ?? [];
      const parsed = parse(arr);

      const minhas = parsed.filter((t) =>
        (t.professorIds ?? []).includes(String(professorId))
      );

      setTurmas(owner?.tipo && owner?.id ? minhas : parsed);
    } catch (e: any) {
      console.error("[PerfilProfessor.reloadTurmas]", e?.response?.data || e);
      setTurmas([]);
    } finally {
      setTurmasLoading(false);
    }
  }, [rawToken, professorId, headers, owner?.tipo, owner?.id]);
  
  useEffect(() => {
    let cancel = false;

    async function fetchPrivacidade() {
      if (!rawToken) return;

      try {
        const r = await axios.get(`${API.BASE_URL}/api/configuracoes-perfil/privacidade`, {
          headers: { Authorization: `Bearer ${rawToken}` },
        });

        const mostrarEmail = !!(r.data?.mostrarEmail ?? r.data?.email ?? r.data?.mostrar_email);
        if (!cancel) setPrivacidade({ mostrarEmail });
      } catch {
        if (!cancel) setPrivacidade({ mostrarEmail: false });
      }
    }

    fetchPrivacidade();
    return () => {
      cancel = true;
    };
  }, [rawToken]);

  useEffect(() => {
    if (professorId && turmas == null) reloadTurmas();
  }, [professorId, turmas, reloadTurmas]);

  useEffect(() => {
    if (aba !== "atletas" || subAba !== "solicitacoes" || !rawToken) return;
    (async () => {
      try {
        const { data } = await axios.get<SolicitacaoItem[]>(
          `${API.BASE_URL}/api/solicitacoes-treino`,
          { headers }
        );
        setSolicitacoes(
          (Array.isArray(data) ? data : []).filter((s) => (s.status ?? "PENDENTE") === "PENDENTE")
        );
      } catch {
        setSolicitacoes([]);
      }
    })();
  }, [aba, subAba, rawToken, headers]);

  const fetchVinculados = useCallback(async () => {
    if (!rawToken) return;
    const h = { Authorization: `Bearer ${rawToken}` };

    const tipoId = isOwn ? Storage.tipoUsuarioId : data?.professor?.id;
    const usuarioTarget = isOwn ? Storage.usuarioId : data?.usuario?.id;

    const candidates = [
      { professorId: tipoId, incluirPontuacao: 1 },
      { tipoUsuarioId: tipoId, incluirPontuacao: 1 },
      { usuarioId: usuarioTarget, incluirPontuacao: 1 },
    ].filter((p) => Object.values(p)[0]);

    if (candidates.length === 0) return;

    let lista: any[] = [];
    for (const params of candidates) {
      try {
        const r = await axios.get(`${API.BASE_URL}/api/treinos/atletas-vinculados`, {
          headers: h,
          params,
        });
        const arr = Array.isArray(r.data) ? r.data : r.data?.items ?? r.data?.data ?? [];
        if (Array.isArray(arr) && arr.length) {
          lista = arr;
          break;
        }
      } catch {}
    }

    const arr = (lista || []).map((x: any) => ({
      id: x.id ?? x.atletaId ?? x.usuarioId,
      usuarioId: x.usuarioId ?? x.userId ?? x.usuario?.id ?? null,
      atletaId: x.atletaId ?? x.atleta?.id ?? null,
      nome: x.nome ?? x.usuario?.nome ?? x.atleta?.nome ?? x.nomeDeUsuario ?? "Atleta",
      foto: x.foto ?? x.usuario?.foto ?? x.atleta?.foto ?? null,
      posicao: x.posicao ?? x.atleta?.posicao ?? null,
      idade: x.idade ?? x.atleta?.idade ?? null,
      categoria: x.categoria ?? x.atleta?.categoria ?? null,
      pontuacao: pickPontuacao(x),
    }));

    const seen = new Set<string>();
    const unique = arr.filter((a: any) => {
      const key = String(a.usuarioId || a.atletaId || a.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ✅ agora traz a pontuação real do mesmo jeito que o ProfileHeader
    const enriched = await Promise.all(
      unique.map(async (a) => {
        const uid = String(a.usuarioId || a.id || "").trim();
        if (!uid) return a;

        try {
          const r2 = await axios.get(
            `${API.BASE_URL}/api/perfil/${encodeURIComponent(uid)}/pontuacao`,
            { headers: h }
          );

          const total = pickPontuacaoFromPerfilPontuacaoEndpoint(r2.data);
          return {
            ...a,
            pontuacao: typeof total === "number" ? total : a.pontuacao ?? null,
          };
        } catch {
          return a;
        }
      })
    );

    setVinculados(enriched);

  }, [rawToken, isOwn, data?.professor?.id, data?.usuario?.id]);

  useEffect(() => {
    if (!rawToken) return;
    const cancel = { v: false };

    async function fetchObservados() {
      const usuarioTarget = isOwn ? Storage.usuarioId : data?.usuario?.id;
      const tipoId = isOwn ? Storage.tipoUsuarioId : data?.professor?.id;
      const params: any = { incluirPontuacao: 1, incluirNotas: 1 };
      if (usuarioTarget) params.usuarioId = usuarioTarget;
      if (tipoId) params.tipoUsuarioId = tipoId;

      try {
        const { data: lista } = await axios.get<AtletaItem[]>(
          `${API.BASE_URL}/api/observados`,
          { headers, params }
        );
        const arr = Array.isArray(lista) ? lista : [];
        if (!cancel.v) {
          setObservados(arr);
          setNotaPorAtleta((prev) => {
            const next = { ...prev };
            for (const a of arr) {
              const key = String(a.usuarioId ?? a.atletaId ?? a.id);
              if (next[key] === undefined) next[key] = a.notaInterna ?? "";
            }
            return next;
          });
          setNotificarPorAtleta((prev) => {
            const next = { ...prev };
            for (const a of arr) {
              const key = String(a.usuarioId ?? a.atletaId ?? a.id);
              if (next[key] === undefined) next[key] = !!a.alertarMudancas;
            }
            return next;
          });
        }
      } catch {
        if (!cancel.v) setObservados([]);
      }
    }

    if (aba === "visao") {
      if (treinosCriados == null) fetchTreinosCriados();
      if (vinculados == null) fetchVinculados();
    }
    if (aba === "atletas") {
      if (subAba === "vinculados" && vinculados == null) fetchVinculados();
      if (subAba === "observados" && observados == null) fetchObservados();
    }

    return () => {
      cancel.v = true;
    };
  }, [
    aba,
    subAba,
    rawToken,
    targetId,
    data?.usuario?.id,
    data?.professor?.id,
    vinculados,
    treinosCriados,
    fetchVinculados,
    fetchTreinosCriados,
    headers,
    isOwn,
  ]);

  useEffect(() => {
    if (!rawToken) return;

    let cancel = false;

    const usuarioIdPerfil = isOwn
      ? usuarioIdStorage
      : data?.usuario?.id ?? null;

    if (!usuarioIdPerfil) {
      setCertificados([]);
      return;
    }

    (async () => {
      try {
        const { data: resp } = await axios.get(
          `${API.BASE_URL}/api/conquistas/certificados/${encodeURIComponent(usuarioIdPerfil)}`,
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
  }, [rawToken, isOwn, usuarioIdStorage, data?.usuario?.id, headers]);

  useEffect(() => {
    if (!rawToken || aba !== "conquistas") return;

    (async () => {
      try {
        const r = await axios.get(`${API.BASE_URL}/api/conquistas/certificados`, {
          headers,
          params: isOwn ? undefined : { usuarioId: idDaUrl },
        });

        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        setCertificados(items);
      } catch {
        setCertificados([]);
      }
    })();
  }, [rawToken, aba, headers, isOwn, idDaUrl]);

  useEffect(() => {
    setEscolinhaSelecionada(data?.professor?.escolinhaId ?? "");
    setClubeSelecionado(data?.professor?.clubeId ?? "");
  }, [data?.professor?.escolinhaId, data?.professor?.clubeId]);

  useEffect(() => {
    if (!rawToken || !professorId) return;

    const parseOrg = (x: any, tipoFallback?: "Escolinha" | "Clube"): Organizacao => ({
      id: String(x.id),
      usuarioId: x.usuarioId ?? x.usuario?.id ?? x.userId ?? x.usuario_id ?? null,
      nome: String(x.nome ?? x.nomeEscolinha ?? x.nomeClube ?? x.titulo ?? "Organização"),
      tipo: (x.tipo ?? x.kind ?? tipoFallback ?? "Escolinha") as "Escolinha" | "Clube",
    });

    (async () => {
      try {
        const [disp, vinc] = await Promise.all([
          axios.get(`${API.BASE_URL}/api/organizacoes/disponiveis`, { headers }),
          axios.get(`${API.BASE_URL}/api/professores/${professorId}/vinculos`, { headers }),
        ]);
        const d1 = Array.isArray(disp.data) ? disp.data : disp.data?.items ?? disp.data?.data ?? [];
        const v1 = Array.isArray(vinc.data) ? vinc.data : vinc.data?.items ?? vinc.data?.data ?? [];
        setOrgsDisponiveis(d1.map((o: any) => parseOrg(o)));
        setOrgsVinculadas(v1.map((o: any) => parseOrg(o)));
      } catch {
        try {
          const [es, cl] = await Promise.all([
            axios.get(`${API.BASE_URL}/api/escolinhas`, { headers }),
            axios.get(`${API.BASE_URL}/api/clubes`, { headers }),
          ]);
          const esA = Array.isArray(es.data) ? es.data : es.data?.items ?? es.data?.data ?? [];
          const clA = Array.isArray(cl.data) ? cl.data : cl.data?.items ?? cl.data?.data ?? [];
          setOrgsDisponiveis([
            ...esA.map((x: any) => parseOrg(x, "Escolinha")),
            ...clA.map((x: any) => parseOrg(x, "Clube")),
          ]);
        } catch {
          setOrgsDisponiveis([]);
        }
        setOrgsVinculadas([]);
      }
    })();
  }, [rawToken, headers, professorId]);

  if (loading) return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  if (!data || !data.professor)
    return <div className="text-center p-10 text-red-600">Professor não encontrado.</div>;

  const nome = data.usuario?.nome || data.professor.nome;
  const emailDoPerfil = data.usuario?.email ? String(data.usuario.email) : "";
  const headerFoto: string | undefined =
    (typeof data.usuario?.foto === "string" && data.usuario.foto) ||
    (typeof data.professor.fotoUrl === "string" && data.professor.fotoUrl) ||
    undefined;

  const time = data.professor.escola || "Professor";

  const unlockedIds = data.metrics.conquistasUnlocked ?? [];
  const extraFromGrupos = (data.metrics.gruposCriados ?? 0) > 0 ? ["organizador_de_grupo"] : [];
  const unlockedFinal = Array.from(new Set([...unlockedIds, ...extraFromGrupos]));
  const conquistasCount = unlockedFinal.length;
  const alunosCount = vinculados?.length ?? data.metrics.alunosRelacionados ?? 0;
  const usuarioPerfilId = data.usuario?.id || data.professor.usuarioId || usuarioIdStorage || "";
  const professorTipoId = data.professor.id;

  async function salvarNotaInterna(alvoUsuarioId: string) {
    if (!rawToken) return;

    const key = String(alvoUsuarioId);
    const item = (observados ?? []).find((x) => String(x.usuarioId ?? x.atletaId ?? x.id) === key);
    const idParaPatch =
      String(item?.observadoId ?? "").trim() ||
      String(item?.atletaId ?? "").trim() ||
      key;
    const ownerId =
      Storage.tipoUsuarioId ||
      localStorage.getItem("tipoUsuarioId") ||
      sessionStorage.getItem("tipoUsuarioId") ||
      "";

    const tipo =
      localStorage.getItem("tipoUsuario") ||
      sessionStorage.getItem("tipoUsuario") ||
      "professor";

    try {
      setSalvandoNota((p) => ({ ...p, [key]: true }));

      await axios.patch(
        `${API.BASE_URL}/api/observados/${encodeURIComponent(idParaPatch)}`, 
        {
          ownerId,              
          tipo,                 
          notaInterna: notaPorAtleta[key] ?? "",
          alertarMudancas: !!notificarPorAtleta[key],
        },
        { headers }
      );

      setObservados((prev) =>
        (prev ?? []).map((a) => {
          const k = String(a.usuarioId ?? a.atletaId ?? a.id);
          if (k !== key) return a;
          return {
            ...a,
            notaInterna: notaPorAtleta[key] ?? "",
            alertarMudancas: !!notificarPorAtleta[key],
          };
        })
      );
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar nota interna.");
    } finally {
      setSalvandoNota((p) => ({ ...p, [key]: false }));
    }
  }

  async function enviarSolicitacaoOrganizacao(
    org: Organizacao | undefined,
    vinculoAtualId: string | null | undefined,
    tipo: "escolinha" | "clube"
  ) {
    if (!rawToken || !professorId) return;

    try {
      if (!org) {
        alert(`Selecione uma ${tipo === "escolinha" ? "escolinha" : "clube"}.`);
        return;
      }

      if (org.id === vinculoAtualId) {
        alert(`Você já está vinculado a esse ${tipo === "escolinha" ? "escolinha" : "clube"}.`);
        return;
      }

      if (!org.usuarioId) {
        alert(`${org.nome} não possui usuário vinculado para receber solicitação.`);
        return;
      }

      await axios.post(
        `${API.BASE_URL}/api/solicitacoes-treino`,
        { destinatarioId: org.usuarioId },
        { headers }
      );

      alert(`Solicitação enviada para ${org.nome}. Aguarde a confirmação.`);
    } catch (e: any) {
      console.error("[PerfilProfessor.enviarSolicitacaoOrganizacao]", e?.response?.data || e);
      alert(e?.response?.data?.message || "Erro ao enviar solicitação de vínculo.");
    }
  }

  const handleCloseTurmas = () => {
    setTurmasOpen(false);
    reloadTurmas();
  };

  return (
    <div className="max-w-md mx-auto">
      <ProfileHeader
        nome={nome}
        time={time}
        isOwnProfile={isOwn}
        foto={headerFoto}
        perfilId={usuarioPerfilId}
        perfilTipoProp="professor"
        perfilTipoIdProp={professorTipoId}
        kpis={[
          { label: "Alunos", value: alunosCount },
          { label: "Treinos", value: data.metrics.treinosProgramados ?? 0 },
          { label: "Conquistas", value: conquistasCount },
        ]}
        isVerified={(data as any)?.perfilVerificado}
        isPro={(data as any)?.isPro}
        hasCreator={hasCreator}
        creatorUsuarioId={creatorUsuarioId}
      />

      <div className="mt-4 px-4">
        <div className="bg-white/90 rounded-xl p-1 grid grid-cols-4 gap-1 border border-green-100">
          {abas.map((t) => (
            <button
              key={t.id}
              onClick={() => setAba(t.id as any)}
              className={`py-2 rounded-lg text-sm font-medium ${
                aba === t.id ? "bg-green-600 text-white" : "text-green-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {aba === "visao" && (
        <div className="mt-4 px-4 grid gap-4">

          <SectionCard title="Informações do Professor">
            <ul className="text-sm text-green-900/90 space-y-2">
              <li>
                <b>Nome:</b> {data.professor.nome}
              </li>
              {privacidade?.mostrarEmail && emailDoPerfil ? (
                <li>
                  <b>Email:</b> {emailDoPerfil}
                </li>
              ) : null}

              {data.professor.codigo && (
                <li>
                  <b>Código:</b> {data.professor.codigo}
                </li>
              )}
              {data.professor.cref && (
                <li>
                  <b>CREF:</b> {data.professor.cref}
                </li>
              )}
              <li>
                <b>Área de formação:</b> {data.professor.areaFormacao}
              </li>
              {escolinhaVinculada && (
                <li>
                  <b>Escolinha vinculada:</b> {escolinhaVinculada.nome}
                </li>
              )}

              {clubeVinculado && (
                <li>
                  <b>Clube vinculado:</b> {clubeVinculado.nome}
                </li>
              )}
              {data.professor.statusCref && (
                <li>
                  <b>Status do CREF:</b> {data.professor.statusCref}
                </li>
              )}
            </ul>
          </SectionCard>
          <SectionCard
            title="Vínculos com Escolinha e Clube"
            right={null}
          >
            {canEdit ? (
              <div className="grid gap-5">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-green-900">Escolinha</label>

                  {escolinhaAtual && (
                    <button
                      type="button"
                      onClick={() => setEscolinhaSelecionada("")}
                      className="w-fit text-xs rounded-full border px-2 py-1 bg-white hover:bg-gray-50"
                    >
                      {escolinhaAtual.nome} <span className="ml-1 text-gray-500">×</span>
                    </button>
                  )}

                  <input
                    className="border rounded px-3 py-2"
                    placeholder="Pesquisar escolinha pelo nome..."
                    value={buscaEscolinha}
                    onChange={(e) => setBuscaEscolinha(e.target.value)}
                  />

                  <div className="border rounded p-2 bg-white max-h-44 overflow-auto">
                    <label className="flex items-center gap-2 py-1 cursor-pointer">
                      <input
                        type="radio"
                        name="escolinhaVinculoProfessor"
                        checked={!escolinhaSelecionada}
                        onChange={() => setEscolinhaSelecionada("")}
                      />
                      <span className="text-sm">Nenhuma</span>
                    </label>

                    {escolinhasDisponiveis.map((o) => (
                      <label key={o.id} className="flex items-center gap-2 py-1 cursor-pointer">
                        <input
                          type="radio"
                          name="escolinhaVinculoProfessor"
                          checked={escolinhaSelecionada === o.id}
                          onChange={() => setEscolinhaSelecionada(o.id)}
                        />
                        <span className="text-sm">{o.nome}</span>
                      </label>
                    ))}
                  </div>
                  <button
                      type="button"
                      onClick={() => enviarSolicitacaoOrganizacao(escolinhaAtual, data?.professor?.escolinhaId, "escolinha")}
                      className="text-sm px-3 py-2 rounded-md bg-green-600 text-white"
                    >
                      Solicitar vínculo com escolinha
                    </button>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-green-900">Clube</label>

                  {clubeAtual && (
                    <button
                      type="button"
                      onClick={() => setClubeSelecionado("")}
                      className="w-fit text-xs rounded-full border px-2 py-1 bg-white hover:bg-gray-50"
                    >
                      {clubeAtual.nome} <span className="ml-1 text-gray-500">×</span>
                    </button>
                  )}

                  <input
                    className="border rounded px-3 py-2"
                    placeholder="Pesquisar clube pelo nome..."
                    value={buscaClube}
                    onChange={(e) => setBuscaClube(e.target.value)}
                  />

                  <div className="border rounded p-2 bg-white max-h-44 overflow-auto">
                    <label className="flex items-center gap-2 py-1 cursor-pointer">
                      <input
                        type="radio"
                        name="clubeVinculoProfessor"
                        checked={!clubeSelecionado}
                        onChange={() => setClubeSelecionado("")}
                      />
                      <span className="text-sm">Nenhum</span>
                    </label>

                    {clubesDisponiveis.map((o) => (
                      <label key={o.id} className="flex items-center gap-2 py-1 cursor-pointer">
                        <input
                          type="radio"
                          name="clubeVinculoProfessor"
                          checked={clubeSelecionado === o.id}
                          onChange={() => setClubeSelecionado(o.id)}
                        />
                        <span className="text-sm">{o.nome}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => enviarSolicitacaoOrganizacao(clubeAtual, data?.professor?.clubeId, "clube")}
                    className="text-sm px-3 py-2 rounded-md bg-green-600 text-white"
                  >
                    Solicitar vínculo com clube
                  </button>
                </div>

                <p className="text-xs text-green-900/70">
                  Cada vínculo envia uma solicitação para a organização aceitar. Depois de aceito,
                  ele ficará salvo no seu perfil.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {orgsVinculadas.length ? (
                  orgsVinculadas.map((o) => (
                    <Link
                      key={o.id}
                      href={`/perfil/${o.usuarioId ?? o.id}`}
                      className="flex items-center justify-between rounded-xl border border-green-100 p-3 hover:bg-green-50"
                    >
                      <div>
                        <div className="text-sm font-medium text-green-900">{o.nome}</div>
                        <div className="text-xs text-green-900/70">{o.tipo}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-green-800" />
                    </Link>
                  ))
                ) : (
                  <div className="text-sm text-green-900/70">Nenhum vínculo público.</div>
                )}
              </div>
            )}
          </SectionCard>

          {!!data.professor.qualificacoes?.length && (
            <SectionCard title="Qualificações">
              <div className="flex flex-wrap gap-2">
                {data.professor.qualificacoes.map((q, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-full bg-green-100 text-green-900 text-xs"
                  >
                    {q}
                  </span>
                ))}
              </div>
            </SectionCard>
          )}

          {!!data.professor.certificacoes?.length && (
            <SectionCard title="Certificações">
              <div className="flex flex-wrap gap-2">
                {data.professor.certificacoes.map((c, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </SectionCard>
          )}

          {canEdit && (
            <SectionCard
              title="Treinos"
              right={
                <div className="flex gap-2">
                  <Link
                    href="/treinos"
                    className="text-sm px-3 py-1.5 rounded-md border border-green-200 text-green-900"
                  >
                    Ver todos
                  </Link>
                  <Link
                    href="/treinos/novo"
                    className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white inline-flex items-center gap-1"
                  >
                    <PlusCircle className="w-4 h-4" /> Criar novo treino
                  </Link>
                  <button
                    onClick={() => setTurmasOpen(true)}
                    className="text-sm px-3 py-1.5 rounded-md border border-green-200 text-green-900"
                  >
                    Administrar turmas
                  </button>
                </div>
              }
            >
              <p className="text-sm text-green-900/90">Crie e gerencie treinos para seus atletas.</p>
            </SectionCard>
          )}

          <SectionCard
            title="Turmas em que você participa"
            right={
              canEdit ? (
                <button
                  onClick={() => setTurmasOpen(true)}
                  className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white inline-flex items-center gap-1"
                >
                  <PlusCircle className="w-4 h-4" /> Administrar
                </button>
              ) : null
            }
          >
            {turmasLoading ? (
              <div className="text-sm text-green-900/70">Carregando turmas…</div>
            ) : turmas && turmas.length > 0 ? (
              <ul className="grid grid-cols-1 gap-3">
                {turmas.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border border-green-100 p-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-green-900">{t.nome}</div>
                      <div className="text-xs text-green-900/70">
                        {t.categoria ? `Cat. ${t.categoria}` : "Sem categoria"}
                        {" • "}
                        {typeof t.alunosCount === "number" ? `${t.alunosCount} alunos` : "—"}
                      </div>
                      <div className="text-xs text-green-900/70 mt-0.5">
                        <b>Professores:</b>{" "}
                        {t.professorNome || (t.professorNomes?.length ? t.professorNomes.join(", ") : "—")}
                      </div>
                    </div>

                    {canEdit ? (
                      <button
                        onClick={() => setTurmasOpen(true)}
                        className="text-sm text-green-800"
                        title="Administrar turmas"
                      >
                        Administrar
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : canEdit ? (
              <div className="grid gap-3">
                <EmptyState text="Você ainda não participa de nenhuma turma" />
                <button
                  onClick={() => setTurmasOpen(true)}
                  className="px-4 py-2 rounded-md border border-green-200 text-green-900 inline-block"
                >
                  Abrir gerenciamento
                </button>
              </div>
            ) : (
              <div className="text-sm text-green-900/70">Nenhuma turma pública cadastrada.</div>
            )}
          </SectionCard>

          <SectionCard
            title="Treinos criados recentemente"
            right={
              canEdit ? (
                <Link href="/treinos" className="text-sm text-green-800">
                  Ver todos
                </Link>
              ) : data.professor?.id ? (
                <Link
                  href={`/treinos?professorId=${encodeURIComponent(data.professor.id)}`}
                  className="text-sm text-green-800"
                >
                  Ver todos
                </Link>
              ) : null
            }
          >
            {treinosCriados && treinosCriados.length > 0 ? (
              <ul className="space-y-3">
                {treinosCriados.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex items-center gap-3">
                    <CalendarClock className="w-5 h-5 text-green-700" />
                    <div className="text-sm">
                      <div className="font-medium text-green-900">
                        {t.nome}{" "}
                        <span
                          className={`text-xs ${
                            t.papel === "Criador" ? "text-green-700" : "text-slate-600"
                          }`}
                        >
                          ({t.papel})
                        </span>
                      </div>

                      <div className="text-xs text-green-900/70">
                        {new Date(t.criadoEm).toLocaleString()}
                        {t.categoria ? ` • Cat. ${t.categoria}` : ""}
                        {t.nivel ? ` • ${t.nivel}` : ""}
                        {typeof t.alunos === "number" ? ` • ${t.alunos} alunos` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState text="Nenhum treino criado recentemente" />
            )}
          </SectionCard>
        </div>
      )}

      {aba === "atletas" && (
        <div className="mt-4 px-4">
          <div className="bg-white/90 rounded-xl p-1 grid grid-cols-2 gap-1 border border-green-100">
            {[
              { id: "vinculados", label: `Vinculados (${qtdVinculados})` },
              { id: "observados", label: `Observados (${qtdObservados})` },
              
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSubAba(t.id as any)}
                className={`py-2 rounded-lg text-sm font-medium ${
                  subAba === t.id ? "bg-green-600 text-white" : "text-green-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4">
            {subAba === "vinculados" && (
              <SectionCard
                title={`Atletas Vinculados (${qtdVinculados})`}
                right={
                  canEdit ? (
                    <Link href="/perfil/GerenciarAtletas" className="text-md text-green-800">
                      Gerenciar Atletas
                    </Link>
                  ) : null
                }
              >
                {vinculados && vinculados.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-3">
                    {vinculados.map((a) => (
                      <li
                        key={a.usuarioId ?? a.atletaId ?? a.id}
                        className="flex items-center gap-3 rounded-xl border border-green-100 p-3"
                      >
                        <Avatar foto={a.foto ?? null} alt={a.nome} className="w-10 h-10" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-green-900">{a.nome}</div>
                          <div className="text-xs text-green-900/70">
                            {[
                              a.posicao,
                              a.idade ? `${a.idade} anos` : "",
                              a.categoria ? `Cat. ${a.categoria}` : "",
                              a.pontuacao != null ? `${a.pontuacao} pts` : "",
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        </div>
                        <Link
                          href={`/perfil/${a.usuarioId ?? a.atletaId ?? a.id}`}
                          className="text-sm text-green-800 inline-flex items-center gap-1"
                        >
                          Ver perfil <ChevronRight className="w-4 h-4" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="grid gap-3">
                    <EmptyState text="Nenhum atleta vinculado ainda" />
                    {canEdit ? (
                      <Link
                        href="/explorar"
                        className="px-4 py-2 rounded-md border border-green-200 text-green-900 inline-block"
                      >
                        Ver atletas
                      </Link>
                    ) : null}
                  </div>
                )}
              </SectionCard>
            )}

            {subAba === "observados" && (
              <SectionCard
                title={`Atletas Observados (${qtdObservados})`}
                right={
                  canEdit ? (
                    <Link
                      href="/explorar"
                      className="inline-flex items-center gap-2 text-md px-3 py-1.5 rounded-md text-green-800"
                    >
                     Descobrir novos atletas
                    </Link>
                  ) : null
                }
              >
                {observados && observados.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-3">
                    {observados.map((a) => {
                      const key = String(a.usuarioId ?? a.atletaId ?? a.id);

                      return (
                        <li
                          key={key}
                          className="rounded-xl border border-green-100 p-3"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar foto={a.foto ?? null} alt={a.nome} className="w-10 h-10" />

                            <div className="flex-1">
                              <div className="text-sm font-medium text-green-900">{a.nome}</div>
                              <div className="text-xs text-green-900/70">
                                {[
                                  a.posicao,
                                  a.idade ? `${a.idade} anos` : "",
                                  a.categoria ? `Cat. ${a.categoria}` : "",
                                  a.pontuacao != null ? `${a.pontuacao} pts` : "",
                                ]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </div>
                            </div>

                            <Link
                              href={`/perfil/${key}`}
                              className="text-sm text-green-800 inline-flex items-center gap-1"
                            >
                              Ver perfil <ChevronRight className="w-4 h-4" />
                            </Link>
                          </div>

                          {canEdit ? (
                            <div className="mt-3 w-full">
                              <div className="text-xs text-green-900/70 mb-1">Nota interna</div>

                              <textarea
                                className="w-full rounded-xl border border-green-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
                                placeholder="Digite uma nota interna..."
                                value={notaPorAtleta[key] ?? ""}
                                onChange={(e) => {
                                  setNotaPorAtleta((p) => ({ ...p, [key]: e.target.value }));
                                }}
                                rows={2}
                              />

                              <label className="mt-2 flex items-start gap-2 text-xs text-green-900/80">
                                <input
                                  type="checkbox"
                                  className="mt-0.5"
                                  checked={!!notificarPorAtleta[key]}
                                  onChange={(e) => {
                                    setNotificarPorAtleta((p) => ({ ...p, [key]: e.target.checked }));
                                  }}
                                />
                                <span>
                                  Notificar mudanças (pontuação, posição, idade, novos treinos/desafios)
                                </span>
                              </label>

                              <button
                                onClick={() => salvarNotaInterna(key)}
                                disabled={!!salvandoNota[key]}
                                className="mt-3 inline-flex items-center justify-center rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                              >
                                {salvandoNota[key] ? "Salvando..." : "Salvar"}
                              </button>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState text="Nenhum atleta observado" />
                )}
              </SectionCard>
            )}

          </div>
        </div>
      )}

      {aba === "conquistas" && (
        <div className="mt-4 px-4 grid gap-4">
          <SectionCard title="Certificados emitidos">
            {certificados && certificados.length > 0 ? (
              <div className="flex items-center justify-between">
                <div className="text-green-900 font-medium">
                  {certificados.length} certificado{certificados.length > 1 ? "s" : ""} emitido{certificados.length > 1 ? "s" : ""}
                </div>
                <Link href="/perfil/conquistas" className="text-sm text-green-800">
                  Ver certificados
                </Link>
              </div>
            ) : (
              <EmptyState text="Nenhum certificado emitido ainda." />
            )}
          </SectionCard>

          <SectionCard
            title="Conquistas e Troféus"
            right={
              <Link href="/perfil/conquistas" className="text-sm text-green-800">
                Ver conquistas
              </Link>
            }
          >
            {unlockedFinal.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {unlockedFinal.map((id) => {
                  const a = ACHIEVEMENTS[id] ?? { title: id, desc: "" };
                  return (
                    <div key={id} className="rounded-xl p-4 border border-green-100 text-center">
                      <Trophy className="mx-auto mb-2" />
                      <div className="text-sm font-medium text-green-900">{a.title}</div>
                      <div className="text-xs text-green-900/70">{a.desc}</div>
                      {a.tier && (
                        <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          {a.tier}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState text="Nenhuma conquista registrada ainda" />
            )}
          </SectionCard>
        </div>
      )}

      {aba === "postagens" && (
        <div className="mt-4 px-4 grid gap-4">
          <SectionCard title="Postagens">
            <ProfilePostsSection usuarioId={usuarioPerfilId} />
          </SectionCard>
        </div>
      )}

      <TurmasManager
        open={turmasOpen && canEdit}
        onClose={handleCloseTurmas}
        owner={owner}
        professorId={professorId} 
      />
      <div className="h-6" />
    </div>
  );
}