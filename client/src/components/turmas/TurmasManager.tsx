import React, { useEffect, useState } from "react";
import axios from "axios";
import { X, Loader2, Plus, Users, User, List, Save, Search } from "lucide-react";
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

type ProfessorMin = { id: string; nome: string; checked?: boolean };
type AtletaMin = { usuarioId: string; nome: string; sobrenome?: string; checked?: boolean };

type Owner = { tipo: "Clube" | "Escolinha"; id: string; usuarioId?: string };

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

  const [filtroAluno, setFiltroAluno] = useState("");
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
    if (!open || !owner) return;
    (async () => {
      setLoading(true);
      try {
        const orgUserId = owner.usuarioId ?? owner.id;

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

        const resA = await axios.get(`${API.BASE_URL}/api/gerenciar/atletas`, {
          headers,
          params: {
            vinculo: owner.tipo === "Clube" ? "clube" : "escolinha",
            id: orgUserId,
            limit: 1000,
          },
        });

        let la = (resA.data?.atletas || resA.data || []) as any[];

        if (la.length < 3) {
          const resAll = await axios.get(`${API.BASE_URL}/api/atletas`, {
            headers,
            params: {
              clubeId: owner.tipo === "Clube" ? owner.id : undefined,
              escolinhaId: owner.tipo === "Escolinha" ? owner.id : undefined,
              limit: 2000,
            },
          });

          la = (resAll.data?.items || resAll.data?.atletas || resAll.data || []) as any[];
        }

        setAlunos(
          la.map((a) => {
            const usuarioId = String(a.usuarioId ?? a.usuario?.id ?? a.id);

            const nome = String(a.nome ?? a.usuario?.nome ?? "").trim();
            const sobrenome = String(a.sobrenome ?? a.usuario?.sobrenome ?? "").trim();

            const nomeCompleto = [nome, sobrenome].filter(Boolean).join(" ").trim() || "Atleta";

            return {
              usuarioId,
              nome: nomeCompleto,
              sobrenome: sobrenome || undefined,
            };
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
        professorNome:
          t.professorNome ??
          (professorNomes.length ? professorNomes.join(", ") : null),
        alunosCount: t._count?.membros ?? t.alunosCount ?? 0,
      };
    });

    const profFiltro = (professorFiltro ?? filtroProf)?.trim();

    const filtradas =
      profFiltro
        ? parsed.filter((t) => (t.professorIds ?? []).includes(String(profFiltro)))
        : parsed;

    setTurmas(filtradas);
  };

  const onFiltrarProf = async (prof: string) => {
    setFiltroProf(prof);
    if (owner) await carregarTurmas(owner, prof); // ✅ usa o valor novo
  };

  const marcarProfessoresDaTurma = (turmaId: string) => {
    const turma = turmas.find((t) => t.id === turmaId);
    const ids = (turma?.professorIds || []).map(String);

    setProfs((prev) =>
      prev.map((p) => ({ ...p, checked: ids.includes(String(p.id)) }))
    );
  };

  const abrirTurma = async (id: string) => {
    setSelecionada(id);
    marcarProfessoresDaTurma(id);

    const res = await axios.get(`${API.BASE_URL}/api/turmas/${id}/alunos`, { headers });

    const usuarioIds: string[] = Array.isArray(res.data?.usuarioIds)
      ? res.data.usuarioIds.map(String)
      : Array.isArray(res.data?.alunos)
        ? res.data.alunos.map((x: any) => String(x.usuarioId)).filter(Boolean)
        : [];

    setAlunos((prev) =>
      prev.map((a) => ({ ...a, checked: usuarioIds.includes(a.usuarioId) }))
    );
  };

  const salvarMembros = async () => {
    if (!selecionada) return;
    setSalvando(true);

    try {
      // 1) salva PROFESSORES primeiro
      await salvarProfessores();

      // 2) salva ALUNOS depois
      const usuarioIds = alunos.filter((a) => a.checked).map((a) => a.usuarioId);

      const r = await axios.post(
        `${API.BASE_URL}/api/turmas/${selecionada}/alunos`,
        { usuarioIds },
        { headers }
      );

      if (owner) await carregarTurmas(owner);
      await abrirTurma(selecionada);

      alert(`Turma atualizada! (${r.data?.total ?? usuarioIds.length} aluno(s))`);
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Falha ao salvar turma");
    } finally {
      setSalvando(false);
    }
  };

  const salvarProfessores = async () => {
    if (!selecionada) return;

    const professorIds = profs.filter((p) => p.checked).map((p) => String(p.id));

    await axios.put(
      `${API.BASE_URL}/api/turmas/${selecionada}/vincular-professor`,
      { professorIds },
      { headers }
    );
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
        professorIds: novoProfessores,
      };
      const res = await axios.post(`${API.BASE_URL}/api/turmas`, payload, { headers });
      const novaId = String(res.data?.id || "");

      // 🔥 garante que salva professores da turma nova
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
      if (novaId) await abrirTurma(novaId);
      alert("Turma criada!");
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Falha ao criar turma");
    } finally {
      setSalvando(false);
    }
  };

  const alunosFiltrados = alunos.filter((a) => {
    const nome = (a.nome || "").toLowerCase();
    const termo = filtroAluno.trim().toLowerCase();
    if (!termo) return true;
    return nome.includes(termo);
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-5xl max-h-[92dvh] rounded-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-100 p-4">
          <div className="text-sm font-semibold text-zinc-900">
            {owner ? `${owner.tipo} · Gerenciar turmas` : "Gerenciar turmas"}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 overscroll-contain">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-1 flex flex-col gap-3">
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

            <div className="md:col-span-2">
              {!selecionada ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-6 text-zinc-500 text-center">
                  Selecione uma turma para gerenciar seus alunos.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* ✅ Card: Professores da turma */}
                  <div className="rounded-xl border border-zinc-200 bg-white">
                    <div className="border-b border-zinc-100 p-3 text-sm font-semibold text-zinc-900 flex items-center gap-2">
                      <User className="h-4 w-4" /> Professores da turma
                    </div>

                    <div className="p-3 max-h-[26dvh] overflow-auto overscroll-contain">
                      {profs.length === 0 ? (
                        <div className="text-sm text-zinc-500">Nenhum professor encontrado.</div>
                      ) : (
                        <ul className="divide-y divide-green-100">
                          {profs.map((p) => (
                            <li key={p.id} className="py-2 flex items-center gap-3">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-green-900">{p.nome}</div>
                              </div>
                              <input
                                type="checkbox"
                                checked={!!p.checked}
                                onChange={() =>
                                  setProfs((prev) =>
                                    prev.map((x) =>
                                      x.id === p.id ? { ...x, checked: !x.checked } : x
                                    )
                                  )
                                }
                                className="h-4 w-4 rounded border-green-300 accent-emerald-600 focus:ring-emerald-500"
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* ✅ Card: Alunos da turma */}
                  <div className="rounded-xl border border-zinc-200 bg-white flex flex-col max-h-[70dvh]">
                    <div className="flex items-center justify-between border-b border-zinc-100 p-3 flex-none">
                      <div className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                        <Users className="h-4 w-4" /> Alunos da turma
                      </div>

                      <button
                        onClick={salvarMembros}
                        disabled={salvando}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-70"
                      >
                        {salvando ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Salvar alterações
                      </button>
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
                      className="flex-1 min-h-0 overflow-auto p-3 overscroll-contain"
                      style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" as any }}
                    >
                      <ul className="divide-y divide-green-100">
                        {alunosFiltrados.map((a) => (
                          <li key={a.usuarioId} className="py-2 flex items-center gap-3">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-green-900">{a.nome}</div>
                            </div>
                            <input
                              type="checkbox"
                              checked={!!a.checked}
                              onChange={() =>
                                setAlunos((prev) =>
                                  prev.map((x) =>
                                    x.usuarioId === a.usuarioId ? { ...x, checked: !x.checked } : x
                                  )
                                )
                              }
                              className="h-4 w-4 rounded border-green-300 accent-emerald-600 focus:ring-emerald-500"
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}