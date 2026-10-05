// client/src/pages/training
import { useEffect, useMemo, useState } from "react";
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

type TipoTreino = "Tecnico" | "Físico" | "Tatico" | "Mental" | null;
type TpExercicio = { exercicio: { nome: string }; repeticoes: string };

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

export default function TrainingsPage() {
  const [route] = useLocation();
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
  const [selProfs, setSelProfs] = useState<string[]>([]);
  const [selDur, setSelDur] = useState<number[]>([]);
  const [selPontuacao, setSelPontuacao] = useState<string[]>([]);
  const [open, setOpen] = useState<null | "cats" | "tipos" | "exs" | "profs" | "dur" | "pontuacao">(null);

  const [loading, setLoading] = useState(true);
  const [treinos, setTreinos] = useState<TreinoProgramado[]>([]);
  const [nomeAtleta, setNomeAtleta] = useState("");
  const [erro, setErro] = useState("");
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [salvos, setSalvos] = useState<string[]>([]);
  const [aviso, setAviso] = useState("");
  const [mesInicial, setMesInicial] = useState(format(new Date(), "yyyy-MM"));
  const SEM_PROF_LABEL = "Sem professor";

  useEffect(() => {
    const controller = new AbortController();
    const token = Storage.token;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    setLoading(true);
    setTreinos([]);
    setNomeAtleta("");
    setErro("");
    setAviso("");
    setSalvos([]);

    async function carregar() {
      try {
        if (!visitandoOutroAtleta) {
          const r = await fetch(`${API.BASE_URL}/api/treinos/programados`, {
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

        const agendadosResponse = await fetch(
          `${API.BASE_URL}/api/treinos/agendados?atletaId=${encodeURIComponent(atletaId)}&month=${encodeURIComponent(mesInicial)}`,
          { headers, signal: controller.signal }
        );
        if (!agendadosResponse.ok) throw new Error("Não foi possível carregar os treinos deste atleta.");
        const agendados = await agendadosResponse.json();
        const unicos = new Map<string, TreinoProgramado>();

        for (const item of Array.isArray(agendados) ? agendados : []) {
          const programado = item?.treinoProgramado ?? null;
          const programadoId = String(item?.treinoProgramadoId ?? programado?.id ?? "").trim();
          const id = programadoId || String(item?.id ?? "").trim();
          if (!id || unicos.has(id)) continue;

          unicos.set(id, {
            ...programado,
            id,
            programadoId: programadoId || null,
            nome: programado?.nome ?? item?.titulo ?? "Treino",
            descricao: programado?.descricao ?? null,
            tipoTreino: programado?.tipoTreino ?? null,
            duracao: programado?.duracao ?? item?.duracaoMinutos ?? null,
            pontuacao: programado?.pontuacao ?? null,
            dataAgendada: item?.dataTreino ?? null,
            createdAt: programado?.createdAt ?? null,
            categoria: Array.isArray(programado?.categoria) ? programado.categoria : [],
            exercicios: Array.isArray(programado?.exercicios) ? programado.exercicios : [],
            professor: programado?.Professor ?? programado?.professores?.[0]?.professor ?? null,
            clube: programado?.clube ?? null,
            escolinha: programado?.escolinha ?? null,
          });
        }

        if (!controller.signal.aborted) {
          setNomeAtleta(perfil?.dadosEspecificos?.nome ?? perfil?.usuario?.nome ?? "Atleta");
          setTreinos([...unicos.values()]);
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
  }, [perfilUsuarioId, visitandoOutroAtleta, mesInicial]);

  async function salvarNaBiblioteca(treino: TreinoProgramado) {
    const treinoProgramadoId = treino.programadoId;
    if (!treinoProgramadoId || salvandoId) return;

    const token = Storage.token;
    if (!token) {
      setAviso("Entre na FootEra para salvar este treino.");
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
        body: JSON.stringify({ treinoProgramadoId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || "Não foi possível salvar o treino.");
      setSalvos((ids) => [...ids, treinoProgramadoId]);
      setAviso(`Treino “${treino.nome}” salvo na sua biblioteca.`);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível salvar o treino.");
    } finally {
      setSalvandoId(null);
    }
  }

  const allCategorias = useMemo(
    () => sorted(uniq(treinos.flatMap(t => t.categoria ?? []))),
    [treinos]
  );
  const allTipos = useMemo(
    () => sorted(uniq(treinos.map(t => t.tipoTreino ?? "").filter(Boolean) as string[])),
    [treinos]
  );
  const allExercicios = useMemo(
    () => sorted(uniq(treinos.flatMap(t => (t.exercicios ?? []).map(e => e.exercicio?.nome ?? "")).filter(Boolean))),
    [treinos]
  );
  const allProfessores = useMemo(() => {
    const names = sorted(
      uniq(treinos.map(t => t.professor?.nome ?? "").filter(Boolean))
    );
    const hasSemProf = treinos.some(t => !t.professor?.nome);
    return hasSemProf ? [SEM_PROF_LABEL, ...names] : names;
  }, [treinos]);

    const allDuracoes = useMemo(
      () => sortedNum(uniq(treinos.map(t => t.duracao ?? 0).filter((n) => typeof n === "number" && n > 0))),
      [treinos]
    );

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();

    return treinos.filter((t) => {
      if (selCats.length && !(t.categoria ?? []).some(c => selCats.includes(c))) return false;
      if (selTipos.length && !selTipos.includes(String(t.tipoTreino ?? ""))) return false;
      if (selExs.length) {
        const nomes = (t.exercicios ?? []).map(e => e.exercicio?.nome ?? "");
        if (!nomes.some(n => selExs.includes(n))) return false;
      }
      if (selProfs.length) {
        const nome = t.professor?.nome ?? "";
        const matchSemProf = !nome && selProfs.includes(SEM_PROF_LABEL);
        const matchByName  =  !!nome && selProfs.includes(nome);
        if (!matchSemProf && !matchByName) return false;
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
        t.professor?.nome ?? "",
        t.clube?.nome ?? "",
        t.escolinha?.nome ?? "",
        ...(t.categoria ?? []),
        ...(t.exercicios?.map(e => e.exercicio?.nome ?? "") ?? []),
      ].join(" ").toLowerCase();

      return alvo.includes(term);
    });
  }, [treinos, q, selCats, selTipos, selExs, selProfs, selDur, selPontuacao]);

  const clearAll = () => {
    setQ("");
    setSelCats([]);
    setSelTipos([]);
    setSelExs([]);
    setSelProfs([]);
    setSelDur([]);
    setSelPontuacao([]);
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
    <div className="min-h-screen bg-transparent">
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
      <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
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
        <div className="flex flex-wrap items-center gap-2">
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

          <details className="relative" open={open === "cats"} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open ? "cats" : null)}>
            <summary className="list-none cursor-pointer flex items-center gap-1 px-3 py-2 border rounded-lg">
              Categorias <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="absolute z-10 mt-2 w-64 bg-white border rounded-lg p-2 shadow">
              <div className="max-h-64 overflow-auto space-y-1">
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

          <details className="relative" open={open === "tipos"} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open ? "tipos" : null)}>
            <summary className="list-none cursor-pointer flex items-center gap-1 px-3 py-2 border rounded-lg">
              TipoTreino <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="absolute z-10 mt-2 w-56 bg-white border rounded-lg p-2 shadow">
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

          <details className="relative" open={open === "exs"} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open ? "exs" : null)}>
            <summary className="list-none cursor-pointer flex items-center gap-1 px-3 py-2 border rounded-lg">
              Exercícios <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="absolute z-10 mt-2 w-72 bg-white border rounded-lg p-2 shadow">
              <div className="max-h-64 overflow-auto space-y-1">
                {allExercicios.map((n) => (
                  <label key={n} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selExs.includes(n)} onChange={() => toggle(n, selExs, setSelExs)} />
                    {n}
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => setSelExs([])}>Limpar</Button>
                <Button size="sm" onClick={() => setOpen(null)}>Aplicar</Button>
              </div>
            </div>
          </details>

          <details className="relative" open={open === "profs"} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open ? "profs" : null)}>
            <summary className="list-none cursor-pointer flex items-center gap-1 px-3 py-2 border rounded-lg">
              Professores <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="absolute z-10 mt-2 w-64 bg-white border rounded-lg p-2 shadow">
              <div className="max-h-64 overflow-auto space-y-1">
                {allProfessores.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selProfs.includes(p)} onChange={() => toggle(p, selProfs, setSelProfs)} />
                    {p}
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => setSelProfs([])}>Limpar</Button>
                <Button size="sm" onClick={() => setOpen(null)}>Aplicar</Button>
              </div>
            </div>
          </details>

          <details className="relative" open={open === "dur"} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open ? "dur" : null)}>
            <summary className="list-none cursor-pointer flex items-center gap-1 px-3 py-2 border rounded-lg">
              Duração <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="absolute z-10 mt-2 w-52 bg-white border rounded-lg p-2 shadow">
              <div className="max-h-64 overflow-auto space-y-1">
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

          <details className="relative" open={open === "pontuacao"} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open ? "pontuacao" : null)}>
            <summary className="list-none cursor-pointer flex items-center gap-1 px-3 py-2 border rounded-lg">
              Pontuação <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="absolute z-10 mt-2 w-60 bg-white border rounded-lg p-2 shadow">
              <div className="max-h-64 overflow-auto space-y-1">
                {pontuacaoRanges.map((r) => (
                  <label key={r.label} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selPontuacao.includes(r.label)} onChange={() => toggle(r.label, selPontuacao, setSelPontuacao)} />
                    {r.label}
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => setSelPontuacao([])}>Limpar</Button>
                <Button size="sm" onClick={() => setOpen(null)}>Aplicar</Button>
              </div>
            </div>
          </details>
        </div>

        {list.length === 0 ? (
          <div className="text-center text-green-800 py-10">
            {erro ? "" : visitandoOutroAtleta ? "Nenhum treino agendado encontrado para este atleta." : "Nenhum treino encontrado."}
          </div>
        ) : (
          <>
            <div className="text-sm text-green-900/70">{list.length} treino(s) encontrado(s)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {list.map((t) => {
                const prazo  = t.dataAgendada ? new Date(t.dataAgendada) : null;
                const criado = t.createdAt ? new Date(t.createdAt) : null;

                return (
                  <Card key={t.id} className="bg-white">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {tipoIcon(t.tipoTreino)}
                          <h3 className="font-semibold">{t.nome}</h3>
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

                        {t.professor?.nome && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-gray-50">
                            Prof.: {t.professor.nome}
                          </span>
                        )}

                        {t.clube?.nome && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-gray-50">
                            Clube: {t.clube.nome}
                          </span>
                        )}

                        {t.escolinha?.nome && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-gray-50">
                            Escolinha: {t.escolinha.nome}
                          </span>
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
                          <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                            {t.exercicios!.map((e, idx) => (
                              <li key={idx}>
                                {e.exercicio?.nome ?? "Exercício"} {e.repeticoes ? `— ${e.repeticoes}` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        {visitandoOutroAtleta ? (
                          t.programadoId ? (
                            <Button
                              disabled={salvandoId === t.programadoId || salvos.includes(t.programadoId)}
                              onClick={() => void salvarNaBiblioteca(t)}
                            >
                              {salvos.includes(t.programadoId) ? "Salvo" : salvandoId === t.programadoId ? "Salvando..." : "Salvar na minha biblioteca"}
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-500">Treino pessoal sem modelo para copiar</span>
                          )
                        ) : (
                          <Button onClick={() => (window.location.href = `/treinos/novo`)}>
                            Agendar
                          </Button>
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
