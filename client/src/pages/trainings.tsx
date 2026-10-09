// client/src/pages/training
import { useEffect, useMemo, useState, useContext } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Search, Dumbbell, Target, Layers, Zap, Timer, Medal, CalendarClock, ChevronDown
} from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { Card, CardContent } from "../components/ui/card.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import { Link, useLocation } from "wouter";
import { UserContext } from "../context/UserContext.js";

type TipoTreino = "Tecnico" | "Físico" | "Tatico" | "Mental" | null;
type TpExercicio = {
  id?: string;
  nome?: string | null;
  exercicio?: { nome?: string | null } | null;
  exercicioPersonalizado?: {
    nome?: string | null;
  } | null;
  exercicioTemporario?: {
    nome?: string | null;
  } | null;
  series?: number | null;
  repeticoes?: string | null;
};

type TreinoProgramado = {
  id: string;
  programadoId?: string | null;
  nome: string;
  descricao?: string | null;
  tipoTreino?: TipoTreino;
  duracao?: number | null;
  pontuacao?: number | null;
  dataAgendada?: string | null;
  createdAt?: string | null;
  categoria?: string[];
  exercicios?: TpExercicio[];
  professor?: { nome: string } | null;
  clube?: { nome: string } | null;
  escolinha?: { nome: string } | null;
  criadores?: {
    tipo: string;
    id: string;
    nome: string;
  }[];
};

const tipoIcon = (tipo?: TipoTreino) => {
  switch (tipo) {
    case "Físico":  return <Dumbbell className="h-4 w-4" />;
    case "Tecnico": return <Target   className="h-4 w-4" />;
    case "Tatico":  return <Layers   className="h-4 w-4" />;
    case "Mental":  return <Zap      className="h-4 w-4" />;
    default:        return <Dumbbell className="h-4 w-4" />;
  }
};

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
const sorted = (arr: string[]) => [...arr].sort((a, b) => a.localeCompare(b, "pt-BR"));
const sortedNum = (arr: number[]) => [...arr].sort((a, b) => a - b);

const pontuacaoRanges = [
  { label: "0 - 5 pontos", min: 0, max: 5 },
  { label: "6 - 10 pontos", min: 6, max: 10 },
  { label: "11 - 15 pontos", min: 11, max: 15 },
  { label: "16 - 20 pontos", min: 16, max: 20 },
  { label: "21+ pontos", min: 21, max: Infinity },
];

function nomeDoExercicio(
  item: TpExercicio
): string {
  return (
    item.nome?.trim() ||
    item.exercicio?.nome?.trim() ||
    item.exercicioPersonalizado?.nome?.trim() ||
    item.exercicioTemporario?.nome?.trim() ||
    "Exercício sem nome"
  );
}

function nomesCriadores(
  treino: TreinoProgramado
): string[] {
  const nomes = (
    Array.isArray(treino.criadores)
      ? treino.criadores
      : []
  )
    .map((c) => String(c.nome ?? "").trim())
    .filter(Boolean);

  return sorted(uniq(nomes));
}

