import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Volleyball, User, CirclePlus, House } from "lucide-react";
import axios from "axios";
import {
  Users,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  ArrowUpAZ,
  ArrowDownZA,
  Shield,
  Activity,
  Trophy,
  Loader2,
  X,
  CalendarClock,
  ListChecks,
  Send,
} from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

export type CategoriaBase =
  | "Sub-9"
  | "Sub-11"
  | "Sub-13"
  | "Sub-15"
  | "Sub-17"
  | "Sub-20"
  | "Livre";

export type Posicao =
  | "Goleiro"
  | "Zagueiro"
  | "Lateral"
  | "Volante"
  | "Meia"
  | "Atacante";

type AtletaMin = {
  id: string;
  usuarioId: string;
  nome: string;
  idade?: number | null;
  foto?: string | null;
  categoria?: CategoriaBase | null;
  posicao?: Posicao | null;
  pontuacao?: number | null;
  ativoRecentemente?: boolean;
};

type EstatisticasAtleta = {
  totalTreinosMes: number;
  concluidosMes: number;
  desafiosFeitosMes: number;
  mediaUltimas4Semanas: number;
  evolucaoSemanas: Array<{ semana: string; pontos: number }>;
};

type TreinoProgramadoMin = {
  id: string;
  titulo: string;
  categoria?: CategoriaBase | null;
  objetivo?: string | null;
  pontuacao?: number | null;
  expiraEm?: string | null;
  naoExpira?: boolean | null;
};

const getFoto = (f?: string | null) => {
  if (!f || f === "" || f === "null") return "/assets/usuarios/default-user.png";
  if (f.startsWith("http")) return f;
  return `${API.BASE_URL}/${f.replace(/^\/+/, "")}`;
};

const numberOrDash = (n?: number | null) => (typeof n === "number" ? n : "–");

