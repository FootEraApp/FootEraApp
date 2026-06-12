// client/src/components/turmas/TurmasManager
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  X,
  Loader2,
  Plus,
  Users,
  User,
  List,
  Save,
  Search,
  CalendarClock,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from "lucide-react";
import { API } from "../../config.js";
import Storage from "../../utils/storage.js";
import AgendaTreinos from "../../components/agenda/AgendaTreinos";

type TurmaMin = {
  id: string;
  nome: string;
  descricao?: string | null;
  categoria?: string[] | string | null;
  professorIds?: string[];
  professorNomes?: string[];
  professorNome?: string | null;
  alunosCount?: number;
  ownerTipo?: "Clube" | "Escolinha" | null;
  ownerId?: string | null;
  criadoPorProfessorId?: string | null;
};

type ProfessorMin = { id: string; nome: string };
type AtletaMin = { usuarioId: string; nome: string; sobrenome?: string };

type VinculoTipo =
  | "CLUBE"
  | "ESCOLINHA"
  | "RELACAO_INSTITUICAO"
  | "RELACAO_PROFESSOR"
  | "NENHUM";

type TurmaAluno = {
  usuarioId: string;
  atletaId?: string | null;
  nome: string;
  sobrenome?: string;
  foto?: string | null;

  vinculado: boolean;
  vinculoTipo?: VinculoTipo;
  vinculoProfessorId?: string | null;
};

type Owner = { tipo: "Clube" | "Escolinha"; id: string; usuarioId?: string };

const CATEGORIAS_TURMA = [
  "Sub3",
  "Sub5",
  "Sub7",
  "Sub9",
  "Sub11",
  "Sub13",
  "Sub15",
  "Sub16",
  "Livre",
];

function normalizarCategoriasTurma(v: any): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function ordenarCategorias(categorias: string[]): string[] {
  return [...categorias].sort((a, b) => {
    if (a === "Livre") return 1;
    if (b === "Livre") return -1;

    const numA = parseInt(a.replace("Sub", ""));
    const numB = parseInt(b.replace("Sub", ""));

    return numA - numB;
  });
}

