import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Activity, PlusCircle, CirclePlus, ChevronRight, House, Search, User, Eye,
  Save, Loader2
} from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import ProfileHeader from "../profile/ProfileHeader.js";
import { Link } from "wouter";
import Avatar from "../shared/Avatar.js";
import ProfilePostsSection from "../perfil/ProfilePostsSection.js";

type Props = { idDaUrl?: string };
type UsuarioMin = { id: string; nome: string; email: string; foto?: string | null; nomeDeUsuario?: string };
type Note = { texto: string; saving: boolean; dirty: boolean };
type PayloadOlheiro = {
  tipo: "Olheiro";
  usuario: UsuarioMin | null;
  olheiro: {
    id: string;
    usuarioId?: string | null;
    fotoUrl?: string | null;
    headline?: string | null;
    descricao?: string | null;
    areaAtuacao?: string | null;
    anosExperiencia: number;
    emailPublico?: string | null;
    telefonePublico?: string | null;
    siteOuLinkedin?: string | null;
    colaboracaoClube?: { id: string; usuarioId?: string | null; nome: string; logo?: string | null } | null;
    reputacaoScore?: number;
    totalIndicacoes?: number;
  };
  metrics: {
    atletasAcompanhados?: number;
    observados?: number;          
    indicacoesEnviadas?: number;
    indicacoes?: number;          
    reputacaoScore?: number;
    reputacao?: number;          
    indicacoesAprovadas?: number;
    taxaAprovacao?: number;
    atletasAssinados?: number;
  };
};

type AtletaItem = {
  id: string;
  usuarioId?: string;
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
};

type IndicacaoItem = {
  id: string;
  criadoEm?: string;
  status?: "PENDENTE" | "APROVADA" | "REJEITADA";
  atleta: { id: string; nome: string; foto?: string | null };
  clube: { id: string; nome: string; logo?: string | null };
};

type AtividadeRecente = {
  id: string;
  tipo: "Treino" | "Desafio" | "Vídeo" | "Postagem";
  titulo: string;
  criadoEm: string;
  imagemUrl?: string | null;
};

type ResultadoBuscaClube = {
  id: string;
  tipo: "Clube";
  nome: string;
  username: string;
  fotoUrl: string | null;
};

