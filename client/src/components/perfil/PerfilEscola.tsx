import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ChevronRight,
  CalendarClock,
  Activity,
  Trophy,
  Shield,
  PlusCircle,
} from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import ProfileHeader from "../profile/ProfileHeader.js";
import { Link } from "wouter";
import Avatar from "../shared/Avatar.js";
import TurmasManager from "../turmas/TurmasManager.js";
import ProfilePostsSection from "../perfil/ProfilePostsSection.js";
import { eventNames } from "process";

type Props = { idDaUrl?: string };
type UsuarioMin = {
  id: string;
  nome: string;
  email: string;
  foto?: string | null;
};
type Escolinha = {
  id: string;
  usuarioId?: string | null;
  nome: string;
  cnpj?: string | null;
  telefone1?: string | null;
  telefone2?: string | null;
  email?: string | null;
  siteOficial?: string | null;
  sede?: string | null;
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
};
type Metrics = {
  atletas: number;
  treinosProgramados: number;
  postagens: number;
  conquistas?: number;
};
type PayloadEscola = {
  tipo: "Escolinha";
  usuario: UsuarioMin | null;
  escolinha: Escolinha;
  metrics: Metrics;
};

type AtletaItem = {
  id: string;
  usuarioId: string;
  nome: string;
  foto?: string | null;
  posicao?: string | null;
  idade?: number | null;
  altura?: number | null;
  peso?: number | null;
  observadoEm?: string;
  categoria?: string | null;
  pontuacao?: number | null;
};

type SolicitacaoItem = {
  id: string;
  remetenteId: string;
  remetente: { id: string; nomeDeUsuario: string; foto: string | null };
  status?: "PENDENTE" | "APROVADO" | "REJEITADO";
  criadaEm?: string;
};
type AtividadeRecente = {
  id: string;
  tipo: "Treino" | "Desafio" | "Vídeo" | "Postagem";
  titulo: string;
  criadoEm: string;
  imagemUrl?: string | null;
};

type ProfessorItem = {
  id: string;
  usuarioId?: string | null;
  nome: string;
  codigo?: string | null;
  cref?: string | null;
  fotoUrl?: string | null;
};

type Turma = {
  id: string;
  nome: string;
  ownerTipo?: "Clube" | "Escolinha" | null;
  ownerId?: string | null;
  professorId?: string | null;
  professorNome?: string | null;
  alunosCount?: number | null;
};

type EventoItem = {
  id: string;
  titulo: string;
  tipo?: string | null;
  dataEvento?: string | null;
  inicio?: string | null; // fallback se algum endpoint retornar "inicio"
  cidade?: string | null;
  estado?: string | null;
  endereco?: string | null;
};

function SectionCard({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="bg-white/90 rounded-2xl shadow-sm border border-green-100">
      <div className="px-3 sm:px-4 py-3 flex items-center justify-between border-b border-green-100">
        <h3 className="font-semibold text-green-900">{title}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center text-green-900/70 py-8">
      <Activity className="mx-auto mb-2 opacity-70" />
      <p>{text}</p>
    </div>
  );
}

