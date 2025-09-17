// client/src/pages/novoTreino
import { useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Volleyball, User, CirclePlus, Search as SearchIcon, House, Check } from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

interface UsuarioLogado {
  // valores persistidos no Storage/localStorage podem variar ("escola" para escolinha)
  // aqui apenas usamos para renderização; ao enviar para o backend normalizamos para "Professor" | "Clube" | "Escolinha"
  tipo: "atleta" | "escola" | "escolinha" | "clube" | "professor";
}

interface Exercicio {
  id: string;
  nome: string;
  repeticoes?: string;
  videoDemonstrativoUrl?: string;
  descricao?: string;
  nivel?: string;
}

interface AtletaVinculado {
  id: string;
  nome: string;
  foto?: string;
}

interface TreinoProgramado {
  id: string;
  nome: string;
  descricao?: string;
  nivel: string;
  dataAgendada?: string;
  exercicios: {
    id: string;
    nome: string;
    repeticoes?: string;
  }[];
}

type ExercicioSelecionado = {
  nome: string;
  series: string;
  repeticoes: string;
  descricao: string;
  exercicioId?: string;
};

type TreinoAgendadoResp = {
  id: string;
  titulo: string;
  dataTreino: string;
  treinoProgramadoId: string;
};

/** =====================  Utilities (autosave)  ===================== **/
const SAVE_KEY = "novoTreinoState";

