// client/src/pages/perfil/GerenciarProfessores.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import axios from "axios";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import TurmasManager from "../components/turmas/TurmasManager.js";
import Avatar from "../components/shared/Avatar.js";
import {
  ChevronLeft,
  Users,
  Layers,
  GraduationCap,
  Search as SearchIcon,
  Loader2,
  PlusCircle,
  ListChecks,
  House,
  Search,
  CirclePlus,
  Volleyball,
  User,
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
  professorId?: string | null;
  professorNome?: string | null;
  alunosCount?: number | null;
};

const getFoto = (f?: string | null) => {
  if (!f || f === "" || f === "null") return "/assets/usuarios/default-user.png";
  if (f.startsWith("http")) return f;
  return `${API.BASE_URL}/${f.replace(/^\/+/, "")}`;
};

const tipoParaVinculo = (t: Exclude<TipoEntidade, null>) =>
  t === "Escola" ? "escolinha" : t.toLowerCase();

const GerenciarProfessores: React.FC = () => {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [tipo, setTipo] = useState<TipoEntidade>(null);
  const [usuarioIdEntidade, setUsuarioIdEntidade] = useState<string | null>(null);
  const [tipoUsuarioIdEntidade, setTipoUsuarioIdEntidade] = useState<string | null>(null);

  const [aba, setAba] = useState<"professores" | "turmas">("professores");

  const [q, setQ] = useState("");
  const [professores, setProfessores] = useState<ProfessorMin[]>([]);
  const [profLoading, setProfLoading] = useState(false);
  const [profError, setProfError] = useState<string | null>(null);

  const [turmas, setTurmas] = useState<TurmaItem[]>([]);
  const [turmasLoading, setTurmasLoading] = useState(false);
  const [turmasError, setTurmasError] = useState<string | null>(null);

  const [turmasOpen, setTurmasOpen] = useState(false);
  const [professorSelecionado, setProfessorSelecionado] = useState<string | undefined>();

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
    const perfilTipo: string | undefined = perfilTipoApi ?? Storage.tipoSalvo ?? undefined;

    const normalizado: TipoEntidade =
      perfilTipo === "Escolinha"
        ? "Escola"
        : perfilTipo === "Clube"
        ? "Clube"
        : perfilTipo === "Professor"
        ? "Professor"
        : null;

    if (!normalizado || normalizado === "Professor") {
      throw new Error(
        "Apenas Clube ou Escolinha podem gerenciar professores e turmas nesta tela."
      );
    }

    const usuarioId =
      data?.usuario?.id ??
      data?.usuarioId ??
      Storage.usuarioId ??
      null;

    let tipoId: string | null = null;

    if (perfilTipo === "Clube") {
      tipoId =
        (data?.clube && data.clube.id) ||
        data?.clubeId ||
        Storage.tipoUsuarioId ||
        null;
    } else if (perfilTipo === "Escolinha") {
      tipoId =
        (data?.escolinha && data.escolinha.id) ||
        data?.escolinhaId ||
        Storage.tipoUsuarioId ||
        null;
    } else {
      tipoId = Storage.tipoUsuarioId ?? null;
    }

    if (!usuarioId || !tipoId) {
      throw new Error("Não foi possível identificar o perfil institucional.");
    }

    setTipo(normalizado);
    setUsuarioIdEntidade(usuarioId);
    setTipoUsuarioIdEntidade(tipoId);
    setProfError(null);
  } catch (e: any) {
    setTipo(null);
    setUsuarioIdEntidade(null);
    setTipoUsuarioIdEntidade(null);
    setProfError(
      e?.response?.data?.message ||
        e?.message ||
        "Não foi possível identificar o perfil institucional."
    );
  }
};

  const carregarProfessores = async () => {
    if (!tipo || tipo === "Professor" || !tipoUsuarioIdEntidade) return;
    try {
      setProfError(null);
      setProfLoading(true);

      const { data } = await axios.get(`${API.BASE_URL}/api/professores`, {
        headers,
        params: { organizacaoId: tipoUsuarioIdEntidade },
      });

      const lista = (Array.isArray(data) ? data : data?.items ?? data?.data ?? []) as any[];

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
      setProfError(
        e?.response?.data?.message || e?.message || "Falha ao carregar professores."
      );
    } finally {
      setProfLoading(false);
    }
  };

  const carregarTurmas = async () => {
    if (!tipoUsuarioIdEntidade || !tipo) return;
    try {
      setTurmasError(null);
      setTurmasLoading(true);

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
          professorId: t.professorId ?? t.responsavelId ?? null,
          professorNome: t.professor?.nome ?? t.professorNome ?? null,
          alunosCount: t.alunosCount ?? t._count?.membros ?? t.qtdAlunos ?? null,
        }))
      );
    } catch (e: any) {
      setTurmas([]);
      setTurmasError(
        e?.response?.data?.message || e?.message || "Falha ao carregar turmas."
      );
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
    if (!tipo || !usuarioIdEntidade) return;
    carregarProfessores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const metricas = useMemo(() => {
    const totalProfessores = professores.length;
    const totalTurmas = turmas.length;
    const totalAlunos = turmas.reduce(
      (acc, t) => acc + (t.alunosCount ?? 0),
      0
    );
    return { totalProfessores, totalTurmas, totalAlunos };
  }, [professores, turmas]);

  type OwnerTurma = {
    tipo: "Clube" | "Escolinha";
    id: string;
  };

  const owner: OwnerTurma | undefined =
    tipo && tipoUsuarioIdEntidade
      ? {
          tipo: tipo === "Escola" ? "Escolinha" : "Clube",
          id: tipoUsuarioIdEntidade,
        }
      : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* topo / voltar */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => (window.location.href = "/perfil")}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-green-800/60 bg-white text-green-900 shadow-sm hover:bg-green-50"
          aria-label="Voltar para o perfil"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="text-right">
          <h1 className="text-xl font-semibold text-zinc-900">
            {tipo ?? "Institucional"} · Gerenciar Professores
          </h1>
          <p className="text-sm text-zinc-500">
            Organize professores, turmas e a relação com atletas do clube/escolinha.
          </p>
        </div>
      </div>

      {/* métricas rápidas */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 text-zinc-600">
            <Users className="h-4 w-4" /> Professores vinculados
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {metricas.totalProfessores}
          </div>
          <div className="text-xs text-zinc-500">
            Professores associados a esta instituição
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 text-zinc-600">
            <Layers className="h-4 w-4" /> Turmas cadastradas
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {metricas.totalTurmas}
          </div>
          <div className="text-xs text-zinc-500">Turmas ativas para treinos</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 text-zinc-600">
            <GraduationCap className="h-4 w-4" /> Alunos nas turmas
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {metricas.totalAlunos}
          </div>
          <div className="text-xs text-zinc-500">
            Soma de atletas/alunos vinculados às turmas
          </div>
        </div>
      </div>

      {/* abas superiores */}
      <div className="mb-4 inline-flex rounded-xl border border-zinc-200 bg-white p-1 text-sm">
        <button
          onClick={() => setAba("professores")}
          className={`px-3 py-1.5 rounded-lg ${
            aba === "professores"
              ? "bg-emerald-600 text-white"
              : "text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          Professores
        </button>
        <button
          onClick={() => setAba("turmas")}
          className={`px-3 py-1.5 rounded-lg ${
            aba === "turmas"
              ? "bg-emerald-600 text-white"
              : "text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          Turmas
        </button>
      </div>

      {/* filtro de busca (apenas para aba professores, mas deixei em cima) */}
      <div className="mb-4 max-w-md">
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

      {aba === "professores" ? (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-100 p-4">
            <div className="text-sm font-semibold text-zinc-900">
              Professores vinculados
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              {professores.length} resultado(s)
              {owner && (
                <button
                  onClick={() => {
                    setProfessorSelecionado(undefined);
                    setTurmasOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <PlusCircle className="h-4 w-4" /> Nova turma
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
            <table className="min-w-full table-fixed">
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
                  <tr key={p.id} className="border-t border-zinc-100">
                    <td className="p-3">
                      <Avatar
                        foto={p.foto ?? null}
                        alt={p.nome}
                        className="h-10 w-10"
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-zinc-900">{p.nome}</div>
                      <div className="text-xs text-zinc-500">
                        ID: {p.usuarioId ?? p.id}
                      </div>
                    </td>
                    <td className="p-3 text-sm text-zinc-700">
                      {p.cref ?? "—"}
                    </td>
                    <td className="p-3 text-sm text-zinc-700">
                      {p.turmas ?? 0}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            setProfessorSelecionado(p.id);
                            setTurmasOpen(true);
                          }}
                          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          Administrar turmas
                        </button>
                        <Link
                          href={`/perfil/${p.usuarioId ?? p.id}`}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
                        >
                          Ver perfil <ChevronLeft className="h-3 w-3 rotate-180" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-900">
                Turmas do clube/escolinha
              </div>
              <div className="text-xs text-zinc-500">
                Defina o professor responsável e acompanhe o número de alunos em
                cada turma.
              </div>
            </div>
            {owner && (
              <button
                onClick={() => {
                  setProfessorSelecionado(undefined);
                  setTurmasOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
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
              Nenhuma turma cadastrada. Crie uma turma para começar a organizar
              seus atletas.
            </div>
          ) : (
            <ul className="space-y-3">
              {turmas.map((t) => (
                <li
                  key={t.id}
                  className="rounded-xl border border-zinc-200 p-3 flex flex-col gap-2"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">
                        {t.nome}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {t.categoria ? `Categoria: ${t.categoria}` : "Sem categoria"}{" "}
                        •{" "}
                        {typeof t.alunosCount === "number"
                          ? `${t.alunosCount} aluno(s)`
                          : "Alunos: —"}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setProfessorSelecionado(t.professorId ?? undefined);
                        setTurmasOpen(true);
                      }}
                      className="mt-2 inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 sm:mt-0"
                    >
                      <ListChecks className="h-4 w-4" />
                      Administrar turma
                    </button>
                  </div>

                  {/* select para escolher professor responsável */}
                  {professores.length > 0 && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <label className="text-xs text-zinc-600">
                        Professor responsável
                      </label>
                      <select
                        className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm sm:mt-0 sm:w-64"
                        value={t.professorId ?? ""}
                        onChange={async (e) => {
                          const newProfId = e.target.value || null;
                          try {
                            await axios.put(
                              `${API.BASE_URL}/api/turmas/${t.id}/vincular-professor`,
                              { professorId: newProfId },
                              { headers }
                            );
                            await carregarTurmas();
                            alert("Professor atualizado na turma!");
                          } catch (err) {
                            console.error(err);
                            alert("Não foi possível atualizar o professor.");
                          }
                        }}
                      >
                        <option value="">— Sem professor —</option>
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
          )}
        </div>
      )}

      {/* Modal de Turmas (mesmo usado em GerenciarAtletas / PerfilClube) */}
      {owner && (
        <TurmasManager
          open={turmasOpen}
          onClose={() => {
            setTurmasOpen(false);
            carregarTurmas();
            carregarProfessores();
          }}
          owner={owner}
          professorId={professorSelecionado}
        />
      )}

      {/* bottom nav igual outras telas principais */}
      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed">
          <House />
        </Link>
        <Link href="/explorar">
          <Search />
        </Link>
        <Link href="/post">
          <CirclePlus />
        </Link>
        <Link href="/treinos">
          <Volleyball />
        </Link>
        <Link href="/perfil">
          <User />
        </Link>
      </nav>
    </div>
  );
};

export default GerenciarProfessores;