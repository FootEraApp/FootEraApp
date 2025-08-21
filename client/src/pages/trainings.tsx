import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search, Dumbbell, Target, Layers, Zap, Timer, Medal, CalendarClock, ChevronDown
} from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { Card, CardContent } from "../components/ui/card.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";

type TipoTreino = "Tecnico" | "Físico" | "Tatico" | "Mental" | null;

type TpExercicio = { exercicio: { nome: string }; repeticoes: string };

type TreinoProgramado = {
  id: string;
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
  const SEM_PROF_LABEL = "Sem professor";

  useEffect(() => {
    const token = Storage.token;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    fetch(`${API.BASE_URL}/api/treinos/programados`, { headers })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setTreinos(Array.isArray(data) ? data : []);
      })
      .catch((e) => console.error("Falha ao carregar treinos:", e))
      .finally(() => setLoading(false));
  }, []);

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
      <header className="bg-green-900 text-white text-center py-3 text-xl font-bold">Todos os Treinos</header>

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
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
          <div className="text-center text-green-800 py-10">Nenhum treino encontrado.</div>
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
                            Prazo: {format(prazo, "dd/MM/yyyy", { locale: ptBR })}
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
                        <Button
                          onClick={() => (window.location.href = `/treinos/novo`)}
                        >
                          Agendar
                        </Button>
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
