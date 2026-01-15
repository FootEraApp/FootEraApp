// client/src/components/turmas/TurmasManager
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  X, Loader2, Plus, Users, User, List, Save, Search,
  ChevronLeft, ChevronRight, ClipboardList, CheckCircle2, XCircle, CalendarClock,
  PanelLeftClose, PanelLeftOpen
} from "lucide-react";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";

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
function normalizeAgendadosPayload(payload: any): TreinoAgendadoItem[] {
  const arr =
    Array.isArray(payload) ? payload :
    payload?.items ??
    payload?.agendados ??
    payload?.treinosAgendados ??
    payload?.treinos ??
    payload?.data?.items ??     // <- MUITO comum
    payload?.data ??
    [];

  if (!Array.isArray(arr)) return [];

  return arr.map((t: any) => {
    const treinoProgramadoObj = t?.treinoProgramado ?? t?.programado ?? null;

    const nomeProgramado =
      treinoProgramadoObj?.nome ??
      treinoProgramadoObj?.titulo ??
      t?.treinoProgramadoNome ??
      t?.nomeTreinoProgramado ??
      t?.titulo ??
      t?.nome ??
      null;

    const treinoProgramadoId =
      t?.treinoProgramadoId ??
      treinoProgramadoObj?.id ??
      null;

    const dataTreino =
      t?.dataTreino ??
      t?.dataHora ??
      t?.data ??
      null;

    const submissaoFeita = !!(t?.submissao?.feito ?? t?.submissaoFeita ?? false);
    
    // ✅ atleta (nome/foto) vem do backend quando você lista por turmaId
    const atletaObj =
      t?.atleta ??
      t?.atletaUsuario ??
      t?.atletaInfo ??
      t?.usuario ??
      null;

    const atletaNome =
      atletaObj?.nome ??
      [atletaObj?.usuario?.nome, atletaObj?.usuario?.sobrenome].filter(Boolean).join(" ") ??
      atletaObj?.usuario?.nome ??
      null;

    const atletaFoto =
      atletaObj?.foto ??
      atletaObj?.usuario?.foto ??
      atletaObj?.fotoUrl ??
      null;

    const atletaIdFinal =
      atletaObj?.atletaId ??
      atletaObj?.id ??
      t?.atletaId ??
      null;

    const atletaUsuarioIdFinal =
      atletaObj?.usuarioId ??
      atletaObj?.usuario?.id ??
      t?.usuarioId ??
      null;


    return {
      id: String(t?.id ?? ""),
      titulo: t?.titulo ?? null,
      dataTreino,
      dataExpiracao: t?.dataExpiracao ?? t?.expiraEm ?? null,
      treinoProgramadoId,
      treinoProgramado: nomeProgramado
        ? { id: String(treinoProgramadoId ?? treinoProgramadoObj?.id ?? ""), nome: String(nomeProgramado) }
        : (treinoProgramadoObj?.id ? { id: String(treinoProgramadoObj.id), nome: treinoProgramadoObj?.nome ?? null } : null),
      meuStatus: t?.meuStatus ?? t?.statusExecucao ?? t?.execucaoStatus ?? null,
      status: t?.status ?? null,
      execucaoStatus: t?.execucaoStatus ?? t?.statusExecucao ?? null,
      submissaoTreinoId: t?.submissaoTreinoId ?? t?.submissao?.id ?? null,
      submissaoFeita,
      atleta: atletaNome || atletaIdFinal || atletaUsuarioIdFinal
        ? {
            atletaId: atletaIdFinal ? String(atletaIdFinal) : undefined,
            usuarioId: atletaUsuarioIdFinal ? String(atletaUsuarioIdFinal) : undefined,
            nome: atletaNome ? String(atletaNome) : null,
            foto: atletaFoto ? String(atletaFoto) : null,
          }
        : null,

    } as TreinoAgendadoItem;
  }).filter((x) => x.id);
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

  const alunosNaTurma = useMemo(() => {
    const setSel = new Set(alunosSelecionados.map(String));
    return alunos
      .filter((a) => setSel.has(String(a.usuarioId)))
      .filter((a) => (termoAluno ? (a.nome || "").toLowerCase().includes(termoAluno) : true));
  }, [alunos, alunosSelecionados, termoAluno]);

  const alunosForaDaTurma = useMemo(() => {
    const setSel = new Set(alunosSelecionados.map(String));
    return alunos
      .filter((a) => !setSel.has(String(a.usuarioId)))
      .filter((a) => (termoAluno ? (a.nome || "").toLowerCase().includes(termoAluno) : true));
  }, [alunos, alunosSelecionados, termoAluno]);

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
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-5xl max-h-[92dvh] rounded-2xl bg-white shadow-xl flex flex-col">
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
                        <button
                          onClick={salvarMembros}
                          disabled={salvando}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-70"
                        >
                          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Salvar alterações
                        </button>
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
                                          <div className="flex-1">
                                            <div className="text-sm font-medium text-emerald-900">{a.nome}</div>
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
                        // =======================
                        // ABA AGENDA DA TURMA
                        // =======================
                        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-3">
                          {/* Calendário */}
                          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                            <div className="flex items-center justify-between border-b border-zinc-100 p-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setCursorMonth((d) => addMonths(d, -1))}
                                  className="h-9 w-9 flex items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                                  title="Mês anterior"
                                >
                                  <ChevronLeft className="h-5 w-5" />
                                </button>

                                <div className="min-w-[160px] text-center font-extrabold text-zinc-900">
                                  {(() => {
                                    const d = cursorMonth;
                                    const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
                                    return `${meses[d.getMonth()]} ${d.getFullYear()}`;
                                  })()}
                                </div>

                                <button
                                  onClick={() => setCursorMonth((d) => addMonths(d, 1))}
                                  className="h-9 w-9 flex items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                                  title="Próximo mês"
                                >
                                  <ChevronRight className="h-5 w-5" />
                                </button>
                              </div>

                              <div className="hidden sm:flex items-center gap-3 text-[11px] text-zinc-600">
                                <span className="flex items-center gap-1">
                                  <span className="inline-block h-2.5 w-2.5 rounded bg-emerald-500" /> Concluído
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="inline-block h-2.5 w-2.5 rounded bg-red-500" /> Perdido
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="inline-block h-2.5 w-2.5 rounded bg-zinc-300" /> Pendente
                                </span>
                              </div>
                            </div>

                            {loadingCalendar ? (
                              <div className="p-4 text-sm text-zinc-600">Carregando calendário…</div>
                            ) : (
                              <>
                                <div className="grid grid-cols-7 gap-1 text-[10px] opacity-80 px-3 pt-3">
                                  {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((w) => (
                                    <div key={w} className="text-center">{w}</div>
                                  ))}
                                </div>

                                {(() => {
                                  const first = startOfMonth(cursorMonth);
                                  const firstWeekday = (first.getDay() + 6) % 7;
                                  const start = new Date(first);
                                  start.setDate(first.getDate() - firstWeekday);

                                  const daysGrid = Array.from({ length: 42 }, (_, i) => {
                                    const d = new Date(start);
                                    d.setDate(start.getDate() + i);
                                    const inMonth = d.getMonth() === cursorMonth.getMonth();
                                    return { date: d, key: toISODateOnly(d), inMonth };
                                  });

                                  const agendadosPorDia = new Map<string, TreinoAgendadoItem[]>();
                                  for (const t of agendadosTurma) {
                                    const k = dayKeyFromAny(t.dataTreino);
                                    if (!k) continue;
                                    const arr = agendadosPorDia.get(k) ?? [];
                                    arr.push(t);
                                    agendadosPorDia.set(k, arr);
                                  }

                                  return (
                                    <div className="grid grid-cols-7 gap-1 p-3">
                                      {daysGrid.map(({ date, key, inMonth }) => {
                                        const items = agendadosPorDia.get(key) ?? [];
                                        const hasTreino = items.length > 0;
                                        const done = hasTreino && items.some((t) => isCompleted(t.meuStatus || t.execucaoStatus || t.status));
                                        const lost = hasTreino && !done && items.some((t) => isLost(t));

                                        const bg =
                                          done ? "bg-emerald-50 border-emerald-200"
                                          : lost ? "bg-red-50 border-red-200"
                                          : "bg-white border-zinc-200";

                                        const opacity = inMonth ? "opacity-100" : "opacity-40";
                                        const selected = selectedDays.includes(key);
                                        const past = isPastDayISO(key);

                                        return (
                                          <button
                                            key={key}
                                            onClick={() => toggleDay(key)}
                                            className={[
                                              "h-12 rounded-xl border text-left p-2 transition relative",
                                              bg,
                                              opacity,
                                              selected ? "ring-2 ring-emerald-400" : "hover:bg-zinc-50",
                                              past ? "opacity-70" : "",
                                            ].join(" ")}
                                          >
                                            <div className="flex items-start justify-between gap-1">
                                              <div className="text-sm font-extrabold">{date.getDate()}</div>
                                              <div className="hidden sm:flex items-center gap-1">
                                                {done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}
                                                {lost ? <XCircle className="h-4 w-4 text-red-600" /> : null}
                                              </div>
                                            </div>
                                            <div className="mt-1 text-[10px] opacity-80 truncate">
                                              {hasTreino ? (items[0]?.treinoProgramado?.nome || items[0]?.titulo || "Treino") : "—"}
                                              {items.length > 1 ? ` +${items.length - 1}` : ""}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </>
                            )}
                          </div>

                          {/* Detalhes + Agendar */}
                          <div className="rounded-xl border border-zinc-200 bg-white p-3 flex flex-col min-h-0">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <ClipboardList className="h-5 w-5 text-zinc-500" />
                                <div className="font-extrabold text-zinc-900">Detalhes</div>
                              </div>
                              <button
                                onClick={() => setDrawerOpen((v) => !v)}
                                className="text-xs px-3 py-1 rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                              >
                                {drawerOpen ? "Recolher" : "Abrir"}
                              </button>
                            </div>

                            {!drawerOpen ? null : selectedDays.length === 0 ? (
                              <div className="text-sm text-zinc-600">
                                Clique em um ou mais dias do calendário para ver/agendar treinos para a turma.
                              </div>
                            ) : (
                              <div className="flex flex-col gap-3 min-h-0 flex-1">
                                {!selectedDays.some(isPastDayISO) ? (
                                  <div className="rounded-xl border border-zinc-200 bg-white p-3 flex-none">
                                    <div className="text-sm font-bold mb-2">
                                      Agendar para {selectedDays.length === 1 ? "1 dia" : `${selectedDays.length} dias`}
                                    </div>

                                    <label className="text-xs opacity-80">Treino programado</label>
                                    <select
                                      value={treinoProgramadoId}
                                      onChange={(e) => setTreinoProgramadoId(e.target.value)}
                                      className="w-full mt-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800"
                                    >
                                      <option value="">Selecionar...</option>
                                      {treinosProgramados.map((t) => (
                                        <option key={t.id} value={t.id}>
                                          {t.nome}{t.codigo ? ` (${t.codigo})` : ""}
                                        </option>
                                      ))}
                                    </select>

                                    <button
                                      onClick={agendarParaDiasSelecionadosTurma}
                                      disabled={loadingProgramados || salvandoAgenda}
                                      className="w-full mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                      {salvandoAgenda ? "Agendando..." : loadingProgramados ? "Carregando..." : "Agendar treino para a turma"}
                                    </button>
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-zinc-200 bg-white p-3 flex-none">
                                    <div className="text-sm font-bold mb-1">Agendamento indisponível</div>
                                    <div className="text-sm text-zinc-600">
                                      Você selecionou pelo menos um dia no passado. Selecione apenas hoje ou datas futuras.
                                    </div>
                                  </div>
                                )}

                                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
                                  {selectedDays
                                    .slice()
                                    .sort((a, b) => a.localeCompare(b))
                                    .map((day) => {
                                      const itensDoDia = agendadosTurma.filter((t) => dayKeyFromAny(t.dataTreino) === day);
                                      return (
                                        <div key={day} className="rounded-xl border border-zinc-200 bg-white p-3">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="font-bold">{formatDayPtBR(day)}</div>
                                            <div className="text-xs text-zinc-500">
                                              {itensDoDia.length ? `${itensDoDia.length} treino(s)` : "Sem treino"}
                                            </div>
                                          </div>

                                          {!itensDoDia.length ? (
                                            <div className="text-sm text-zinc-600">Nenhum treino agendado para a turma neste dia.</div>
                                          ) : (
                                            <div className="space-y-2">
                                              {itensDoDia.map((t) => {
                                                const nome = t.treinoProgramado?.nome || t.titulo || "Treino";
                                                const done = isCompleted(t.meuStatus || t.execucaoStatus || t.status);
                                                const lost = !done && isLost(t);

                                                const statusText = statusLabel(t.meuStatus ?? t.execucaoStatus ?? t.status);
                                                const statusClass = done ? "text-emerald-600" : lost ? "text-red-600" : "text-zinc-600";

                                                return (
                                                  <div key={t.id} className="rounded-lg border border-zinc-200 p-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                      <div className="min-w-0">

                                                        <div className="font-bold truncate">{nome}</div>
                                                        {t.atleta?.nome ? (
                                                          <div className="text-xs text-zinc-700 mt-1">
                                                            Atleta: <span className="font-semibold">{t.atleta.nome}</span>
                                                          </div>
                                                        ) : null}
                                                        <div className="text-xs opacity-80 mt-1">
                                                          Status: <span className={statusClass}>{statusText}</span>
                                                        </div>

                                                      </div>

                                                      {done ? (
                                                        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                                                      ) : lost ? (
                                                        <XCircle className="h-5 w-5 text-red-300" />
                                                      ) : null}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
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
            {/* fim col direita */}
          </div>
        </div>
      </div>
    </div>
  );
}
