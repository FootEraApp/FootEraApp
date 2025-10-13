//client/src/components/perfil/PerfilClube
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import ProfileHeader from "../profile/ProfileHeader.js";
import { Link } from "wouter";
import { Activity, ChevronRight } from "lucide-react";
import Avatar from "../shared/Avatar.js";

type Props = { idDaUrl?: string };

type UsuarioMin = { id: string; nome: string; email: string; foto?: string | null };

type PayloadClube = {
  tipo: "Clube";
  usuario: UsuarioMin | null;
  clube: {
    id: string;
    usuarioId: string;
    nome: string;
    cnpj?: string | null;
    telefone1?: string | null;
    telefone2?: string | null;
    email?: string | null;
    siteOficial?: string | null;
    estadio?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    pais?: string | null;
    cep?: string | null;
    logo?: string | null;
    dataCriacao: string;
    categorias?: string[] | null;
    responsavel?: string | null;
    descricao?: string | null;
  };
  metrics: { atletas: number; eventos?: number; conquistas?: number };
};

type AbaTopo = "perfil" | "eventos" | "atletas";
type SubAbaAtletas = "vinculados" | "observados" | "solicitacoes";

type AtletaItem = {
  id: string;              
  atletaId: string;       
  nome: string;
  foto?: string | null;
  posicao?: string | null;
  idade?: number | null;
  altura?: number | null;
  peso?: number | null;
  observadoEm?: string;
  categoria?: string | null;
  pontuacao?: number | null;
  notaInterna?: string | null;
  alertarMudancas?: boolean | null;
};

type Solicitacao = {
  id: string;
  remetenteId: string;
  remetente: { id: string; nomeDeUsuario: string; foto: string | null };
};

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center text-green-900/70 py-8">
      <Activity className="mx-auto mb-2 opacity-70" />
      <p>{text}</p>
    </div>
  );
}