function SectionCard({
  title, children, right,
}: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center text-green-900/70 py-8">
      <Activity className="mx-auto mb-2 opacity-70" />
      <p>{text}</p>
    </div>
  );
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms = 400) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export default function PerfilOlheiro({ idDaUrl }: Props) {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const isOwn = !idDaUrl || idDaUrl === Storage.usuarioId;
  const targetId = isOwn ? (Storage.tipoUsuarioId || "me") : (idDaUrl as string);

  const [data, setData] = useState<PayloadOlheiro | null>(null);
  const [loading, setLoading] = useState(true);
  const [privacidade, setPrivacidade] = useState<{
    perfilVisivel: boolean;
    permitirMensagens: boolean;
    mostrarEmail: boolean;
  } | null>(null);

  type Aba = "visao" | "atletas" | "indicacoes" | "postagens";
  const [aba, setAba] = useState<Aba>("visao");
  type SubAbaAtletas = "observados";
  const [subAbaAtletas, setSubAbaAtletas] = useState<SubAbaAtletas>("observados");

  const [observados, setObservados] = useState<AtletaItem[] | null>(null);
  const [indicacoes, setIndicacoes] = useState<IndicacaoItem[] | null>(null);
  const [atividades, setAtividades] = useState<AtividadeRecente[] | null>(null);

  const [indicAtletaId, setIndicAtletaId] = useState("");
  const [clubeQuery, setClubeQuery] = useState("");
  const [clubes, setClubes] = useState<ResultadoBuscaClube[]>([]);
  const [clubeSel, setClubeSel] = useState<ResultadoBuscaClube | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await axios.get<PayloadOlheiro>(
          `${API.BASE_URL}/api/perfil/olheiro/${targetId}`,
          { headers }
        );
        if (!cancel) setData(resp.data);
      } catch (e) {
        console.error("PerfilOlheiro GET error:", e);
        if (!cancel) setData(null);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [targetId, token]);

  useEffect(() => {
    if (aba === "atletas") setObservados(null);
  }, [aba]);

  useEffect(() => {
    if (!token) return;
    let cancel = false;

    (async () => {
      try {
        const { data } = await axios.get(
          `${API.BASE_URL}/api/configuracoes-perfil/privacidade`,
          { headers }
        );
        if (!cancel) setPrivacidade({
          perfilVisivel: data?.perfilVisivel ?? true,
          permitirMensagens: data?.permitirMensagens ?? true,
          mostrarEmail: data?.mostrarEmail ?? false,
        });
      } catch {
        if (!cancel) setPrivacidade({
          perfilVisivel: true,
          permitirMensagens: true,
          mostrarEmail: false,
        });
      }
    })();

    return () => { cancel = true; };
  }, [token]);
  
  useEffect(() => {
    if (!token) return;
    const cancel = { v: false };

    async function fetchAtividades() {
      try {
        const { data } = await axios.get<AtividadeRecente[]>(
          `${API.BASE_URL}/api/perfil/${targetId}/atividades`,
          { headers }
        );
        if (!cancel.v) setAtividades(Array.isArray(data) ? data : []);
      } catch {
        if (!cancel.v) setAtividades([]);
      }
    }

async function fetchObservados() {
  const ownerId =
    (isOwn ? Storage.tipoUsuarioId : data?.olheiro?.id) ??
    data?.olheiro?.id ??
    Storage.tipoUsuarioId ??
    null;

  if (!ownerId) {
    if (!cancel.v) setObservados([]);
    return;
  }

  try {
    const { data: lista } = await axios.get<AtletaItem[]>(
      `${API.BASE_URL}/api/observados`,
      {
        headers,
        params: {
          incluirPontuacao: 1,
          ownerId,         
          tipo: "olheiro", 
        },
      }
    );

    if (!cancel.v) setObservados(Array.isArray(lista) ? lista : []);
  } catch (e) {
    if (!cancel.v) setObservados([]);
  }
}


    async function fetchIndicacoes() {
      const tipoId = (isOwn ? Storage.tipoUsuarioId : data?.olheiro?.id) ?? null;
      if (!tipoId) { if (!cancel.v) setIndicacoes([]); return; }
      try {
        const { data: lista } = await axios.get<IndicacaoItem[]>(
          `${API.BASE_URL}/api/olheiros/${tipoId}/indicacoes`,
          { headers }
        );
        if (!cancel.v) setIndicacoes(Array.isArray(lista) ? lista : []);
      } catch {
        if (!cancel.v) setIndicacoes([]);
      }
    }

    if (aba === "visao" && atividades == null) fetchAtividades();
    if (aba === "atletas" && subAbaAtletas === "observados" && observados == null) {
      fetchObservados();
    }
    if (aba === "indicacoes" && indicacoes == null) fetchIndicacoes();

    return () => { cancel.v = true; };
  }, [
    aba, subAbaAtletas, targetId, token,
    data?.olheiro?.id, atividades, observados, indicacoes, isOwn
  ]);

  const buscarClubes = useMemo(
    () =>
      debounce(async (q: string) => {
        setFeedback(null);
        setClubeSel(null);
        if (!q || q.trim().length < 2) return setClubes([]);
        try {
          const r = await axios.get<any[]>(
            `${API.BASE_URL}/api/cadastro/buscar`,
            { params: { query: q, tipo: "Clube" }, headers }
          );
          const arr: ResultadoBuscaClube[] = (Array.isArray(r.data) ? r.data : [])
            .filter((x) => x?.id && x?.nome && x?.tipo === "Clube")
            .map((x) => ({
              id: String(x.id),
              tipo: "Clube",
              nome: String(x.nome),
              username: String(x.username || ""),
              fotoUrl: x.fotoUrl ?? null,
            }));
          setClubes(arr);
        } catch {
          setClubes([]);
        }
      }, 400),
    [headers]
  );

  async function fetchNota(atletaId: string) {
    try {
      const { data } = await axios.get(
        `${API.BASE_URL}/api/observados/${encodeURIComponent(atletaId)}/nota`,
        { headers }
      );
      setNotes(p => ({ ...p, [atletaId]: { texto: data?.texto ?? "", saving: false, dirty: false } }));
    } catch {
      setNotes(p => ({ ...p, [atletaId]: { texto: "", saving: false, dirty: false } }));
    }
  }