function safeParse<T>(str: string | null, fallback: T): T {
  try {
    if (!str) return fallback;
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function saveState(partial: any) {
  try {
    const prev = safeParse<any>(sessionStorage.getItem(SAVE_KEY), {});
    const next = { ...prev, ...partial };
    sessionStorage.setItem(SAVE_KEY, JSON.stringify(next));
  } catch {}
}

/** =====================  Stepper  ===================== **/
const steps = [
  { id: 1, label: "Informações" },
  { id: 2, label: "Exercícios" },
  { id: 3, label: "Dicas" },
  { id: 4, label: "Atletas" },
] as const;

function Stepper({
  current,
  onJump,
  completedUntil,
}: {
  current: number;
  onJump: (n: number) => void;
  completedUntil: number;
}) {
  return (
    <div className="mb-4 sm:mb-6 -mx-2 sm:mx-0">
      <div className="overflow-x-auto px-2">
        <ol className="flex items-center gap-2 sm:gap-3 min-w-max">
          {steps.map((s, idx) => {
            const isCurrent = s.id === current;
            const isCompleted = s.id <= completedUntil;
            return (
              <li key={s.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onJump(s.id)}
                  className={[
                    "flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-full border transition text-sm sm:text-base whitespace-nowrap",
                    isCurrent
                      ? "bg-green-700 text-white border-green-700"
                      : isCompleted
                      ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200"
                      : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200",
                  ].join(" ")}
                  title={`Ir para ${s.label}`}
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs">
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.id}
                  </span>
                  <span className="font-semibold text-xs sm:text-sm">{s.label}</span>
                </button>
                {idx < steps.length - 1 && <div className="hidden sm:block w-8 h-px bg-gray-300" />}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function StepCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-4 sm:p-6">
      <h3 className="font-bold text-lg sm:text-xl mb-4">{title}</h3>
      {children}
    </div>
  );
}

/** =====================  Página  ===================== **/
export default function NovoTreino() {
  const [, navigate] = useLocation();

  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

  const [prazos, setPrazos] = useState<Record<string, string>>({});
  const [exerciciosDisponiveis, setExerciciosDisponiveis] = useState<Exercicio[]>([]);
  const [treinosDisponiveis, setTreinosDisponiveis] = useState<TreinoProgramado[]>([]);
  const [atletasVinculados, setAtletasVinculados] = useState<AtletaVinculado[]>([]);
  const [atletasSelecionados, setAtletasSelecionados] = useState<string[]>([]);

  const [etapa, setEtapa] = useState<number>(1);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nivel, setNivel] = useState("Base");
  const [duracao, setDuracao] = useState<number>(60);
  const [dataTreino, setDataTreino] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("Sub13");
  const [tipoTreino, setTipoTreino] = useState<string>("Tecnico");
  const [objetivo, setObjetivo] = useState<string>("");
  const [iniciado, setIniciado] = useState<boolean>(false);

  const [exerciciosSelecionados, setExerciciosSelecionados] = useState<ExercicioSelecionado[]>([]);
  const [dicas, setDicas] = useState<string[]>([]);
  const [dicaAtual, setDicaAtual] = useState<string>("");

  const [filtroEx, setFiltroEx] = useState("");
  const restoredRef = useRef(false);

  function normalizaTreinos(raw: any[]): TreinoProgramado[] {
    return raw.map((t: any) => ({
      id: t.id,
      nome: t.nome ?? t.titulo ?? "(sem nome)",
      descricao: t.descricao ?? t.resumo ?? "",
      nivel: t.nivel ?? t.dificuldade ?? "-",
      exercicios: (t.exercicios ?? t.exs ?? []).map((ex: any, i: number) => ({
        id: ex.id ?? ex.exercicioId ?? String(i),
        nome: ex.nome ?? ex.titulo ?? "",
        repeticoes: ex.repeticoes ?? ex.reps ?? ex.qtde ?? "",
      })),
    }));
  }

  /** =====================  Bootstrap  ===================== **/
  useEffect(() => {
    const tipoPersistido = (
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario") ??
      (Storage as any).tipoSalvo ??
      ""
    )
      .toString()
      .trim()
      .toLowerCase();

    const tipoNormalizado = tipoPersistido === "escolinha" ? "escola" : tipoPersistido;
    const permitidos = ["escola", "clube", "professor", "atleta"] as const;

    if (permitidos.includes(tipoNormalizado as any)) {
      setUsuario({ tipo: tipoNormalizado as (typeof permitidos)[number] });
    } else {
      console.warn("tipoUsuario inválido/inesperado:", { tipoPersistido, tipoNormalizado });
      setUsuario(null);
    }

    const id =
      localStorage.getItem("usuarioId") ??
      sessionStorage.getItem("usuarioId") ??
      (Storage as any).usuarioId ??
      null;
    setUsuarioId(id);

    if (!restoredRef.current) {
      const saved = safeParse<any>(sessionStorage.getItem(SAVE_KEY), null);
      if (saved) {
        setEtapa(saved.etapa ?? 1);
        setNome(saved.nome ?? "");
        setDescricao(saved.descricao ?? "");
        setNivel(saved.nivel ?? "Base");
        setDuracao(saved.duracao ?? 60);
        setDataTreino(saved.dataTreino ?? "");
        setCategoria(saved.categoria ?? "Sub13");
        setTipoTreino(saved.tipoTreino ?? "Tecnico");
        setObjetivo(saved.objetivo ?? "");
        setExerciciosSelecionados(saved.exerciciosSelecionados ?? []);
        setDicas(saved.dicas ?? []);
        setAtletasSelecionados(saved.atletasSelecionados ?? []);
      }
      restoredRef.current = true;
    }

    setIniciado(true);
  }, []);

  /** =====================  Carregar treinos (visão atleta)  ===================== **/
  useEffect(() => {
    if (!iniciado) return;

    const token =
      (Storage as any).token ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      "";

    const opt: RequestInit = token ? { headers: { Authorization: `Bearer ${token}` } as any } : {};

    (async () => {
      try {
        const urls = [
          `${API.BASE_URL}/api/treinos/disponiveis?tipoUsuarioId=${(Storage as any).tipoUsuarioId ?? ""}`,
          `${API.BASE_URL}/api/treinosprogramados`,
          `${API.BASE_URL}/api/treinos`,
        ];

        for (const url of urls) {
          const r = await fetch(url, opt);
          if (!r.ok) continue;

          const j = await r.json();
          const arr = Array.isArray(j) ? j : j.items ?? j.data ?? j.treinos ?? j.rows ?? j.result ?? [];

          if (Array.isArray(arr) && arr.length) {
            setTreinosDisponiveis(normalizaTreinos(arr));
            return;
          }
        }
        setTreinosDisponiveis([]);
      } catch (e) {
        console.error("Falha ao carregar treinos:", e);
        setTreinosDisponiveis([]);
      }
    })();
  }, [iniciado]);

  /** =====================  Carregar exercícios e atletas  ===================== **/
  useEffect(() => {
    let cancel = { v: false };

    (async () => {
      try {
        const r = await fetch(`${API.BASE_URL}/api/exercicios`);
        if (!r.ok) return;
        const data = await r.json();
        const arr: Exercicio[] = Array.isArray(data) ? data : data.items ?? data.data ?? [];
        if (!cancel.v) {
          setExerciciosDisponiveis(
            arr.map((e: any) => ({
              id: e.id,
              nome: e.nome ?? e.titulo ?? "",
              videoDemonstrativoUrl: e.videoDemonstrativoUrl,
              descricao: e.descricao,
              nivel: e.nivel,
            }))
          );
        }
      } catch {}
    })();

    (async () => {
      try {
        const token =
          (Storage as any).token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token") ||
          "";

        const tipoRaw = (
          (Storage as any).tipoSalvo ??
          localStorage.getItem("tipoUsuario") ??
          sessionStorage.getItem("tipoUsuario") ??
          ""
        )
          .toString()
          .trim()
          .toLowerCase();

        const vinculo = tipoRaw === "escolinha" ? "escola" : tipoRaw;

        const id =
          (Storage as any).tipoUsuarioId ||
          localStorage.getItem("tipoUsuarioId") ||
          sessionStorage.getItem("tipoUsuarioId") ||
          (Storage as any).usuarioId;

        if (!id || !["professor", "clube", "escola"].includes(vinculo)) return;

        const r = await fetch(
          `${API.BASE_URL}/api/relacoes/atletas?vinculo=${encodeURIComponent(vinculo)}&id=${encodeURIComponent(id)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
        );

        let raw: any[] | undefined;
        if (r.ok) {
          const data = await r.json();
          raw = Array.isArray(data)
            ? data
            : data.items ?? data.data ?? data.rows ?? data.result ?? data.atletasVinculados ?? [];
        }

        if (!raw || raw.length === 0) {
          const r2 = await fetch(
            `${API.BASE_URL}/api/treinos/atletas-vinculados?tipoUsuarioId=${encodeURIComponent(id)}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
          );
          if (r2.ok) {
            const d2 = await r2.json();
            raw = Array.isArray(d2) ? d2 : d2.items ?? d2.data ?? [];
          }
        }

        const lista: AtletaVinculado[] = (raw ?? [])
          .map((a: any) => ({
            id: a.id ?? a.atletaId ?? a.usuarioId ?? a?.atleta?.id ?? a?.usuario?.id ?? "",
            nome: a.nome ?? a?.atleta?.usuario?.nome ?? a?.usuario?.nome ?? a?.atleta?.nome ?? "Atleta",
            foto: a.foto ?? a?.atleta?.usuario?.foto ?? a?.usuario?.foto ?? a?.fotoUrl ?? undefined,
          }))
          .filter((x) => x.id);

        setAtletasVinculados(lista);
      } catch (e) {
        console.error("Erro ao carregar atletas vinculados:", e);
        setAtletasVinculados([]);
      }
    })();

    return () => {
      cancel.v = true;
    };
  }, []);

  /** =====================  Autosave  ===================== **/
  useEffect(() => {
    saveState({
      etapa,
      nome,
      descricao,
      nivel,
      duracao,
      dataTreino,
      categoria,
      tipoTreino,
      objetivo,
      exerciciosSelecionados,
      dicas,
      atletasSelecionados,
    });
  }, [
    etapa,
    nome,
    descricao,
    nivel,
    duracao,
    dataTreino,
    categoria,
    tipoTreino,
    objetivo,
    exerciciosSelecionados,
    dicas,
    atletasSelecionados,
  ]);

  /** =====================  Navegação  ===================== **/
  const [completedUntil, setCompletedUntil] = useState<number>(1);
  const goTo = (n: number) => {
    setEtapa(n);
    setCompletedUntil((prev) => Math.max(prev, n));
  };

  /** =====================  Derivados (sempre fora de condicionais!)  ===================== **/
  const exerciciosFiltrados = useMemo(() => {
    const q = filtroEx.trim().toLowerCase();
    if (!q) return exerciciosDisponiveis;
    return exerciciosDisponiveis.filter((e) => {
      const nome = (e.nome || "").toLowerCase();
      const desc = (e.descricao || "").toLowerCase();
      const nivel = (e.nivel || "").toLowerCase();
      return nome.includes(q) || desc.includes(q) || nivel.includes(q);
    });
  }, [filtroEx, exerciciosDisponiveis]);

  /** =====================  Handlers  ===================== **/
  const adicionarExercicio = () => {
    setExerciciosSelecionados((prev) => [...prev, { nome: "", series: "", repeticoes: "", descricao: "" }]);
  };

  const atualizarExercicio = (index: number, campo: keyof ExercicioSelecionado, valor: string) => {
    const copia = [...exerciciosSelecionados];
    (copia[index][campo] as string | undefined) = valor;
    setExerciciosSelecionados(copia);
  };

  const removerExercicio = (index: number) => {
    const novaLista = [...exerciciosSelecionados];
    novaLista.splice(index, 1);
    setExerciciosSelecionados(novaLista);
  };

  const adicionarExercicioExistente = (exercicio: Exercicio) => {
    setExerciciosSelecionados((prev) => [
      ...prev,
      {
        nome: exercicio.nome,
        series: "",
        repeticoes: "",
        descricao: "",
        exercicioId: exercicio.id,
      },
    ]);
  };

  const adicionarDica = () => {
    if (dicaAtual.trim()) {
      setDicas((prev) => [...prev, dicaAtual.trim()]);
      setDicaAtual("");
    }
  };

  // normalizar o par (tipoUsuario, tipoUsuarioId) para o backend
  function getDono() {
    const tipoRaw =
      (Storage as any).tipoSalvo ??
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario") ??
      "";

    // "escola" (frontend) == "Escolinha" (backend)
    const normalized =
      String(tipoRaw).trim().toLowerCase() === "escola" || String(tipoRaw).trim().toLowerCase() === "escolinha"
        ? "Escolinha"
        : String(tipoRaw).trim().toLowerCase() === "professor"
        ? "Professor"
        : String(tipoRaw).trim().toLowerCase() === "clube"
        ? "Clube"
        : null;

    const tipoUsuarioId =
      (Storage as any).tipoUsuarioId ||
      localStorage.getItem("tipoUsuarioId") ||
      sessionStorage.getItem("tipoUsuarioId") ||
      null;

    return { tipoUsuario: normalized as "Professor" | "Clube" | "Escolinha" | null, tipoUsuarioId };
  }

  const criarTreino = async () => {
    try {
      const { tipoUsuario, tipoUsuarioId } = getDono();

      if (!tipoUsuario || !tipoUsuarioId) {
        alert("Erro: não foi possível determinar o dono do treino (Professor/Clube/Escolinha).");
        return;
      }

      if (!usuarioId) {
        alert("Erro: usuário não autenticado.");
        return;
      }

      const token =
        (Storage as any).token ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

      const exerciciosParaEnvio = exerciciosSelecionados.map((ex, index) => ({
        exercicioId: ex.exercicioId,
        nome: ex.nome,
        descricao: ex.descricao,
        repeticoes: ex.repeticoes,
        series: ex.series,
        ordem: index + 1,
      }));

      // gerar um 'codigo' padrão se não houver um input específico
      const codigo =
        `${nome}`.trim()
          ? `${nome}`.toUpperCase().replace(/\s+/g, "-").slice(0, 24) + "-" + Date.now().toString(36)
          : "TP-" + Date.now().toString(36);

      const payload = {
        // obrigatórios
        nome,
        codigo,
        nivel, // "Base" | "Avancado" | "Performance"
        categoria: [categoria], // no schema é Categoria[]
        // opcionais
        tipoTreino,
        objetivo,
        duracao,
        dataAgendada: dataTreino || null,
        dicas,
        metas: null as string | null,
        pontuacao: null as number | null,
        // dono do treino
        tipoUsuario, // "Professor" | "Clube" | "Escolinha"
        tipoUsuarioId, // ID da tabela correspondente
        // exercícios
        exercicios: exerciciosParaEnvio,
        // seleção de atletas (guarda para agendamento posterior em outra rota/fluxo)
        atletasIds: atletasSelecionados,
      };

      const res = await fetch(`${API.BASE_URL}/api/treinosprogramados`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.error("Erro ao criar treino:", errJson);
        alert(errJson?.message || "Erro ao criar treino. Verifique o console.");
        return;
      }

      alert("Treino criado com sucesso!");
      sessionStorage.removeItem(SAVE_KEY);
      setEtapa(1);
      setCompletedUntil(1);
      // opcional: navegar para /treinos
      // navigate("/treinos");
    } catch (e) {
      console.error("Falha inesperada ao criar treino:", e);
      alert("Erro inesperado ao criar treino.");
    }
  };

  const agendarTreino = async (t: TreinoProgramado) => {
    try {
      const atletaId = (Storage as any).tipoUsuarioId;
      const token = (Storage as any).token;

      if (!atletaId || !token) {
        alert("Sessão expirada. Faça login novamente.");
        return;
      }

      const prazoSelecionado = prazos[t.id];
      const quandoISO = prazoSelecionado
        ? new Date(prazoSelecionado).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const res = await fetch(`${API.BASE_URL}/api/treinos/agendados`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          titulo: t.nome,
          dataTreino: quandoISO,
          dataExpiracao: quandoISO,
          atletaId,
          treinoProgramadoId: t.id,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("Falha ao agendar treino:", res.status, txt);
        alert("Erro ao agendar treino.");
        return;
      }

      const novo: TreinoAgendadoResp = await res.json();
      sessionStorage.setItem("lastAgendamento", JSON.stringify(novo));
      navigate("/treinos");

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("treino:agendado", { detail: novo }));
      }, 50);

      setPrazos(({ [t.id]: _, ...rest }) => rest);
      alert("Treino agendado com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao agendar treino.");
    }
  };

  /** =====================  Render  ===================== **/
  if (!iniciado) return <p className="text-center p-4">Carregando...</p>;
  if (!usuario)
    return (
      <div className="p-4 text-center">
        Você precisa estar logado como <b>Escola</b>, <b>Clube</b> ou <b>Professor</b> para criar treinos.
      </div>
    );

  // VISÃO ATLETA
  if (usuario.tipo === "atleta") {
    return (
      <div className="p-4 max-w-xl mx-auto mb-5">
        <h2 className="text-lg font-bold mb-4">Treinos Disponíveis</h2>

        {treinosDisponiveis.length === 0 ? (
          <p className="text-gray-600">Nenhum treino disponível no momento.</p>
        ) : (
          treinosDisponiveis.map((t) => (
            <div key={t.id} className="bg-white border p-4 rounded shadow mb-4">
              
              <h3
                className="text-green-800 text-lg font-semibold cursor-pointer hover:underline"
                onClick={() => navigate(`/treinos/unico?programadoId=${t.id}`)}
                title="Ver detalhes do treino"
              >
                {t.nome}
              </h3>

              <p className="text-sm">
                <strong>Descrição:</strong> {t.descricao}
              </p>

              <p className="text-sm">
                <strong>Nível:</strong> {t.nivel}
              </p>

              <p className="text-sm">
                <strong>Exercícios:</strong>
              </p>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                {t.exercicios.map((ex, i) => (
                  <li key={i}>
                    {ex.nome} {ex.repeticoes ? `(${ex.repeticoes})` : ""}
                  </li>
                ))}
              </ul>

              <label className="text-sm mt-2 block">
                <strong>Prazo para envio: </strong>
              </label>
              <input
                type="datetime-local"
                className="border p-2 rounded"
                value={prazos[t.id] || ""}
                onChange={(e) => setPrazos((prev) => ({ ...prev, [t.id]: e.target.value }))}
              />
              <button
                className="mt-3 bg-green-800 text-white px-5 py-2 rounded ml-3"
                onClick={() => agendarTreino(t)}
              >
                Agendar este treino
              </button>
            </div>
          ))
        )}

        <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-2 flex justify-around items-center shadow-md">
          <Link href="/feed" className="hover:underline">
            <House />
          </Link>
          <Link href="/explorar" className="hover:underline">
            <SearchIcon />
          </Link>
          <Link href="/post" className="hover:underline">
            <CirclePlus />
          </Link>
          <Link href="/treinos" className="hover:underline">
            <Volleyball />
          </Link>
          <Link href="/perfil" className="hover:underline">
            <User />
          </Link>
        </nav>
      </div>
    );
  }

  // VISÃO CRIADOR (escola/clube/professor)
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-bold">Criar Novo Treino</h2>
          <button
            onClick={() => {
              if (confirm("Deseja limpar o progresso deste treino?")) {
                sessionStorage.removeItem(SAVE_KEY);
                setEtapa(1);
                setCompletedUntil(1);
                setNome("");
                setDescricao("");
                setNivel("Base");
                setDuracao(60);
                setDataTreino("");
                setCategoria("Sub13");
                setTipoTreino("Tecnico");
                setObjetivo("");
                setExerciciosSelecionados([]);
                setDicas([]);
                setDicaAtual("");
                setAtletasSelecionados([]);
              }
            }}
            className="text-sm text-red-700 underline"
          >
            Limpar progresso
          </button>
        </div>

        <Stepper current={etapa} onJump={goTo} completedUntil={completedUntil} />

        {/* Etapa 1 */}
        {etapa === 1 && (
          <StepCard title="Informações Básicas">
            <label className="block text-sm text-gray-700 mb-1">Título do Treino</label>
            <input
              className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
              placeholder="Título do Treino"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />

            <label className="block text-sm text-gray-700 mb-1">Descrição</label>
            <textarea
              className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
              placeholder="Descrição do Treino"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Nível do Treino</label>
                <select
                  className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
                  value={nivel}
                  onChange={(e) => setNivel(e.target.value)}
                >
                  <option value="">--</option>
                  <option value="Base">Base</option>
                  <option value="Avancado">Avançado</option>
                  <option value="Performance">Performance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Categoria (Faixa Etária)</label>
                <select
                  className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                >
                  <option value="">--</option>
                  <option value="Sub9">Sub-9</option>
                  <option value="Sub11">Sub-11</option>
                  <option value="Sub13">Sub-13</option>
                  <option value="Sub15">Sub-15</option>
                  <option value="Sub17">Sub-17</option>
                  <option value="Sub20">Sub-20</option>
                  <option value="Livre">Livre</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Tipo do Treino</label>
                <select
                  className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
                  value={tipoTreino}
                  onChange={(e) => setTipoTreino(e.target.value)}
                >
                  <option value="">--</option>
                  <option value="Tecnico">Técnico</option>
                  <option value="Fisico">Físico</option>
                  <option value="Tatico">Tático</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Duração do Treino (minutos)</label>
                <input
                  className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
                  type="number"
                  min={1}
                  value={duracao}
                  onChange={(e) => setDuracao(parseInt(e.target.value || "0") || 0)}
                />
              </div>
            </div>

            <label className="block text-sm text-gray-700 mb-1">Data Agendada (prazo para envio)</label>
            <input
              className="border w-full mb-4 p-2 rounded text-sm sm:text-base"
              type="datetime-local"
              value={dataTreino}
              onChange={(e) => setDataTreino(e.target.value)}
            />

            <div className="flex justify-end">
              <button onClick={() => goTo(2)} className="bg-green-800 text-white px-4 py-2 rounded">
                Próximo
              </button>
            </div>
          </StepCard>
        )}

        {/* Etapa 2 */}
        {etapa === 2 && (
          <>
            <StepCard title="Exercícios Selecionados">
              {exerciciosSelecionados.length === 0 && (
                <div className="text-sm text-gray-600 mb-3">Nenhum exercício adicionado ainda.</div>
              )}

              <div className="space-y-3">
                {exerciciosSelecionados.map((ex, i) => {
                  const base = ex.exercicioId ? exerciciosDisponiveis.find((e) => e.id === ex.exercicioId) : undefined;

                  const videoSrc = base?.videoDemonstrativoUrl
                    ? base.videoDemonstrativoUrl.startsWith("http")
                      ? base.videoDemonstrativoUrl
                      : `${API.BASE_URL}${base.videoDemonstrativoUrl}`
                    : "";

                  const nomeFinal = base?.nome ?? ex.nome;
                  const nivelFinal = base?.nivel;
                  const descFinal = base?.descricao ?? ex.descricao;

                  const ehDoBanco = Boolean(ex.exercicioId);

                  return (
                    <div key={i} className="border rounded-lg p-3 relative bg-white shadow-sm">
                      <button
                        onClick={() => removerExercicio(i)}
                        className="absolute top-2 right-2 text-red-600 text-sm"
                        title="Remover exercício"
                      >
                        Remover
                      </button>

                      <div className="flex flex-col sm:flex-row gap-3 items-start">
                        {/* Mídia */}
                        {videoSrc ? (
                          <video
                            className="w-full h-44 sm:w-44 sm:h-28 rounded bg-black object-cover shrink-0"
                            src={videoSrc}
                            controls
                            preload="metadata"
                          />
                        ) : (
                          <div className="w-full h-44 sm:w-44 sm:h-28 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-600 shrink-0">
                            sem vídeo
                          </div>
                        )}

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          {/* Título + nível */}
                          <div className="flex items-center gap-2 mb-1">
                            {ehDoBanco ? (
                              <div className="font-semibold">{nomeFinal}</div>
                            ) : (
                              <input
                                className="border p-1 rounded w-full"
                                placeholder="Nome do exercício"
                                value={ex.nome}
                                onChange={(e) => atualizarExercicio(i, "nome", e.target.value)}
                              />
                            )}

                            {nivelFinal ? (
                              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300">
                                {nivelFinal}
                              </span>
                            ) : null}
                          </div>

                          {/* Descrição (só leitura se veio do banco) */}
                          {ehDoBanco ? (
                            <p className="text-sm text-gray-700 mb-2 whitespace-pre-line">
                              {descFinal || "Sem descrição."}
                            </p>
                          ) : (
                            <textarea
                              className="border w-full mb-2 p-1 rounded"
                              placeholder="Descrição"
                              value={ex.descricao}
                              onChange={(e) => atualizarExercicio(i, "descricao", e.target.value)}
                            />
                          )}

                          {/* Inputs de séries e repetições */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Séries</label>
                              <input
                                className="border w-full p-1 rounded"
                                placeholder="ex.: 3"
                                value={ex.series}
                                onChange={(e) => atualizarExercicio(i, "series", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Repetições</label>
                              <input
                                className="border w-full p-1 rounded"
                                placeholder="ex.: 12"
                                value={ex.repeticoes}
                                onChange={(e) => atualizarExercicio(i, "repeticoes", e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button onClick={adicionarExercicio} className="bg-gray-200 px-3 py-1 rounded mb-2 mt-3">
                + Adicionar linha (personalizado)
              </button>
            </StepCard>

            <div className="h-4" />

            <StepCard title="Exercícios Disponíveis">
              {/* Busca */}
              <div className="mb-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    className="border w-full p-2 pl-9 rounded text-sm"
                    placeholder="Buscar por nome, nível ou descrição..."
                    value={filtroEx}
                    onChange={(e) => setFiltroEx(e.target.value)}
                  />
                  <SearchIcon className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                <span className="text-xs text-gray-600 whitespace-nowrap">
                  {exerciciosFiltrados.length} resultado(s)
                </span>
              </div>

              {/* Lista rolável */}
              <ul className="divide-y divide-gray-200 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto pr-1">
                {exerciciosFiltrados.map((exercicio) => {
                  const videoParcial = exercicio.videoDemonstrativoUrl;
                  const videoSrc = videoParcial
                    ? videoParcial.startsWith("http")
                      ? videoParcial
                      : `${API.BASE_URL}${videoParcial}`
                    : "";

                  return (
                    <li key={exercicio.id} className="py-3">
                      <div className="flex flex-col sm:flex-row gap-3 items-start">
                        {/* Thumb / vídeo */}
                        {videoSrc ? (
                          <video
                            className="w-full h-40 sm:w-40 sm:h-24 rounded bg-black object-cover shrink-0"
                            src={videoSrc}
                            controls
                            preload="metadata"
                          />
                        ) : (
                          <div className="w-full h-40 sm:w-40 sm:h-24 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-600 shrink-0">
                            sem vídeo
                          </div>
                        )}

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold truncate">{exercicio.nome}</div>
                            {exercicio.nivel ? (
                              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300">
                                {exercicio.nivel}
                              </span>
                            ) : null}
                          </div>
                          {exercicio.descricao ? (
                            <p className="text-sm text-gray-700 mt-1 line-clamp-2">{exercicio.descricao}</p>
                          ) : null}
                        </div>

                        {/* Ação */}
                        <button
                          onClick={() => adicionarExercicioExistente(exercicio)}
                          className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded w-full sm:w-auto"
                          title="Adicionar ao treino"
                        >
                          Adicionar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Controles da etapa */}
              <div className="flex flex-col sm:flex-row justify-between gap-2 mt-6">
                <button onClick={() => goTo(1)} className="bg-gray-200 px-4 py-2 rounded w-full sm:w-auto">
                  Voltar
                </button>
                <button onClick={() => goTo(3)} className="bg-green-800 text-white px-4 py-2 rounded w-full sm:w-auto">
                  Próximo
                </button>
              </div>
            </StepCard>
          </>
        )}

        {/* Etapa 3 */}
        {etapa === 3 && (
          <StepCard title="Dicas para os Atletas">
            <div className="flex gap-2 mb-3">
              <input
                className="border w-full p-2 rounded"
                placeholder="Ex: Mantenha a postura correta"
                value={dicaAtual}
                onChange={(e) => setDicaAtual(e.target.value)}
              />
              <button onClick={adicionarDica} className="bg-gray-300 px-3 py-2 rounded">
                + Adicionar
              </button>
            </div>

            <ul className="list-disc pl-5 text-sm text-gray-700">
              {dicas.map((dica, i) => (
                <li key={i}>{dica}</li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row justify-between gap-2 mt-6">
              <button onClick={() => goTo(2)} className="bg-gray-200 px-4 py-2 rounded w-full sm:w-auto">
                Voltar
              </button>
              <button onClick={() => goTo(4)} className="bg-green-800 text-white px-4 py-2 rounded w-full sm:w-auto">
                Próximo
              </button>
            </div>
          </StepCard>
        )}

        {/* Etapa 4 */}
        {etapa === 4 && (
          <StepCard title="Selecionar Atletas Vinculados">
            {atletasVinculados.length === 0 ? (
              <div className="bg-gray-100 text-gray-600 text-center py-6 rounded">
                Nenhum atleta vinculado encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {atletasVinculados.map((atleta) => {
                  const selecionado = atletasSelecionados.includes(atleta.id);
                  return (
                    <div
                      key={atleta.id}
                      onClick={() =>
                        setAtletasSelecionados((prev) =>
                          selecionado ? prev.filter((id) => id !== atleta.id) : [...prev, atleta.id]
                        )
                      }
                      className={`cursor-pointer p-4 rounded-xl shadow-md text-center border-2 transition-all duration-200 ${
                        selecionado ? "border-green-500 bg-green-50" : "border-gray-200"
                      }`}
                    >
                      <img
                        src={atleta.foto ? `${atleta.foto}` : "https://via.placeholder.com/80"}
                        alt={atleta.nome}
                        className="w-20 h-20 mx-auto rounded-full object-cover mb-2"
                      />
                      <p className="font-semibold text-sm sm:text-base">{atleta.nome}</p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between gap-2 mt-6">
              <button onClick={() => goTo(3)} className="bg-gray-200 px-4 py-2 rounded w-full sm:w-auto">
                Voltar
              </button>
              <button onClick={criarTreino} className="bg-green-800 text-white px-4 py-2 rounded w-full sm:w-auto">
                Salvar Treino
              </button>
            </div>
          </StepCard>
        )}
      </div>
    </div>
  );
}