export default function TurmasManager({
  open,
  onClose,
  owner,
  professorId,
  initialTurmaId,
}: {
  open: boolean;
  onClose: () => void;
  owner?: Owner;
  professorId?: string;
  initialTurmaId?: string;
}) {
  const getToken = () =>
    (Storage as any).token ??
    localStorage.getItem("token") ??
    sessionStorage.getItem("token") ??
    "";

  function readAnyKey(key: string): string | null {
    const v = localStorage.getItem(key) || sessionStorage.getItem(key);
    return v && v.trim().length ? v : null;
  }

  function safeJsonParse<T = any>(v: string | null): T | null {
    if (!v) return null;
    try { return JSON.parse(v) as T; } catch { return null; }
  }

  function readUserObj(): any | null {
    return (
      safeJsonParse(localStorage.getItem("user")) ??
      safeJsonParse(sessionStorage.getItem("user")) ??
      safeJsonParse(localStorage.getItem("usuario")) ??
      safeJsonParse(sessionStorage.getItem("usuario")) ??
      null
    );
  }

  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const professorAlvoId = String(professorId ?? "").trim();
  const userObj = readUserObj();
  const meuProfessorId =
    String(
      (Storage as any)?.professor?.id ||
        (Storage as any)?.user?.professorId ||
        (Storage as any)?.usuario?.professorId ||
        (Storage as any)?.user?.tipoUsuarioId ||
        (Storage as any)?.usuario?.tipoUsuarioId ||
        userObj?.professor?.id ||
        userObj?.professorId ||
        userObj?.tipoUsuarioId ||
        userObj?.usuario?.professorId ||
        userObj?.usuario?.tipoUsuarioId ||
        readAnyKey("professorId") ||
        readAnyKey("tipoUsuarioId") ||
        ""
    ).trim();

  const tipoUsuarioLogado = String(
    (Storage as any)?.user?.tipoUsuario ||
      (Storage as any)?.usuario?.tipoUsuario ||
      userObj?.tipoUsuario ||
      userObj?.usuario?.tipoUsuario ||
      userObj?.user?.tipoUsuario ||
      userObj?.role ||
      userObj?.tipo ||
      readAnyKey("tipoUsuario") ||
      readAnyKey("usuarioTipoRaw") ||
      readAnyKey("role") ||
      readAnyKey("userType") ||
      ""
  )
    .toLowerCase()
    .trim();

  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [deletandoTurma, setDeletandoTurma] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [leaveAware, setLeaveAware] = useState(false);
  const [leavingTurma, setLeavingTurma] = useState(false);
  const [confirmDeleteStep, setConfirmDeleteStep] = useState<1 | 2>(1);
  const [turmas, setTurmas] = useState<TurmaMin[]>([]);
  const [profs, setProfs] = useState<ProfessorMin[]>([]);
  const [alunos, setAlunos] = useState<AtletaMin[]>([]);
  const [filtroProf, setFiltroProf] = useState<string>(professorAlvoId || "");
  const [selecionada, setSelecionada] = useState<string>("");
  const [profSelecionados, setProfSelecionados] = useState<string[]>([]);
  const [alunosSelecionados, setAlunosSelecionados] = useState<string[]>([]);
  const [dirtyProf, setDirtyProf] = useState(false);
  const [dirtyAlunos, setDirtyAlunos] = useState(false);
  const [filtroAluno, setFiltroAluno] = useState("");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [abaDireita, setAbaDireita] = useState<"membros" | "agenda" | "frequencia">("membros");
  const [turmaAlunos, setTurmaAlunos] = useState<TurmaAluno[]>([]);
  const [naoVinculadosUsuarioIds, setNaoVinculadosUsuarioIds] = useState<string[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novoDescricao, setNovoDescricao] = useState("");
  const [novoCategorias, setNovoCategorias] = useState<string[]>([]);
  const [editandoInfoTurma, setEditandoInfoTurma] = useState(false);
  const [editNomeTurma, setEditNomeTurma] = useState("");
  const [editDescricaoTurma, setEditDescricaoTurma] = useState("");
  const [editCategoriasTurma, setEditCategoriasTurma] = useState<string[]>([]);
  const [novoProfessores, setNovoProfessores] = useState<string[]>(
    professorId ? [professorId] : []
  );
  const [freqLoading, setFreqLoading] = useState(false);
  const [freqData, setFreqData] = useState<any>(null);
  const [freqYear, setFreqYear] = useState(new Date().getFullYear());
  
  const turmaSelecionada = useMemo(
    () => turmas.find((t) => String(t.id) === String(selecionada)),
    [turmas, selecionada]
  );

  const podeGerenciarTurma = useMemo(() => {
    if (!turmaSelecionada) return false;

    const professorIds = (turmaSelecionada.professorIds ?? []).map((x) =>
      String(x).trim()
    );

    if (!owner && meuProfessorId) {
      return professorIds.includes(String(meuProfessorId).trim());
    }

    if (owner?.id && turmaSelecionada.ownerId) {
      return String(owner.id).trim() === String(turmaSelecionada.ownerId).trim();
    }

    return false;
  }, [turmaSelecionada, owner?.id, meuProfessorId]);

  const podeExcluirTurma = podeGerenciarTurma; 
  const podeSairDaTurma = useMemo(() => {
    if (!meuProfessorId) return false;
    if (!turmaSelecionada) return false;

    const ids = (turmaSelecionada.professorIds ?? []).map((x) => String(x).trim());
    const match = ids.includes(String(meuProfessorId).trim());

    if (tipoUsuarioLogado === "professor") return match && !podeGerenciarTurma;
    if (!tipoUsuarioLogado) return match && !podeGerenciarTurma;

    return false;
  }, [meuProfessorId, turmaSelecionada, tipoUsuarioLogado, podeGerenciarTurma]);

  function formatYMD(ano: number, mesZeroBased: number, dia: number): string {
    const m = String(mesZeroBased + 1).padStart(2, "0");
    const d = String(dia).padStart(2, "0");
    return `${ano}-${m}-${d}`;
  }

  function dateKeyLocal(date: Date): string {
    return formatYMD(date.getFullYear(), date.getMonth(), date.getDate());
  }

  useEffect(() => {
    if (open) setFiltroProf(professorAlvoId || "");
  }, [open, professorAlvoId]);

  useEffect(() => {
    if (!open) return;
    setAbaDireita("membros");
    setLeftCollapsed(false);
    setConfirmDeleteOpen(false);
    setConfirmDeleteStep(1);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    (async () => {
      setLoading(true);
      try {
        if (!owner) {
          setProfs([]);
          setAlunos([]);

          const lista = await carregarTurmas(undefined, filtroProf);
          const tid = String(initialTurmaId ?? "").trim();
          let alvoId: string | undefined;

          if (tid) {
            alvoId = lista.find((t) => t.id === tid)?.id;
          }

          if (!alvoId && lista.length > 0) {
            alvoId = lista[0].id;
          }

          if (alvoId && alvoId !== selecionada) {
            const turmaAlvo = lista.find((t) => t.id === alvoId);
            await abrirTurma(alvoId, turmaAlvo);
          }
          return;
        }

        const orgId = owner.id;
        const resP = await axios.get(`${API.BASE_URL}/api/gerenciar/professores`, {
          headers,
          params: {
            vinculo: owner.tipo === "Clube" ? "clube" : "escolinha",
            id: orgId,
            limit: 200,
          },
        });

        let lp = (resP.data?.professores || resP.data || []) as any[];

        if (!lp.length) {
          const resAlt = await axios.get(`${API.BASE_URL}/api/professores`, {
            headers,
            params: {
              organizacaoId: owner.id,
              clubeId: owner.id,
              tipoUsuarioId: owner.id,
            },
          });
          lp = (resAlt.data?.professores || resAlt.data?.items || resAlt.data || []) as any[];
        }

        setProfs(
          lp.map((p) => ({
            id: String(p.id),
            nome: p.nome ?? p.usuario?.nome ?? "Professor",
          }))
        );

        const resA = await axios.get(`${API.BASE_URL}/api/gerenciar/atletas`, {
          headers,
          params: {
            vinculo: owner.tipo === "Clube" ? "clube" : "escolinha",
            id: orgId,
            order: "nome_asc",
            limit: 1000,
          },
        });

        const la = (resA.data?.atletas || []) as any[];

        setAlunos(
          la.map((a) => {
            const usuarioId = String(a.usuarioId ?? a.usuario?.id ?? a.id);
            const nome = String(a.nome ?? a.usuario?.nome ?? "").trim();
            const sobrenome = String(a.sobrenome ?? a.usuario?.sobrenome ?? "").trim();
            const nomeCompleto =
              [nome, sobrenome].filter(Boolean).join(" ").trim() || "Atleta";

            return {
              usuarioId,
              nome: nomeCompleto,
              sobrenome: sobrenome || undefined,
            };
          })
        );

        const lista = await carregarTurmas(owner, filtroProf);
        const tid = String(initialTurmaId ?? "").trim();

        let alvoId: string | undefined;

        if (tid) {
          alvoId = lista.find((t) => t.id === tid)?.id;
        }

        if (!alvoId && lista.length > 0) {
          alvoId = lista[0].id;
        }

        if (alvoId && alvoId !== selecionada) {
          const turmaAlvo = lista.find((t) => t.id === alvoId);
          await abrirTurma(alvoId, turmaAlvo);
        }
      } finally {
        setLoading(false);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, owner?.id, initialTurmaId]);

  useEffect(() => {
    if (!open) return;
    void carregarTurmas(owner, filtroProf); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, owner?.id, filtroProf]);

  useEffect(() => {
    if (abaDireita === "agenda") setLeftCollapsed(true);
  }, [abaDireita]);

  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !selecionada) return;
    if (abaDireita !== "frequencia") return;

    (async () => {
      try {
        setFreqLoading(true);
        const r = await axios.get(`${API.BASE_URL}/api/turmas/${selecionada}/frequencia`, {
          headers,
          params: { year: freqYear },
        });
        setFreqData(r.data);
      } catch (e: any) {
        alert(e?.response?.data?.message || e?.message || "Falha ao carregar frequência.");
        setFreqData(null);
      } finally {
        setFreqLoading(false);
      }
    })();
  }, [open, selecionada, abaDireita, freqYear]);

  const carregarTurmas = async (o?: Owner, professorFiltro?: string) => {
    const resT = o
      ? await axios.get(`${API.BASE_URL}/api/turmas`, {
          headers,
          params: { ownerTipo: o.tipo, ownerId: o.id },
        })
      : await axios.get(`${API.BASE_URL}/api/turmas/como-professor`, {
          headers,
        });

    const lt = (resT.data?.items || resT.data || []) as any[];

    const parsed: TurmaMin[] = lt.map((t) => {
      const professorIds = Array.isArray(t.professorIds) ? t.professorIds.map(String) : [];
      const professorNomes = Array.isArray(t.professorNomes) ? t.professorNomes : [];

      return {
        id: String(t.id),
        nome: String(t.nome ?? "Turma"),
        descricao: t.descricao ? String(t.descricao) : null,
        categoria: normalizarCategoriasTurma(t.categoria),
        professorIds,
        professorNomes,
        professorNome: t.professorNome ?? (professorNomes.length ? professorNomes.join(", ") : null),
        alunosCount: t.alunosCount ?? 0,

        ownerTipo: (t.ownerTipo ?? t.organizacaoTipo ?? null) as any,
        ownerId: t.ownerId ? String(t.ownerId) : null,
        criadoPorProfessorId: t.criadoPorProfessorId ? String(t.criadoPorProfessorId) : null,
      };
    });

    if (!o) {
      const map = new Map<string, string>();

      parsed.forEach((t) => {
        const ids = (t.professorIds || []).map(String);
        const nomes = Array.isArray(t.professorNomes) ? t.professorNomes : [];

        ids.forEach((pid, idx) => {
          const nome =
            String(nomes[idx] ?? "").trim() ||
            String(t.professorNome ?? "").trim() ||
            "Professor";

          if (pid && !map.has(pid)) map.set(pid, nome);
        });
      });

      setProfs(Array.from(map.entries()).map(([id, nome]) => ({ id, nome })));
    }

    const profFiltro = (professorFiltro ?? filtroProf)?.trim();

    const filtradas = profFiltro
      ? parsed.filter((t) => (t.professorIds ?? []).includes(String(profFiltro)))
      : parsed;

    setTurmas(filtradas);
    return filtradas;
  };

  const onFiltrarProf = async (prof: string) => {
    setFiltroProf(prof);
    await carregarTurmas(owner, prof);
  };

  const abrirTurma = async (id: string, turmaFromList?: TurmaMin) => {
    setSelecionada(id);
    setConfirmLeaveOpen(false);
    setLeaveAware(false);

    const turma = turmaFromList ?? turmas.find((t) => t.id === id);

    setEditNomeTurma(turma?.nome || "");
    setEditCategoriasTurma(
      ordenarCategorias(normalizarCategoriasTurma(turma?.categoria))
    );
    setEditDescricaoTurma((turma as any)?.descricao || "");
    setEditandoInfoTurma(false);

    const idsProf = (turma?.professorIds || []).map(String).filter(Boolean);
    setProfSelecionados(idsProf);
    setDirtyProf(false);

    const res = await axios.get(`${API.BASE_URL}/api/turmas/${id}/alunos`, { headers });

    if (!owner && Array.isArray(res.data?.disponiveis)) {
      const disponiveis = res.data.disponiveis as any[];

      setAlunos(
        disponiveis.map((d) => ({
          usuarioId: String(d.usuarioId),
          nome: String(d.usuario?.nome ?? "Atleta"),
          sobrenome: undefined,
        }))
      );
    }

    const usuarioIds: string[] = Array.isArray(res.data?.usuarioIds)
      ? res.data.usuarioIds.map(String) 
      : Array.isArray(res.data?.alunos)
        ? res.data.alunos.filter((x: any) => x?.inTurma).map((x: any) => String(x.usuarioId)).filter(Boolean)
        : [];

    const alunosTurma: TurmaAluno[] = Array.isArray(res.data?.alunos)
      ? res.data.alunos
          .map((a: any) => {
            const u = a?.usuario ?? {};
            const nome = String(u?.nome ?? a?.nome ?? "").trim();
            const sobrenome = String(u?.sobrenome ?? a?.sobrenome ?? "").trim();
            const nomeCompleto = [nome, sobrenome].filter(Boolean).join(" ").trim() || "Atleta";

            return {
              usuarioId: String(a?.usuarioId ?? u?.id ?? ""),
              atletaId: a?.atletaId ? String(a.atletaId) : null,
              nome: nomeCompleto,
              sobrenome: sobrenome || undefined,
              foto: (u?.foto ?? a?.foto ?? null) as any,

              vinculado: !!a?.vinculado,
              vinculoTipo: (a?.vinculoTipo ?? (a?.vinculado ? "RELACAO_INSTITUICAO" : "NENHUM")) as any,
              vinculoProfessorId: a?.vinculoProfessorId ? String(a.vinculoProfessorId) : null,
            };
          })
          .filter((x: TurmaAluno) => !!x.usuarioId)
      : [];

    setTurmaAlunos(alunosTurma);

    const naoVinc: string[] = Array.isArray(res.data?.naoVinculadosUsuarioIds)
      ? res.data.naoVinculadosUsuarioIds.map(String)
      : alunosTurma
          .filter((x) => (x.vinculoTipo ?? (x.vinculado ? "RELACAO_INSTITUICAO" : "NENHUM")) === "NENHUM")
          .map((x) => x.usuarioId);

    setNaoVinculadosUsuarioIds(naoVinc);
    setAlunosSelecionados(usuarioIds);
    setDirtyAlunos(false);
  };

  const salvarInfoTurma = async () => {
    if (!selecionada) return;
    if (!editNomeTurma.trim()) return alert("Informe o nome da turma.");

    try {
      setSalvando(true);

      await axios.put(
        `${API.BASE_URL}/api/turmas/${selecionada}`,
        {
          nome: editNomeTurma.trim(),
          descricao: editDescricaoTurma.trim() || null,
          categoria: ordenarCategorias(editCategoriasTurma),
        },
        { headers }
      );

      alert("Dados da turma atualizados!");

      if (owner) {
        const lista = await carregarTurmas(owner, filtroProf);
        const turmaAtualizada = lista.find((t) => t.id === selecionada);
        if (turmaAtualizada) await abrirTurma(selecionada, turmaAtualizada);
      } else {
        const lista = await carregarTurmas(undefined, filtroProf);
        const turmaAtualizada = lista.find((t) => t.id === selecionada);
        if (turmaAtualizada) await abrirTurma(selecionada, turmaAtualizada);
      }

      setEditandoInfoTurma(false);
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Falha ao atualizar turma.");
    } finally {
      setSalvando(false);
    }
  };

  const salvarMembros = async () => {
    if (!selecionada) return;
    setSalvando(true);

    try {
      let totalAlunosAtualizado = alunosSelecionados.length;

      if (dirtyProf) {
        await axios.put(
          `${API.BASE_URL}/api/turmas/${selecionada}/vincular-professor`,
          { professorIds: profSelecionados },
          { headers }
        );
      }

      if (dirtyAlunos) {
        const r = await axios.post(
          `${API.BASE_URL}/api/turmas/${selecionada}/alunos`,
          { usuarioIds: alunosSelecionados },
          { headers }
        );

        totalAlunosAtualizado = Number(r.data?.total ?? alunosSelecionados.length);
      }

      setTurmas((prev) =>
        prev.map((t) =>
          String(t.id) === String(selecionada)
            ? {
                ...t,
                alunosCount: totalAlunosAtualizado,
                professorIds: profSelecionados,
                professorNomes: t.professorNomes?.filter((_, idx) =>
                  profSelecionados.includes(String(t.professorIds?.[idx] ?? ""))
                ),
                professorNome:
                  t.professorNomes
                    ?.filter((_, idx) =>
                      profSelecionados.includes(String(t.professorIds?.[idx] ?? ""))
                    )
                    .join(", ") || null,
              }
            : t
        )
      );

      const lista = await carregarTurmas(owner, filtroProf);
      const turmaAtualizada = lista.find((t) => String(t.id) === String(selecionada));

      if (turmaAtualizada) {
        await abrirTurma(selecionada, turmaAtualizada);
      } else {
        setSelecionada("");
        setProfSelecionados([]);
        setAlunosSelecionados([]);

        const primeira = lista[0];
        if (primeira) {
          await abrirTurma(primeira.id, primeira);
        }
      }

      setDirtyProf(false);
      setDirtyAlunos(false);

      alert(
        dirtyAlunos
          ? `Turma atualizada! (${totalAlunosAtualizado} aluno(s))`
          : "Turma atualizada!"
      );
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Falha ao salvar turma");
    } finally {
      setSalvando(false);
    }
  };

  const pedirSairDaTurma = () => {
    if (!selecionada) return;
    setLeaveAware(false);
    setConfirmLeaveOpen(true);
  };

  const confirmarSairDaTurma = async () => {
    if (!selecionada) return;
    if (!meuProfessorId) return alert("Não foi possível identificar seu professorId.");

    try {
      setLeavingTurma(true);

      const novos = (profSelecionados || []).filter((id) => String(id) !== String(meuProfessorId));

      await axios.put(
        `${API.BASE_URL}/api/turmas/${selecionada}/vincular-professor`,
        { professorIds: novos },
        { headers }
      );

      alert("Você foi removido da turma. Ela não aparecerá mais para você.");

      const lista = await carregarTurmas(undefined, filtroProf);
      const primeira = lista?.[0]?.id;

      setConfirmLeaveOpen(false);
      setSelecionada("");

      if (primeira) {
        await abrirTurma(primeira);
      }
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Falha ao sair da turma.");
    } finally {
      setLeavingTurma(false);
    }
  };

  const deletarTurmaSelecionada = async () => {
    const turmaId = String(selecionada || "").trim();
    if (!turmaId) return;
    setConfirmDeleteStep(1);
    setConfirmDeleteOpen(true);
  };

  const confirmarExclusaoTurma = async () => {
    const turmaId = String(selecionada || "").trim();
    if (!turmaId) return;

    try {
      setDeletandoTurma(true);
      await axios.delete(`${API.BASE_URL}/api/turmas/${turmaId}`, { headers });

      setConfirmDeleteOpen(false);
      alert("Turma excluída!");
      fecharModal();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Falha ao excluir turma.");
    } finally {
      setDeletandoTurma(false);
    }
  };

  const criarTurma = async () => {
    if (!novoNome.trim()) return alert("Dê um nome para a turma");

    const professoresDaNovaTurma = owner
      ? novoProfessores
      : meuProfessorId
        ? [meuProfessorId]
        : [];

    if (!owner && professoresDaNovaTurma.length === 0) {
      return alert("Não foi possível identificar o professor logado.");
    }

    setSalvando(true);

    try {
      const payload: any = {
        nome: novoNome.trim(),
        descricao: novoDescricao.trim() || null,
        categoria: novoCategorias || undefined,
        professorIds: professoresDaNovaTurma,
      };

      if (owner) {
        payload.ownerTipo = owner.tipo;
        payload.ownerId = owner.id;
      }

      const res = await axios.post(`${API.BASE_URL}/api/turmas`, payload, { headers });
      const novaId = String(res.data?.id || "");

      if (novaId && professoresDaNovaTurma.length) {
        await axios.put(
          `${API.BASE_URL}/api/turmas/${novaId}/vincular-professor`,
          { professorIds: professoresDaNovaTurma },
          { headers }
        );
      }

      setNovoNome("");
      setNovoDescricao("");
      setNovoCategorias([]);

      const lista = await carregarTurmas(owner, filtroProf);
      setSelecionada(novaId);

      const turmaNova = lista.find((t) => t.id === novaId);
      if (novaId) await abrirTurma(novaId, turmaNova);

      alert("Turma criada!");
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Falha ao criar turma");
    } finally {
      setSalvando(false);
    }
  };

  const termoAluno = filtroAluno.trim().toLowerCase();
  const setSel = useMemo(() => new Set(alunosSelecionados.map(String)), [alunosSelecionados]);

  const turmaAlunosMap = useMemo(() => {
    const m = new Map<string, TurmaAluno>();
    (turmaAlunos || []).forEach((a) => {
      const k = String(a.usuarioId || "").trim();
      if (k) m.set(k, a);
    });
    return m;
  }, [turmaAlunos]);

  const alunosMap = useMemo(() => {
    const m = new Map<string, AtletaMin>();
    (alunos || []).forEach((a) => {
      const k = String(a.usuarioId || "").trim();
      if (k) m.set(k, a);
    });
    return m;
  }, [alunos]);

  const naoVincSet = useMemo(
    () => new Set((naoVinculadosUsuarioIds || []).map(String)),
    [naoVinculadosUsuarioIds]
  );

  const alunosNaTurma = useMemo(() => {
    const selecionados = alunosSelecionados.map(String);

    const merged: TurmaAluno[] = selecionados
      .map((uid) => {
        const fromTurma = turmaAlunosMap.get(uid);
        if (fromTurma) return fromTurma;

        const base = alunosMap.get(uid);
        const nome = String(base?.nome ?? "Atleta").trim();
        const naoVinculado = naoVincSet.has(uid);

        return {
          usuarioId: uid,
          atletaId: null,
          nome,
          sobrenome: base?.sobrenome,
          foto: null,
          vinculado: !naoVinculado,
          vinculoTipo: naoVinculado ? "NENHUM" : "RELACAO_INSTITUICAO",
          vinculoProfessorId: null,
        } as TurmaAluno;
      })
      .filter((a) => !!a.usuarioId);

    const termo = termoAluno ? termoAluno.toLowerCase() : "";
    return termo ? merged.filter((a) => (a.nome || "").toLowerCase().includes(termo)) : merged;
  }, [alunosSelecionados, turmaAlunosMap, alunosMap, naoVincSet, termoAluno]);

  const alunosForaDaTurma = useMemo(() => {
    return alunos
      .filter((a) => !setSel.has(String(a.usuarioId)))
      .filter((a) => (termoAluno ? (a.nome || "").toLowerCase().includes(termoAluno) : true));
  }, [alunos, setSel, termoAluno]);

  const membrosNaoVinculados = useMemo(
    () => alunosNaTurma.filter((a) => (a.vinculoTipo ?? (a.vinculado ? "RELACAO_INSTITUICAO" : "NENHUM")) === "NENHUM"),
    [alunosNaTurma]
  );

  const bloqueiaAgendarTurma = membrosNaoVinculados.length > 0;

  const fecharModal = () => {
    setSelecionada("");
    setProfSelecionados([]);
    setAlunosSelecionados([]);
    setDirtyProf(false);
    setDirtyAlunos(false);
    setFiltroAluno("");
    setAbaDireita("membros");
    setLeftCollapsed(false);

    setConfirmDeleteOpen(false);
    setConfirmDeleteStep(1);

    setTurmaAlunos([]);
    setNaoVinculadosUsuarioIds([]);

    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40">
      <div
        className="
          absolute inset-0
          w-screen h-[100dvh]
          max-w-none max-h-none
          rounded-none
          bg-white
          flex flex-col
        "
      >
        <div className="flex items-center justify-between border-b border-zinc-100 p-4">
          <div className="text-sm font-semibold text-zinc-900">
            {owner ? `${owner.tipo} · Gerenciar turmas` : "Gerenciar turmas"}
          </div>
          <button onClick={fecharModal} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 sm:p-4">
          <div
            className={`grid grid-cols-1 gap-4 min-w-0 ${
              leftCollapsed ? "md:grid-cols-1" : "md:grid-cols-3"
            }`}
          >
            <div className={`${leftCollapsed ? "hidden" : "md:col-span-1"} flex flex-col gap-3`}>
              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="mb-2 text-sm font-medium text-zinc-900 flex items-center gap-2">
                  <User className="h-4 w-4" /> Professor
                </div>
                <select
                  value={filtroProf}
                  onChange={(e) => onFiltrarProf(e.target.value)}
                  className="w-full rounded-lg border border-green-200 px-3 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  {profs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white flex flex-col min-h-0">
                <div className="border-b border-zinc-100 p-3 text-sm font-medium text-zinc-900 flex items-center gap-2">
                  <List className="h-4 w-4" /> Turmas
                </div>
                {loading ? (
                  <div className="p-4 text-center text-zinc-600">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </div>
                ) : turmas.length === 0 ? (
                  <div className="p-4 text-center text-zinc-500">Nenhuma turma.</div>
                ) : (
                  <ul className="overflow-visible">
                    {turmas.map((t) => (
                      <li
                        key={t.id}
                        onClick={() => abrirTurma(t.id, t)}
                        className={`flex cursor-pointer items-center justify-between p-3 hover:bg-zinc-50 ${
                          selecionada === t.id ? "bg-zinc-50" : ""
                        }`}
                      >
                        <div>
                          <div className="text-sm font-medium text-zinc-900">{t.nome}</div>

                          {t.descricao ? (
                            <div className="mt-0.5 line-clamp-2 text-xs text-zinc-600">
                              <p>Descrição: {t.descricao}</p>
                            </div>
                          ) : null}

                          <div className="mt-2 text-xs text-zinc-500">
                            {normalizarCategoriasTurma(t.categoria).length
                              ? ordenarCategorias(normalizarCategoriasTurma(t.categoria)).join(", ")
                              : "—"}{" "}
                            · {t.professorNome || "Sem professor"}
                          </div>
                        </div>
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                          {t.alunosCount ?? 0} aluno(s)
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {owner || tipoUsuarioLogado === "professor" || meuProfessorId ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="mb-2 text-sm font-semibold text-zinc-900 flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Criar nova turma
                  </div>
                  <input
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Nome da turma"
                    className="mb-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={novoDescricao}
                    onChange={(e) => setNovoDescricao(e.target.value)}
                    placeholder="Descrição da turma"
                    className="mb-2 min-h-[80px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                  <div className="mb-2 rounded-lg border border-zinc-200 p-2">
                    <div className="mb-2 text-xs font-medium text-zinc-700">
                      Categorias (opcional)
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORIAS_TURMA.map((c) => {
                        const checked = novoCategorias.includes(c);

                        return (
                          <label key={c} className="flex items-center gap-2 text-sm text-zinc-700">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setNovoCategorias((prev) =>
                                  prev.includes(c)
                                    ? prev.filter((x) => x !== c)
                                    : [...prev, c]
                                )
                              }
                            />
                            {c}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {owner ? (
                    <>
                      <select
                        multiple
                        value={novoProfessores}
                        onChange={(e) =>
                          setNovoProfessores(Array.from(e.target.selectedOptions).map((o) => o.value))
                        }
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                        style={{ minHeight: 120 }}
                      >
                        {profs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </select>

                      <div className="mt-1 text-xs text-zinc-500">
                        Dica: segure Ctrl (Windows) / Cmd (Mac) para selecionar vários.
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                      Esta turma será criada para o professor logado.
                    </div>
                  )}

                  <button
                    onClick={criarTurma}
                    disabled={salvando}
                    className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-70"
                  >
                    {salvando ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Criar turma"}
                  </button>
                </div>
              ) : null}
            </div>

            <div className={`${leftCollapsed ? "md:col-span-3" : "md:col-span-2"} min-w-0`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs text-zinc-500">{leftCollapsed ? "Painel recolhido" : "Painel aberto"}</div>

                <button
                  type="button"
                  onClick={() => setLeftCollapsed((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                  title={leftCollapsed ? "Expandir painel" : "Recolher painel"}
                >
                  {leftCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  {leftCollapsed ? "Expandir" : "Recolher"}
                </button>
              </div>

              {!selecionada ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-6 text-zinc-500 text-center">
                  Selecione uma turma para gerenciar seus alunos.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border border-zinc-200 bg-white flex flex-col min-h-0">
                    <div className="border-b border-zinc-100 p-2 flex-none">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="w-full overflow-x-auto sm:w-auto">
                          <div className="inline-flex min-w-max rounded-xl border border-zinc-200 bg-white p-1 text-sm">
                        <button
                          type="button"
                          onClick={() => {
                            setAbaDireita("membros");
                            setLeftCollapsed(false);
                          }}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm flex items-center gap-2 ${
                            abaDireita === "membros"
                              ? "bg-emerald-600 text-white"
                              : "text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          Membros
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAbaDireita("agenda");
                            setLeftCollapsed(true);
                          }}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 ${
                            abaDireita === "agenda" ? "bg-emerald-600 text-white" : "text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          <CalendarClock className="h-4 w-4" />
                          Agenda
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAbaDireita("frequencia");
                            setLeftCollapsed(true);
                          }}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 ${
                            abaDireita === "frequencia" ? "bg-emerald-600 text-white" : "text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          📊 Frequência
                        </button>
                      </div>
                      </div>

                      {abaDireita === "membros" ? (
                        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:justify-end sm:gap-2">
                          {podeSairDaTurma ? (
                            <button
                              type="button"
                              onClick={pedirSairDaTurma}
                              disabled={salvando || leavingTurma}
                              className="inline-flex h-10 sm:h-auto items-center justify-center gap-1.5 sm:gap-2 rounded-xl border border-amber-200 bg-white px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-60 whitespace-nowrap"
                              title="Sair desta turma (ela não aparecerá mais para você)"
                            >
                              {leavingTurma ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                              Sair da turma
                            </button>
                          ) : null}

                          {podeGerenciarTurma ? (
                            <button
                              type="button"
                              onClick={() => setEditandoInfoTurma((v) => !v)}
                              disabled={salvando || !selecionada}
                              className="inline-flex h-10 sm:h-auto items-center justify-center gap-1.5 sm:gap-2 rounded-xl border border-zinc-200 bg-white px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 whitespace-nowrap"
                            >
                              Editar turma
                            </button>
                          ) : null}

                          {podeExcluirTurma ? (
                            <button
                              type="button"
                              onClick={deletarTurmaSelecionada}
                              disabled={deletandoTurma || salvando || !selecionada}
                              className="inline-flex h-10 sm:h-auto items-center justify-center gap-1.5 sm:gap-2 rounded-xl border border-red-200 bg-white px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 whitespace-nowrap"
                              title="Excluir esta turma"
                            >
                              {deletandoTurma ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              Excluir turma
                            </button>
                          ) : null}

                          <button
                            onClick={salvarMembros}
                            disabled={salvando}
                            className="inline-flex h-10 sm:h-auto items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-emerald-600 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-70 whitespace-nowrap"
                          >
                            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Salvar alterações
                          </button>
                        </div>
                      ) : null}
                    </div>
                    </div>

                    <div className="p-3">
                      {abaDireita === "membros" ? (
                        <div className="pr-1">
                          {editandoInfoTurma ? (
                            <div className="mb-3 rounded-xl border border-zinc-200 bg-white p-3">
                              <div className="mb-3 text-sm font-semibold text-zinc-900">
                                Editar dados da turma
                              </div>

                              <label className="block text-xs font-medium text-zinc-700 mb-1">
                                Nome da turma
                              </label>
                              <input
                                value={editNomeTurma}
                                onChange={(e) => setEditNomeTurma(e.target.value)}
                                className="mb-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                placeholder="Nome da turma"
                              />

                              <label className="block text-xs font-medium text-zinc-700 mb-1">
                                Descrição da turma
                              </label>
                              <textarea
                                value={editDescricaoTurma}
                                onChange={(e) => setEditDescricaoTurma(e.target.value)}
                                className="mb-2 min-h-[80px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                placeholder="Descrição da turma"
                              />

                              <label className="block text-xs font-medium text-zinc-700 mb-1">
                                Categoria
                              </label>
                              <div className="mb-3 rounded-lg border border-zinc-200 p-2">
                                <div className="mb-2 text-xs font-medium text-zinc-700">
                                  Categorias
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  {CATEGORIAS_TURMA.map((c) => {
                                    const checked = editCategoriasTurma.includes(c);

                                    return (
                                      <label key={c} className="flex items-center gap-2 text-sm text-zinc-700">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() =>
                                            setEditCategoriasTurma((prev) =>
                                              prev.includes(c)
                                                ? prev.filter((x) => x !== c)
                                                : [...prev, c]
                                            )
                                          }
                                        />
                                        {c}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditandoInfoTurma(false)}
                                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                                >
                                  Cancelar
                                </button>

                                <button
                                  type="button"
                                  onClick={salvarInfoTurma}
                                  disabled={salvando}
                                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-70"
                                >
                                  {salvando ? "Salvando..." : "Salvar dados"}
                                </button>
                              </div>
                            </div>
                          ) : null}
                          <div className="rounded-xl border border-zinc-200 bg-white">
                            <div className="border-b border-zinc-100 p-3 text-sm font-semibold text-zinc-900 flex items-center gap-2">
                              <User className="h-4 w-4" /> Professores da turma
                            </div>

                            <div className="p-3">
                              {profs.length === 0 ? (
                                <div className="text-sm text-zinc-500">Nenhum professor encontrado.</div>
                              ) : (
                                <ul className="divide-y divide-green-100">
                                  {profs.map((p) => {
                                    const pid = String(p.id);
                                    const checked = profSelecionados.includes(pid);

                                    return (
                                      <li key={p.id} className="py-2 flex items-center gap-3">
                                        <div className="flex-1">
                                          <div className="text-sm font-medium text-green-900">{p.nome}</div>
                                        </div>
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => {
                                            setDirtyProf(true);
                                            setProfSelecionados((prev) =>
                                              prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]
                                            );
                                          }}
                                          className="h-4 w-4 rounded border-green-300 accent-emerald-600 focus:ring-emerald-500"
                                        />
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          </div>

                          <div className="rounded-xl border border-zinc-200 bg-white flex flex-col">
                            <div className="border-b border-zinc-100 p-3 flex-none">
                              <div className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                                <Users className="h-4 w-4" /> Alunos da turma
                              </div>
                            </div>

                            <div className="border-b border-zinc-100 p-3 flex-none">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <input
                                  value={filtroAluno}
                                  onChange={(e) => setFiltroAluno(e.target.value)}
                                  placeholder="Procurar aluno..."
                                  className="w-full rounded-lg border border-zinc-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-emerald-400"
                                />
                              </div>
                            </div>

                            <div className="p-3 space-y-4">
                              {bloqueiaAgendarTurma ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                  <div className="font-extrabold">Atenção</div>
                                  <div className="mt-1 text-xs leading-relaxed">
                                    Existe(m) <b>{membrosNaoVinculados.length}</b> aluno(s) na turma que <b>não estão mais vinculados</b> à sua instituição.
                                    <br />
                                    Por segurança, <b>não será possível agendar treino para a turma inteira</b> enquanto eles não forem removidos.
                                  </div>
                                </div>
                              ) : null}

                              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-100">
                                  <div className="text-xs font-semibold text-emerald-900">
                                    ✅ Na turma ({alunosNaTurma.length})
                                  </div>
                                  <div className="text-[11px] text-emerald-900/70">Desmarque para remover</div>
                                </div>

                                {alunosNaTurma.length === 0 ? (
                                  <div className="p-3 text-sm text-emerald-900/70">
                                    Nenhum aluno está na turma (ou não corresponde à busca).
                                  </div>
                                ) : (
                                  <ul className="divide-y divide-emerald-100">
                                    {alunosNaTurma.map((a) => {
                                      const uid = String(a.usuarioId);
                                      return (
                                        <li key={uid} className="px-3 py-2 flex items-center gap-3">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                              <div className="text-sm font-medium text-emerald-900 truncate">{a.nome}</div>

                                              {(a.vinculoTipo ?? (a.vinculado ? "RELACAO_INSTITUICAO" : "NENHUM")) === "NENHUM" ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-800 font-extrabold">
                                                  Não vinculado
                                                </span>
                                              ) : (a.vinculoTipo === "RELACAO_PROFESSOR" ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 font-extrabold">
                                                  Vinculado por professor
                                                </span>
                                              ) : null)}
                                            </div>

                                            {(a.vinculoTipo ?? (a.vinculado ? "RELACAO_INSTITUICAO" : "NENHUM")) === "NENHUM" ? (
                                              <div className="text-[11px] text-amber-900/80 mt-0.5">
                                                Remova este aluno para liberar o agendamento por turma.
                                              </div>
                                            ) : null}
                                          </div>
                                          <input
                                            type="checkbox"
                                            checked={true}
                                            onChange={() => {
                                              setDirtyAlunos(true);
                                              setAlunosSelecionados((prev) => prev.filter((x) => x !== uid));
                                            }}
                                            className="h-4 w-4 rounded border-emerald-300 accent-emerald-600 focus:ring-emerald-500"
                                          />
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>

                              <div className="rounded-xl border border-zinc-200 bg-white">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100">
                                  <div className="text-xs font-semibold text-zinc-900">
                                    ➕ Fora da turma ({alunosForaDaTurma.length})
                                  </div>
                                  <div className="text-[11px] text-zinc-600">Marque para adicionar</div>
                                </div>

                                {alunosForaDaTurma.length === 0 ? (
                                  <div className="p-3 text-sm text-zinc-500">
                                    Nenhum aluno fora da turma (ou não corresponde à busca).
                                  </div>
                                ) : (
                                  <ul className="divide-y divide-green-100">
                                    {alunosForaDaTurma.map((a) => {
                                      const uid = String(a.usuarioId);
                                      return (
                                        <li key={uid} className="px-3 py-2 flex items-center gap-3">
                                          <div className="flex-1">
                                            <div className="text-sm font-medium text-green-900">{a.nome}</div>
                                          </div>
                                          <input
                                            type="checkbox"
                                            checked={false}
                                            onChange={() => {
                                              setDirtyAlunos(true);
                                              setAlunosSelecionados((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
                                            }}
                                            className="h-4 w-4 rounded border-green-300 accent-emerald-600 focus:ring-emerald-500"
                                          />
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : abaDireita === "agenda" ? (
                          <div className="pr-1">
                            <AgendaTreinos
                              open={open && abaDireita === "agenda" && !!selecionada}
                              title={turmas.find((t) => t.id === selecionada)?.nome ?? "Turma"}
                              groupByTreinoPerDay
                              turmaId={selecionada}
                              fetchAgendados={async ({ monthISO }) => {
                                const r = await axios.get(`${API.BASE_URL}/api/treinos/agendados`, {
                                  headers,
                                  params: {
                                    turmaId: selecionada,
                                    month: monthISO,
                                    ownerTipo: owner?.tipo ?? "",
                                    ownerId: owner?.id ?? "",
                                  },
                                });

                                const data = r.data;
                                const arr =
                                  (Array.isArray(data?.items) && data.items) ||
                                  (Array.isArray(data?.agendados) && data.agendados) ||
                                  (Array.isArray(data) && data) ||
                                  [];

                                const turmaNome = turmas.find((t) => t.id === selecionada)?.nome ?? "Turma";

                                const withTurma = arr.map((it: any) => ({
                                  ...it,
                                  turmaNome,
                                  titulo: it?.titulo ?? it?.treinoProgramado?.nome ?? "Treino",
                                }));

                                return { ...data, items: withTurma };
                              }}
                              fetchProgramados={async () => {
                                if (!owner) {
                                  const userId =
                                    (Storage as any).user?.id ??
                                    (Storage as any).usuario?.id ??
                                    (Storage as any).userId ??
                                    localStorage.getItem("userId") ??
                                    "";

                                  const res = await axios.get(
                                    `${API.BASE_URL}/api/gerenciar/treinosprogramados/visiveis`,
                                    {
                                      headers,
                                      params: {
                                        vinculo: "professor",
                                        id: userId,
                                        debug: "1",
                                      },
                                    }
                                  );

                                  return res.data;
                                }

                                const orgId = owner.id;
                                const res = await axios.get(
                                  `${API.BASE_URL}/api/gerenciar/treinosprogramados/visiveis`,
                                  {
                                    headers,
                                    params: {
                                      vinculo: owner.tipo === "Clube" ? "clube" : "escolinha",
                                      id: orgId,
                                      debug: "1",
                                    },
                                  }
                                );

                                return res.data;
                              }}
                              onAgendar={async ({ selectedDays, treinoProgramadoId, selectedTime }) => {
                                if (bloqueiaAgendarTurma) {
                                  throw new Error("Não é possível agendar para a turma inteira...");
                                }

                                const buildDataHoraISO = (dayISO: string, hhmm: string) => {
                                  return `${dayISO}T${hhmm}:00-03:00`;
                                };

                                await Promise.all(
                                  selectedDays.map((day) =>
                                    axios.post(
                                      `${API.BASE_URL}/api/sessoes-turma`,
                                      {
                                        turmaId: selecionada,
                                        treinoProgramadoId,
                                        dataHoraISO: buildDataHoraISO(day, selectedTime),
                                      },
                                      { headers }
                                    )
                                  )
                                );

                                setAbaDireita("agenda");
                                alert("Sessão agendada e treinos criados para os atletas da turma!");
                              }}
                            />
                          </div>
                        ) : (
                          <div className="pr-1">
                            <div className="rounded-xl border border-zinc-200 bg-white p-4">
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <div>
                                  <div className="text-sm font-extrabold text-zinc-900">Frequência da turma</div>
                                  <div className="text-xs text-zinc-500">Resumo anual • sem vídeos</div>
                                </div>

                                <select
                                  value={freqYear}
                                  onChange={(e) => setFreqYear(Number(e.target.value))}
                                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                >
                                  {Array.from({ length: 6 }).map((_, i) => {
                                    const y = new Date().getFullYear() - i;
                                    return (
                                      <option key={y} value={y}>
                                        {y}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>

                              {freqLoading ? (
                                <div className="p-6 text-center text-zinc-600">
                                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                </div>
                              ) : !freqData ? (
                                <div className="text-sm text-zinc-500">Sem dados de frequência para este ano.</div>
                              ) : (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="rounded-xl border border-zinc-200 p-3">
                                      <div className="text-xs text-zinc-500">Alunos</div>
                                      <div className="text-2xl font-extrabold text-zinc-900">{freqData.totalAlunos}</div>
                                    </div>
                                    <div className="rounded-xl border border-zinc-200 p-3">
                                      <div className="text-xs text-zinc-500">Treinos agendados</div>
                                      <div className="text-2xl font-extrabold text-zinc-900">{freqData.totalAgendados}</div>
                                    </div>
                                    <div className="rounded-xl border border-zinc-200 p-3">
                                      <div className="text-xs text-zinc-500">Treinos realizados</div>
                                      <div className="text-2xl font-extrabold text-zinc-900">{freqData.totalRealizados}</div>
                                    </div>
                                  </div>

                                  <div className="rounded-xl border border-zinc-200 p-3">
                                    <div className="text-sm font-bold text-zinc-900 mb-2">🏅 Quem mais participa</div>
                                    {freqData.topAtletas?.length ? (
                                      <ul className="divide-y divide-zinc-100">
                                        {freqData.topAtletas.map((a: any) => (
                                          <li key={a.atletaId} className="py-2 flex items-center justify-between">
                                            <div className="text-sm text-zinc-900">{a.nome}</div>
                                            <div className="text-xs font-extrabold text-emerald-700">{a.qtd} treino(s)</div>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <div className="text-sm text-zinc-500">Ninguém realizou treinos ainda neste ano.</div>
                                    )}
                                  </div>

                                  <div className="rounded-xl border border-zinc-200 p-3">
                                    <div className="text-sm font-bold text-zinc-900 mb-2">📅 Histórico mensal</div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      {(freqData.historicoMensal || []).map((m: any) => (
                                        <div key={m.mes} className="rounded-lg border border-zinc-200 p-2">
                                          <div className="text-[11px] text-zinc-500">Mês {m.mes}</div>
                                          <div className="text-xs text-zinc-800">
                                            Agendados: <b>{m.agendados}</b>
                                          </div>
                                          <div className="text-xs text-zinc-800">
                                            Realizados: <b>{m.realizados}</b>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                   </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
      
      {confirmDeleteOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-zinc-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-red-50 flex items-center justify-center border border-red-100">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-zinc-900">Excluir turma</div>
                  <div className="text-xs text-zinc-500">
                    {confirmDeleteStep === 1 ? "Confirmação" : "Confirmação final"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (deletandoTurma) return;
                  setConfirmDeleteOpen(false);
                  setConfirmDeleteStep(1);
                }}
                className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-50"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              {confirmDeleteStep === 1 ? (
                <>
                  <div className="text-sm text-zinc-800">
                    Tem certeza que deseja <span className="font-extrabold text-red-700">EXCLUIR</span> esta turma?
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    Isso removerá os vínculos de professores e alunos relacionados à turma.
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-zinc-800">
                    Última confirmação: essa ação é <span className="font-extrabold text-red-700">irreversível</span>.
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    Ao confirmar, a turma será apagada do banco.
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 p-4">
              <button
                type="button"
                disabled={deletandoTurma}
                onClick={() => {
                  setConfirmDeleteOpen(false);
                  setConfirmDeleteStep(1);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancelar
              </button>

              {confirmDeleteStep === 1 ? (
                <button
                  type="button"
                  disabled={deletandoTurma}
                  onClick={() => setConfirmDeleteStep(2)}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  Continuar
                </button>
              ) : (
                <button
                  type="button"
                  disabled={deletandoTurma}
                  onClick={confirmarExclusaoTurma}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {deletandoTurma ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Excluindo...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Excluir definitivamente
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {confirmLeaveOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-zinc-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4">
              <div>
                <div className="text-sm font-extrabold text-zinc-900">Sair da turma</div>
                <div className="text-xs text-zinc-500">Confirmação</div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (leavingTurma) return;
                  setConfirmLeaveOpen(false);
                  setLeaveAware(false);
                }}
                className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-50"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="font-extrabold">Atenção</div>
                <div className="mt-1 text-xs leading-relaxed">
                  Você será removido desta turma e ela <b>não aparecerá mais para você</b>.
                  <br />
                  Para voltar, somente um responsável terá que te adicionar novamente.
                </div>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={leaveAware}
                  onChange={(e) => setLeaveAware(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 accent-emerald-600"
                />
                Estou ciente
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 p-4">
              <button
                type="button"
                disabled={leavingTurma}
                onClick={() => {
                  setConfirmLeaveOpen(false);
                  setLeaveAware(false);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={!leaveAware || leavingTurma}
                onClick={confirmarSairDaTurma}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-amber-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {leavingTurma ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saindo...
                  </>
                ) : (
                  "Confirmar saída"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}