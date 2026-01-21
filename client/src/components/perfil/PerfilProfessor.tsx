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
  usuarioId?: string | null;
  atletaId?: string | null;
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
};

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

export default function PerfilProfessor({ idDaUrl }: Props) {
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

  const qtdVinculados = vinculados?.length ?? 0;
  const qtdObservados = observados?.length ?? 0;

  const [orgsDisponiveis, setOrgsDisponiveis] = useState<Organizacao[]>([]);
  const [orgsVinculadas, setOrgsVinculadas] = useState<Organizacao[]>([]);
  const [orgSelecionada, setOrgSelecionada] = useState<string>("");
  const [treinosCriados, setTreinosCriados] = useState<TreinoCriado[] | null>(null);

  const [turmasOpen, setTurmasOpen] = useState(false);
  const [turmas, setTurmas] = useState<Turma[] | null>(null);
  const [turmasLoading, setTurmasLoading] = useState(false);

  const professorId = data?.professor?.id;

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

    const profId = data?.professor?.id ?? Storage.tipoUsuarioId ?? null;
    const usuarioCriou = data?.usuario?.id ?? Storage.usuarioId ?? null;

    const candidates = [
      { professorId: profId, order: "desc", limit: 6 },
      { criadoPorId: usuarioCriou, order: "desc", limit: 6 },
    ].filter((p) => Object.values(p)[0]);

    if (candidates.length === 0) return;

    let lista: any[] = [];
    for (const params of candidates) {
      try {
        const r = await axios.get(`${API.BASE_URL}/api/treinosprogramados`, { headers: h, params });
        const arr = Array.isArray(r.data) ? r.data : r.data?.items ?? r.data?.data ?? [];
        if (Array.isArray(arr) && arr.length) {
          lista = arr;
          break;
        }
      } catch {}
    }

    const parseDate = (x: any) =>
      x?.criadoEm || x?.createdAt || x?.dataCriacao || x?.created_at || new Date().toISOString();

    const parsed: TreinoCriado[] = (lista ?? []).map((t: any) => ({
      id: String(t.id),
      nome: String(t.nome ?? t.titulo ?? "Treino"),
      criadoEm: String(parseDate(t)),
      categoria: t.categoria ?? null,
      nivel: t.nivel ?? t.level ?? null,
      alunos: t._count?.atletas ?? t._count?.agendamentos ?? t.alunosCount ?? null,
    }));

    setTreinosCriados(parsed);
  }, [rawToken, data?.professor?.id, data?.usuario?.id, headers]);

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
      }

      const r = await axios.get(`${API.BASE_URL}/api/turmas`, { headers, params });
      const arr = Array.isArray(r.data) ? r.data : r.data?.items ?? r.data?.data ?? [];
      const parsed = parse(arr);
      const minhas = parsed.filter((t) => (t.professorIds ?? []).includes(String(professorId)));

      setTurmas(minhas);
    } catch (e) {
      console.error(e);
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
      pontuacao: x.pontuacao ?? null,
    }));

    const seen = new Set<string>();
    const unique = arr.filter((a: any) => {
      const key = String(a.usuarioId || a.atletaId || a.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setVinculados(unique);
  }, [rawToken, isOwn, data?.professor?.id, data?.usuario?.id]);

  useEffect(() => {
    if (!rawToken) return;
    const cancel = { v: false };

    async function fetchObservados() {
      const usuarioTarget = isOwn ? Storage.usuarioId : data?.usuario?.id;
      const tipoId = isOwn ? Storage.tipoUsuarioId : data?.professor?.id;
      const params: any = { incluirPontuacao: 1 };
      if (usuarioTarget) params.usuarioId = usuarioTarget;
      if (tipoId) params.tipoUsuarioId = tipoId;

      try {
        const { data: lista } = await axios.get<AtletaItem[]>(
          `${API.BASE_URL}/api/observados`,
          { headers, params }
        );
        if (!cancel.v) setObservados(Array.isArray(lista) ? lista : []);
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
    setOrgSelecionada(data?.professor?.escolinhaId ?? data?.professor?.clubeId ?? "");
  }, [data?.professor?.escolinhaId, data?.professor?.clubeId]);

  useEffect(() => {
    if (!rawToken || !professorId) return;

    const parseOrg = (x: any, tipoFallback?: "Escolinha" | "Clube"): Organizacao => ({
      id: String(x.id),
      usuarioId: x.usuarioId ?? null,
      nome: String(x.nome ?? x.titulo ?? "Organização"),
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

  async function salvarVinculo() {
    if (!rawToken || !professorId || !orgSelecionada) return;
    try {
      await axios.put(
        `${API.BASE_URL}/api/professores/${professorId}/vinculos`,
        { organizacaoId: orgSelecionada },
        { headers }
      );

      const org = orgsDisponiveis.find((o) => o.id === orgSelecionada);
      if (org) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                professor: {
                  ...prev.professor,
                  escolinhaId: org.tipo === "Escolinha" ? orgSelecionada : null,
                  clubeId: org.tipo === "Clube" ? orgSelecionada : null,
                },
              }
            : prev
        );
      }
      setTurmas(null);
      await reloadTurmas();
      alert("Vínculo atualizado!");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar vínculo.");
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
          <SectionCard
            title="Vínculo com Escolinha/Clube"
            right={
              canEdit ? (
                <button
                  onClick={salvarVinculo}
                  className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white"
                  disabled={!orgSelecionada}
                >
                  Salvar vínculo
                </button>
              ) : null
            }
          >
            {canEdit ? (
              <div className="grid gap-2">
                <label className="text-sm">Selecione a organização onde você trabalha</label>
                <select
                  className="border rounded px-3 py-2"
                  value={orgSelecionada}
                  onChange={(e) => setOrgSelecionada(e.target.value)}
                >
                  <option value="">— Nenhuma —</option>
                  {orgsDisponiveis.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome} ({o.tipo})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-green-900/70">
                  Esse vínculo permite participar de turmas com múltiplos professores.
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
              {data.professor.escola && (
                <li>
                  <b>Escola:</b> {data.professor.escola}
                </li>
              )}
              {data.professor.statusCref && (
                <li>
                  <b>Status do CREF:</b> {data.professor.statusCref}
                </li>
              )}
            </ul>
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
                      <div className="font-medium text-green-900">{t.nome}</div>
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
          <div className="bg-white/90 rounded-xl p-1 grid grid-cols-3 gap-1 border border-green-100">
            {[
              { id: "vinculados", label: `Vinculados (${qtdVinculados})` },
              { id: "observados", label: `Observados (${qtdObservados})` },
              { id: "solicitacoes", label: "Solicitações" },
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
                    <Link href="/perfil/GerenciarAtletas" className="text-sm text-green-800">
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
                      className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-amber-500 text-white"
                    >
                      <PlusCircle className="w-4 h-4" /> Descobrir novos atletas
                    </Link>
                  ) : null
                }
              >
                {observados && observados.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-3">
                    {observados.map((a) => (
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
                  <EmptyState text="Nenhum atleta observado" />
                )}
              </SectionCard>
            )}

            {subAba === "solicitacoes" && (
              <SectionCard
                title="Solicitações de Atletas"
                right={
                  <Link href="/notificacoes" className="text-sm text-green-800">
                    Abrir notificações
                  </Link>
                }
              >
                {solicitacoes && solicitacoes.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-3">
                    {solicitacoes.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center gap-3 rounded-xl border border-green-100 p-3 hover:bg-green-50"
                      >
                        <Link href={`/perfil/${s.remetenteId}`} className="flex items-center gap-3 flex-1">
                          <Avatar
                            foto={s.remetente.foto ?? null}
                            alt={s.remetente.nomeDeUsuario}
                            className="w-10 h-10"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-green-900">{s.remetente.nomeDeUsuario}</div>
                            <div className="text-xs text-green-900/70">
                              {s.criadaEm ? new Date(s.criadaEm).toLocaleString() : "—"}
                              {s.status ? ` • ${s.status}` : ""}
                            </div>
                            <div className="text-xs text-green-900/80">quer treinar junto com você</div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-green-800" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState text="Nenhuma solicitação pendente de atletas" />
                )}
              </SectionCard>
            )}
          </div>
        </div>
      )}

      {aba === "conquistas" && (
        <div className="mt-4 px-4 grid gap-4">
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