const StatusBadge: React.FC<{ ativo?: boolean }> = ({ ativo }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
      ativo ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-600"
    }`}
  >
    <span className={`h-2 w-2 rounded-full ${ativo ? "bg-green-500" : "bg-zinc-400"}`} />
    {ativo ? "ativo" : "inativo"}
  </span>
);

const posicoesMap: Record<string, string> = {
  GOL: "Goleiro",
  LD: "Lateral Direito",
  ZD: "Zagueiro Direito",
  ZE: "Zagueiro Esquerdo",
  LE: "Lateral Esquerdo",
  VOL1: "Volante 1",
  VOL2: "Volante 2",
  MEI: "Meia",
  PD: "Ponta Direita",
  CA: "Centroavante",
  PE: "Ponta Esquerda",
};

// Conversão Categoria UI <-> API (Prisma enum: Sub9|Sub11|...|Livre)
const apiToUiCategoria = (c?: string | null): CategoriaBase | null => {
  if (!c) return null;
  if (c === "Livre") return "Livre";
  if (c.startsWith("Sub")) return c.replace("Sub", "Sub-") as CategoriaBase;
  return null;
};
const uiToApiCategoria = (c?: CategoriaBase | ""): string | undefined => {
  if (!c) return undefined;
  if (c === "Livre") return "Livre";
  return c.replace("Sub-", "Sub");
};

const GerenciarAtletas: React.FC = () => {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [tipo, setTipo] = useState<"Escola" | "Clube" | "Professor" | null>(null);
  const [entidadeUsuarioId, setEntidadeUsuarioId] = useState<string | null>(null); 
  const [atletas, setAtletas] = useState<AtletaMin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState<"" | CategoriaBase>("");
  const [posicao, setPosicao] = useState<"" | Posicao>("");
  const [status, setStatus] = useState<"" | "ativo" | "inativo">("");
  const [ordenacao, setOrdenacao] = useState<
    "pontuacao_desc" | "pontuacao_asc" | "nome_asc" | "nome_desc"
  >("pontuacao_desc");

  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});
  const [focado, setFocado] = useState<AtletaMin | null>(null);

  // Stats
  const [stats, setStats] = useState<EstatisticasAtleta | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollingStatsRef = useRef<NodeJS.Timeout | null>(null);

  const [abrirDesignar, setAbrirDesignar] = useState(false);
  const [treinosDisponiveis, setTreinosDisponiveis] = useState<TreinoProgramadoMin[]>([]);
  const [treinoSelecionado, setTreinoSelecionado] = useState<string>("");
  const [objetivo, setObjetivo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [alcance, setAlcance] = useState<"todos" | "categoria" | "selecionados">("todos");
  const [categoriaFiltroDesignacao, setCategoriaFiltroDesignacao] = useState<"" | CategoriaBase>("");
  const [salvandoDesignacao, setSalvandoDesignacao] = useState(false);

  const tipoParaVinculo = (t: "Escola" | "Clube" | "Professor") =>
    t === "Escola" ? "escolinha" : t.toLowerCase();

  const descobrirPerfil = async () => {
    try {
      const { data } = await axios.get(`${API.BASE_URL}/api/perfil/me`, { headers });

      const perfilTipo: string = data?.tipo;
      const normalizado =
        perfilTipo === "Escolinha" ? "Escola" :
        perfilTipo === "Clube" ? "Clube" :
        perfilTipo === "Professor" ? "Professor" : null;

      if (!normalizado) throw new Error("Perfil institucional inválido para Gerenciar Atletas.");

      setTipo(normalizado);
      setEntidadeUsuarioId(data?.usuario?.id || Storage.tipoUsuarioId || Storage.usuarioId || null);
    } catch (e: any) {
      setTipo(null);
      setEntidadeUsuarioId(null);
      setError(e?.response?.data?.message || e?.message || "Não foi possível identificar o perfil");
    }
  };

  const carregarAtletas = async () => {
    if (!tipo || !entidadeUsuarioId) return;
    try {
      setError(null);
      setLoading(true);

      const params: any = {
        vinculo: tipoParaVinculo(tipo),
        id: entidadeUsuarioId,
        order: ordenacao,
      };
      if (q.trim()) params.search = q.trim();
      if (categoria) params.categoria = uiToApiCategoria(categoria);
      if (posicao) params.posicao = posicao;
      if (status) params.status = status;

      const { data } = await axios.get(`${API.BASE_URL}/api/gerenciar/atletas`, { headers, params });
      const lista = (data?.atletas || []) as any[];

      const normalizados: AtletaMin[] = lista.map((a) => ({
        id: a.id,
        usuarioId: a.usuarioId,
        nome: a.nome,
        idade: a.idade ?? null,
        foto: a.foto ?? null,
        posicao: a.posicao ?? null,
        categoria: apiToUiCategoria(a.categoria),
        pontuacao: a.pontuacao ?? null,
        ativoRecentemente: !!a.ativoRecentemente,
      }));

      setAtletas(normalizados);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Falha ao carregar atletas");
    } finally {
      setLoading(false);
    }
  };

  const carregarTreinos = async () => {
    if (!tipo || !entidadeUsuarioId) return;
    try {
      const params = { criador: tipoParaVinculo(tipo), id: entidadeUsuarioId };
      const res = await axios.get(`${API.BASE_URL}/api/gerenciar/treinosprogramados`, { headers, params });
      const items = (res.data?.items ?? res.data ?? []) as any[];
      setTreinosDisponiveis(
        items.map((t) => ({
          id: t.id,
          titulo: t.titulo ?? t.nome ?? "Treino",
          objetivo: t.objetivo ?? null,
          pontuacao: t.pontuacao ?? null,
          categoria: apiToUiCategoria(t.categoria),
          expiraEm: t.expiraEm ?? null,
          naoExpira: !!t.naoExpira,
        }))
      );
    } catch (_) {
      setTreinosDisponiveis([]);
    }
  };

  const carregarStatsAtleta = async (atletaUsuarioId: string) => {
    setStatsLoading(true);
    try {
      const res = await axios.get(`${API.BASE_URL}/api/gerenciar/atletas/${atletaUsuarioId}/pontuacao`, { headers });
      const s: EstatisticasAtleta = {
        totalTreinosMes: res.data?.totalTreinosMes ?? 0,
        concluidosMes: res.data?.concluidosMes ?? 0,
        desafiosFeitosMes: res.data?.desafiosFeitosMes ?? 0,
        mediaUltimas4Semanas: res.data?.mediaUltimas4Semanas ?? 0,
        evolucaoSemanas: res.data?.evolucaoSemanas ?? [
          { semana: "S-3", pontos: 0 },
          { semana: "S-2", pontos: 0 },
          { semana: "S-1", pontos: 0 },
          { semana: "S", pontos: 0 },
        ],
      };
      setStats(s);
    } catch (_) {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    descobrirPerfil();
    }, [token]);

  useEffect(() => {
    if (!tipo || !entidadeUsuarioId) return;
    carregarAtletas();
    carregarTreinos();

    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => {
      carregarAtletas();
    }, 30000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [tipo, entidadeUsuarioId]);

  useEffect(() => {
    if (!tipo || !entidadeUsuarioId) return;
    carregarAtletas();
  }, [q, categoria, posicao, status, ordenacao]);

  const filtrados = useMemo(() => atletas, [atletas]);

  const metricas = useMemo(() => {
    const total = filtrados.length || 0;
    const soma = filtrados.reduce((acc, a) => acc + (a.pontuacao ?? 0), 0);
    const mediaPont = total ? Math.round((soma / total) * 10) / 10 : 0;
    const ativos = filtrados.filter((a) => a.ativoRecentemente).length;
    return { total, mediaPont, ativos };
  }, [filtrados]);

  const toggleSelecionado = (id: string) => setSelecionados((prev) => ({ ...prev, [id]: !prev[id] }));
  const limparSelecao = () => setSelecionados({});

  const abrirDetalhe = (a: AtletaMin) => {
    setFocado(a);
  };

  // Carrega (e faz polling) das stats enquanto houver atleta focado
  useEffect(() => {
    if (!focado) {
      setStats(null);
      if (pollingStatsRef.current) clearInterval(pollingStatsRef.current);
      return;
    }
    const uid = focado.usuarioId || focado.id;
    carregarStatsAtleta(uid);

    if (pollingStatsRef.current) clearInterval(pollingStatsRef.current);
    pollingStatsRef.current = setInterval(() => {
      carregarStatsAtleta(uid);
    }, 15000);

    return () => {
      if (pollingStatsRef.current) clearInterval(pollingStatsRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focado?.usuarioId, focado?.id]);

  // ===== Designar treino =====
  const idsDestino = useMemo(() => {
    if (alcance === "todos") return filtrados.map((a) => a.usuarioId || a.id);
    if (alcance === "categoria" && categoriaFiltroDesignacao)
      return filtrados.filter((a) => a.categoria === categoriaFiltroDesignacao).map((a) => a.usuarioId || a.id);
    return Object.keys(selecionados).filter((k) => selecionados[k]);
  }, [alcance, filtrados, selecionados, categoriaFiltroDesignacao]);

  // 👉 leva os ids pré-selecionados para /treinos/novo (novoTreino.tsx usa sessionStorage: "novoTreinoState")
  const irCriarTreinoComPreselecionados = () => {
    try {
      const prev = JSON.parse(sessionStorage.getItem("novoTreinoState") || "{}");
      const next = {
        ...prev,
        atletasSelecionados: Array.from(new Set(idsDestino.length ? idsDestino : filtrados.map((a) => a.usuarioId || a.id))),
      };
      sessionStorage.setItem("novoTreinoState", JSON.stringify(next));
    } catch {}
    window.location.href = "/treinos/novo";
  };

  const enviarDesignacao = async () => {
    if (!treinoSelecionado) return alert("Selecione um treino");
    if (idsDestino.length === 0) return alert("Nenhum atleta selecionado para designação");

    setSalvandoDesignacao(true);
    try {
      const payload = {
        treinoProgramadoId: treinoSelecionado,
        objetivo: objetivo || undefined,
        prazo: prazo || undefined,
        destinatarios: idsDestino,
        origem: tipo ? (tipoParaVinculo(tipo) as "escolinha" | "clube" | "professor") : "escolinha",
      };
      await axios.post(`${API.BASE_URL}/api/gerenciar/treinosprogramados/convocar`, payload, { headers });
      alert("Treino designado com sucesso! Os atletas serão notificados.");
      setAbrirDesignar(false);
      setTreinoSelecionado("");
      setObjetivo("");
      setPrazo("");
      setAlcance("todos");
      setCategoriaFiltroDesignacao("");
      limparSelecao();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Falha ao designar treino");
    } finally {
      setSalvandoDesignacao(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-600/10 p-3 text-emerald-700">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">{tipo ?? "Institucional"} · Gerenciar Atletas</h1>
            <p className="text-sm text-zinc-500">Acompanhe e organize seus atletas vinculados na FootEra.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAbrirDesignar(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-white shadow hover:bg-emerald-700"
          >
            <ListChecks className="h-4 w-4" /> Designar treino
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome"
              className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
            />
          </div>
        </div>
        <div className="md:col-span-3">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as any)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Categoria (todas)</option>
            {["Sub-9", "Sub-11", "Sub-13", "Sub-15", "Sub-17", "Sub-20", "Livre"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <select
            value={posicao}
            onChange={(e) => setPosicao(e.target.value as any)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Posição (todas)</option>
            {Object.entries(posicoesMap).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Status</option>
            <option value="ativo">Ativo recentemente</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 text-zinc-600">
            <Shield className="h-4 w-4" /> Atletas vinculados
          </div>
          <div className="mt-2 text-2xl font-semibold">{metricas.total}</div>
          <div className="text-xs text-zinc-500">Total filtrado nesta visão</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 text-zinc-600">
            <Activity className="h-4 w-4" /> Ativos recentemente
          </div>
          <div className="mt-2 text-2xl font-semibold">{metricas.ativos}</div>
          <div className="text-xs text-zinc-500">Baseado em última atividade</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 text-zinc-600">
            <Trophy className="h-4 w-4" /> Média de pontuação
          </div>
          <div className="mt-2 text-2xl font-semibold">{metricas.mediaPont}</div>
          <div className="text-xs text-zinc-500">Pontuação FootEra</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 xl:col-span-8">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <Filter className="h-4 w-4" /> {filtrados.length} resultado(s)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOrdenacao((o) => (o === "pontuacao_desc" ? "pontuacao_asc" : "pontuacao_desc"))}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                {ordenacao.includes("pontuacao") ? (
                  ordenacao === "pontuacao_desc" ? (
                    <ArrowDownZA className="h-4 w-4" />
                  ) : (
                    <ArrowUpAZ className="h-4 w-4" />
                  )
                ) : (
                  <ArrowDownZA className="h-4 w-4" />
                )}
                Pontuação
              </button>
              <button
                onClick={() => setOrdenacao((o) => (o === "nome_asc" || o === "pontuacao_desc" ? "nome_desc" : "nome_asc"))}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                <ArrowDownZA className="h-4 w-4" /> Nome
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <table className="min-w-full table-fixed">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="w-12 p-3">Sel.</th>
                  <th className="w-16 p-3">Foto</th>
                  <th className="p-3">Nome</th>
                  <th className="w-24 p-3">Categoria</th>
                  <th className="w-24 p-3">Posição</th>
                  <th className="w-24 p-3">Idade</th>
                  <th className="w-28 p-3">Pontuação</th>
                  <th className="w-28 p-3">Status</th>
                  <th className="w-10 p-3">Ver</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-zinc-600">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-red-600">{error}</td>
                  </tr>
                ) : filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-zinc-500">Nenhum atleta encontrado com os filtros aplicados.</td>
                  </tr>
                ) : (
                  filtrados.map((a) => (
                    <tr key={a.id} className="border-t border-zinc-100">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={!!selecionados[a.usuarioId || a.id]}
                          onChange={() => toggleSelecionado(a.usuarioId || a.id)}
                          className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="p-3">
                        <img src={getFoto(a.foto)} alt={a.nome} className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow" />
                      </td>
                      <td className="truncate p-3">
                        <div className="font-medium text-zinc-900">{a.nome}</div>
                        <div className="text-xs text-zinc-500">ID: {a.usuarioId || a.id}</div>
                      </td>
                      <td className="p-3 text-sm text-zinc-700">{a.categoria ?? "–"}</td>
                      <td className="p-3 text-sm text-zinc-700">{a.posicao ?? "–"}</td>
                      <td className="p-3 text-sm text-zinc-700">{numberOrDash(a.idade)}</td>
                      <td className="p-3 text-sm font-semibold text-zinc-900">{numberOrDash(a.pontuacao)}</td>
                      <td className="p-3 text-sm">
                        <StatusBadge ativo={a.ativoRecentemente} />
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => abrirDetalhe(a)}
                          className="rounded-lg border border-zinc-200 p-1.5 text-zinc-700 hover:bg-zinc-50"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <div className="text-zinc-500">
              {Object.values(selecionados).filter(Boolean).length} selecionado(s)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={limparSelecao}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
              >
                Limpar seleção
              </button>
              <button
                onClick={() => setAbrirDesignar(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700"
              >
                <ListChecks className="h-4 w-4" /> Designar treino aos selecionados
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 xl:col-span-4">
          <div className="rounded-2xl border border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-zinc-100 p-2 text-zinc-700">
                  <ChevronDown className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-900">Detalhes do atleta</div>
                  <div className="text-xs text-zinc-500">Perfil e desempenho</div>
                </div>
              </div>
              {focado && (
                <button onClick={() => setFocado(null)} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-50">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {!focado ? (
              <div className="p-6 text-center text-zinc-500">Selecione um atleta para ver o resumo do perfil.</div>
            ) : (
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <img src={getFoto(focado.foto)} alt={focado.nome} className="h-14 w-14 rounded-full object-cover" />
                  <div>
                    <div className="text-base font-semibold text-zinc-900">{focado.nome}</div>
                    <div className="text-xs text-zinc-500">{focado.posicao ?? "Posição –"} • {focado.categoria ?? "Categoria –"}</div>
                    <div className="mt-1 text-xs text-zinc-500">Pontuação: {numberOrDash(focado.pontuacao)}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <div className="text-xs text-zinc-500">Treinos (mês)</div>
                    <div className="text-lg font-semibold">
                      {statsLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : (stats?.totalTreinosMes ?? "–")}
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <div className="text-xs text-zinc-500">Concluídos</div>
                    <div className="text-lg font-semibold">
                      {statsLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : (stats?.concluidosMes ?? "–")}
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <div className="text-xs text-zinc-500">Desafios</div>
                    <div className="text-lg font-semibold">
                      {statsLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : (stats?.desafiosFeitosMes ?? "–")}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setSelecionados({ [focado.usuarioId || focado.id]: true });
                      setAbrirDesignar(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    <CalendarClock className="h-4 w-4" /> Designar treino a este atleta
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white">
            <div className="flex items-center gap-2 border-b border-zinc-100 p-4 text-sm font-semibold text-zinc-900">
              <Trophy className="h-4 w-4" /> Ranking interno (Pontuação)
            </div>
            <div className="p-3">
              {filtrados.length === 0 ? (
                <div className="p-4 text-center text-zinc-500">Sem dados para ranking.</div>
              ) : (
                <ul className="space-y-2">
                  {[...filtrados]
                    .sort((a, b) => (b.pontuacao ?? 0) - (a.pontuacao ?? 0))
                    .slice(0, 8)
                    .map((a, i) => (
                      <li key={a.id} className="flex items-center justify-between rounded-xl p-2 hover:bg-zinc-50">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-zinc-100">
                            <img src={getFoto(a.foto)} className="h-full w-full object-cover" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-zinc-900">{i + 1}. {a.nome}</div>
                            <div className="text-xs text-zinc-500">{a.posicao ?? "–"} • {a.categoria ?? "–"}</div>
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-zinc-900">{numberOrDash(a.pontuacao)}</div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {abrirDesignar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4">
              <div className="flex items-center gap-2 text-zinc-900">
                <ListChecks className="h-5 w-5" /> Designar treino programado
              </div>
              <button onClick={() => setAbrirDesignar(false)} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Treino</label>

                  {/* Se não houver treinos do perfil: sugere criar novo e leva os atletas pré-selecionados */}
                  {treinosDisponiveis.length === 0 ? (
                    <>
                      <select
                        disabled
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-400"
                      >
                        <option>Nenhum treino programado encontrado</option>
                      </select>

                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        <div className="font-medium">Você ainda não tem treinos programados.</div>
                        <div className="mt-1">
                          Crie um treino agora — já levaremos <b>{idsDestino.length}</b> atleta(s) selecionado(s) para a etapa 4.
                        </div>
                        <button
                          onClick={irCriarTreinoComPreselecionados}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700"
                        >
                          Criar treino em /treinos/novo
                        </button>
                      </div>
                    </>
                  ) : (
                    <select
                      value={treinoSelecionado}
                      onChange={(e) => setTreinoSelecionado(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Selecione um treino…</option>
                      {treinosDisponiveis.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.titulo}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Prazo (opcional)</label>
                  <input
                    type="date"
                    value={prazo}
                    onChange={(e) => setPrazo(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Objetivo (opcional)</label>
                  <input
                    value={objetivo}
                    onChange={(e) => setObjetivo(e.target.value)}
                    placeholder="Descreva objetivos, instruções ou metas específicas"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-zinc-200">
                <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 p-3 text-sm">
                  <span className="text-zinc-600">Alcance:</span>
                  <label className="inline-flex items-center gap-1">
                    <input type="radio" name="alcance" checked={alcance === "todos"} onChange={() => setAlcance("todos")} />
                    Todos os atletas filtrados
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input type="radio" name="alcance" checked={alcance === "categoria"} onChange={() => setAlcance("categoria")} />
                    Por categoria
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input type="radio" name="alcance" checked={alcance === "selecionados"} onChange={() => setAlcance("selecionados")} />
                    Apenas selecionados manualmente
                  </label>
                </div>

                {alcance === "categoria" && (
                  <div className="flex items-center gap-2 p-3">
                    <select
                      value={categoriaFiltroDesignacao}
                      onChange={(e) => setCategoriaFiltroDesignacao(e.target.value as any)}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Escolha a categoria…</option>
                      {["Sub-9", "Sub-11", "Sub-13", "Sub-15", "Sub-17", "Sub-20", "Livre"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="border-t border-zinc-100 p-3 text-sm text-zinc-600">
                  Destinatários: <strong>{idsDestino.length}</strong>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => setAbrirDesignar(false)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={enviarDesignacao}
                  disabled={salvandoDesignacao || treinosDisponiveis.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700 disabled:opacity-70"
                  title={treinosDisponiveis.length === 0 ? "Crie um treino primeiro" : "Designar treino"}
                >
                  {salvandoDesignacao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Designar treino
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed"><House /></Link>
        <Link href="/explorar"><Search /></Link>
        <Link href="/post"><CirclePlus /></Link>
        <Link href="/treinos"><Volleyball /></Link>
        <Link href="/perfil"><User /></Link>
      </nav>
    </div>
  );
};

export default GerenciarAtletas;
