// client/src/components/turmas/TurmasManager
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  X, Loader2, Plus, Users, User, List, Save, Search,
  ChevronLeft, ChevronRight, ClipboardList, CheckCircle2, XCircle, CalendarClock,
  PanelLeftClose, PanelLeftOpen, Trash2
} from "lucide-react";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";
import AgendaTreinos, { normalizeAgendadosPayload } from "@/components/agenda/AgendaTreinos";

type TurmaMin = {
  id: string;
  nome: string;
  categoria?: string | null;
  professorIds?: string[];
  professorNomes?: string[];
  professorNome?: string | null;
  alunosCount?: number;
};

type ProfessorMin = { id: string; nome: string };
type AtletaMin = { usuarioId: string; nome: string; sobrenome?: string };

type TurmaAluno = {
  usuarioId: string;
  atletaId?: string | null;
  nome: string;
  sobrenome?: string;
  foto?: string | null;
  vinculado: boolean;
};

type TreinoAgendadoItem = {
  id: string;
  titulo: string | null;
  dataTreino: string | Date | null;
  dataExpiracao?: string | Date | null;
  treinoProgramadoId?: string | null;
  treinoProgramado?: { id: string; nome?: string | null } | null;
  meuStatus?: string | null;
  status?: string | null;
  execucaoStatus?: string | null;
  submissaoTreinoId?: string | null;
  submissaoFeita?: boolean;

  atleta?: {
    atletaId?: string;
    usuarioId?: string | null;
    nome?: string | null;
    foto?: string | null;
  } | null;
};

type TreinoProgramadoItem = {
  id: string;
  nome: string;
  codigo?: string | null;
  nivel?: string | null;
  descricao?: string | null;
  autor?: { tipo: "Professor" | "Clube" | "Escolinha" | "Desconhecido"; id: string | null; nome: string | null };
};

