import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { X, Loader2, Plus, Users, User, List, Save } from "lucide-react";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";

type Owner = { tipo: "Clube" | "Escolinha"; id: string };

type TurmaMin = {
  id: string;
  nome: string;
  categoria?: string | null;
  professorId?: string | null;
  professorNome?: string | null;
  alunosCount?: number;
};

type ProfessorMin = { id: string; nome: string };
type AtletaMin = { usuarioId: string; nome: string; checked?: boolean };

export default function TurmasManager({
  open,
  onClose,
  owner,
  professorId,
}: {
  open: boolean;
  onClose: () => void;
  owner?: Owner;
  professorId?: string;
}) {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [turmas, setTurmas] = useState<TurmaMin[]>([]);
  const [profs, setProfs] = useState<ProfessorMin[]>([]);
  const [alunos, setAlunos] = useState<AtletaMin[]>([]);

  const [filtroProf, setFiltroProf] = useState<string>(professorId || "");
  const [selecionada, setSelecionada] = useState<string>("");

  const [novoNome, setNovoNome] = useState("");
  const [novoCategoria, setNovoCategoria] = useState<"" | "Sub-9" | "Sub-11" | "Sub-13" | "Sub-15" | "Sub-17" | "Sub-20" | "Livre">("");
  const [novoProfessor, setNovoProfessor] = useState<string>(professorId || "");

  useEffect(() => {
    if (!open || !owner) return;
    (async () => {
      setLoading(true);
      try {
        // professores do dono
        const resP = await axios.get(`${API.BASE_URL}/api/gerenciar/professores`, {
          headers,
          params: { vinculo: owner.tipo === "Clube" ? "clube" : "escolinha", id: owner.id, limit: 200 },
        });
        const lp = (resP.data?.professores || resP.data || []) as any[];
        setProfs(lp.map((p) => ({ id: p.id, nome: p.nome })));

        // alunos do dono (para vincular em turmas)
        const resA = await axios.get(`${API.BASE_URL}/api/gerenciar/atletas`, {
          headers,
          params: { vinculo: owner.tipo === "Clube" ? "clube" : "escolinha", id: owner.id, limit: 1000 },
        });
        const la = (resA.data?.atletas || []) as any[];
        setAlunos(la.map((a) => ({ usuarioId: a.usuarioId || a.id, nome: a.nome })));

        await carregarTurmas(owner, professorId || "");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, owner?.id]);

  const carregarTurmas = async (o: Owner, prof?: string) => {
    const resT = await axios.get(`${API.BASE_URL}/api/turmas`, {
      headers,
      params: { ownerTipo: o.tipo, ownerId: o.id, professorId: prof || undefined },
    });
    const lt = (resT.data?.items || resT.data || []) as any[];
    setTurmas(
      lt.map((t) => ({
        id: t.id,
        nome: t.nome,
        categoria: t.categoria ?? null,
        professorId: t.professorId ?? null,
        professorNome: t.professor?.nome ?? null,
        alunosCount: t._count?.alunos ?? t.alunosCount ?? 0,
      }))
    );
  };

  const onFiltrarProf = async (prof: string) => {
    setFiltroProf(prof);
    if (owner) await carregarTurmas(owner, prof);
  };

  const abrirTurma = async (id: string) => {
    setSelecionada(id);
    // carregar membros para marcar check
    const res = await axios.get(`${API.BASE_URL}/api/turmas/${id}/alunos`, { headers });
    const membros: string[] = (res.data?.usuarioIds || res.data || []) as string[];
    setAlunos((prev) => prev.map((a) => ({ ...a, checked: membros.includes(a.usuarioId) })));
  };

  const salvarMembros = async () => {
    if (!selecionada) return;
    setSalvando(true);
    try {
      const usuarioIds = alunos.filter((a) => a.checked).map((a) => a.usuarioId);
      await axios.post(`${API.BASE_URL}/api/turmas/${selecionada}/alunos`, { usuarioIds }, { headers });
      alert("Turma atualizada!");
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Falha ao salvar turma");
    } finally {
      setSalvando(false);
    }
  };

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
        professorId: novoProfessor || undefined,
      };
      const res = await axios.post(`${API.BASE_URL}/api/turmas`, payload, { headers });
      setNovoNome(""); setNovoCategoria(""); // mantém professor selecionado
      await carregarTurmas(owner, filtroProf);
      setSelecionada(res.data?.id);
      alert("Turma criada!");
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Falha ao criar turma");
    } finally {
      setSalvando(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 p-4">
          <div className="text-sm font-semibold text-zinc-900">
            {owner ? `${owner.tipo} · Gerenciar turmas` : "Gerenciar turmas"}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Coluna esquerda: filtro + lista de turmas */}
          <div className="md:col-span-1">
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <div className="mb-2 text-sm font-medium text-zinc-900 flex items-center gap-2">
                <User className="h-4 w-4" /> Professor
              </div>
              <select
                value={filtroProf}
                onChange={(e) => onFiltrarProf(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {profs.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div className="mt-3 rounded-xl border border-zinc-200 bg-white">
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
                <ul className="max-h-72 overflow-auto">
                  {turmas.map((t) => (
                    <li
                      key={t.id}
                      onClick={() => abrirTurma(t.id)}
                      className={`flex cursor-pointer items-center justify-between p-3 hover:bg-zinc-50 ${selecionada === t.id ? "bg-zinc-50" : ""}`}
                    >
                      <div>
                        <div className="text-sm font-medium text-zinc-900">{t.nome}</div>
                        <div className="text-xs text-zinc-500">
                          {(t.categoria || "—")} · {t.professorNome || "Sem professor"}
                        </div>
                      </div>
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{t.alunosCount ?? 0} aluno(s)</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
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
                {["Sub-9","Sub-11","Sub-13","Sub-15","Sub-17","Sub-20","Livre"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={novoProfessor}
                onChange={(e) => setNovoProfessor(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                <option value="">Professor (opcional)</option>
                {profs.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <button
                onClick={criarTurma}
                disabled={salvando}
                className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-70"
              >
                {salvando ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Criar turma"}
              </button>
            </div>
          </div>

          {/* Coluna direita: membros da turma */}
          <div className="md:col-span-2">
            {!selecionada ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 text-zinc-500 text-center">
                Selecione uma turma para gerenciar seus alunos.
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-white">
                <div className="flex items-center justify-between border-b border-zinc-100 p-3">
                  <div className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                    <Users className="h-4 w-4" /> Alunos da turma
                  </div>
                  <button
                    onClick={salvarMembros}
                    disabled={salvando}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-70"
                  >
                    {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar alterações
                  </button>
                </div>
                <div className="max-h-[420px] overflow-auto p-3">
                  <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {alunos.map((a) => (
                      <li key={a.usuarioId} className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2">
                        <input
                          type="checkbox"
                          checked={!!a.checked}
                          onChange={() => setAlunos(prev => prev.map(x => x.usuarioId === a.usuarioId ? { ...x, checked: !x.checked } : x))}
                          className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-zinc-800">{a.nome}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}