function SectionCard({
  title, children, right,
}: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="bg-white/90 rounded-2xl shadow-sm border border-green-100">
      <div className="px-4 py-3 flex items-center justify-between border-b border-green-100">
        <h3 className="font-semibold text-green-900">{title}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function PerfilClube({ idDaUrl }: Props) {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const isOwn = !idDaUrl || idDaUrl === Storage.usuarioId;
  const canEdit = isOwn;

  const targetId = isOwn ? (Storage.tipoUsuarioId || "me") : (idDaUrl as string);

  const [data, setData] = useState<PayloadClube | null>(null);
  const [loading, setLoading] = useState(true);

  const [aba, setAba] = useState<AbaTopo>("perfil");
  const [subAba, setSubAba] = useState<SubAbaAtletas>("vinculados");

  const [vinculados, setVinculados] = useState<AtletaItem[] | null>(null);
  const [observados, setObservados] = useState<AtletaItem[] | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[] | null>(null);

  const [observadoEdits, setObservadoEdits] = useState<Record<string, { notaInterna: string; alertarMudancas: boolean }>>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [errorById, setErrorById] = useState<Record<string, string | null>>({});
  const [atletasHeaderCount, setAtletasHeaderCount] = useState<number | null>(null);
  const tipoIdDoClube = (isOwn ? Storage.tipoUsuarioId : data?.clube?.id) ?? null;

  useEffect(() => {
    if (!token) return;
    const tipoId = tipoIdDoClube;
    if (!tipoId) { setAtletasHeaderCount(0); return; }

    let cancel = false;
    (async () => {
      try {
        const { data: lista } = await axios.get(
          `${API.BASE_URL}/api/treinos/atletas-vinculados`,
          { headers, params: { tipoUsuarioId: tipoId, incluirPontuacao: 1 } }
        );
        if (!cancel) setAtletasHeaderCount(Array.isArray(lista) ? lista.length : 0);
      } catch {
        if (!cancel) setAtletasHeaderCount(null);
      }
    })();
    return () => { cancel = true; };
  }, [token, tipoIdDoClube]);

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await axios.get<PayloadClube>(
          `${API.BASE_URL}/api/perfil/clube/${targetId}`,
          { headers }
        );
        if (!cancel) setData(resp.data);
      } catch {
        if (!cancel) setData(null);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [targetId, token]);

  useEffect(() => {
    if (!token) return;
    const cancel = { v: false };

    async function fetchVinculados() {
      const tipoId = tipoIdDoClube;
      if (!tipoId) { if (!cancel.v) setVinculados([]); return; }
      try {
        const { data: lista } = await axios.get<AtletaItem[]>(
          `${API.BASE_URL}/api/treinos/atletas-vinculados`,
          { headers, params: { tipoUsuarioId: tipoId, incluirPontuacao: 1 } }
        );
        if (!cancel.v) setVinculados(Array.isArray(lista) ? lista : []);
      } catch {
        if (!cancel.v) setVinculados([]);
      }
    }

    async function fetchObservados() {
      const tipoId = tipoIdDoClube;
      if (!tipoId) { if (!cancel.v) setObservados([]); return; }
      try {
        const { data: lista } = await axios.get<AtletaItem[]>(
          `${API.BASE_URL}/api/observados`,
          { headers, params: { tipoUsuarioId: tipoId, incluirPontuacao: 1, incluirNotas: 1 } }
        );
        if (!cancel.v) {
          setObservados(Array.isArray(lista) ? lista : []);
          const seed: Record<string, { notaInterna: string; alertarMudancas: boolean }> = {};
          (Array.isArray(lista) ? lista : []).forEach((a) => {
            seed[a.atletaId] = {
              notaInterna: a.notaInterna ?? "",
              alertarMudancas: !!a.alertarMudancas,
            };
          });
          setObservadoEdits(seed);
        }
      } catch {
        if (!cancel.v) setObservados([]);
      }
    }

    async function fetchSolicitacoes() {
      try {
        const { data } = await axios.get<Solicitacao[]>(
          `${API.BASE_URL}/api/solicitacoes-treino`,
          { headers }
        );
        if (!cancel.v) setSolicitacoes(Array.isArray(data) ? data : []);
      } catch {
        if (!cancel.v) setSolicitacoes([]);
      }
    }

    if (aba === "atletas") {
      if (subAba === "vinculados" && vinculados == null) fetchVinculados();
      if (subAba === "observados" && observados == null) fetchObservados();
      if (subAba === "solicitacoes" && solicitacoes == null) fetchSolicitacoes();
    }
    return () => { cancel.v = true; };
  }, [aba, subAba, token, tipoIdDoClube, vinculados, observados, solicitacoes]);

  async function salvarObservado(atletaId: string) {
    if (!token || !tipoIdDoClube) return;
    const edit = observadoEdits[atletaId] || { notaInterna: "", alertarMudancas: false };

    setSavingById((s) => ({ ...s, [atletaId]: true }));
    setErrorById((e) => ({ ...e, [atletaId]: null }));
    try {
      await axios.patch(
        `${API.BASE_URL}/api/observados/${atletaId}`,
        { tipoUsuarioId: tipoIdDoClube, notaInterna: edit.notaInterna, alertarMudancas: edit.alertarMudancas },
        { headers }
      );
      setObservados((prev) =>
        (prev || []).map((a) =>
          a.atletaId === atletaId
            ? { ...a, notaInterna: edit.notaInterna, alertarMudancas: edit.alertarMudancas }
            : a
        )
      );
    } catch (err: any) {
      setErrorById((e) => ({
        ...e,
        [atletaId]:
          err?.response?.data?.message ||
          err?.message ||
          "Não foi possível salvar a nota/preferência agora.",
      }));
    } finally {
      setSavingById((s) => ({ ...s, [atletaId]: false }));
    }
  }

  if (loading) return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  if (!data || !data.clube) return <div className="text-center p-10 text-red-600">Clube não encontrado.</div>;

  const nome = data.clube.nome || data.usuario?.nome || "Clube";
  const headerFoto =
    (typeof data.clube.logo === "string" && data.clube.logo) ||
    (typeof data.usuario?.foto === "string" && data.usuario.foto) ||
    undefined;

  const time =
    data.clube.cidade
      ? `${data.clube.cidade}${data.clube.estado ? " - " + data.clube.estado : ""}${data.clube.pais ? " - " + data.clube.pais : ""}`
      : undefined;
  
  const athletesCount =
    vinculados?.length ?? data.metrics?.atletas ?? 0;

  const kpis = [
    { label: "Atletas", value: (atletasHeaderCount ?? athletesCount ?? data.metrics?.atletas ?? 0) },
    { label: "Eventos", value: data.metrics?.eventos ?? 0 },
    { label: "Conquistas", value: data.metrics?.conquistas ?? 0 },
  ];

  const clubeId = data.clube.id;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <ProfileHeader
        nome={nome}
        time={time}
        isOwnProfile={isOwn}
        foto={headerFoto}
        perfilId={data.usuario?.id || data.clube.usuarioId || data.clube.id}
        kpis={kpis}
      />

      <div className="mt-4 grid grid-cols-3 gap-2">
        {(canEdit
          ? [
              { key:"perfil",label:"Perfil"},
              { key:"eventos",label:"Eventos"},
              { key:"atletas",label:"Atletas"}
            ]
          : 
            [
              { key:"perfil",label:"Perfil"},
              { key:"eventos",label:"Eventos"}
            ]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setAba(t.key as AbaTopo)}
            className={`py-2 rounded-lg text-sm font-medium ${
              aba === t.key ? "bg-green-100 text-green-900" : "bg-white/70 text-green-900 hover:bg-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {aba === "perfil" && (
        <section className="mt-4 grid gap-4">
          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">Informações do Clube</h3>
            <ul className="text-sm text-green-900/90 space-y-1">
              <li><b>Nome:</b> {data.clube.nome}</li>
              {data.clube.estadio && <li><b>Estádio:</b> {data.clube.estadio}</li>}
              {(data.clube.cidade || data.clube.estado || data.clube.pais) && (
                <li><b>Localização:</b> {[data.clube.cidade, data.clube.estado, data.clube.pais].filter(Boolean).join(", ")}</li>
              )}
              {(data.clube.logradouro || data.clube.bairro || data.clube.cep) && (
                <li>
                  <b>Endereço:</b>{" "}
                  {[data.clube.logradouro, data.clube.numero, data.clube.complemento, data.clube.bairro, data.clube.cep]
                    .filter(Boolean)
                    .join(", ")}
                </li>
              )}
              {data.clube.siteOficial && <li><b>Site:</b> {data.clube.siteOficial}</li>}
            </ul>
          </div>

          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-1">FootEra Formadores</h3>
            <p className="text-sm text-green-900/80">
              Gerencie vínculos de formação de atletas e documentos para mecanismo de solidariedade
            </p>
            <div className="mt-3">
              <Link
                href="/formadores"
                className="inline-block rounded-lg bg-green-600 text-white px-4 py-2 font-semibold"
              >
                Acessar Módulo Formadores
              </Link>
            </div>
          </div>

          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">Sobre o Clube</h3>
            {data.clube.descricao?.trim()
              ? <p className="text-sm text-green-900/90 whitespace-pre-wrap">{data.clube.descricao}</p>
              : <p className="text-sm text-green-900/70">Sem descrição cadastrada.</p>}
          </div>

          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">Categorias de Base</h3>
            {data.clube.categorias?.length ? (
              <div className="flex flex-wrap gap-2">
                {data.clube.categorias.map((c) => (
                  <span key={c} className="text-xs bg-green-100 text-green-900 px-2 py-1 rounded-full">{c}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-green-900/70">Nenhuma categoria de base cadastrada.</p>
            )}
          </div>

          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">Contato</h3>
            <ul className="text-sm text-green-900/90 space-y-1">
              {(data.clube.responsavel || data.usuario?.nome) && (
                <li><b>Responsável:</b> {data.clube.responsavel || data.usuario?.nome}</li>
              )}
              {data.clube.email && <li><b>Email:</b> {data.clube.email}</li>}
              {(data.clube.telefone1 || data.clube.telefone2) && (
                <li><b>Telefone:</b> {[data.clube.telefone1, data.clube.telefone2].filter(Boolean).join(" / ")}</li>
              )}
            </ul>
          </div>

          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">Documentação</h3>
            {data.clube.cnpj
              ? <p className="text-sm text-green-900/90"><b>CNPJ:</b> {data.clube.cnpj}</p>
              : <p className="text-sm text-green-900/70">Sem CNPJ informado.</p>}
          </div>
        </section>
      )}

      {aba === "eventos" && (
        <section className="mt-4 grid gap-4">
          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-green-900">Eventos e Peneiras</h3>
              <Link
                href={`/eventos/clubes/${clubeId}`}
                className="text-sm px-3 py-1 rounded-lg bg-green-100 text-green-900"
              >
                Ver eventos
              </Link>
            </div>

            <p className="text-sm text-green-900/80 mt-1">
              Crie e gerencie seus eventos, peneiras e amistosos.
            </p>

            {isOwn && (
              <div className="mt-4">
                <Link
                  href={`/eventos/clubes/${clubeId}/novo`}
                  className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 text-green-900 font-semibold px-4 py-2"
                >
                  <span>+</span> Criar novo evento
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {aba === "atletas" && (
        <section className="mt-4 grid gap-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "vinculados", label: "Vinculados" },
              { key: "observados", label: "Observados" },
              { key: "solicitacoes", label: "Solicitações" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setSubAba(t.key as SubAbaAtletas)}
                className={`py-2 rounded-lg text-sm font-medium ${
                  subAba === t.key ? "bg-green-100 text-green-900" : "bg-white/70 text-green-900 hover:bg-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {subAba === "vinculados" && (
            <SectionCard
              title="Atletas Vinculados"
              right={
                <Link href="/perfil/GerenciarAtletas" className="text-sm text-green-800">
                  Gerenciar Atletas
                </Link>
              }
            >
              {vinculados && vinculados.length > 0 ? (
                <ul className="grid grid-cols-1 gap-3">
                  {vinculados.map((a) => (
                    <li key={a.atletaId} className="flex items-center gap-3 rounded-xl border border-green-100 p-3">
                      <Avatar foto={a.foto ?? null} alt={a.nome} className="w-10 h-10" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-green-900">{a.nome}</div>
                        <div className="text-xs text-green-900/70">
                          {[
                            a.posicao,
                            a.idade ? `${a.idade} anos` : "",
                            a.categoria ? `Cat. ${a.categoria}` : "",
                            a.pontuacao != null ? `${a.pontuacao} pts` : "",
                          ].filter(Boolean).join(" • ")}
                        </div>
                      </div>
                      <Link
                        href={`/perfil/${a.id}`}
                        className="text-sm text-green-800 inline-flex items-center gap-1"
                      >
                        Ver perfil <ChevronRight className="w-4 h-4" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState text="Nenhum atleta vinculado ainda" />
              )}
            </SectionCard>
          )}

          {subAba === "observados" && (
            <SectionCard
              title="Atletas Observados"
              right={<span className="text-xs text-green-900/60">Futuro: destacar mudanças e enviar alertas</span>}
            >
              {observados && observados.length > 0 ? (
                <ul className="grid grid-cols-1 gap-3">
                  {observados.map((a) => {
                    const edit = observadoEdits[a.atletaId] || { notaInterna: a.notaInterna ?? "", alertarMudancas: !!a.alertarMudancas };
                    const saving = !!savingById[a.atletaId];
                    const errMsg = errorById[a.atletaId] || null;

                    return (
                      <li key={a.atletaId} className="rounded-xl border border-green-100 p-3">
                        <div className="flex items-center gap-3">
                          <Avatar foto={a.foto ?? null} alt={a.nome} className="w-10 h-10" />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-green-900">{a.nome}</div>
                            <div className="text-xs text-green-900/70">
                              {[
                                a.posicao,
                                a.idade ? `${a.idade} anos` : "",
                                a.categoria ? `Cat. ${a.categoria}` : "",
                                a.pontuacao != null ? `${a.pontuacao} pts` : "",
                              ].filter(Boolean).join(" • ")}
                            </div>
                          </div>
                          <Link
                            href={`/perfil/${a.id}`}
                            className="text-sm text-green-800 inline-flex items-center gap-1"
                          >
                            Ver perfil <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>

                        <div className="mt-3 grid gap-2">
                          <label className="text-xs font-medium text-green-900">
                            Nota interna
                            <input
                              type="text"
                              value={edit.notaInterna}
                              onChange={(e) =>
                                setObservadoEdits((old) => ({
                                  ...old,
                                  [a.atletaId]: { ...edit, notaInterna: e.target.value },
                                }))
                              }
                              placeholder="ex.: 'Bom 1x1, precisa evoluir passe longo'"
                              className="mt-1 w-full rounded-lg border border-green-200 px-3 py-2 text-sm text-green-900 placeholder:text-green-900/40 focus:outline-none focus:ring-2 focus:ring-green-300"
                            />
                          </label>

                          <label className="inline-flex items-center gap-2 text-sm text-green-900">
                            <input
                              type="checkbox"
                              checked={!!edit.alertarMudancas}
                              onChange={(e) =>
                                setObservadoEdits((old) => ({
                                  ...old,
                                  [a.atletaId]: { ...edit, alertarMudancas: e.target.checked },
                                }))
                              }
                            />
                            Notificar mudanças (pontuação, posição, idade, novos treinos/desafios)
                          </label>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => salvarObservado(a.atletaId)}
                              disabled={saving}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                                saving
                                  ? "bg-green-200 text-green-700 cursor-not-allowed"
                                  : "bg-green-600 text-white hover:bg-green-700"
                              }`}
                            >
                              {saving ? "Salvando..." : "Salvar"}
                            </button>
                            {errMsg && <span className="text-xs text-red-600">{errMsg}</span>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState text="Você ainda não observa nenhum atleta" />
              )}
            </SectionCard>
          )}

          {subAba === "solicitacoes" && (
            <SectionCard
              title="Solicitações de Atletas"
              right={
                <Link href="/notificacoes" className="text-sm text-green-800">
                  Abrir notificações
                </Link>
              }
            >
              {solicitacoes && solicitacoes.length > 0 ? (
                <ul className="space-y-3">
                  {solicitacoes.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-green-100 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar foto={s.remetente.foto} alt={s.remetente.nomeDeUsuario} className="w-10 h-10" />
                        <div>
                          <div className="text-sm font-medium text-green-900">{s.remetente.nomeDeUsuario}</div>
                          <div className="text-xs text-green-900/70">quer treinar junto com você</div>
                        </div>
                      </div>
                      <Link
                        href={`/perfil/${s.remetenteId}`}
                        className="text-sm text-green-800 inline-flex items-center gap-1"
                      >
                        Ver perfil <ChevronRight className="w-4 h-4" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState text="Nenhuma solicitação no momento." />
              )}
            </SectionCard>
          )}
        </section>
      )}
    </div>
  );
}