async function salvarNota(atletaId: string) {
  const texto = notes[atletaId]?.texto ?? "";

  setNotes(p => {
    const prev = p[atletaId] ?? { texto: "", saving: false, dirty: false };
    return { ...p, [atletaId]: { ...prev, saving: true } };
  });

  try {
    await axios.put(
      `${API.BASE_URL}/api/observados/${encodeURIComponent(atletaId)}/nota`,
      { texto },
      { headers: { "Content-Type": "application/json", ...(headers || {}) } }
    );

    setNotes(p => ({
      ...p,
      [atletaId]: { texto, saving: false, dirty: false },
    }));
  } catch {
    setNotes(p => ({
      ...p,
      [atletaId]: { texto, saving: false, dirty: true },
    }));
  }
}


  useEffect(() => {
    if (clubeQuery) buscarClubes(clubeQuery);
    else { setClubes([]); setClubeSel(null); }
  }, [clubeQuery]);

  async function enviarIndicacao() {
    setFeedback(null);
    if (!indicAtletaId) { setFeedback({ tipo: "erro", msg: "Informe o ID do atleta." }); return; }
    if (!clubeSel) { setFeedback({ tipo: "erro", msg: "Selecione um clube." }); return; }

    try {
      setEnviando(true);
      await axios.post(
        `${API.BASE_URL}/api/indicacoes`,
        { atletaId: indicAtletaId, clubeId: clubeSel.id },
        { headers: { "Content-Type": "application/json", ...(headers || {}) } }
      );
      setFeedback({ tipo: "ok", msg: "Indicação enviada com sucesso!" });
      setIndicAtletaId("");
      setClubeQuery("");
      setClubes([]);
      setClubeSel(null);
      setIndicacoes(null);
      setAba("indicacoes");
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "Falha ao enviar indicação.";
      setFeedback({ tipo: "erro", msg });
    } finally {
      setEnviando(false);
    }
  }

  if (loading) return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  if (!data || !data.olheiro) return <div className="text-center p-10 text-red-600">Olheiro não encontrado.</div>;

  const nome = data.usuario?.nome || "Olheiro";
  const handle = data.usuario?.nomeDeUsuario ? `@${data.usuario.nomeDeUsuario}` : "";
  const emailDoPerfil =
  (data?.usuario?.email && String(data.usuario.email)) ||
  (data?.olheiro?.emailPublico && String(data.olheiro.emailPublico)) ||
  "";
  const headerFoto: string | undefined =
    (typeof data.usuario?.foto === "string" && data.usuario.foto) ||
    (typeof data.olheiro.fotoUrl === "string" && data.olheiro.fotoUrl) ||
    undefined;
  const perfilUsuarioId: string =
    (data.usuario && data.usuario.id) ||
    data.olheiro.usuarioId ||
    "";



  const clubeColab = data.olheiro.colaboracaoClube || null;

  const reputacaoScore =
    data.metrics?.reputacaoScore ??
    data.metrics?.reputacao ??
    data.olheiro.reputacaoScore ??
    0;

  const kpiIndicacoes =
    data.metrics?.indicacoesEnviadas ??
    data.metrics?.indicacoes ??
    data.olheiro.totalIndicacoes ??
    0;

  const atletasCount = (observados?.length ?? data.metrics?.observados ?? data.metrics?.atletasAcompanhados ?? 0);

  const time = clubeColab?.nome || "Olheiro";

  const indicacoesAprovadas = data.metrics?.indicacoesAprovadas ?? undefined;
  const taxaAprovacao = data.metrics?.taxaAprovacao ?? undefined;
  const atletasAssinados = data.metrics?.atletasAssinados ?? undefined;
  
  return (
    <div className="max-w-md mx-auto pb-20">
      <ProfileHeader
        nome={nome}
        time={time}
        isOwnProfile={isOwn}
        foto={headerFoto}
        kpis={[
          { label: "Atletas", value: atletasCount },
          { label: "Indicações", value: kpiIndicacoes },
          { label: "Reputação", value: reputacaoScore },
        ]}
        perfilId={perfilUsuarioId}
        perfilTipoProp="olheiro"
        perfilTipoIdProp={data.olheiro.id}
      />
      {clubeColab && (
        <div className="px-4 mt-2">
          <Link
            href={`/perfil/${clubeColab.usuarioId ?? clubeColab.id}`}
            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-green-100 border border-green-200 text-green-900 hover:bg-green-200 transition"
          >
            {clubeColab.logo ? (
              <img
                src={clubeColab.logo}
                className="w-4 h-4 rounded object-cover border"
                onError={(e: any) => (e.currentTarget.style.display = "none")}
              />
            ) : null}
            Colabora com <b className="ml-1">{clubeColab.nome}</b>
          </Link>
        </div>
      )}

      <div className="mt-4 px-4">
        <div className="bg-white/90 rounded-xl p-1 grid grid-cols-4 gap-1 border border-green-100">
          {[
            { id: "visao", label: "Visão Geral" },
            { id: "atletas", label: "Atletas" },
            { id: "indicacoes", label: "Indicações" },
            { id: "postagens", label: "Postagens" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setAba(t.id as Aba)}
              className={`py-2 rounded-lg text-sm font-medium ${
                aba === t.id ? "bg-green-600 text-white" : "text-green-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {aba === "visao" && (
        <div className="mt-4 px-4 grid gap-4">
          <SectionCard
            title="Informações do Olheiro"
            right={handle ? <span className="text-xs text-green-900/60">{handle}</span> : null}
          >
            <ul className="text-sm text-green-900/90 space-y-2">
              <li><b>Nome:</b> {nome}</li>

              {privacidade?.mostrarEmail && emailDoPerfil ? (
                <li>
                  <b>Email:</b> {emailDoPerfil}
                </li>
              ) : null}

              {data.olheiro.headline && <li><b>Headline:</b> {data.olheiro.headline}</li>}
              {data.olheiro.areaAtuacao && <li><b>Área de atuação:</b> {data.olheiro.areaAtuacao}</li>}
              <li>
                <b>Experiência:</b> {data.olheiro.anosExperiencia ?? 0} ano
                {(data.olheiro.anosExperiencia ?? 0) === 1 ? "" : "s"}
              </li>

              {clubeColab && (
                <li className="flex items-center gap-2">
                  <b>Colaboração:</b>
                  {clubeColab.logo ? (
                    <img
                      src={clubeColab.logo}
                      className="w-5 h-5 rounded object-cover border"
                      onError={(e: any) => (e.currentTarget.style.display = "none")}
                    />
                  ) : null}
                  <Link
                    href={`/perfil/${clubeColab.usuarioId ?? clubeColab.id}`}
                    className="underline text-green-800"
                  >
                    {clubeColab.nome}
                  </Link>
                </li>
              )}
            </ul>

            {data.olheiro.descricao && (
              <div className="mt-3">
                <div className="text-sm font-semibold text-green-900">Sobre: </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-green-900/90">
                  {data.olheiro.descricao}
                </p>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Reputação & Impacto"
            right={<span className="text-xs text-green-900/60">Futuro: badges, tiers e ranking</span>}
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-green-100 p-3">
                <div className="text-xs text-green-900/70">Reputação</div>
                <div className="text-xl font-bold text-green-900">{reputacaoScore}</div>
              </div>
              <div className="rounded-lg border border-green-100 p-3">
                <div className="text-xs text-green-900/70">Indicações</div>
                <div className="text-xl font-bold text-green-900">{kpiIndicacoes}</div>
              </div>
              <div className="rounded-lg border border-green-100 p-3">
                <div className="text-xs text-green-900/70">Aprovadas</div>
                <div className="text-xl font-bold text-green-900">{indicacoesAprovadas ?? "—"}</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-green-900/70 mb-1">
                <span>Taxa de aprovação</span>
                <span>{typeof taxaAprovacao === "number" ? `${Math.round(taxaAprovacao * 100)}%` : "—"}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-green-100 overflow-hidden">
                <div
                  className="h-2 bg-green-600"
                  style={{ width: `${Math.max(0, Math.min(100, Math.round((taxaAprovacao ?? 0) * 100)))}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-green-900/70">
                Atletas que assinaram após suas indicações: <b>{typeof atletasAssinados === "number" ? atletasAssinados : "—"}</b>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Contatos">
            <ul className="text-sm text-green-900/90 space-y-2">
              <li>
                <b>E-mail:</b>{" "}
                {data.olheiro.emailPublico ? (
                  <a className="text-green-800 underline" href={`mailto:${data.olheiro.emailPublico}`}>{data.olheiro.emailPublico}</a>
                ) : "—"}
              </li>
              <li><b>Telefone:</b> {data.olheiro.telefonePublico || "—"}</li>
              <li>
                <b>Site/LinkedIn:</b>{" "}
                {data.olheiro.siteOuLinkedin ? (
                  <a className="text-green-800 underline" href={data.olheiro.siteOuLinkedin} target="_blank" rel="noreferrer">
                    {data.olheiro.siteOuLinkedin}
                  </a>
                ) : "—"}
              </li>
            </ul>
          </SectionCard>
        </div>
      )}

      {aba === "atletas" && (
        <div className="mt-4 px-4">
          <div className="bg-white/90 rounded-xl p-1 grid grid-cols-1 gap-1 border border-green-100">
            <button
              onClick={() => setSubAbaAtletas("observados")}
              className={`py-2 rounded-lg text-sm font-medium ${
                subAbaAtletas === "observados" ? "bg-green-600 text-white" : "text-green-900"
              }`}
            >
              Observados
            </button>
          </div>

          <div className="mt-4 grid gap-4">
            <SectionCard
              title={`Atletas Observados (${observados?.length ?? 0})`}
              right={
                <Link
                  href="/explorar"
                  className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-amber-500 text-white"
                >
                  <PlusCircle className="w-4 h-4" />
                  Descobrir atletas
                </Link>
              }
            >
              {observados && observados.length > 0 ? (
                <ul className="grid grid-cols-1 gap-3">
                  {observados.map((a) => {
                    const atletaKey = a.atletaId || a.id;

                    return (
                      <li key={a.id} className="flex flex-col gap-2 rounded-xl border border-green-100 p-3">
                        <div className="flex items-center gap-3">
                          <Avatar foto={a.foto ?? null} alt={a.nome} className="w-10 h-10" />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-green-900">{a.nome}</div>
                            <div className="text-xs text-green-900/70">
                              {[a.posicao, a.idade ? `${a.idade} anos` : ""].filter(Boolean).join(" • ")}
                            </div>
                          </div>
                            <Link href={`/perfil/${a.usuarioId || a.id}`} className="text-sm text-green-800 inline-flex items-center gap-1">
                              Ver perfil <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {isOwn && (
                          <div>
                            <button
                              onClick={() => {
                                const willOpen = openNoteId !== atletaKey;
                                setOpenNoteId(willOpen ? atletaKey : null);
                                if (willOpen && notes[atletaKey] === undefined) fetchNota(atletaKey);
                              }}
                              className="text-xs px-2 py-1 rounded-md border border-green-200 text-green-900 hover:bg-green-50"
                            >
                              {openNoteId === atletaKey ? "Ocultar anotações" : "Anotações do atleta"}
                            </button>

                            {openNoteId === atletaKey && (
                              <div className="mt-2">
                                <textarea
                                  rows={4}
                                  className="w-full border rounded p-2 text-sm"
                                  placeholder="Suas observações (visível somente para você)"
                                  value={notes[atletaKey]?.texto ?? ""}
                                  onChange={(e) => {
                                    const texto = e.target.value;
                                    setNotes(p => {
                                      const prev = p[atletaKey] ?? { texto: "", saving: false, dirty: false };
                                      return { ...p, [atletaKey]: { ...prev, texto, dirty: true } };
                                    });
                                  }}
                                />

                                <div className="mt-2 flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => salvarNota(atletaKey)}
                                    disabled={!notes[atletaKey]?.dirty || notes[atletaKey]?.saving}
                                    className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                                  >
                                    {notes[atletaKey]?.saving ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Salvando...
                                      </>
                                    ) : (
                                      <>
                                        <Save className="w-4 h-4" />
                                        Salvar anotação
                                      </>
                                    )}
                                  </button>

                                  <div className="text-[11px] text-green-900/60">
                                    {notes[atletaKey]?.saving
                                      ? "Salvando…"
                                      : notes[atletaKey]?.dirty
                                      ? "Alterações pendentes"
                                      : "Salvo"}
                                  </div>
                                </div>

                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div>
                  <EmptyState text="Você ainda não observa nenhum atleta" />
                  <div className="flex justify-center">
                    <Link
                      href="/explorar"
                      className="px-4 py-2 rounded-md border border-green-200 text-green-900 inline-block"
                    >
                      Explorar atletas
                    </Link>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {aba === "indicacoes" && (
        <div className="mt-4 px-4 grid gap-4">
          <SectionCard title="Nova Indicação">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">ID do Atleta</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="ex: 1f2a3b4c-..."
                  value={indicAtletaId}
                  onChange={(e) => setIndicAtletaId(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Buscar Clube</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="Digite ao menos 2 letras..."
                  value={clubeQuery}
                  onChange={(e) => setClubeQuery(e.target.value)}
                />
                {clubeQuery && clubes.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">Buscando clubes...</p>
                )}
                {clubes.length > 0 && (
                  <div className="max-h-44 overflow-auto border rounded mt-2">
                    {clubes.map((c) => {
                      const selected = clubeSel?.id === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-50 border-b last:border-b-0 ${
                            selected ? "bg-green-50" : ""
                          }`}
                          onClick={() => setClubeSel(c)}
                        >
                          <Avatar foto={c.fotoUrl} alt={c.nome} className="w-7 h-7" />
                          <div className="text-sm">
                            <div className="font-medium">{c.nome}</div>
                            <div className="text-xs text-gray-500">@{c.username}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {clubeSel && (
                  <div className="mt-2 text-xs text-gray-600">
                    Selecionado: <span className="font-medium">{clubeSel.nome}</span>
                    <button className="ml-2 underline text-green-700" onClick={() => setClubeSel(null)}>trocar</button>
                  </div>
                )}
              </div>
            </div>

            {feedback && (
              <p className={`mt-3 text-sm ${feedback.tipo === "ok" ? "text-green-700" : "text-red-600"}`}>
                {feedback.msg}
              </p>
            )}

            <div className="mt-4">
              <button
                onClick={enviarIndicacao}
                disabled={enviando}
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
              >
                {enviando ? "Enviando..." : "Enviar indicação"}
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Minhas Indicações">
            {indicacoes && indicacoes.length > 0 ? (
              <ul className="grid grid-cols-1 gap-3">
                {indicacoes.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 rounded-xl border border-green-100 p-3">
                    <Avatar foto={i.atleta.foto ?? null} alt={i.atleta.nome} className="w-10 h-10" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-green-900">{i.atleta.nome}</div>
                      <div className="text-xs text-green-900/70">
                        {i.criadoEm ? new Date(i.criadoEm).toLocaleString() : "—"}{i.status ? ` • ${i.status}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Avatar foto={i.clube.logo ?? null} alt={i.clube.nome} className="w-8 h-8" />
                      <div className="text-xs text-green-900/80">{i.clube.nome}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-green-800" />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState text="Você ainda não enviou indicações" />
            )}
          </SectionCard>
        </div>
      )}

      {aba === "postagens" && (
        <section className="mt-4 px-4">
          {perfilUsuarioId ? (
            <ProfilePostsSection usuarioId={perfilUsuarioId} />
          ) : (
            <div className="bg-white/70 rounded-xl p-4 shadow-sm text-sm text-green-900/70">
              Não foi possível carregar o usuário das postagens.
            </div>
          )}
        </section>
      )}

      <div className="h-6" />
    </div>
  );
}