export default function TrainingsPage() {
  const [route] = useLocation();
  
  const userContext = useContext(UserContext);

  const papelAtivo =
    userContext?.activeContext?.kind === "PERSONAL"
      ? String(userContext.activeTipoUsuario ?? "").toLowerCase()
      : "";

  const ehAtleta = papelAtivo === "atleta";
  const ehResponsavel = papelAtivo === "responsavel";

  type AtletaGerenciavel = {
    id: string;
    atletaId: string;
    nome: string;
  };

  const [atletasGerenciaveis, setAtletasGerenciaveis] =
    useState<AtletaGerenciavel[]>([]);

  const [atletaIdSelecionado, setAtletaIdSelecionado] =
    useState("");

  const atletaGerenciado = atletasGerenciaveis.find(
    (item) => item.atletaId === atletaIdSelecionado
  );

  const nomeAtletaSelecionado =
    atletaGerenciado?.nome ?? "o atleta selecionado";

  const podeOperarTreinos =
    ehAtleta ||
    (ehResponsavel && Boolean(atletaGerenciado));
  
  const urlTreinosProgramados =
    ehResponsavel && atletaIdSelecionado
      ? `${API.BASE_URL}/api/treinos/programados?atletaId=${encodeURIComponent(
          atletaIdSelecionado
        )}`
      : `${API.BASE_URL}/api/treinos/programados`;

  const perfilUsuarioId = useMemo(
    () => new URLSearchParams(window.location.search).get("usuarioId")?.trim() ?? "",
    [route]
  );
  const visitandoOutroAtleta =
    Boolean(perfilUsuarioId) && perfilUsuarioId !== String(Storage.usuarioId ?? "");
  const [q, setQ] = useState("");
  const [selCats, setSelCats] = useState<string[]>([]);
  const [selTipos, setSelTipos] = useState<string[]>([]);
  const [selExs, setSelExs] = useState<string[]>([]);
  const [selCriadores, setSelCriadores] =
  useState<string[]>([]);
  const [selDur, setSelDur] = useState<number[]>([]);
  const [selPontuacao, setSelPontuacao] = useState<string[]>([]);
  const [open, setOpen] = useState<null | "cats" | "tipos" | "exs" | "criadores" | "dur" | "pontuacao">(null);

  const [loading, setLoading] = useState(true);
  const [treinos, setTreinos] = useState<TreinoProgramado[]>([]);
  const [nomeAtleta, setNomeAtleta] = useState("");
  const [erro, setErro] = useState("");
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [salvos, setSalvos] = useState<string[]>([]);
  
  const [somenteSalvos, setSomenteSalvos] = useState(false);
  const [carregandoSalvos, setCarregandoSalvos] = useState(false);
  const [bibliotecaCarregada, setBibliotecaCarregada] = useState(false);
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  const [aviso, setAviso] = useState("");
  const [mesInicial, setMesInicial] = useState(format(new Date(), "yyyy-MM"));
  const SEM_PROF_LABEL = "Sem professor";
  
  useEffect(() => {
    if (!ehResponsavel) {
      setAtletasGerenciaveis([]);
      setAtletaIdSelecionado("");
      return;
    }

    const controller = new AbortController();

    async function carregarAtletasGerenciaveis() {
      try {
        const token =
          Storage.token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token");

        if (!token) return;

        const resposta = await fetch(
          `${API.BASE_URL}/api/responsaveis/me/atletas`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          }
        );

        if (!resposta.ok) {
          throw new Error("Não foi possível carregar os atletas.");
        }

        const dados = await resposta.json();

        const atletas = (
          Array.isArray(dados?.items) ? dados.items : []
        )
          .filter(
            (item: any) =>
              item.status === "ATIVO" &&
              (
                item.principal === true ||
                item.podeGerenciarTreinos === true
              )
          )
          .map((item: any) => ({
            id: String(item.atleta?.usuarioId ?? ""),
            atletaId: String(item.atletaId ?? ""),
            nome: String(
              item.atleta?.nome ??
              item.atleta?.nomeDeUsuario ??
              "Atleta"
            ),
          }))
          .filter((item: AtletaGerenciavel) => Boolean(item.atletaId));

        if (!controller.signal.aborted) {
          setAtletasGerenciaveis(atletas);

          setAtletaIdSelecionado((anterior) =>
            atletas.some(
              (item: AtletaGerenciavel) =>
                item.atletaId === anterior
            )
              ? anterior
              : atletas[0]?.atletaId ?? ""
          );
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[Trainings] Erro ao carregar atletas:", error);
          setAtletasGerenciaveis([]);
          setAtletaIdSelecionado("");
        }
      }
    }

    void carregarAtletasGerenciaveis();

    return () => controller.abort();
  }, [ehResponsavel, userContext?.activeContext?.key]);

  useEffect(() => {
    if (ehResponsavel && !atletaIdSelecionado) {
      setTreinos([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const token = Storage.token;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    setLoading(true);
    setTreinos([]);
    setNomeAtleta("");
    setErro("");
    setAviso("");

    async function carregar() {
      try {
        if (!visitandoOutroAtleta) {
          const r = await fetch(urlTreinosProgramados, {
            headers,
            signal: controller.signal,
          });
          if (!r.ok) throw new Error("Não foi possível carregar os treinos.");
          const data = await r.json();
          if (!controller.signal.aborted) setTreinos(Array.isArray(data) ? data : []);
          return;
        }

        // A consulta do perfil valida se o visitante tem acesso e fornece o ID do atleta.
        const perfilResponse = await fetch(
          `${API.BASE_URL}/api/perfil/${encodeURIComponent(perfilUsuarioId)}?papel=Atleta`,
          { headers, signal: controller.signal }
        );
        if (!perfilResponse.ok) throw new Error("Não foi possível acessar os treinos deste atleta.");
        const perfil = await perfilResponse.json();
        const atletaId = String(perfil?.dadosEspecificos?.atletaId ?? "").trim();
        if (perfil?.tipo !== "Atleta" || !atletaId) {
          throw new Error("Este usuário não possui um perfil de atleta disponível.");
        }

        const treinosResponse = await fetch(
          urlTreinosProgramados,
          {
            headers,
            signal: controller.signal,
          }
        );

        const treinosDisponiveis = await treinosResponse
          .json()
          .catch(() => null);

        if (!treinosResponse.ok) {
          throw new Error(
            treinosDisponiveis?.message ||
              "Não foi possível carregar os treinos disponíveis."
          );
        }

        if (!controller.signal.aborted) {
          setNomeAtleta(
            perfil?.dadosEspecificos?.nome ??
            perfil?.usuario?.nome ??
            "Atleta"
          );

          setTreinos(
            Array.isArray(treinosDisponiveis)
              ? treinosDisponiveis
              : []
          );
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error("Falha ao carregar treinos:", e);
        setErro(e instanceof Error ? e.message : "Não foi possível carregar os treinos.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void carregar();
    return () => controller.abort();
  }, [
    perfilUsuarioId,
    visitandoOutroAtleta,
    mesInicial,
    ehResponsavel,
    atletaIdSelecionado,
  ]);
  
  useEffect(() => {
    const controller = new AbortController();

    setSalvos([]);
    setBibliotecaCarregada(false);

    if (!podeOperarTreinos) {
      setCarregandoSalvos(false);
      return () => controller.abort();
    }

    async function carregarBiblioteca() {
      setCarregandoSalvos(true);

      try {
        const token =
          Storage.token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token");

        if (!token) return;

        const query =
          ehResponsavel && atletaIdSelecionado
            ? `?atletaId=${encodeURIComponent(atletaIdSelecionado)}`
            : "";

        const resposta = await fetch(
          `${API.BASE_URL}/api/treinos/biblioteca${query}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          }
        );

        const dados = await resposta.json().catch(() => null);

        if (!resposta.ok) {
          throw new Error(
            dados?.message ||
            "Não foi possível consultar a biblioteca."
          );
        }

      const ids: string[] = (
        Array.isArray(dados?.items) ? dados.items : []
      )
        .map((item: any): string =>
          String(item.treinoProgramadoId ?? "").trim()
        )
        .filter((id: string) => id.length > 0);

      if (!controller.signal.aborted) {
        setSalvos(Array.from(new Set<string>(ids)));
        setBibliotecaCarregada(true);
      }

      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[Trainings] Biblioteca:", error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setCarregandoSalvos(false);
        }
      }
    }

    void carregarBiblioteca();

    return () => controller.abort();
  }, [
    podeOperarTreinos,
    ehResponsavel,
    atletaIdSelecionado,
    userContext?.activeContext?.key,
  ]);

  async function salvarNaBiblioteca(treino: TreinoProgramado) {
    const treinoProgramadoId = String(
      treino.programadoId || treino.id || ""
    ).trim();
    if (!treinoProgramadoId || salvandoId) return;

    const token = Storage.token;
    if (!token) {
      setAviso("Entre na FootEra para salvar este treino.");
      return;
    }
    if (!podeOperarTreinos) {
      setAviso(
        "Selecione um perfil de Atleta ou um atleta sob sua responsabilidade."
      );
      return;
    }
    setSalvandoId(treinoProgramadoId);
    setAviso("");
    try {
      const r = await fetch(`${API.BASE_URL}/api/treinos/biblioteca`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          treinoProgramadoId,
          ...(ehResponsavel && atletaIdSelecionado
            ? { atletaId: atletaIdSelecionado }
            : {}),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 409) {
          setSalvos((ids) =>
            [...new Set([...ids, treinoProgramadoId])]
          );
          setAviso("Este treino já está salvo na biblioteca.");
          return;
        }

        throw new Error(
          data?.message || "Não foi possível salvar o treino."
        );
      }
      setSalvos((ids) => [...ids, treinoProgramadoId]);
      setAviso(
        ehResponsavel
          ? `Treino “${treino.nome}” salvo na biblioteca de ${nomeAtletaSelecionado}.`
          : `Treino “${treino.nome}” salvo na sua biblioteca.`
      );
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível salvar o treino.");
    } finally {
      setSalvandoId(null);
    }
  }
  
  async function removerDaBiblioteca(treino: TreinoProgramado) {
    const treinoProgramadoId = String(
      treino.programadoId || treino.id || ""
    ).trim();

    if (!treinoProgramadoId || !podeOperarTreinos || removendoId) {
      return;
    }

    setRemovendoId(treinoProgramadoId);
    setAviso("");

    try {
      const token =
        Storage.token ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token");

      if (!token) throw new Error("Entre na FootEra.");

      const query =
        ehResponsavel && atletaIdSelecionado
          ? `?atletaId=${encodeURIComponent(atletaIdSelecionado)}`
          : "";

      const resposta = await fetch(
        `${API.BASE_URL}/api/treinos/biblioteca/${encodeURIComponent(
          treinoProgramadoId
        )}${query}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const dados = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        throw new Error(
          dados?.message || "Não foi possível remover o treino."
        );
      }

      setSalvos((ids) =>
        ids.filter((id) => id !== treinoProgramadoId)
      );

      setAviso(
        ehResponsavel
          ? `Treino removido da biblioteca de ${nomeAtletaSelecionado}.`
          : "Treino removido da sua biblioteca."
      );
    } catch (error) {
      setAviso(
        error instanceof Error
          ? error.message
          : "Erro ao remover o treino."
      );
    } finally {
      setRemovendoId(null);
    }
  }

  const allCategorias = useMemo(
    () => sorted(uniq(treinos.flatMap(t => t.categoria ?? []))),
    [treinos]
  );
  const allExercicios = useMemo(
    () => sorted(uniq(treinos.flatMap(t => (t.exercicios ?? []).map(e => nomeDoExercicio(e) ?? "")).filter(Boolean))),
    [treinos]
  );
  const allCriadores = useMemo(
    () =>
      sorted(
        uniq(
          treinos.flatMap((treino) =>
            nomesCriadores(treino)
          )
        )
      ),
    [treinos]
  );

    const allDuracoes = useMemo(
      () => sortedNum(uniq(treinos.map(t => t.duracao ?? 0).filter((n) => typeof n === "number" && n > 0))),
      [treinos]
    );

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();

    return treinos.filter((t) => {
      const treinoId = String(t.programadoId || t.id || "");

      if (somenteSalvos && !salvos.includes(treinoId)) {
        return false;
      }
      if (selCats.length && !(t.categoria ?? []).some(c => selCats.includes(c))) return false;
      if (selTipos.length && !selTipos.includes(String(t.tipoTreino ?? ""))) return false;
      if (selExs.length) {
        const nomes = (t.exercicios ?? []).map(e => nomeDoExercicio(e) ?? "");
        if (!nomes.some(n => selExs.includes(n))) return false;
      }
      if (selCriadores.length) {
        const nomes = nomesCriadores(t);

        if (
          !nomes.some((nome) =>
            selCriadores.includes(nome)
          )
        ) {
          return false;
        }
      }
      if (selDur.length && !selDur.includes(Number(t.duracao ?? 0))) return false;

      if (selPontuacao.length) {
        const p = t.pontuacao ?? 0;
        const ok = pontuacaoRanges.some(r =>
          selPontuacao.includes(r.label) && p >= r.min && p <= r.max
        );
        if (!ok) return false;
      }

      if (!term) return true;

      const alvo = [
        t.nome,
        t.descricao ?? "",
        t.tipoTreino ?? "",
        String(t.duracao ?? ""),
        String(t.pontuacao ?? ""),
        ...nomesCriadores(t),
        ...(t.categoria ?? []),
        ...(t.exercicios?.map(e => nomeDoExercicio(e) ?? "") ?? []),
      ].join(" ").toLowerCase();

      return alvo.includes(term);
    });
  }, [
    treinos,
    q,
    selCats,
    selTipos,
    selExs,
    selCriadores,
    selDur,
    selPontuacao,
    somenteSalvos,
    salvos,
  ]);

  const clearAll = () => {
    setQ("");
    setSelCats([]);
    setSelTipos([]);
    setSelExs([]);
    setSelCriadores([]);
    setSelDur([]);
    setSelPontuacao([]);
    setSomenteSalvos(false);
  };

  const toggle = <T,>(value: T, arr: T[], setArr: (v: T[]) => void) => {
    setArr(arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value]);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-10 w-full bg-gray-200 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-40 bg-gray-200 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full min-w-0 bg-transparent">
      <Link
                            href={visitandoOutroAtleta ? `/perfil/${encodeURIComponent(perfilUsuarioId)}?papel=Atleta` : "/perfil"}
                            aria-label="Voltar para perfil"
                            className="inline-flex h-10 w-10 items-center justify-center
                              rounded-full border border-green-800 bg-white text-green-900
                              shadow-sm hover:bg-green-50 focus:outline-none
                              focus:ring-2 focus:ring-green-700/30 mt-2 ml-2 mb-2"
                            >
                            <ArrowLeft className="h-5 w-5" />
      </Link>
      <header className="bg-green-900 text-white text-center py-3 text-xl font-bold">
        {visitandoOutroAtleta ? `Treinos de ${nomeAtleta || "Atleta"}` : "Todos os Treinos"}
      </header>
      <div className="mx-auto w-full min-w-0 max-w-5xl space-y-3 px-3 py-4 sm:px-4">
      {ehResponsavel && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <label
            htmlFor="atleta-gerenciado-trainings"
            className="mb-2 block text-sm font-semibold text-green-900"
          >
            Salvar ou agendar treinos para
          </label>

          <select
            id="atleta-gerenciado-trainings"
            value={atletaIdSelecionado}
            onChange={(event) => {
              setAtletaIdSelecionado(event.target.value);
              setAviso("");
            }}
            className="w-full rounded-xl border border-green-200 bg-white px-4 py-3 text-green-950"
          >
            {atletasGerenciaveis.length === 0 && (
              <option value="">
                Nenhum atleta com permissão de treinos
              </option>
            )}

            {atletasGerenciaveis.map((atleta) => (
              <option key={atleta.atletaId} value={atleta.atletaId}>
                {atleta.nome}
              </option>
            ))}
          </select>
        </div>
      )}
        {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{erro}</p>}
        {aviso && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{aviso}</p>}
        {visitandoOutroAtleta && (
          <label className="flex items-center gap-2 text-sm text-green-900">
            Ver treinos deste mês e do seguinte
            <input
              type="month"
              value={mesInicial}
              onChange={(e) => e.target.value && setMesInicial(e.target.value)}
              className="rounded-lg border border-green-200 bg-white px-2 py-1"
            />
          </label>
        )}
        <div className="relative flex w-full min-w-0 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-800" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, tipo, exercícios, professor, categoria ou duração…"
              className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <Button variant="outline" onClick={clearAll}>Todos</Button>
          
          {podeOperarTreinos && (
            <Button
              variant={somenteSalvos ? "default" : "outline"}
              disabled={!bibliotecaCarregada || carregandoSalvos}
              onClick={() => setSomenteSalvos((valor) => !valor)}
            >
              {somenteSalvos
                ? "✓ Somente salvos"
                : "Somente treinos salvos"}
            </Button>
          )}

          <details className="static min-w-0" open={open === "cats"} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open ? "cats" : null)}>
            <summary className="list-none cursor-pointer flex items-center gap-1 px-3 py-2 border rounded-lg">
              Categorias <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="absolute inset-x-0 top-full z-50 mt-2 w-full min-w-0 max-w-full rounded-lg border bg-white p-3 shadow-lg">
              <div className="max-h-64 min-w-0 space-y-1 overflow-y-auto overflow-x-hidden break-words">
                {allCategorias.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Nenhuma categoria disponível.
                  </p>
                )}
                {allCategorias.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selCats.includes(c)} onChange={() => toggle(c, selCats, setSelCats)} />
                    {c}
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => setSelCats([])}>Limpar</Button>
                <Button size="sm" onClick={() => setOpen(null)}>Aplicar</Button>
              </div>
            </div>
          </details>

          <details className="static min-w-0" open={open === "tipos"} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open ? "tipos" : null)}>
            <summary className="list-none cursor-pointer flex items-center gap-1 px-3 py-2 border rounded-lg">
              TipoTreino <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="absolute inset-x-0 top-full z-50 mt-2 w-full min-w-0 max-w-full rounded-lg border bg-white p-3 shadow-lg">
              <div className="space-y-1">
                {["Físico", "Tecnico", "Tatico", "Mental"].map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selTipos.includes(t)} onChange={() => toggle(t, selTipos, setSelTipos)} />
                    {t}
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => setSelTipos([])}>Limpar</Button>
                <Button size="sm" onClick={() => setOpen(null)}>Aplicar</Button>
              </div>
            </div>
          </details>

          <details
            className="static min-w-0"
            open={open === "exs"}
            onToggle={(e) =>
              setOpen(
                (e.target as HTMLDetailsElement).open ? "exs" : null
              )
            }
          >
            <summary className="list-none cursor-pointer flex items-center gap-1 px-3 py-2 border rounded-lg">
              Exercícios <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="absolute inset-x-0 top-full z-50 mt-2 w-full min-w-0 max-w-full rounded-lg border bg-white p-3 shadow-lg">
              <div className="max-h-64 min-w-0 space-y-1 overflow-y-auto overflow-x-hidden break-words">
                {allExercicios.map((n) => (
                  <label
                    key={n}
                    className="flex min-w-0 items-start gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selExs.includes(n)}
                      onChange={() => toggle(n, selExs, setSelExs)}
                      className="mt-1 shrink-0"
                    />

                    <span className="min-w-0 flex-1 break-words">
                      {n}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => setSelExs([])}>Limpar</Button>
                <Button size="sm" onClick={() => setOpen(null)}>Aplicar</Button>
              </div>
            </div>
          </details>
                    
          <details
            className="static min-w-0"
            open={open === "criadores"}
            onToggle={(event) =>
              setOpen(
                (event.target as HTMLDetailsElement).open
                  ? "criadores"
                  : null
              )
            }
          >
            <summary className="list-none cursor-pointer flex items-center gap-1 px-3 py-2 border rounded-lg">
              Criadores
              <ChevronDown className="h-4 w-4" />
            </summary>

            <div className="absolute inset-x-0 top-full z-50 mt-2 w-full min-w-0 max-w-full rounded-lg border bg-white p-3 shadow-lg">
              <div className="max-h-64 min-w-0 space-y-1 overflow-y-auto overflow-x-hidden break-words">
                {allCriadores.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhum criador identificado.
                  </p>
                ) : (
                  allCriadores.map((nome) => (
                    <label
                      key={nome}
                      className="flex min-w-0 items-start gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selCriadores.includes(nome)}
                        onChange={() =>
                          toggle(
                            nome,
                            selCriadores,
                            setSelCriadores
                          )
                        }
                      />
                      <span className="min-w-0 flex-1 break-words">
                        {nome}
                      </span>
                    </label>
                  ))
                )}
              </div>

              <div className="flex justify-end gap-2 mt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelCriadores([])}
                >
                  Limpar
                </Button>

                <Button size="sm" onClick={() => setOpen(null)}>
                  Aplicar
                </Button>
              </div>
            </div>
          </details>

          <details className="static min-w-0" open={open === "dur"} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open ? "dur" : null)}>
            <summary className="list-none cursor-pointer flex items-center gap-1 px-3 py-2 border rounded-lg">
              Duração <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="absolute inset-x-0 top-full z-50 mt-2 w-full min-w-0 max-w-full rounded-lg border bg-white p-3 shadow-lg">
              <div className="max-h-64 min-w-0 space-y-1 overflow-y-auto overflow-x-hidden break-words">
                {allDuracoes.map((d) => (
                  <label key={d} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selDur.includes(d)} onChange={() => toggle(d, selDur, setSelDur)} />
                    {d} min
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => setSelDur([])}>Limpar</Button>
                <Button size="sm" onClick={() => setOpen(null)}>Aplicar</Button>
              </div>
            </div>
          </details>

          <details
            className="static min-w-0"
            open={open === "pontuacao"}
            onToggle={(e) =>
              setOpen(
                (e.target as HTMLDetailsElement).open
                  ? "pontuacao"
                  : null
              )
            }
          >
            <summary className="list-none cursor-pointer flex items-center gap-1 px-3 py-2 border rounded-lg">
              Pontuação
              <ChevronDown className="h-4 w-4" />
            </summary>

            <div className="absolute inset-x-0 top-full z-50 mt-2 w-full min-w-0 max-w-full rounded-lg border bg-white p-3 shadow-lg">
              <div className="max-h-64 min-w-0 space-y-1 overflow-y-auto overflow-x-hidden break-words">
                {pontuacaoRanges.map((r) => (
                  <label
                    key={r.label}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selPontuacao.includes(r.label)}
                      onChange={() =>
                        toggle(r.label, selPontuacao, setSelPontuacao)
                      }
                    />
                    {r.label}
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelPontuacao([])}
                >
                  Limpar
                </Button>

                <Button size="sm" onClick={() => setOpen(null)}>
                  Aplicar
                </Button>
              </div>
            </div>
          </details>
        </div>

        {list.length === 0 ? (
          <div className="text-center text-green-800 py-10">
            {erro
              ? ""
              : "Nenhum treino disponível foi encontrado."}
          </div>
        ) : (
          <>
            <div className="text-sm text-green-900/70">{list.length} treino(s) encontrado(s)</div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              {list.map((t) => {
                const prazo  = t.dataAgendada ? new Date(t.dataAgendada) : null;
                const criado = t.createdAt ? new Date(t.createdAt) : null;
                const criadoresDoTreino = nomesCriadores(t);

                return (
                  <Card key={t.id} className="min-w-0 max-w-full bg-white">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          <span className="mt-1 shrink-0">
                            {tipoIcon(t.tipoTreino)}
                          </span>

                          <h3 className="min-w-0 break-words font-semibold">
                            {t.nome}
                          </h3>
                        </div>
                        {typeof t.pontuacao === "number" && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                            <Medal className="h-3.5 w-3.5 mr-1" /> {t.pontuacao}
                          </Badge>
                        )}
                      </div>

                      {t.descricao && (
                        <p className="text-sm text-gray-700 line-clamp-3">{t.descricao}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
                        {t.duracao ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-gray-50">
                            <Timer className="h-3.5 w-3.5" />
                            {t.duracao} min
                          </span>
                        ) : null}

                        {t.tipoTreino ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-gray-50">
                            {tipoIcon(t.tipoTreino)}
                            {t.tipoTreino}
                          </span>
                        ) : null}
                        {criadoresDoTreino.length > 0 && (
                          <div className="w-full text-sm text-green-950">
                            <span className="font-semibold">
                              Criado por:
                            </span>{" "}
                            {criadoresDoTreino.join(", ")}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        {prazo && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {visitandoOutroAtleta ? "Agendado para" : "Prazo"}: {format(prazo, "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                        {criado && (
                          <span className="inline-flex items-center gap-1">
                            Criado em: {format(criado, "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                      </div>

                      {!!(t.categoria?.length) && (
                        <div className="flex flex-wrap gap-1">
                          {t.categoria!.map((c) => (
                            <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                          ))}
                        </div>
                      )}

                      {!!(t.exercicios?.length) && (
                        <div className="space-y-1">
                          <div className="text-sm font-medium">Exercícios</div>
                          <ul className="list-inside list-disc space-y-0.5 break-words text-sm text-gray-700">
                            {t.exercicios!.map((e, idx) => (
                              <li key={idx}>
                                {nomeDoExercicio(e)} {e.repeticoes ? `— ${e.repeticoes}` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        {podeOperarTreinos && (
                          <>                       
                            <Button
                              variant="outline"
                              disabled={
                                carregandoSalvos ||
                                !bibliotecaCarregada ||
                                salvandoId === (t.programadoId || t.id) ||
                                removendoId === (t.programadoId || t.id)
                              }
                              onClick={() =>
                                salvos.includes(t.programadoId || t.id)
                                  ? void removerDaBiblioteca(t)
                                  : void salvarNaBiblioteca(t)
                              }
                            >
                              {removendoId === (t.programadoId || t.id)
                                ? "Removendo..."
                                : salvandoId === (t.programadoId || t.id)
                                  ? "Salvando..."
                                  : salvos.includes(t.programadoId || t.id)
                                    ? "Remover dos salvos"
                                    : "Salvar treino"}
                            </Button>

                            <Button
                              onClick={() => {
                                const treinoProgramadoId = String(
                                  t.programadoId || t.id || ""
                                ).trim();

                                const params = new URLSearchParams();

                                if (ehResponsavel && atletaIdSelecionado) {
                                  params.set("atletaId", atletaIdSelecionado);
                                }

                                if (treinoProgramadoId) {
                                  params.set("treinoProgramadoId", treinoProgramadoId);
                                }

                                window.location.href =
                                  `/treinos/novo?${params.toString()}`;
                              }}
                            >
                              Agendar treino
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
