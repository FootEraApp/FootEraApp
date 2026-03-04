// client/src/pages/GerenciarProfessores.tsx
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
  Building2,
  ShieldCheck,
  Save,
  Trash2,
} from "lucide-react";
import GerenciarOrganizacao, { type OrgGestorItem } from "./GerenciarOrganizacao.js";

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

// ======= professor -> lista organizações gerenciáveis =======


// ======= clube/escolinha -> lista gestores (responsáveis) =======
type GestorItem = {
  id: string;
  professorId: string;
  ativo: boolean;
  papel?: string | null;
  permissoes?: any | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;

  // UI (se seu backend mandar)
  professorNome?: string | null;
  professorCref?: string | null;
  professorFoto?: string | null;
};

function getQueryParam(name: string) {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

const GerenciarProfessores: React.FC = () => {
  const [location, setLocation] = useLocation();

  const isAtletasPage =
    location === "/perfil/GerenciarAtletas" || location === "/perfil/gerenciarAtletas";

  const isProfessoresPage =
    location.startsWith("/perfil/GerenciarProfessores") ||
    location.startsWith("/perfil/gerenciarProfessores");

  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  // perfil base (logado)
  const [tipo, setTipo] = useState<TipoEntidade>(null);
  const [usuarioIdEntidade, setUsuarioIdEntidade] = useState<string | null>(null);
  const [tipoUsuarioIdEntidade, setTipoUsuarioIdEntidade] = useState<string | null>(null);

  // se for Professor, guardamos id da tabela Professor
  const [professorIdLogado, setProfessorIdLogado] = useState<string | null>(null);

  // aba
  const getTab = (): "professores" | "turmas" | "organizacoes" => {
    const tab = getQueryParam("tab");
    if (tab === "turmas") return "turmas";
    if (tab === "organizacoes") return "organizacoes";
    return "professores";
  };
  const [aba, setAba] = useState<"professores" | "turmas" | "organizacoes">(() => getTab());

  useEffect(() => {
    setAba(getTab());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const [orgSelecionada, setOrgSelecionada] = useState<OrgGestorItem | null>(null);

  // ======= listas (prof/turmas) =======
  const [q, setQ] = useState("");
  const [professores, setProfessores] = useState<ProfessorMin[]>([]);
  const [profLoading, setProfLoading] = useState(false);
  const [profError, setProfError] = useState<string | null>(null);

  const [turmas, setTurmas] = useState<TurmaItem[]>([]);
  const [turmasLoading, setTurmasLoading] = useState(false);
  const [turmasError, setTurmasError] = useState<string | null>(null);


  // modal turmas
  const [turmasOpen, setTurmasOpen] = useState(false);
  const [professorSelecionado, setProfessorSelecionado] = useState<string | undefined>();
  const [turmaSelecionadaId, setTurmaSelecionadaId] = useState<string | undefined>();

  // contexto efetivo (se logado como professor e selecionou org)
  const contextoTipo: TipoEntidade = useMemo(() => {
    if (tipo === "Professor") {
      if (!orgSelecionada) return "Professor";
      return orgSelecionada.tipo === "CLUBE" ? "Clube" : "Escola";
    }
    return tipo;
  }, [tipo, orgSelecionada]);

  const contextoTipoUsuarioId: string | null = useMemo(() => {
    if (tipo === "Professor") {
      if (!orgSelecionada) return professorIdLogado;
      return orgSelecionada.ownerId;
    }
    return tipoUsuarioIdEntidade;
  }, [tipo, orgSelecionada, professorIdLogado, tipoUsuarioIdEntidade]);

  // owner para TurmasManager
  type OwnerTurma = { tipo: "Clube" | "Escolinha"; id: string };
  const owner: OwnerTurma | undefined =
    contextoTipo && contextoTipo !== "Professor" && contextoTipoUsuarioId
      ? { tipo: contextoTipo === "Escola" ? "Escolinha" : "Clube", id: contextoTipoUsuarioId }
      : undefined;

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

      if (!normalizado) throw new Error("Perfil inválido.");

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

      if (normalizado === "Professor") setProfessorIdLogado(tipoId);
      else setProfessorIdLogado(null);

      setProfError(null);
    } catch (e: any) {
      setTipo(null);
      setUsuarioIdEntidade(null);
      setTipoUsuarioIdEntidade(null);
      setProfessorIdLogado(null);
      setProfError(e?.response?.data?.message || e?.message || "Não foi possível identificar o perfil institucional.");
    }
  };


  // ======= carregar professores (para contexto organização) =======
  const carregarProfessores = async () => {
    if (!contextoTipo || contextoTipo === "Professor" || !contextoTipoUsuarioId) return;

    try {
      setProfError(null);
      setProfLoading(true);

      const { data } = await axios.get(`${API.BASE_URL}/api/professores`, {
        headers,
        params: {
          organizacaoId: contextoTipoUsuarioId,
          search: q.trim() || undefined,
        },
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
      setProfError(e?.response?.data?.message || e?.message || "Falha ao carregar professores.");
    } finally {
      setProfLoading(false);
    }
  };

  const carregarTurmas = async () => {
    if (!contextoTipo) return;

    try {
      setTurmasError(null);
      setTurmasLoading(true);

      if (contextoTipo === "Professor") {
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

      if (!contextoTipoUsuarioId) return;

      const ownerTipo = contextoTipo === "Escola" ? "Escolinha" : "Clube";
      const { data } = await axios.get(`${API.BASE_URL}/api/turmas`, {
        headers,
        params: { ownerTipo, ownerId: contextoTipoUsuarioId },
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

  // init
  useEffect(() => {
    if (!token) return;
    descobrirPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);


  // carrega listas quando muda contexto
  useEffect(() => {
    if (!tipo) return;

    if (tipo === "Professor" && !orgSelecionada) {
      carregarTurmas();
      setProfessores([]);
      return;
    }

    carregarProfessores();
    carregarTurmas();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, usuarioIdEntidade, tipoUsuarioIdEntidade, orgSelecionada, aba]);

  // busca (só no contexto organização)
  useEffect(() => {
    if (!tipo) return;
    if (contextoTipo === "Professor") return;

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

  // regra professor: se não escolheu org, não deixa ficar na aba professores
  useEffect(() => {
    if (tipo !== "Professor") return;
    if (!orgSelecionada && aba === "professores") {
      setAba("organizacoes");
      setLocation("/perfil/GerenciarProfessores?tab=organizacoes");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, orgSelecionada, aba]);

  const tituloTopo = useMemo(() => {
    if (tipo !== "Professor") return `${tipo ?? "Institucional"} · Gerenciar Professores`;
    if (orgSelecionada) {
      const label = orgSelecionada.tipo === "CLUBE" ? "Clube" : "Escolinha";
      return `${label} · Gerenciar Professores`;
    }
    return `Professor · Gerenciar`;
  }, [tipo, orgSelecionada]);

  const subtituloTopo = useMemo(() => {
    if (tipo !== "Professor") return "Organize professores, turmas e a relação com atletas do clube/escolinha.";
    if (orgSelecionada) return "Você está gerenciando como responsável (gestor) desta organização.";
    return "Selecione uma organização para gerenciar como professor responsável.";
  }, [tipo, orgSelecionada]);

  const goTab = (next: "organizacoes" | "professores" | "turmas") => {
    setAba(next);

    if (tipo === "Professor" && orgSelecionada) {
      const qs = new URLSearchParams();
      qs.set("tab", next);
      qs.set("orgTipo", orgSelecionada.tipo);
      qs.set("orgId", orgSelecionada.ownerId);
      setLocation(`/perfil/GerenciarProfessores?${qs.toString()}`);
      return;
    }

    setLocation(`/perfil/GerenciarProfessores?tab=${next}`);
  };

  const selecionarOrg = (o: OrgGestorItem) => {
    setOrgSelecionada(o);

    const qs = new URLSearchParams();
    qs.set("tab", "professores");
    qs.set("orgTipo", o.tipo);
    qs.set("orgId", o.ownerId);
    setLocation(`/perfil/GerenciarProfessores?${qs.toString()}`);
  };

  const limparOrg = () => {
    setOrgSelecionada(null);
    setProfessores([]);
    setQ("");
    setLocation(`/perfil/GerenciarProfessores?tab=organizacoes`);
  };

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
            <h1 className="text-xl font-semibold text-zinc-900">{tituloTopo}</h1>
            <p className="text-sm text-zinc-500">{subtituloTopo}</p>

            {tipo && (
              <div className="mt-2 inline-flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setLocation("/perfil/GerenciarAtletas")}
                  className={`px-3 py-1.5 rounded-lg ${
                    isAtletasPage ? "bg-emerald-600 text-white" : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Atletas
                </button>

                {/* Clube/Escola: aba Organização (responsáveis) */}
                {tipo !== "Professor" && (
                  <button
                    type="button"
                    onClick={() => goTab("organizacoes")}
                    className={`px-3 py-1.5 rounded-lg ${
                      isProfessoresPage && aba === "organizacoes"
                        ? "bg-emerald-600 text-white"
                        : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    Organização
                  </button>
                )}

                {/* Professor: aba Organizações (lista orgs gerenciáveis) */}
                {tipo === "Professor" && (
                  <button
                    type="button"
                    onClick={() => goTab("organizacoes")}
                    className={`px-3 py-1.5 rounded-lg ${
                      isProfessoresPage && aba === "organizacoes"
                        ? "bg-emerald-600 text-white"
                        : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    Organizações
                  </button>
                )}

                {/* Professores: clube/escola sempre; professor somente se escolheu org */}
                {(tipo !== "Professor" || !!orgSelecionada) && (
                  <button
                    type="button"
                    onClick={() => goTab("professores")}
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
                  onClick={() => goTab("turmas")}
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

            {/* badge: professor com org selecionada */}
            {tipo === "Professor" && orgSelecionada && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900">
                <ShieldCheck className="h-4 w-4" />
                Responsável:{" "}
                <span className="font-semibold">
                  {orgSelecionada.nome ?? (orgSelecionada.tipo === "CLUBE" ? "Clube" : "Escolinha")}
                </span>
                <button
                  onClick={limparOrg}
                  className="ml-2 rounded-lg border border-emerald-200 bg-white px-2 py-0.5 text-emerald-800 hover:bg-emerald-100"
                  title="Trocar organização"
                >
                  Trocar
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

      {/* métricas só quando contexto é organização */}
      {contextoTipo !== "Professor" && (
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

      {/* busca só na aba professores */}
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
        <div className="md:col-span-6 flex items-center justify-end" />
      </div>

      {aba === "organizacoes" && (
        <GerenciarOrganizacao
          tipo={tipo}
          headers={headers}
          owner={owner}
          professores={professores}
          profLoading={profLoading}
          profError={profError}
          orgSelecionada={orgSelecionada}
          setOrgSelecionada={setOrgSelecionada}
          selecionarOrg={selecionarOrg}
          limparOrg={limparOrg}
        />
      )}

      {/* ABA: PROFESSORES */}
      {aba === "professores" && (
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

          {tipo === "Professor" && !orgSelecionada ? (
            <div className="p-8 text-center text-zinc-600">
              Primeiro selecione uma organização na aba <b>Organizações</b>.
            </div>
          ) : profLoading ? (
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
      )}

      {/* ABA: TURMAS */}
      {aba === "turmas" && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-100 p-4">
            <div>
              <div className="text-sm font-semibold text-zinc-900">
                {contextoTipo === "Professor" ? "Minhas turmas (como professor)" : "Turmas do clube/escolinha"}
              </div>
              <div className="text-xs text-zinc-500">
                {contextoTipo === "Professor"
                  ? "Acompanhe e administre as turmas em que você participa."
                  : "Defina o professor responsável e acompanhe o número de alunos em cada turma."}
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
                          if (contextoTipo === "Professor") setProfessorSelecionado(undefined);
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

                    {contextoTipo !== "Professor" && professores.length > 0 && (
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
          if (contextoTipo !== "Professor") carregarProfessores();
        }}
        owner={owner}
        professorId={contextoTipo === "Professor" ? (professorIdLogado ?? undefined) : professorSelecionado}
        initialTurmaId={turmaSelecionadaId}
      />

      <BottomNav />
    </div>
  );
};

export default GerenciarProfessores;