type Owner = { tipo: "Clube" | "Escolinha"; id: string; usuarioId?: string };

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}
function isPastDayISO(dayISO: string) {
  const [y, m, d] = dayISO.split("-").map((n) => Number(n));
  const dt = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  return dt.getTime() < startOfToday().getTime();
}
function toISODateOnly(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1, 0, 0, 0, 0);
}
function parseAsDate(x: any): Date | null {
  if (!x) return null;
  if (x instanceof Date) return x;
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
}
function dayKeyFromAny(x: any) {
  const d = parseAsDate(x);
  if (!d) return "";
  return toISODateOnly(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
}
function statusLabel(s?: string | null) {
  const v = String(s || "").toUpperCase();
  if (v === "COMPLETED" || v === "CONCLUIDO" || v === "CONCLUÍDO") return "Concluído";
  if (v === "IN_PROGRESS" || v === "EM_ANDAMENTO") return "Em andamento";
  if (v === "EXPIRED" || v === "EXPIRADO" || v === "PERDIDO") return "Perdido";
  return "Pendente";
}
function isCompleted(s?: string | null) {
  const v = String(s || "").toUpperCase();
  return v === "COMPLETED" || v === "CONCLUIDO" || v === "CONCLUÍDO";
}
function isExpiredStatus(s?: string | null) {
  const v = String(s || "").toUpperCase();
  return v === "EXPIRED" || v === "EXPIRADO" || v === "PERDIDO";
}
function isLost(t: TreinoAgendadoItem) {
  if (isExpiredStatus(t.meuStatus) || isExpiredStatus(t.execucaoStatus) || isExpiredStatus(t.status)) return true;

  const dt = parseAsDate(t.dataTreino);
  if (!dt) return false;

  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const treinoOnly = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const passouDoDia = treinoOnly.getTime() < todayOnly.getTime();
  const concluido = isCompleted(t.meuStatus || t.execucaoStatus || t.status);

  return passouDoDia && !concluido;
}


function formatDayPtBR(dayISO: string) {
  const [y, m, d] = dayISO.split("-").map((n) => Number(n));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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

  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [deletandoTurma, setDeletandoTurma] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteStep, setConfirmDeleteStep] = useState<1 | 2>(1);

  const [turmas, setTurmas] = useState<TurmaMin[]>([]);
  const [profs, setProfs] = useState<ProfessorMin[]>([]);
  const [alunos, setAlunos] = useState<AtletaMin[]>([]);

  const [filtroProf, setFiltroProf] = useState<string>(professorId || "");
  const [selecionada, setSelecionada] = useState<string>("");

  // ✅ seleção separada (não depende de "checked" dentro dos objetos)
  const [profSelecionados, setProfSelecionados] = useState<string[]>([]);
  const [alunosSelecionados, setAlunosSelecionados] = useState<string[]>([]);
  const [dirtyProf, setDirtyProf] = useState(false);
  const [dirtyAlunos, setDirtyAlunos] = useState(false);

  const [filtroAluno, setFiltroAluno] = useState("");

  const [leftCollapsed, setLeftCollapsed] = useState(false);

  // =======================
  // ABA DIREITA: "membros" | "agenda"
  // =======================
  const [abaDireita, setAbaDireita] = useState<"membros" | "agenda">("membros");

  // Agenda (turma)
  const [cursorMonth, setCursorMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [agendadosTurma, setAgendadosTurma] = useState<TreinoAgendadoItem[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(true);

  const [loadingProgramados, setLoadingProgramados] = useState(false);
  const [treinosProgramados, setTreinosProgramados] = useState<TreinoProgramadoItem[]>([]);
  const [treinoProgramadoId, setTreinoProgramadoId] = useState<string>("");
  const [salvandoAgenda, setSalvandoAgenda] = useState(false);

  const [turmaAlunos, setTurmaAlunos] = useState<TurmaAluno[]>([]);
  const [naoVinculadosUsuarioIds, setNaoVinculadosUsuarioIds] = useState<string[]>([]);

  const [novoNome, setNovoNome] = useState("");
  const [novoCategoria, setNovoCategoria] = useState<
    "" | "Sub-9" | "Sub-11" | "Sub-13" | "Sub-15" | "Sub-17" | "Sub-20" | "Livre"
  >("");
  const [novoProfessores, setNovoProfessores] = useState<string[]>(
    professorId ? [professorId] : []
  );

  useEffect(() => {
    if (open) setFiltroProf(professorId || "");
  }, [open, professorId]);

  useEffect(() => {
    if (!open) return;
    if (!owner) return;

    // se veio turma específica, abre automaticamente
    const tid = String(initialTurmaId ?? "").trim();
    if (!tid) return;

    // evita reabrir se já está aberta
    if (selecionada === tid) return;

    // 🔥 abre a turma (carrega professores/alunos vinculados)
    void abrirTurma(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, owner?.id, initialTurmaId]);


  useEffect(() => {
    if (!open || !owner) return;

    (async () => {
      setLoading(true);
      try {
        const orgUserId = owner.usuarioId ?? owner.id;

        // =======================
        // 1) Professores do owner
        // =======================
        const resP = await axios.get(`${API.BASE_URL}/api/gerenciar/professores`, {
          headers,
          params: {
            vinculo: owner.tipo === "Clube" ? "clube" : "escolinha",
            id: orgUserId,
            limit: 200,
          },
        });

        let lp = (resP.data?.professores || resP.data || []) as any[];

        if (!lp.length) {
          const resAlt = await axios.get(`${API.BASE_URL}/api/professores`, {
            headers,
            params: { organizacaoId: owner.id, clubeId: owner.id, tipoUsuarioId: owner.id },
          });
          lp = (resAlt.data?.professores || resAlt.data?.items || resAlt.data || []) as any[];
        }

        setProfs(
          lp.map((p) => ({
            id: String(p.id),
            nome: p.nome ?? p.usuario?.nome ?? "Professor",
          }))
        );

        // =======================
        // 2) Atletas vinculados
        // =======================
        const resA = await axios.get(`${API.BASE_URL}/api/gerenciar/atletas`, {
          headers,
          params: {
            vinculo: owner.tipo === "Clube" ? "clube" : "escolinha",
            id: orgUserId,
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
            const nomeCompleto = [nome, sobrenome].filter(Boolean).join(" ").trim() || "Atleta";
            return { usuarioId, nome: nomeCompleto, sobrenome: sobrenome || undefined };
          })
        );

        await carregarTurmas(owner);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, owner?.id]);

  useEffect(() => {
    if (!open || !owner) return;
    void carregarTurmas(owner, filtroProf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, owner?.id, filtroProf]);

useEffect(() => {
  if (!open) return;

  // reset quando abrir
  if (open) {
    setAbaDireita("membros");
    setSelectedDays([]);
    setDrawerOpen(true);
    setTreinoProgramadoId("");
    setCursorMonth(startOfMonth(new Date()));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open]);

useEffect(() => {
  if (!open || !owner) return;
  if (!selecionada) return;
  if (abaDireita !== "agenda") return;

  (async () => {
    try {
      setLoadingCalendar(true);
      await carregarAgendadosDaTurma(selecionada, cursorMonth);
    } catch (e) {
      console.error("Erro ao carregar agendados da turma:", e);
      setAgendadosTurma([]);
    } finally {
      setLoadingCalendar(false);
    }
  })();

  // carrega treinos programados (uma vez por abertura da aba)
  void carregarTreinosProgramadosVisiveis();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, owner?.id, selecionada, abaDireita]);

useEffect(() => {
  if (!open || !owner) return;
  if (!selecionada) return;
  if (abaDireita !== "agenda") return;

  (async () => {
    try {
      setLoadingCalendar(true);
      await carregarAgendadosDaTurma(selecionada, cursorMonth);
    } catch (e) {
      console.error("Erro ao recarregar agendados da turma (troca de mês):", e);
      setAgendadosTurma([]);
    } finally {
      setLoadingCalendar(false);
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [cursorMonth, abaDireita, selecionada]);

useEffect(() => {
  if (abaDireita === "agenda") setLeftCollapsed(true);
}, [abaDireita]);

  const carregarTurmas = async (o: Owner, professorFiltro?: string) => {
    const resT = await axios.get(`${API.BASE_URL}/api/turmas`, {
      headers,
      params: { ownerTipo: o.tipo, ownerId: o.id },
    });

    const lt = (resT.data?.items || resT.data || []) as any[];

    const parsed: TurmaMin[] = lt.map((t) => {
      const professorIds = Array.isArray(t.professorIds) ? t.professorIds.map(String) : [];
      const professorNomes = Array.isArray(t.professorNomes)
        ? t.professorNomes
        : Array.isArray(t.professores)
          ? t.professores.map((p: any) => p?.nome ?? p?.usuario?.nome).filter(Boolean)
          : [];

      return {
        id: String(t.id),
        nome: String(t.nome ?? "Turma"),
        categoria: t.categoria ?? null,
        professorIds,
        professorNomes,
        professorNome: t.professorNome ?? (professorNomes.length ? professorNomes.join(", ") : null),
        alunosCount: t._count?.membros ?? t.alunosCount ?? 0,
      };
    });

    const profFiltro = (professorFiltro ?? filtroProf)?.trim();

    const filtradas = profFiltro
      ? parsed.filter((t) => (t.professorIds ?? []).includes(String(profFiltro)))
      : parsed;

    setTurmas(filtradas);
  };

  const onFiltrarProf = async (prof: string) => {
    setFiltroProf(prof);
    if (owner) await carregarTurmas(owner, prof);
  };

  // ✅ abre turma: pré-seleciona professores e alunos já vinculados
  const abrirTurma = async (id: string) => {
    setSelecionada(id);

    const turma = turmas.find((t) => t.id === id);
    const idsProf = (turma?.professorIds || []).map(String).filter(Boolean);

    setProfSelecionados(idsProf);
    setDirtyProf(false);

    const res = await axios.get(`${API.BASE_URL}/api/turmas/${id}/alunos`, { headers });

    const usuarioIds: string[] = Array.isArray(res.data?.usuarioIds)
      ? res.data.usuarioIds.map(String)
      : Array.isArray(res.data?.alunos)
        ? res.data.alunos.map((x: any) => String(x.usuarioId)).filter(Boolean)
        : [];

    // ✅ lista real da turma (pode incluir não-vinculado)
    const alunosTurma: TurmaAluno[] = Array.isArray(res.data?.alunos)
      ? res.data.alunos.map((a: any) => {
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
          };
        }).filter((x: TurmaAluno) => !!x.usuarioId)
      : [];

    setTurmaAlunos(alunosTurma);

    const naoVinc: string[] = Array.isArray(res.data?.naoVinculadosUsuarioIds)
      ? res.data.naoVinculadosUsuarioIds.map(String)
      : alunosTurma.filter((x) => !x.vinculado).map((x) => x.usuarioId);

    setNaoVinculadosUsuarioIds(naoVinc);

    setAlunosSelecionados(usuarioIds);
    setDirtyAlunos(false);
  };

  // ✅ salva separado: só salva o que foi alterado (evita “zerar” professores/alunos)
  const salvarMembros = async () => {
    if (!selecionada) return;
    setSalvando(true);

    try {
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
        alert(`Turma atualizada! (${r.data?.total ?? alunosSelecionados.length} aluno(s))`);
      } else {
        alert("Turma atualizada!");
      }

      if (owner) await carregarTurmas(owner);
      await abrirTurma(selecionada);
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Falha ao salvar turma");
    } finally {
      setSalvando(false);
    }
  };

const deletarTurmaSelecionada = async () => {
  const turmaId = String(selecionada || "").trim();
  if (!turmaId) return;
  // abre o modal de confirmação (passo 1)
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

function autorTipoFromOwner(o: Owner): "Clube" | "Escolinha" {
  return o.tipo === "Clube" ? "Clube" : "Escolinha";
}

async function carregarAgendadosDaTurma(turmaId: string, mes: Date) {
  const month = `${mes.getFullYear()}-${pad2(mes.getMonth() + 1)}`;
  const r = await axios.get(`${API.BASE_URL}/api/treinos/agendados`, {
    headers,
    params: { turmaId, month },
  });

  console.log("[turma/agendados] raw:", r.data);
  setAgendadosTurma(normalizeAgendadosPayload(r.data));
}

function toggleDay(dayISO: string) {
  setDrawerOpen(true);
  setSelectedDays((prev) =>
    prev.includes(dayISO) ? prev.filter((d) => d !== dayISO) : [...prev, dayISO]
  );
}

async function carregarTreinosProgramadosVisiveis() {
  if (!owner) return;

  setLoadingProgramados(true);
  try {
    const vinculo = owner.tipo === "Clube" ? "clube" : "escolinha";
    const entidadeId = String(owner.id);

    const res = await axios.get(`${API.BASE_URL}/api/gerenciar/treinosprogramados/visiveis`, {
      headers,
      params: {
        vinculo,
        id: entidadeId,
        tipoUsuarioId: entidadeId,
      },
    });

    const items = (res.data?.items ?? res.data ?? []) as any[];

    setTreinosProgramados(
      items.map((t) => ({
        id: String(t.id),
        nome: String(t.nome ?? t.titulo ?? "Treino"),
        codigo: t.codigo ?? null,
        nivel: t.nivel ?? null,
        descricao: t.descricao ?? null,
        autor: t.autor
          ? { tipo: t.autor.tipo, id: t.autor.id ?? null, nome: t.autor.nome ?? null }
          : undefined,
      }))
    );
  } catch (e) {
    console.error("Erro ao carregar treinos programados (turma):", e);
    setTreinosProgramados([]);
  } finally {
    setLoadingProgramados(false);
  }
}

async function agendarParaDiasSelecionadosTurma() {
  if (!owner) return;
  if (!selecionada) return;
  if (selectedDays.some(isPastDayISO)) return alert("Não é permitido agendar treinos em datas passadas.");
  if (!treinoProgramadoId) return alert("Selecione um treino programado para agendar.");
  if (!selectedDays.length) return alert("Selecione ao menos 1 dia no calendário.");
  if (salvandoAgenda) return;
  if (bloqueiaAgendarTurma) {
    return alert(
      "Não é possível agendar para a turma inteira: existe aluno na turma que não está vinculado à sua instituição. Remova-o da turma para continuar."
    );
  }

  const autorId = String(owner.id);
  const autorTipo = autorTipoFromOwner(owner);

  setSalvandoAgenda(true);
  try {
    await Promise.all(
      selectedDays.map((day) =>
        axios.post(
          `${API.BASE_URL}/api/treinos/agendados`,
          {
            turmaId: selecionada,
            treinoProgramadoId,
            dataTreino: day,
            autorId,
            autorTipo,
          },
          { headers }
        )
      )
    );

    await carregarAgendadosDaTurma(selecionada, cursorMonth);
    setSelectedDays([]);
    alert("Treino(s) agendado(s) para a turma com sucesso!");
  } catch (e: any) {
    console.error(e);
    const msg =
      e?.response?.data?.message ||
      (e?.response?.status === 409 ? "Já existe treino agendado em um dos dias selecionados." : null) ||
      "Erro ao agendar treinos.";
    alert(msg);
  } finally {
    setSalvandoAgenda(false);
  }
}


  const criarTurma = async () => {
    if (!owner) return;
    if (!novoNome.trim()) return alert("Dê um nome para a turma");
    setSalvando(true);

    try {
      const payload = {
        ownerTipo: owner.tipo,
        ownerId: owner.id,
        nome: novoNome.trim(),
        categoria: novoCategoria || undefined,
        professorIds: novoProfessores,
      };

      const res = await axios.post(`${API.BASE_URL}/api/turmas`, payload, { headers });
      const novaId = String(res.data?.id || "");

      if (novaId && novoProfessores.length) {
        await axios.put(
          `${API.BASE_URL}/api/turmas/${novaId}/vincular-professor`,
          { professorIds: novoProfessores },
          { headers }
        );
      }

      setNovoNome("");
      setNovoCategoria("");

      await carregarTurmas(owner);

      setSelecionada(novaId);

      // já abre e marca os que foram escolhidos ao criar
      if (novaId) {
        await abrirTurma(novaId);
      }

      alert("Turma criada!");
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Falha ao criar turma");
    } finally {
      setSalvando(false);
    }
  };

  // ✅ filtro aplicado nas duas listas
  const termoAluno = filtroAluno.trim().toLowerCase();
  const setSel = useMemo(() => new Set(alunosSelecionados.map(String)), [alunosSelecionados]);

  const alunosNaTurma = useMemo(() => {
    return turmaAlunos
      .filter((a) => setSel.has(String(a.usuarioId)))
      .filter((a) => (termoAluno ? (a.nome || "").toLowerCase().includes(termoAluno) : true));
  }, [turmaAlunos, setSel, termoAluno]);

  const alunosForaDaTurma = useMemo(() => {
    return alunos
      .filter((a) => !setSel.has(String(a.usuarioId)))
      .filter((a) => (termoAluno ? (a.nome || "").toLowerCase().includes(termoAluno) : true));
  }, [alunos, setSel, termoAluno]);

  const bloqueiaAgendarTurma = (naoVinculadosUsuarioIds?.length ?? 0) > 0;

  const membrosNaoVinculados = useMemo(
    () => alunosNaTurma.filter((a) => !a.vinculado),
    [alunosNaTurma]
  );

  const fecharModal = () => {
    setSelecionada("");
    setProfSelecionados([]);
    setAlunosSelecionados([]);
    setDirtyProf(false);
    setDirtyAlunos(false);
    setFiltroAluno("");
    onClose();
    setAbaDireita("membros");
    setSelectedDays([]);
    setDrawerOpen(true);
    setTreinoProgramadoId("");
    setAgendadosTurma([]);
    setConfirmDeleteOpen(false);
    setConfirmDeleteStep(1);
    setTurmaAlunos([]);
    setNaoVinculadosUsuarioIds([]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40">
      <div className="
        absolute inset-0
        w-screen h-[100dvh]
        max-w-none max-h-none
        rounded-none
        bg-white
        flex flex-col
      ">
        <div className="flex items-center justify-between border-b border-zinc-100 p-4">
          <div className="text-sm font-semibold text-zinc-900">
            {owner ? `${owner.tipo} · Gerenciar turmas` : "Gerenciar turmas"}
          </div>
          <button onClick={fecharModal} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 overscroll-contain">
          <div
            className={`grid grid-cols-1 gap-4 ${
              leftCollapsed ? "md:grid-cols-1" : "md:grid-cols-3"
            }`}
          >
            {/* Coluna esquerda */}
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

              <div className="rounded-xl border border-zinc-200 bg-white">
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
                  <ul className="max-h-[40dvh] md:max-h-[60dvh] overflow-auto overscroll-contain">
                    {turmas.map((t) => (
                      <li
                        key={t.id}
                        onClick={() => abrirTurma(t.id)}
                        className={`flex cursor-pointer items-center justify-between p-3 hover:bg-zinc-50 ${
                          selecionada === t.id ? "bg-zinc-50" : ""
                        }`}
                      >
                        <div>
                          <div className="text-sm font-medium text-zinc-900">{t.nome}</div>
                          <div className="text-xs text-zinc-500">
                            {(t.categoria || "—")} · {t.professorNome || "Sem professor"}
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
                <select
                  value={novoCategoria}
                  onChange={(e) => setNovoCategoria(e.target.value as any)}
                  className="mb-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                >
                  <option value="">Categoria (opcional)</option>
                  {["Sub-9", "Sub-11", "Sub-13", "Sub-15", "Sub-17", "Sub-20", "Livre"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

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

                <button
                  onClick={criarTurma}
                  disabled={salvando}
                  className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-70"
                >
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Criar turma"}
                </button>
              </div>
            </div>

            {/* Coluna direita */}
            <div className={leftCollapsed ? "md:col-span-3" : "md:col-span-2"}>

              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs text-zinc-500">
                  {leftCollapsed ? "Painel recolhido" : "Painel aberto"}
                </div>

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
                  {/* Abas direita */}
                  <div className="rounded-xl border border-zinc-200 bg-white">
                    <div className="flex items-center justify-between border-b border-zinc-100 p-2">
                      <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 text-sm">
                        <button
                          type="button"
                          onClick={() => {
                            setAbaDireita("membros");
                            setLeftCollapsed(false);
                          }}
                          className={`px-3 py-1.5 rounded-lg ${
                            abaDireita === "membros" ? "bg-emerald-600 text-white" : "text-zinc-700 hover:bg-zinc-50"
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
                          className={`px-3 py-1.5 rounded-lg flex items-center gap-2 ${
                            abaDireita === "agenda" ? "bg-emerald-600 text-white" : "text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          <CalendarClock className="h-4 w-4" />
                          Agenda
                        </button>
                      </div>

                      {abaDireita === "membros" ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={deletarTurmaSelecionada}
                            disabled={deletandoTurma || salvando || !selecionada}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-60"
                            title="Excluir esta turma"
                          >
                            {deletandoTurma ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Excluir turma
                          </button>

                          <button
                            onClick={salvarMembros}
                            disabled={salvando}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-70"
                          >
                            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Salvar alterações
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {/* Conteúdo da aba */}
                    <div className="p-3">
                      {abaDireita === "membros" ? (
                        <div className="flex flex-col gap-4">
                          {/* Professores */}
                          <div className="rounded-xl border border-zinc-200 bg-white">
                            <div className="border-b border-zinc-100 p-3 text-sm font-semibold text-zinc-900 flex items-center gap-2">
                              <User className="h-4 w-4" /> Professores da turma
                            </div>

                            <div className="p-3 max-h-[26dvh] overflow-auto overscroll-contain">
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
                                              prev.includes(pid)
                                                ? prev.filter((x) => x !== pid)
                                                : [...prev, pid]
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

                          {/* Alunos */}
                          <div className="rounded-xl border border-zinc-200 bg-white flex flex-col max-h-[70dvh]">
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

                            <div
                              className="flex-1 min-h-0 overflow-auto p-3 overscroll-contain space-y-4"
                              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" as any }}
                            >

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

                              {/* ✅ LISTA 1: NA TURMA */}
                              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-100">
                                  <div className="text-xs font-semibold text-emerald-900">
                                    ✅ Na turma ({alunosNaTurma.length})
                                  </div>
                                  <div className="text-[11px] text-emerald-900/70">
                                    Desmarque para remover
                                  </div>
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

                                              {!a.vinculado ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-800 font-extrabold">
                                                  Não vinculado
                                                </span>
                                              ) : null}
                                            </div>

                                            {!a.vinculado ? (
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

                              {/* ✅ LISTA 2: FORA DA TURMA */}
                              <div className="rounded-xl border border-zinc-200 bg-white">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100">
                                  <div className="text-xs font-semibold text-zinc-900">
                                    ➕ Fora da turma ({alunosForaDaTurma.length})
                                  </div>
                                  <div className="text-[11px] text-zinc-600">
                                    Marque para adicionar
                                  </div>
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
                                              setAlunosSelecionados((prev) =>
                                                prev.includes(uid) ? prev : [...prev, uid]
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
                          </div>
                        </div>
                      ) : (
                        <div className="min-h-0 flex-1 overflow-hidden">
                          <AgendaTreinos
                            open={open && abaDireita === "agenda" && !!selecionada}
                            title={turmas.find((t) => t.id === selecionada)?.nome ?? "Turma"}
                            fetchAgendados={async ({ monthISO }) => {
                              const r = await axios.get(`${API.BASE_URL}/api/treinos/agendados`, {
                                headers,
                                params: { turmaId: selecionada, month: monthISO },
                              });
                              return r.data; // normalizeAgendadosPayload já é aplicado dentro do AgendaTreinos
                            }}

                            fetchProgramados={async () => {
                              const orgUserId = owner?.usuarioId ?? owner?.id;
                              const res = await axios.get(
                                `${API.BASE_URL}/api/gerenciar/treinosprogramados/visiveis`,
                                {
                                  headers,
                                  params: {
                                    vinculo: owner?.tipo === "Clube" ? "clube" : "escolinha",
                                    id: orgUserId,
                                    debug: "1",
                                  },
                                }
                              );
                              return res.data;
                            }}
                            onAgendar={async ({ selectedDays, treinoProgramadoId }) => {
                              await Promise.all(
                                selectedDays.map((day) =>
                                  axios.post(
                                    `${API.BASE_URL}/api/treinos/agendados`,
                                    {
                                      turmaId: selecionada,
                                      treinoProgramadoId,
                                      dataTreino: day,
                                      autorId: String(owner?.id),
                                      autorTipo: owner?.tipo === "Clube" ? "Clube" : "Escolinha",
                                    },
                                    { headers }
                                  )
                                )
                              );
                            }}

                          />
                        </div>
                      )}


                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* fim col direita */}
          </div>
        </div>
      </div>


      {/* =======================
    MODAL: CONFIRMAR EXCLUSÃO DA TURMA
   ======================= */}
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

    </div>
  );
}
