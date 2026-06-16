// client/src/pages/GerenciarOrganizacao.tsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API } from "../config.js";
import Avatar from "../components/shared/Avatar.js";
import {
  Building2,
  ShieldCheck,
  Loader2,
  PlusCircle,
  Save,
  Trash2,
} from "lucide-react";
import { setGestorOrg } from "../utils/gestorSession.js";

type TipoEntidade = "Escola" | "Clube" | "Professor" | null;

type OrgGestorTipo = "CLUBE" | "ESCOLINHA";
export type OrgGestorItem = {
  id: string;
  tipo: OrgGestorTipo;
  ownerId: string;
  papel?: string | null;
  permissoes?: any | null;
  ativo: boolean;
  nome?: string | null;
  logo?: string | null;
  cidade?: string | null;
  estado?: string | null;
};

type ProfessorMin = {
  id: string;
  usuarioId: string | null;
  nome: string;
  cref?: string | null;
  foto?: string | null;
};

type GestorItem = {
  id: string;
  professorId: string;
  ativo: boolean;
  papel?: string | null;
  permissoes?: any | null;
  professorNome?: string | null;
  professorCref?: string | null;
  professorFoto?: string | null;
};

type OwnerTurma = { tipo: "Clube" | "Escolinha"; id: string };
type PermState = { atletasTurmas: boolean; professores: boolean };

function normalizePermissoes(raw: any | null | undefined): PermState {
  const obj = raw && typeof raw === "object" ? raw : {};
  const atletasTurmas = !!obj.atletasTurmas || !!obj.atletas_turmas || !!obj.turmas || !!obj.atletas;
  const professores = !!obj.professores || !!obj.professor || !!obj.turmasProfessores;

  return { atletasTurmas, professores };
}

function permsToPayload(p: PermState) {
  return { atletasTurmas: !!p.atletasTurmas, professores: !!p.professores };
}

function PermissoesChips({ perms }: { perms: PermState }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <span
        className={`rounded-full border px-2 py-0.5 ${
          perms.atletasTurmas
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-zinc-200 bg-zinc-50 text-zinc-600"
        }`}
      >
        Atletas/Turmas
      </span>
      <span
        className={`rounded-full border px-2 py-0.5 ${
          perms.professores
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-zinc-200 bg-zinc-50 text-zinc-600"
        }`}
      >
        Professores
      </span>
    </div>
  );
}

function PermissoesPicker({
  value,
  onChange,
}: {
  value: PermState;
  onChange: (next: PermState) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <label className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-white p-3">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={value.atletasTurmas}
          onChange={(e) => onChange({ ...value, atletasTurmas: e.target.checked })}
        />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900">Atletas/Turmas</div>
          <div className="text-xs text-zinc-600">
            Gerenciar turmas, treinos, adicionar/remover atletas, etc.
          </div>
        </div>
      </label>

      <label className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-white p-3">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={value.professores}
          onChange={(e) => onChange({ ...value, professores: e.target.checked })}
        />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900">Professores</div>
          <div className="text-xs text-zinc-600">
            Criar turmas e selecionar professores responsáveis da turma.
          </div>
        </div>
      </label>
    </div>
  );
}

type Props = {
  tipo: TipoEntidade;
  headers?: any;
  orgs?: OrgGestorItem[];
  orgsLoading?: boolean;
  orgsError?: string | null;
  onSelectOrg?: (o: OrgGestorItem) => void;
  orgSelecionada?: OrgGestorItem | null;
  setOrgSelecionada?: React.Dispatch<React.SetStateAction<OrgGestorItem | null>>;
  selecionarOrg?: (o: OrgGestorItem) => void;
  limparOrg?: () => void;
  owner?: OwnerTurma;
  professores: ProfessorMin[];
  profLoading?: boolean;
  profError?: string | null;
};

