import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import axios from "axios";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import TurmasManager from "../components/turmas/TurmasManager.js";
import Avatar from "../components/shared/Avatar.js";
import BottomNav from "@/components/layout/BottomNav.js";
import {
  Users,
  Layers,
  GraduationCap,
  Search as SearchIcon,
  Loader2,
  PlusCircle,
  ListChecks,
  ChevronRight,
  CirclePlus,
} from "lucide-react";

type TipoEntidade = "Escola" | "Clube" | "Professor" | null;

type ProfessorMin = {
  id: string;
  usuarioId: string | null;
  nome: string;
  cref?: string | null;
  foto?: string | null;
  turmas?: number;
};

type TurmaItem = {
  id: string;
  nome: string;
  categoria?: string | null;
  professorIds?: string[];
  professorNomes?: string[];
  professorNome?: string | null;
  alunosCount?: number | null;
};

const GerenciarProfessores: React.FC = () => {
  const [location, setLocation] = useLocation();
  const isAtletasPage =
    location === "/perfil/GerenciarAtletas" || location === "/perfil/gerenciarAtletas";
  const isProfessoresPage =
    location.startsWith("/perfil/GerenciarProfessores") ||
    location.startsWith("/perfil/gerenciarProfessores");


  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [tipo, setTipo] = useState<TipoEntidade>(null);
  const [usuarioIdEntidade, setUsuarioIdEntidade] = useState<string | null>(null);
  const [tipoUsuarioIdEntidade, setTipoUsuarioIdEntidade] = useState<string | null>(null);

  const getTab = (): "professores" | "turmas" => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tab === "turmas" ? "turmas" : "professores";
  };

  const [aba, setAba] = useState<"professores" | "turmas">(() => getTab());

  const [q, setQ] = useState("");
  const [professores, setProfessores] = useState<ProfessorMin[]>([]);
  const [profLoading, setProfLoading] = useState(false);
  const [profError, setProfError] = useState<string | null>(null);
  const [turmas, setTurmas] = useState<TurmaItem[]>([]);
  const [turmasLoading, setTurmasLoading] = useState(false);
  const [turmasError, setTurmasError] = useState<string | null>(null);
  const [turmasOpen, setTurmasOpen] = useState(false);
  const [professorSelecionado, setProfessorSelecionado] = useState<string | undefined>();
  const [turmaSelecionadaId, setTurmaSelecionadaId] = useState<string | undefined>();

  useEffect(() => {
    setAba(getTab());
  }, [location]);


  const descobrirPerfil = async () => {
    try {
      let data: any | null = null;

      try {
        const resp = await axios.get(`${API.BASE_URL}/api/perfil/me`, { headers });
        data = resp.data;
      } catch {
        data = null;
      }

      const perfilTipoApi: string | undefined = data?.tipo ?? undefined;
      const perfilTipo: string | undefined = perfilTipoApi ?? (Storage as any).tipoSalvo ?? undefined;

      const normalizado: TipoEntidade =
        perfilTipo === "Escolinha"
          ? "Escola"
          : perfilTipo === "Clube"
          ? "Clube"
          : perfilTipo === "Professor"
          ? "Professor"
          : null;

      if (!normalizado) {
        throw new Error("Perfil inválido.");
      }

      const usuarioId = data?.usuario?.id ?? data?.usuarioId ?? Storage.usuarioId ?? null;

      let tipoId: string | null = null;

      if (perfilTipo === "Clube") {
        tipoId = (data?.clube && data.clube.id) || data?.clubeId || Storage.tipoUsuarioId || null;
      } else if (perfilTipo === "Escolinha") {
        tipoId = (data?.escolinha && data.escolinha.id) || data?.escolinhaId || Storage.tipoUsuarioId || null;
      } else if (perfilTipo === "Professor") {
        tipoId = (data?.professor && data.professor.id) || data?.professorId || Storage.tipoUsuarioId || null;
      } else {
        tipoId = Storage.tipoUsuarioId ?? null;
      }

      if (!usuarioId || !tipoId) throw new Error("Não foi possível identificar o perfil institucional.");

      setTipo(normalizado);
      setUsuarioIdEntidade(usuarioId);
      setTipoUsuarioIdEntidade(tipoId);
      setProfError(null);
    } catch (e: any) {
      setTipo(null);
      setUsuarioIdEntidade(null);
      setTipoUsuarioIdEntidade(null);
      setProfError(e?.response?.data?.message || e?.message || "Não foi possível identificar o perfil institucional.");
    }
  };

  const carregarProfessores = async () => {
    if (!tipo || tipo === "Professor" || !tipoUsuarioIdEntidade) return;

    try {
      setProfError(null);
      setProfLoading(true);

      // 🔥 Preferencial: usar gerenciar/professores (vínculo real)
      // (igual você já usa no TurmasManager)
      const vinculo = tipo === "Clube" ? "clube" : "escolinha";

      const resGerenciar = await axios.get(`${API.BASE_URL}/api/gerenciar/professores`, {
        headers,
        params: {
          vinculo,
          id: usuarioIdEntidade, // ✅ aqui é USER ID da entidade (igual seu TurmasManager faz com orgUserId)
          limit: 200,
          search: q.trim() || undefined,
        },
      });

      let lista = (resGerenciar.data?.professores || resGerenciar.data || []) as any[];

      // 🧯 Fallback: /api/professores com parâmetros mais amplos (igual TurmasManager)
      if (!lista.length) {
        const params: any = {
          organizacaoId: tipoUsuarioIdEntidade,
          tipoUsuarioId: tipoUsuarioIdEntidade,
          search: q.trim() || undefined,
        };

        if (tipo === "Clube") params.clubeId = tipoUsuarioIdEntidade;
        if (tipo === "Escola") params.escolinhaId = tipoUsuarioIdEntidade; // seu tipo "Escola" = Escolinha

        const { data } = await axios.get(`${API.BASE_URL}/api/professores`, { headers, params });
        lista = (Array.isArray(data) ? data : data?.items ?? data?.data ?? []) as any[];
      }

      setProfessores(
        lista.map((p) => ({
          id: String(p.id),
          usuarioId: p.usuarioId ?? p.usuario?.id ?? null,
          nome: p.nome ?? p.usuario?.nome ?? "Professor",
          cref: p.cref ?? null,
          foto: p.fotoUrl ?? p.foto ?? p.usuario?.foto ?? null,
          turmas: p._count?.turmas ?? p.turmasCount ?? 0,
        }))
      );
    } catch (e: any) {
      setProfessores([]);
      setProfError(e?.response?.data?.message || e?.message || "Falha ao carregar professores.");
    } finally {
      setProfLoading(false);
    }
  };

  const carregarTurmas = async () => {
    if (!tipo) return;

    try {
      setTurmasError(null);
      setTurmasLoading(true);

      if (tipo === "Professor") {
        const { data } = await axios.get(`${API.BASE_URL}/api/turmas/como-professor`, { headers });

        const arr: any[] = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];

        setTurmas(
          arr.map((t) => ({
            id: String(t.id),
            nome: String(t.nome ?? t.titulo ?? "Turma"),
            categoria: t.categoria ?? null,
            professorIds: Array.isArray(t.professorIds) ? t.professorIds.map(String) : [],
            professorNomes: Array.isArray(t.professorNomes) ? t.professorNomes : [],
            professorNome:
              t.professorNome ??
              (Array.isArray(t.professorNomes) ? t.professorNomes.join(", ") : null) ??
              null,
            alunosCount: t.alunosCount ?? t._count?.membros ?? t.qtdAlunos ?? null,
          }))
        );

        return;
      }

      if (!tipoUsuarioIdEntidade) return;

      const ownerTipo = tipo === "Escola" ? "Escolinha" : "Clube";
      const { data } = await axios.get(`${API.BASE_URL}/api/turmas`, {
        headers,
        params: { ownerTipo, ownerId: tipoUsuarioIdEntidade },
      });

      const arr: any[] = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];

      setTurmas(
        arr.map((t) => ({
          id: String(t.id),
          nome: String(t.nome ?? t.titulo ?? "Turma"),
          categoria: t.categoria ?? null,
          professorIds: Array.isArray(t.professorIds) ? t.professorIds.map(String) : [],
          professorNomes: Array.isArray(t.professorNomes) ? t.professorNomes : [],
          professorNome:
            t.professorNome ??
            (Array.isArray(t.professorNomes) ? t.professorNomes.join(", ") : null) ??
            null,
          alunosCount: t.alunosCount ?? t._count?.membros ?? t.qtdAlunos ?? null,
        }))
      );
    } catch (e: any) {
      setTurmas([]);
      setTurmasError(e?.response?.data?.message || e?.message || "Falha ao carregar turmas.");
    } finally {
      setTurmasLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    descobrirPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!tipo || !usuarioIdEntidade || !tipoUsuarioIdEntidade) return;
    carregarProfessores();
    carregarTurmas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, usuarioIdEntidade, tipoUsuarioIdEntidade]);

  useEffect(() => {
    if (!tipo || !usuarioIdEntidade || !tipoUsuarioIdEntidade) return;
    const t = setTimeout(() => carregarProfessores(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const metricas = useMemo(() => {
    const totalProfessores = professores.length;
    const totalTurmas = turmas.length;
    const totalAlunos = turmas.reduce((acc, t) => acc + (t.alunosCount ?? 0), 0);
    return { totalProfessores, totalTurmas, totalAlunos };
  }, [professores, turmas]);

  type OwnerTurma = { tipo: "Clube" | "Escolinha"; id: string };
  const owner: OwnerTurma | undefined =
    tipo && tipo !== "Professor" && tipoUsuarioIdEntidade
      ? { tipo: tipo === "Escola" ? "Escolinha" : "Clube", id: tipoUsuarioIdEntidade }
      : undefined;

  useEffect(() => {
    if (tipo === "Professor" && aba === "professores") setAba("turmas");
  }, [tipo, aba]);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 sm:px-4 py-4 sm:py-6 pb-24">
      <div className="mb-3">
        <Link
          href="/perfil"
          aria-label="Voltar para o perfil"
          className="inline-flex h-10 w-10 items-center justify-center
                     rounded-xl border border-green-800/60 bg-white text-green-900
                     shadow-sm hover:bg-green-50"
        >
          <span className="text-xl -mt-0.5">&lt;</span>
        </Link>
      </div>

      <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-600/10 p-3 text-emerald-700">
            <Users className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-xl font-semibold text-zinc-900">
              {tipo ?? "Institucional"} · Gerenciar Professores
            </h1>
            <p className="text-sm text-zinc-500">
              Organize professores, turmas e a relação com atletas do clube/escolinha.
            </p>

            {tipo && (
              <div className="mt-2 inline-flex rounded-xl border border-zinc-200 bg-white p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setLocation("/perfil/GerenciarAtletas")}
                  className={`px-3 py-1.5 rounded-lg ${
                    isAtletasPage ? "bg-emerald-600 text-white" : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Atletas
                </button>

                {tipo !== "Professor" && (
                  <button
                    type="button"
                    onClick={() => {
                      setAba("professores");
                      setLocation("/perfil/GerenciarProfessores");
                    }}
                    className={`px-3 py-1.5 rounded-lg ${
                      isProfessoresPage && aba === "professores"
                        ? "bg-emerald-600 text-white"
                        : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    Professores
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setAba("turmas");
                    setLocation("/perfil/GerenciarProfessores?tab=turmas");
                  }}
                  className={`px-3 py-1.5 rounded-lg ${
                    isProfessoresPage && aba === "turmas"
                      ? "bg-emerald-600 text-white"
                      : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Turmas
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-start sm:justify-end gap-2">
          {owner && (
            <>
              <button
                onClick={() => {
                  setProfessorSelecionado(undefined);
                  setTurmaSelecionadaId(undefined);
                  setTurmasOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                <CirclePlus className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap text-sm">Adicionar</span>
                <span className="hidden sm:inline whitespace-nowrap">turma</span>
              </button>

              <button
                onClick={() => {
                  setProfessorSelecionado(undefined);
                  setTurmaSelecionadaId(undefined);
                  setTurmasOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                <ListChecks className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap text-sm">Turmas</span>
                <span className="hidden sm:inline whitespace-nowrap"> (admin)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {tipo !== "Professor" && (
        <div className="mb-4 hidden sm:grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-2 text-zinc-600">
              <Users className="h-4 w-4" /> Professores vinculados
            </div>
            <div className="mt-2 text-2xl font-semibold">{metricas.totalProfessores}</div>
            <div className="text-xs text-zinc-500">Professores associados a esta instituição</div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-2 text-zinc-600">
              <Layers className="h-4 w-4" /> Turmas cadastradas
            </div>
            <div className="mt-2 text-2xl font-semibold">{metricas.totalTurmas}</div>
            <div className="text-xs text-zinc-500">Turmas ativas para treinos</div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-2 text-zinc-600">
              <GraduationCap className="h-4 w-4" /> Alunos nas turmas
            </div>
            <div className="mt-2 text-2xl font-semibold">{metricas.totalAlunos}</div>
            <div className="text-xs text-zinc-500">Soma de atletas/alunos vinculados às turmas</div>
          </div>
        </div>
      )}

      <div className="mb-3 sm:mb-4 grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-12">
        {aba === "professores" && (
        <div className="md:col-span-6">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2">
            <SearchIcon className="h-4 w-4 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar professor por nome, código ou CREF"
              className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
            />
          </div>
        </div>
        )}

        <div className="md:col-span-6 flex items-center justify-end">
        </div>
      </div>

      {aba === "professores" ? (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-100 p-4">
            <div className="text-sm font-semibold text-zinc-900">Professores vinculados</div>

            <div className="flex items-center gap-2 text-sm text-zinc-600">
              {professores.length} resultado(s)
              {owner && (
                <button
                  onClick={() => {
                    setProfessorSelecionado(undefined);
                    setTurmasOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <PlusCircle className="h-4 w-4" />
                  Nova turma
                </button>
              )}
            </div>
          </div>

          {profLoading ? (
            <div className="p-6 text-center text-zinc-600">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : profError ? (
            <div className="p-6 text-center text-red-600">{profError}</div>
          ) : professores.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              Nenhum professor encontrado para este clube/escolinha.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] table-auto">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="w-16 p-3">Foto</th>
                    <th className="p-3">Nome</th>
                    <th className="w-28 p-3">CREF</th>
                    <th className="w-28 p-3">Turmas</th>
                    <th className="w-44 p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {professores.map((p) => (
                    <tr key={p.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                      <td className="p-3">
                        <Avatar foto={p.foto ?? null} alt={p.nome} className="h-10 w-10" />
                      </td>

                      <td className="p-3">
                        <div className="font-medium text-zinc-900">{p.nome}</div>
                        <div className="text-xs text-zinc-500">ID: {p.usuarioId ?? p.id}</div>
                      </td>

                      <td className="p-3 text-sm text-zinc-700">{p.cref ?? "—"}</td>
                      <td className="p-3 text-sm text-zinc-700">{p.turmas ?? 0}</td>

                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => {
                              setProfessorSelecionado(p.id);
                              setTurmasOpen(true);
                            }}
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                          >
                            Administrar turmas
                          </button>

                          <Link
                            href={`/perfil/${p.usuarioId ?? p.id}`}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
                          >
                            Ver perfil <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-100 p-4">
            <div>
              <div className="text-sm font-semibold text-zinc-900">Turmas do clube/escolinha</div>
              <div className="text-xs text-zinc-500">
                Defina o professor responsável e acompanhe o número de alunos em cada turma.
              </div>
            </div>

            {owner && (
              <button
                onClick={() => {
                  setProfessorSelecionado(undefined);
                  setTurmasOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <PlusCircle className="h-4 w-4" />
                Nova turma
              </button>
            )}
          </div>

          {turmasLoading ? (
            <div className="p-6 text-center text-zinc-600">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : turmasError ? (
            <div className="p-6 text-center text-red-600">{turmasError}</div>
          ) : turmas.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              Nenhuma turma cadastrada. Crie uma turma para começar a organizar seus atletas.
            </div>
          ) : (
            <div className="p-4">
              <ul className="space-y-3">
                {turmas.map((t) => (
                  <li key={t.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">{t.nome}</div>
                        <div className="text-xs text-zinc-500">
                          {t.categoria ? `Categoria: ${t.categoria}` : "Sem categoria"} •{" "}
                          {typeof t.alunosCount === "number" ? `${t.alunosCount} aluno(s)` : "Alunos: —"}
                          {t.professorNome ? ` • Professores: ${t.professorNome}` : ""}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (tipo === "Professor") setProfessorSelecionado(undefined);
                          else setProfessorSelecionado(t.professorIds?.[0]);

                          setTurmaSelecionadaId(t.id);
                          setTurmasOpen(true);
                        }}
                        className="mt-2 inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 sm:mt-0"
                      >
                        <ListChecks className="h-4 w-4" />
                        Administrar turma
                      </button>
                    </div>

                    {professores.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <label className="text-xs text-zinc-600">Professor responsável</label>

                        <select
                          multiple
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm sm:w-80"
                          value={t.professorIds ?? []}
                          onChange={async (e) => {
                            const selectedIds = Array.from(e.target.selectedOptions)
                              .map((o) => o.value)
                              .filter(Boolean);

                            try {
                              await axios.put(
                                `${API.BASE_URL}/api/turmas/${t.id}/atribuir-professores`,
                                { professorIds: selectedIds },
                                { headers }
                              );
                              await carregarTurmas();
                              alert("Professores atualizados na turma!");
                            } catch (err) {
                              console.error(err);
                              alert("Não foi possível atualizar os professores.");
                            }
                          }}
                        >
                          {professores.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nome}
                              {p.cref ? ` • CREF ${p.cref}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <TurmasManager
        open={turmasOpen}
        onClose={() => {
          setTurmasOpen(false);
          carregarTurmas();
          carregarProfessores();
        }}
        owner={owner} 
        professorId={tipo === "Professor" ? (tipoUsuarioIdEntidade ?? undefined) : professorSelecionado}
        initialTurmaId={turmaSelecionadaId}
      />
      <BottomNav />
    </div>
  );
};

export default GerenciarProfessores;