export default function PerfilEscola({ idDaUrl }: Props) {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const isOwn = !idDaUrl || idDaUrl === Storage.usuarioId;
  const canEdit = isOwn;

  const targetId = isOwn ? (Storage.tipoUsuarioId || "me") : (idDaUrl as string);

  const [data, setData] = useState<PayloadEscola | null>(null);
  const [loading, setLoading] = useState(true);

  type Aba = "visao" | "eventos" | "atletas" | "conquistas" | "postagens"| "professores";
  const [aba, setAba] = useState<Aba>("visao");

  type SubAba = "vinculados" | "observados" | "solicitacoes";
  const [subAba, setSubAba] = useState<SubAba>("vinculados");

  const [vinculados, setVinculados] = useState<AtletaItem[] | null>(null);
  const [observados, setObservados] = useState<AtletaItem[] | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoItem[] | null>(
    null
  );
  const [atividades, setAtividades] = useState<AtividadeRecente[] | null>(null);
  const [professores, setProfessores] = useState<ProfessorItem[]>([]);
  const [professoresLoading, setProfessoresLoading] = useState(false);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmasLoading, setTurmasLoading] = useState(false);
  const [turmasOpen, setTurmasOpen] = useState(false);
  const [professorSelecionado, setProfessorSelecionado] = useState<
    string | undefined
  >();

  const [eventos, setEventos] = useState<EventoItem[] | null>(null);
  const [eventosLoading, setEventosLoading] = useState(false);

  const escolinhaId = (isOwn ? Storage.tipoUsuarioId : data?.escolinha?.id) ?? null;

  useEffect(() => {
    setVinculados(null);
    setObservados(null);
    setSolicitacoes(null);
    setAtividades(null);
    setEventos(null);
  }, [isOwn, data?.escolinha?.id, data?.usuario?.id]);

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await axios.get<PayloadEscola>(
          `${API.BASE_URL}/api/perfil/escola/${targetId}`,
          { headers }
        );
        if (!cancel) setData(resp.data);
      } catch (e) {
        console.error("PerfilEscola GET error:", e);
        if (!cancel) setData(null);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [targetId, token]);

  useEffect(() => {
    if (!token) return;
    const cancel = { v: false };

    const targetUserForActivities = isOwn ? "me" : data?.usuario?.id ?? "";

    async function loadAtividadesIfNeeded() {
      if (aba !== "visao" || atividades != null || !targetUserForActivities)
        return;
      try {
        const { data: itens } = await axios.get<AtividadeRecente[]>(
          `${API.BASE_URL}/api/perfil/${targetUserForActivities}/atividades`,
          { headers }
        );
        if (!cancel.v) setAtividades(Array.isArray(itens) ? itens : []);
      } catch {
        if (!cancel.v) setAtividades([]);
      }
    }

    async function fetchVinculados() {
      const entidadeUsuarioId = isOwn ? Storage.usuarioId : data?.usuario?.id;
      if (!entidadeUsuarioId) return;
      try {
        const { data: resp } = await axios.get<{ atletas: AtletaItem[] }>(
          `${API.BASE_URL}/api/gerenciar/atletas`,
          {
            headers,
            params: {
              vinculo: "escolinha",
              id: entidadeUsuarioId,
              order: "pontuacao_desc",
            },
          }
        );
        setVinculados(Array.isArray(resp?.atletas) ? resp.atletas : []);
      } catch {
        setVinculados([]);
      }
    }

    async function fetchObservados() {
      const tipoId = escolinhaId;
      if (!tipoId) return;
      try {
        const { data: lista } = await axios.get<AtletaItem[]>(
          `${API.BASE_URL}/api/observados`,
          { headers, params: { tipoUsuarioId: tipoId, incluirPontuacao: 1 } }
        );
        if (!cancel.v) setObservados(Array.isArray(lista) ? lista : []);
      } catch {
        if (!cancel.v) setObservados([]);
      }
    }

    async function fetchSolicitacoes() {
      try {
        const { data } = await axios.get<SolicitacaoItem[]>(
          `${API.BASE_URL}/api/solicitacoes-treino`,
          { headers }
        );
        if (!cancel.v) setSolicitacoes(Array.isArray(data) ? data : []);
      } catch {
        if (!cancel.v) setSolicitacoes([]);
      }
    }

    if (aba === "visao") loadAtividadesIfNeeded();

    if (aba === "eventos" && eventos == null && !eventosLoading) {
      loadEventosEscolinha();
    }

    if (aba === "atletas") {
      if (subAba === "vinculados" && vinculados == null) fetchVinculados();
      if (subAba === "observados" && observados == null) fetchObservados();
      if (subAba === "solicitacoes" && solicitacoes == null)
        fetchSolicitacoes();
    }

    return () => {
      cancel.v = true;
    };
  }, [
    aba,
    subAba,
    token,
    isOwn,
    data?.usuario?.id,
    data?.escolinha?.id,
    escolinhaId,
    atividades,
    eventos,
    eventosLoading
  ]);

  async function loadProfessores() {
    if (!token || !escolinhaId) return;
    setProfessoresLoading(true);
    try {
      const { data } = await axios.get(`${API.BASE_URL}/api/professores`, {
        headers,
        params: { organizacaoId: escolinhaId },
      });
      const arr = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
      setProfessores(
        (arr ?? []).map((p: any) => ({
          id: String(p.id),
          usuarioId: p.usuarioId ?? p.usuario?.id ?? null,
          nome: p.nome ?? p.usuario?.nome ?? "Professor",
          codigo: p.codigo ?? null,
          cref: p.cref ?? null,
          fotoUrl: p.fotoUrl ?? p.usuario?.foto ?? null,
        }))
      );
    } catch {
      setProfessores([]);
    } finally {
      setProfessoresLoading(false);
    }
  }

    async function loadEventosEscolinha() {
    if (!token) return;

    const escolaId =
      (isOwn ? Storage.tipoUsuarioId : data?.escolinha?.id) ?? null;

    if (!escolaId) {
      setEventos([]);
      return;
    }

    setEventosLoading(true);
    try {
      // ✅ igual ao PerfilClubes: lista por "dono"
      const { data: resp } = await axios.get(
        `${API.BASE_URL}/api/eventos/escolas/${escolaId}`,
        {
          headers,
          params: {
            ownerTipo: "Escolinha",
            ownerId: escolaId,
          },
        }
      );

      const arr =
        Array.isArray(resp) ? resp :
        Array.isArray(resp?.items) ? resp.items :
        Array.isArray(resp?.eventos) ? resp.eventos :
        [];

      setEventos(
        (arr ?? []).map((e: any) => ({
          id: String(e.id),
          titulo: String(e.titulo ?? e.nome ?? "Evento"),
          tipo: e.tipo ?? null,
          dataEvento: e.dataEvento ?? e.data ?? null,
          inicio: e.inicio ?? null,
          cidade: e.cidade ?? null,
          estado: e.estado ?? null,
          endereco: e.endereco ?? null,
        }))
      );
    } catch (err) {
      console.error("Erro ao carregar eventos da escolinha:", err);
      setEventos([]);
    } finally {
      setEventosLoading(false);
    }
  }

  async function loadTurmas() {
    if (!token || !escolinhaId) return;
    setTurmasLoading(true);
    try {
      const { data } = await axios.get(`${API.BASE_URL}/api/turmas`, {
        headers,
        params: { ownerTipo: "Escolinha", ownerId: escolinhaId },
      });
      const arr = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
      setTurmas(
        (arr ?? []).map((t: any) => ({
          id: String(t.id),
          nome: String(t.nome ?? t.titulo ?? "Turma"),
          ownerTipo: t.ownerTipo ?? "Escolinha",
          ownerId: t.ownerId ?? escolinhaId,
          professorId: t.professorId ?? t.responsavelId ?? null,
          professorNome: t.professor?.nome ?? t.professorNome ?? null,
          alunosCount: t.alunosCount ?? t.qtdAlunos ?? null,
        }))
      );
    } catch {
      setTurmas([]);
    } finally {
      setTurmasLoading(false);
    }
  }

  useEffect(() => {
    if (aba === "professores" && canEdit) {
      loadProfessores();
      loadTurmas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, canEdit, escolinhaId, token]);

  if (loading)
    return (
      <div className="text-center p-10 text-green-800">
        Carregando perfil...
      </div>
    );
  if (!data || !data.escolinha)
    return (
      <div className="text-center p-10 text-red-600">
        Escolinha não encontrada.
      </div>
    );

  const nome = data.escolinha.nome || data.usuario?.nome || "Escola";
  const headerFoto: string | undefined =
    (typeof data.escolinha.logo === "string" && data.escolinha.logo) ||
    (typeof data.usuario?.foto === "string" && data.usuario.foto) ||
    undefined;

  const perfilUsuarioId: string =
    (data.usuario && data.usuario.id) ||
    data.escolinha.usuarioId ||
    "";

  const localidade = data.escolinha.cidade
    ? `${data.escolinha.cidade}${
        data.escolinha.estado ? " - " + data.escolinha.estado : ""
      }`
    : undefined;

  const conquistasCount = data.metrics.conquistas ?? 0;
  const escolinhaIdStr = data.escolinha.id;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <ProfileHeader
        nome={nome}
        time="Escola de Futebol"
        isOwnProfile={isOwn}
        foto={headerFoto}
        kpis={[
          { label: "Atletas", value: data.metrics.atletas ?? 0 },
          { label: "Treinos", value: data.metrics.treinosProgramados ?? 0 },
          { label: "Conquistas", value: (data.metrics as any).conquistas ?? 0 },
        ]}
        perfilId={perfilUsuarioId}
        perfilTipoProp="escolinha"
        perfilTipoIdProp={data.escolinha.id}
      />
      <div className="mt-4 px-3 sm:px-4">
        <div className="bg-white/90 rounded-xl p-1 border border-green-100">
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-1">
            {(canEdit
              ? [
                  { id: "visao", label: "Visão Geral" },
                  { id: "eventos", label: "Eventos" },
                  { id: "atletas", label: "Atletas" },
                  { id: "conquistas", label: "Conquistas" },
                  { id: "postagens", label: "Postagens" },
                  { id: "professores", label: "Professores" },
                ]
              : [
                  { id: "visao", label: "Visão Geral" },
                  { id: "eventos", label: "Eventos" },
                  { id: "conquistas", label: "Conquistas" },
                  { id: "postagens", label: "Postagens" },
                ]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setAba(t.id as Aba)}
                className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  aba === t.id ? "bg-green-600 text-white" : "text-green-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {aba === "visao" && (
        <div className="mt-4 px-3 sm:px-4 grid gap-4">
          <SectionCard title="Informações da Escola">
            <ul className="text-sm text-green-900/90 space-y-2">
              <li>
                <b>Nome:</b> {data.escolinha.nome}
              </li>
              <li>
                <b>Tipo:</b> Escola de Futebol
              </li>
              {localidade && (
                <li>
                  <b>Local:</b> {localidade}
                </li>
              )}
              <li>
                <b>Email:</b> {data.escolinha.email ?? "Não informado"}
              </li>
              {data.escolinha.siteOficial && (
                <li>
                  <b>Site:</b> {data.escolinha.siteOficial}
                </li>
              )}
              {(data.escolinha.telefone1 || data.escolinha.telefone2) && (
                <li>
                  <b>Telefones:</b>{" "}
                  {[data.escolinha.telefone1, data.escolinha.telefone2]
                    .filter(Boolean)
                    .join(" / ")}
                </li>
              )}
              {(data.escolinha.logradouro ||
                data.escolinha.bairro ||
                data.escolinha.cidade) && (
                <li>
                  <b>Endereço:</b>{" "}
                  {[
                    data.escolinha.logradouro,
                    data.escolinha.numero,
                    data.escolinha.complemento,
                    data.escolinha.bairro,
                    data.escolinha.cidade,
                    data.escolinha.estado,
                    data.escolinha.cep,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </li>
              )}
            </ul>
          </SectionCard>

          {canEdit && (
            <SectionCard
              title="FootEra Formadores"
              right={
                <Link href="/formadores">
                  <button
                    className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-green-600 text-white"
                    onClick={() => {}}
                  >
                    <Shield className="w-4 h-4" />
                    Acessar Módulo Formadores
                  </button>
                </Link>
              }
            >
              <p className="text-sm text-green-900/90">
                Gerencie vínculos de formação de atletas e documentos para
                mecanismo de solidariedade.
              </p>
            </SectionCard>
          )}

          <SectionCard
            title="Treinos"
            right={
              <div className="flex gap-2">
                <Link
                  href="/treinos"
                  className="text-sm px-3 py-1.5 rounded-md border border-green-200 text-green-900"
                >
                  Ver todos
                </Link>
                {canEdit && (
                  <>
                    <Link
                      href="/perfil/GerenciarProfessores"
                      className="text-sm px-3 py-1.5 rounded-md bg-green-100 text-green-900 inline-flex items-center gap-1"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Gerenciar Professores
                    </Link>

                    <button
                      onClick={() => {
                        setAba("professores");
                      }}
                      className="text-sm px-3 py-1.5 rounded-md border border-green-200 text-green-900"
                    >
                      Administrar turmas
                    </button>

                    <Link
                      href="/treinos/novo"
                      className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white inline-flex items-center gap-1"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Criar novo treino
                    </Link>
                  </>
                )}
              </div>
            }
          >
            <p className="text-sm text-green-900/90 mt-2">
              Crie treinos e agrupe seus atletas em <b>turmas</b>. Vincule cada
              turma a um professor para facilitar a condução do treino.
            </p>
          </SectionCard>

          <SectionCard title="Atividade Recente">
            {atividades && atividades.length > 0 ? (
              <ul className="space-y-3">
                {atividades.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <CalendarClock className="w-5 h-5 text-green-700" />
                    <div className="text-sm">
                      <div className="font-medium text-green-900">
                        {a.titulo}
                      </div>
                      <div className="text-xs text-green-900/70">
                        {new Date(a.criadoEm).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState text="Nenhuma atividade recente" />
            )}
          </SectionCard>
        </div>
      )}

      {aba === "eventos" && (
        <div className="mt-4 px-3 sm:px-4 grid gap-4">
          <SectionCard
            title="Eventos"
            right={
              <Link
                href={`/eventos/escolas/${escolinhaIdStr}`}
                className="text-sm px-3 py-1 rounded-lg bg-green-100 text-green-900"
              >
                Ver todos
              </Link>
            }
          >
            <p className="text-sm text-green-900/80 mt-1">
              Crie e gerencie seus eventos, peneiras, amistosos e avaliações.
            </p>

            {isOwn && (
              <div className="mt-4">
                <Link
                  href={`/eventos/escolas/${escolinhaIdStr}/novo`}
                  className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 text-green-900 font-semibold px-3 sm:px-4 py-2"
                >
                  <span>+</span> Criar novo evento
                </Link>
              </div>
            )}

            <div className="mt-5">
              {eventosLoading ? (
                <div className="text-sm text-green-900/70">Carregando eventos…</div>
              ) : eventos && eventos.length > 0 ? (
                <ul className="grid grid-cols-1 gap-3">
                  {eventos
                    .slice()
                    .sort((a, b) => {
                      const da = new Date(a.dataEvento || a.inicio || 0).getTime();
                      const db = new Date(b.dataEvento || b.inicio || 0).getTime();
                      return db - da;
                    })
                    .slice(0, 8)
                    .map((e) => {
                      const dt = e.dataEvento || e.inicio || "";
                      const when = dt ? new Date(dt).toLocaleString() : "Data não informada";
                      const where = [e.endereco, e.cidade, e.estado].filter(Boolean).join(" • ");

                      return (
                        <li
                          key={e.id}
                          className="flex items-center gap-3 rounded-xl border border-green-100 p-3 hover:bg-green-50"
                        >
                          <CalendarClock className="w-5 h-5 text-green-700" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-green-900 truncate">
                              {e.titulo}
                            </div>
                            <div className="text-xs text-green-900/70">
                              {when}
                              {where ? ` • ${where}` : ""}
                            </div>
                          </div>

                          <Link
                            href={`/eventos/${e.id}`}
                            className="text-sm text-green-800 inline-flex items-center gap-1"
                          >
                            Abrir <ChevronRight className="w-4 h-4" />
                          </Link>

                          {isOwn && (
                            <Link
                              href={`/eventos/convocar?eventoId=${e.id}&returnTo=/perfil/escola`}
                              className="ml-2 text-xs px-2 py-1 rounded-md border border-green-200 text-green-900"
                            >
                              Convocar
                            </Link>
                          )}
                        </li>
                      );
                    })}
                </ul>
              ) : (
                <EmptyState text="Nenhum evento cadastrado ainda." />
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {aba === "atletas" && (
        <div className="mt-4 px-3 sm:px-4">
          <div className="bg-white/90 rounded-xl p-1 grid grid-cols-3 gap-1 border border-green-100">
            {[
              { id: "vinculados", label: "Vinculados" },
              { id: "observados", label: "Observados" },
              { id: "solicitacoes", label: "Solicitações" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSubAba(t.id as SubAba)}
                className={`py-2 rounded-lg text-sm font-medium ${
                  subAba === t.id ? "bg-green-600 text-white" : "text-green-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4">
            {subAba === "vinculados" && (
              <SectionCard
                title="Atletas Vinculados"
                right={
                  <Link
                    href="/perfil/GerenciarAtletas"
                    className="text-sm text-green-800"
                  >
                    Gerenciar Atletas
                  </Link>
                }
              >
                {vinculados && vinculados.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-3">
                    {vinculados.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-3 rounded-xl border border-green-100 p-3"
                      >
                        <Avatar
                          foto={a.foto ?? null}
                          alt={a.nome}
                          className="w-10 h-10"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-green-900">
                            {a.nome}
                          </div>
                          <div className="text-xs text-green-900/70">
                            {[
                              a.posicao,
                              a.idade ? `${a.idade} anos` : null,
                              a.categoria,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        </div>
                        {typeof a.pontuacao === "number" && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">
                            {a.pontuacao} pts
                          </span>
                        )}
                        <Link
                          href={`/perfil/${a.usuarioId}`}
                          className="ml-2 text-sm text-green-800 inline-flex items-center gap-1"
                        >
                          Ver perfil <ChevronRight className="w-4 h-4" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div>
                    <EmptyState text="Nenhum atleta vinculado ainda" />
                    <div className="flex justify-center">
                      <Link href="/explorar">
                        <button className="px-3 sm:px-4 py-2 rounded-md border border-green-200 text-green-900">
                          Ver atletas
                        </button>
                      </Link>
                    </div>
                  </div>
                )}
              </SectionCard>
            )}

            {subAba === "observados" && (
              <SectionCard
                title="Atletas Observados"
                right={
                  <Link
                    href="/explorar"
                    className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-amber-500 text-white"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Descobrir novos atletas
                  </Link>
                }
              >
                {observados && observados.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-3">
                    {observados.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-3 rounded-xl border border-green-100 p-3"
                      >
                        <Avatar
                          foto={a.foto ?? null}
                          alt={a.nome}
                          className="w-10 h-10"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-green-900">
                            {a.nome}
                          </div>
                          <div className="text-xs text-green-900/70">
                            {[
                              a.posicao ?? "-",
                              a.idade ? `${a.idade} anos` : null,
                              a.categoria,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        </div>
                        {typeof a.pontuacao === "number" && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">
                            {a.pontuacao} pts
                          </span>
                        )}
                        <Link
                          href={`/perfil/${a.usuarioId}`}
                          className="ml-2 text-sm text-green-800 inline-flex items-center gap-1"
                        >
                          Ver perfil <ChevronRight className="w-4 h-4" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div>
                    <EmptyState text="Você ainda não observa nenhum atleta" />
                    <div className="flex justify-center">
                      <Link href="/explorar">
                        <button className="px-3 sm:px-4 py-2 rounded-md border border-green-200 text-green-900">
                          Ver atletas observados
                        </button>
                      </Link>
                    </div>
                  </div>
                )}
              </SectionCard>
            )}

            {subAba === "solicitacoes" && (
              <SectionCard
                title="Solicitações de Atletas"
                right={
                  <Link
                    href="/notificacoes"
                    className="text-sm text-green-800"
                  >
                    Abrir notificações
                  </Link>
                }
              >
                {solicitacoes && solicitacoes.length > 0 ? (
                  <div className="space-y-3">
                    <ul className="grid grid-cols-1 gap-3">
                      {solicitacoes.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center gap-3 rounded-xl border border-green-100 p-3 hover:bg-green-50"
                        >
                          <Link
                            href={`/perfil/${s.remetenteId}`}
                            className="flex items-center gap-3 flex-1"
                          >
                            <Avatar
                              foto={s.remetente.foto ?? null}
                              alt={s.remetente.nomeDeUsuario}
                              className="w-10 h-10"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-green-900">
                                {s.remetente.nomeDeUsuario}
                              </div>
                              <div className="text-xs text-green-900/70">
                                {s.criadaEm
                                  ? new Date(
                                      s.criadaEm
                                    ).toLocaleString()
                                  : "—"}
                                {s.status ? ` • ${s.status}` : ""}
                              </div>
                              <div className="text-xs text-green-900/80">
                                quer treinar junto com você
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-green-800" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <EmptyState text="Nenhuma solicitação pendente de atletas" />
                )}
              </SectionCard>
            )}
          </div>
        </div>
      )}

      {aba === "conquistas" && (
        <div className="mt-4 px-3 sm:px-4 grid gap-4">
          <SectionCard title="Conquistas e Troféus">
            {conquistasCount > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: conquistasCount }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4 border border-green-100 text-center"
                  >
                    <Trophy className="mx-auto mb-2" />
                    <div className="text-sm font-medium text-green-900">
                      Conquista #{i + 1}
                    </div>
                    <div className="text-xs text-green-900/70">
                      da sua escola ou atleta
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="Nenhuma conquista registrada ainda" />
            )}
          </SectionCard>
        </div>
      )}

      {aba === "postagens" && (
        <div className="mt-4 px-3 sm:px-4 grid gap-4">
          <SectionCard title="Postagens">
            <ProfilePostsSection usuarioId={perfilUsuarioId} />
          </SectionCard>
        </div>
      )}

      {aba === "professores" && canEdit && (
        <div className="mt-4 px-3 sm:px-4 grid gap-4">
          <SectionCard
            title="Professores da Escolinha"
            right={
              <button
                onClick={() => {
                  setProfessorSelecionado(undefined);
                  setTurmasOpen(true);
                }}
                className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white inline-flex items-center gap-1"
              >
                <PlusCircle className="w-4 h-4" />
                Adicionar turma
              </button>
            }
          >
            {professoresLoading ? (
              <div className="text-sm text-green-900/70">
                Carregando professores…
              </div>
            ) : professores.length ? (
              <ul className="grid grid-cols-1 gap-3">
                {professores.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-green-100 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        foto={p.fotoUrl ?? null}
                        alt={p.nome}
                        className="w-10 h-10"
                      />
                      <div>
                        <div className="text-sm font-medium text-green-900">
                          {p.nome}
                        </div>
                        <div className="text-xs text-green-900/70">
                          {[
                            p.codigo ? `Código ${p.codigo}` : "",
                            p.cref ? `CREF ${p.cref}` : "",
                          ]
                            .filter(Boolean)
                            .join(" • ") || "—"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setProfessorSelecionado(String(p.id));
                          setTurmasOpen(true);
                        }}
                        className="text-sm px-3 py-1.5 rounded-md border border-green-200 text-green-900"
                      >
                        Administrar turmas
                      </button>
                      <Link
                        href={`/perfil/${p.usuarioId ?? p.id}`}
                        className="text-sm text-green-800 inline-flex items-center gap-1"
                      >
                        Ver perfil <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState text="Nenhum professor vinculado à escolinha." />
            )}
          </SectionCard>

          <SectionCard title="Turmas da Escolinha">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-green-900/80">
                Crie turmas e defina o professor responsável. Alunos vinculados
                à escolinha podem ser adicionados às turmas.
              </div>
              <button
                onClick={() => {
                  setProfessorSelecionado(undefined);
                  setTurmasOpen(true);
                }}
                className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white inline-flex items-center gap-1"
              >
                <PlusCircle className="w-4 h-4" />
                Nova turma
              </button>
            </div>

            {turmasLoading ? (
              <div className="text-sm text-green-900/70">
                Carregando turmas…
              </div>
            ) : turmas.length ? (
              <ul className="space-y-2">
                {turmas.map((t) => (
                  <li
                    key={t.id}
                    className="border rounded-xl p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-green-900">
                          {t.nome}
                        </div>
                        <div className="text-xs text-green-900/70">
                          {t.professorNome
                            ? `Professor: ${t.professorNome}`
                            : "Professor: —"}{" "}
                          •{" "}
                          {typeof t.alunosCount === "number"
                            ? `${t.alunosCount} alunos`
                            : "—"}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setProfessorSelecionado(
                            t.professorId ?? undefined
                          );
                          setTurmasOpen(true);
                        }}
                        className="text-sm px-3 py-1.5 rounded-md border border-green-200 text-green-900"
                      >
                        Administrar
                      </button>
                    </div>

                    {professores.length > 0 && (
                      <div className="flex items-center gap-2">
                        <select
                          className="border rounded px-3 py-2 text-sm"
                          value={t.professorId ?? ""}
                          onChange={async (e) => {
                            const newProfId = e.target.value || null;
                            try {
                              await axios.put(
                                `${API.BASE_URL}/api/turmas/${t.id}/vincular-professor`,
                                { professorId: newProfId },
                                { headers }
                              );
                              await loadTurmas();
                              alert("Professor atualizado na turma!");
                            } catch (err) {
                              console.error(err);
                              alert(
                                "Não foi possível atualizar o professor."
                              );
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
            ) : (
              <EmptyState text="Nenhuma turma cadastrada na escolinha." />
            )}
          </SectionCard>
        </div>
      )}

      {canEdit && (
        <TurmasManager
          open={turmasOpen}
          onClose={() => {
            setTurmasOpen(false);
            loadTurmas();
            loadProfessores();
          }}
          owner={
            escolinhaId
              ? { tipo: "Escolinha", id: escolinhaId }
              : undefined
          }
          professorId={professorSelecionado}
        />
      )}

      <div className="h-6" />
    </div>
  );
}