export default function GerenciarOrganizacao({
  tipo,
  headers,
  orgs = [],
  orgsLoading = false,
  orgsError = null,
  onSelectOrg,
  selecionarOrg,
  owner,
  professores,
  profLoading,
  profError,
}: Props) {

  const [gestores, setGestores] = useState<GestorItem[]>([]);
  const [gestoresLoading, setGestoresLoading] = useState(false);
  const [gestoresError, setGestoresError] = useState<string | null>(null);
  const [novoProfessorId, setNovoProfessorId] = useState("");
  const [novoPapel, setNovoPapel] = useState("");
  const [novoPerms, setNovoPerms] = useState<PermState>({
    atletasTurmas: true, 
    professores: false,
  });

  const [saving, setSaving] = useState(false);
  const tipoApi = useMemo(() => {
    if (!owner) return null;
    return owner.tipo === "Clube" ? "CLUBE" : "ESCOLINHA";
  }, [owner]);

  const carregarGestores = async () => {
    if (!owner || !tipoApi) return;

    try {
      setGestoresError(null);
      setGestoresLoading(true);

      const { data } = await axios.get(`${API.BASE_URL}/api/gerenciar-organizacoes/gestores`, {
        headers,
        params: { tipo: tipoApi, ownerId: owner.id },
      });

      const arr = (Array.isArray(data) ? data : data?.items ?? data?.data ?? []) as any[];

      setGestores(
        arr.map((g) => ({
          id: String(g.id),
          professorId: String(g.professorId ?? g.professor?.id ?? ""),
          ativo: !!g.ativo,
          papel: g.papel ?? null,
          permissoes: g.permissoes ?? null,
          professorNome: g.professorNome ?? g.professor?.nome ?? null,
          professorCref: g.professorCref ?? g.professor?.cref ?? null,
          professorFoto: g.professorFoto ?? g.professor?.fotoUrl ?? g.professor?.foto ?? null,
        }))
      );
    } catch (e: any) {
      setGestores([]);
      setGestoresError(e?.response?.data?.message || e?.message || "Falha ao carregar responsáveis.");
    } finally {
      setGestoresLoading(false);
    }
  };

  const criarGestor = async () => {
    if (!owner || !tipoApi) return;
    if (!novoProfessorId) return alert("Selecione um professor.");

    try {
      setSaving(true);

      await axios.post(
        `${API.BASE_URL}/api/gerenciar-organizacoes/gestores`,
        {
          tipo: tipoApi,
          ownerId: owner.id,
          professorId: novoProfessorId,
          papel: novoPapel.trim() || null,
          permissoes: permsToPayload(novoPerms),
        },
        { headers }
      );

      setNovoProfessorId("");
      setNovoPapel("");
      setNovoPerms({ atletasTurmas: true, professores: false });

      await carregarGestores();
      alert("Responsável adicionado!");
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.response?.data?.message || e?.message || "Erro ao adicionar responsável.");
    } finally {
      setSaving(false);
    }
  };

  const salvarGestor = async (g: GestorItem, next: Partial<GestorItem>) => {
    try {
      setSaving(true);

      await axios.put(
        `${API.BASE_URL}/api/gerenciar-organizacoes/gestores/${g.id}`,
        {
          papel: next.papel ?? g.papel ?? null,
          permissoes: next.permissoes ?? g.permissoes ?? null,
          ativo: typeof next.ativo === "boolean" ? next.ativo : g.ativo,
        },
        { headers }
      );

      await carregarGestores();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.response?.data?.message || e?.message || "Erro ao salvar responsável.");
    } finally {
      setSaving(false);
    }
  };

  const removerGestor = async (g: GestorItem) => {
    if (!confirm("Remover/desativar este responsável?")) return;

    try {
      setSaving(true);
      await axios.delete(`${API.BASE_URL}/api/gerenciar-organizacoes/gestores/${g.id}`, { headers });
      await carregarGestores();
      alert("Responsável removido!");
    } catch (e: any) {
      try {
        await salvarGestor(g, { ativo: false });
      } catch {}
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (tipo !== "Professor" && owner) carregarGestores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, owner?.id, tipoApi]);

  if (tipo === "Professor") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-visible">
        <div className="flex items-center justify-between border-b border-zinc-100 p-4">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Organizações que você pode gerenciar</div>
            <div className="text-xs text-zinc-500">
              Selecione um clube/escolinha para acessar “Professores” e “Turmas” como responsável.
            </div>
          </div>

          <div className="inline-flex items-center gap-2 text-xs text-zinc-600">
            <Building2 className="h-4 w-4" />
            {orgs.length} organização(ões)
          </div>
        </div>

        {orgsLoading ? (
          <div className="p-6 text-center text-zinc-600">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : orgsError ? (
          <div className="p-6 text-center text-red-600">{orgsError}</div>
        ) : orgs.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            Nenhuma organização encontrada. Peça para um admin/clube/escolinha te vincular como responsável.
          </div>
        ) : (
          <div className="p-4">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {orgs.map((o) => {
                const labelTipo = o.tipo === "CLUBE" ? "Clube" : "Escolinha";
                const ativoTxt = o.ativo ? "Ativo" : "Inativo";
                const nome = o.nome ?? `${labelTipo} (${o.ownerId.slice(0, 6)}…)`;
                const perms = normalizePermissoes(o.permissoes);

                return (
                  <li key={o.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <Avatar foto={o.logo ?? null} alt={nome} className="h-12 w-12 shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-900">{nome}</div>
                        <div className="text-xs text-zinc-500">
                          {labelTipo} • {ativoTxt}
                          {(o.cidade || o.estado) ? ` • ${o.cidade ?? "—"}-${o.estado ?? "—"}` : ""}
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          {o.papel ? `Papel: ${o.papel}` : "Papel: —"}
                        </div>
                        <div className="mt-2">
                          <PermissoesChips perms={perms} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setGestorOrg({
                            id: String(o.id),
                            tipo: o.tipo,
                            ownerId: String(o.ownerId),
                            nome: o.nome ?? null,
                            logo: o.logo ?? null,
                            cidade: o.cidade ?? null,
                            estado: o.estado ?? null,
                            papel: o.papel ?? null,
                            permissoes: o.permissoes ?? null,
                            ativo: !!o.ativo,
                          });

                          (selecionarOrg ?? onSelectOrg)?.(o);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Gerenciar
                      </button>

                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(o.ownerId).catch(() => {});
                          alert("ID da organização copiado (ownerId).");
                        }}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
                        title="Copiar ID"
                      >
                        Copiar ID
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-visible">
      <div className="flex items-center justify-between border-b border-zinc-100 p-4">
        <div>
          <div className="text-sm font-semibold text-zinc-900">Responsáveis (professores gestores)</div>
          <div className="text-xs text-zinc-500">
            Escolha quais professores terão permissões extras. (O vínculo normal já dá acesso base.)
          </div>
        </div>

        <button
          onClick={carregarGestores}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
        >
          <Building2 className="h-4 w-4" />
          Recarregar
        </button>
      </div>

      {!owner ? (
        <div className="p-8 text-center text-zinc-600">Não foi possível identificar sua organização.</div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-sm font-semibold text-zinc-900 mb-2">Adicionar responsável</div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-5">
                <label className="text-xs text-zinc-600">Professor</label>
                <select
                  value={novoProfessorId}
                  onChange={(e) => setNovoProfessorId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">— selecionar —</option>
                  {professores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                      {p.cref ? ` • CREF ${p.cref}` : ""}
                    </option>
                  ))}
                </select>

                {profLoading && (
                  <div className="mt-2 text-xs text-zinc-500 inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando lista de professores…
                  </div>
                )}
                {profError && <div className="mt-2 text-xs text-red-600">{profError}</div>}
              </div>

              <div className="md:col-span-7">
                <label className="text-xs text-zinc-600">Funções (permissões)</label>
                <div className="mt-1">
                  <PermissoesPicker value={novoPerms} onChange={setNovoPerms} />
                </div>
              </div>

              <div className="md:col-span-12">
                <label className="text-xs text-zinc-600">Papel (opcional)</label>
                <input
                  value={novoPapel}
                  onChange={(e) => setNovoPapel(e.target.value)}
                  placeholder="ex.: Coordenador"
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                onClick={criarGestor}
                disabled={saving || !novoProfessorId}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                Adicionar
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 p-3">
              <div className="text-sm font-semibold text-zinc-900">Responsáveis atuais</div>
              <div className="text-xs text-zinc-600">{gestores.length} item(ns)</div>
            </div>

            {gestoresLoading ? (
              <div className="p-6 text-center text-zinc-600">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </div>
            ) : gestoresError ? (
              <div className="p-6 text-center text-red-600">{gestoresError}</div>
            ) : gestores.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">Nenhum responsável cadastrado ainda.</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {gestores.map((g) => {
                  const nome =
                    g.professorNome ||
                    professores.find((p) => p.id === g.professorId)?.nome ||
                    `Professor (${g.professorId.slice(0, 6)}…)`;

                  const foto =
                    g.professorFoto ||
                    professores.find((p) => p.id === g.professorId)?.foto ||
                    null;

                  const cref =
                    g.professorCref ||
                    professores.find((p) => p.id === g.professorId)?.cref ||
                    null;

                  const perms = normalizePermissoes(g.permissoes);

                  return (
                    <div key={g.id} className="p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar foto={foto} alt={nome} className="h-10 w-10 shrink-0" />
                          <div>
                            <div className="text-sm font-semibold text-zinc-900">{nome}</div>
                            <div className="text-xs text-zinc-500">
                              {cref ? `CREF ${cref} • ` : ""} {g.ativo ? "Ativo" : "Inativo"}
                            </div>
                            <div className="mt-1">
                              <PermissoesChips perms={perms} />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input
                            defaultValue={g.papel ?? ""}
                            onBlur={(e) => {
                              const papel = e.target.value.trim() || null;
                              if (papel !== (g.papel ?? null)) salvarGestor(g, { papel });
                            }}
                            className="w-full sm:w-56 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                            placeholder="Papel"
                            title="Edite e clique fora para salvar"
                          />

                          <select
                            defaultValue={g.ativo ? "1" : "0"}
                            onChange={(e) => salvarGestor(g, { ativo: e.target.value === "1" })}
                            className="w-full sm:w-36 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                          >
                            <option value="1">Ativo</option>
                            <option value="0">Inativo</option>
                          </select>

                          <button
                            onClick={() => removerGestor(g)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                            title="Remover/Desativar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <div className="text-xs font-semibold text-zinc-800 mb-2 inline-flex items-center gap-2">
                          <Save className="h-3.5 w-3.5" /> Funções (permissões)
                        </div>

                        <PermissoesPicker
                          value={perms}
                          onChange={(next) => {
                            salvarGestor(g, { permissoes: permsToPayload(next) });
                          }}
                        />

                        <div className="text-[11px] text-zinc-500 mt-2">
                          Ao marcar/desmarcar, já salva no backend.
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}