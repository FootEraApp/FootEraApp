import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bell,
  BookOpen,
  Coins,
  Edit3,
  Eye,
  Mail,
  Settings,
  Star,
  Users,
} from "lucide-react";
import CreatorCard from "../../components/CreatorCard";
import ProfilePostsSection from "@/components/perfil/ProfilePostsSection";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

type Conteudo = {
  id: string;
  titulo: string;
  descricao?: string | null;
  capaUrl?: string | null;
  origem: "LEARNING" | "PREMIUM";
  preco?: number | null;
  mediaAvaliacao?: number | null;
  totalReviews?: number | null;
  totalAssinantes?: number | null;
  geraCertificado?: boolean;
};

type PerfilResponse = {
  creator: {
    usuarioId: string;
    nomePublico: string;
    headline?: string | null;
    bio?: string | null;
    nicho?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    tipo: "PESSOA_FISICA" | "INSTITUCIONAL";
    verificado: boolean;
    instituicaoOficial: boolean;
    initials: string;
    perfilOriginal: any;
  };
  metricas: {
    seguidores: number;
    cursos: number;
    alunos: number;
    vendas: number;
    receitaBruta: number;
    ganhoCreator: number;
    views: number;
  };
  conteudos: Conteudo[];
};

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const compact = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
};

export default function CreatorProfile() {
  const [data, setData] = useState<PerfilResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"visao" | "conteudo" | "ganhos" | "eventos" | "postagens" | "sobre">("visao");
  const [unreadDM, setUnreadDM] = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);
  const [seguindo, setSeguindo] = useState<boolean | null>(null);
  const [followPendente, setFollowPendente] = useState(false);

  const usuarioId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || localStorage.getItem("usuarioId") || "";
  }, []);

  const meuId = useMemo(() => {
    return (
        localStorage.getItem("usuarioId") ||
        sessionStorage.getItem("usuarioId") ||
        ""
    );
  }, []);

  useEffect(() => {
    const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

    if (!token) return;

    fetch(`${API}/api/mensagem/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
    })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => setUnreadDM(typeof j === "number" ? j : j?.count ?? 0))
        .catch(() => setUnreadDM(0));

    fetch(`${API}/api/notificacoes/badge`, {
     headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
        const total = Number(j?.totalNotificacoes ?? j?.total ?? j?.count ?? 0) || 0;
        setBadgeCount(total);
    })
    .catch(() => setBadgeCount(0));

    const onBadge = (e: Event) => {
        const d: any = (e as CustomEvent<any>).detail;
        const total =
        typeof d === "number"
            ? d
            : Number(d?.totalNotificacoes ?? d?.total ?? 0) || 0;

        setBadgeCount(total);
    };

    window.addEventListener("badge:update", onBadge as EventListener);
    return () => window.removeEventListener("badge:update", onBadge as EventListener);
    }, []);

  useEffect(() => {
    if (!usuarioId) {
      setLoading(false);
      return;
    }

    fetch(`${API}/api/creator/profile/${usuarioId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Creator não encontrado.");
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) => {
        console.error(err);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [usuarioId, meuId]);

  useEffect(() => {
    if (!usuarioId) return;

    if (meuId && meuId === usuarioId) return;

    const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

    fetch(`${API}/api/creator/profile/${usuarioId}/view`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).catch(() => {});
  }, [usuarioId, meuId]);

  useEffect(() => {
    if (!usuarioId) return;

    const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

    if (!token) {
        setSeguindo(false);
        return;
    }

    if (meuId === usuarioId) {
        setSeguindo(true);
        return;
    }

    fetch(`${API}/api/seguidores/status?seguidoUsuarioId=${encodeURIComponent(usuarioId)}`, {
        headers: { Authorization: `Bearer ${token}` },
    })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
        setSeguindo(Boolean(j?.seguindo));
        setFollowPendente(Boolean(j?.pendente && !j?.seguindo));
        })
        .catch(() => {
        setSeguindo(false);
        setFollowPendente(false);
        });
    }, [usuarioId, meuId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7f3] flex items-center justify-center">
        <div className="text-emerald-900 font-semibold">Carregando perfil Creator...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#f5f7f3] flex items-center justify-center p-6">
        <div className="bg-white border rounded-2xl p-6 max-w-md text-center">
          <h1 className="font-bold text-xl text-emerald-950">Creator não encontrado</h1>
          <p className="text-slate-500 mt-2">
            Esse usuário ainda não ativou o perfil Creator.
          </p>
        </div>
      </div>
    );
  }

  const { creator, metricas, conteudos } = data;
  const tipoOriginal = String(creator.perfilOriginal?.tipo || "").toLowerCase();
  const isAtletaCreator = tipoOriginal === "atleta";
  const institucional = creator.tipo === "INSTITUCIONAL";
  const avaliacaoMedia =
  conteudos.length > 0
    ? conteudos.reduce((acc, c) => acc + Number(c.mediaAvaliacao || 0), 0) / conteudos.length
    : 0;
  const creatorReturnUrl = `/creator/profile?id=${creator.usuarioId}`;
  const isOwnCreator = meuId === creator.usuarioId;
  const tabs = institucional
  ? [
      ["visao", "Visão Geral"],
      ["conteudo", "Conteúdo"],
      ["eventos", "Eventos"],
      ["postagens", "Postagens"],
      ["sobre", "Sobre"],
    ]
  : [
      ["visao", "Visão Geral"],
      ["conteudo", "Conteúdo"],
      ["ganhos", "Ganhos"],
      ["postagens", "Postagens"],
      ["sobre", "Sobre"],
    ];

    async function toggleSeguirCreator() {
    const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

    if (!token) {
        alert("Faça login para seguir.");
        return;
    }

    if (isOwnCreator) return;

    if (followPendente) {
        alert("Solicitação já enviada. Aguarde a pessoa aceitar.");
        return;
    }

    if (seguindo) {
        const resp = await fetch(`${API}/api/seguidores/`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ seguidoUsuarioId: creator.usuarioId }),
        });

        if (resp.ok) {
        setSeguindo(false);
        setFollowPendente(false);
        }

        return;
    }

    const resp = await fetch(`${API}/api/seguidores`, {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ seguidoUsuarioId: creator.usuarioId }),
    });

    if (resp.ok) {
        setSeguindo(false);
        setFollowPendente(true);
        alert("Solicitação enviada. Aguarde a pessoa aceitar.");
    }
  }

  if (isAtletaCreator) {
    return (
        <div className="min-h-screen bg-[#f5f7f3] flex items-center justify-center p-6">
        <div className="bg-white border rounded-2xl p-6 max-w-md text-center">
            <h1 className="font-bold text-xl text-emerald-950">
            Creator não encontrado
            </h1>
            <p className="text-slate-500 mt-2">
            Este perfil não está disponível como Creator.
            </p>
        </div>
        </div>
    );
    }

  return (
    <div className="min-h-screen bg-[#f5f7f3]">
      <header className="bg-[#163d29] text-white">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <div className="flex justify-between items-start">
            <button
                onClick={() => (window.location.href = `/mensagens?returnTo=${encodeURIComponent(creatorReturnUrl)}`)}
                className="relative w-10 h-10 rounded-xl border border-white/20 flex items-center justify-center"
            >
                <Mail size={18} />
                <BadgeCount count={unreadDM} />
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => (window.location.href = `/notificacoes?returnTo=${encodeURIComponent(creatorReturnUrl)}`)}
                className="relative w-10 h-10 rounded-xl border border-white/20 flex items-center justify-center"
              >
                <Bell size={18} />
                <BadgeCount count={badgeCount} />
              </button>
              <button
                onClick={() => (window.location.href = `/perfil/editar?returnTo=${encodeURIComponent(creatorReturnUrl)}`)}
                className="relative w-10 h-10 rounded-xl border border-white/20 flex items-center justify-center"
              >
                <Edit3 size={18} />
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center mt-2">
            <div
              className={
                institucional
                  ? "w-24 h-24 rounded-2xl bg-white/10 border-4 border-white/20 flex items-center justify-center text-2xl font-bold relative overflow-hidden"
                  : "w-24 h-24 rounded-full bg-white/10 border-4 border-white/20 flex items-center justify-center text-2xl font-bold relative overflow-hidden"
              }
            >
              {creator.avatarUrl ? (
                <img src={creator.avatarUrl} alt={creator.nomePublico} className="w-full h-full object-cover" />
              ) : (
                creator.initials
              )}

              {creator.verificado && (
                <span className="absolute right-0 bottom-0 bg-emerald-500 rounded-full p-1 border-2 border-[#163d29]">
                  <BadgeCheck size={16} />
                </span>
              )}
            </div>

            <p className="text-[10px] uppercase tracking-widest text-white/50 mt-3">
              {institucional ? "Creator — Página Institucional" : "Creator Pro"}
            </p>

            <h1 className="font-extrabold text-xl mt-1">{creator.nomePublico}</h1>

            {creator.headline && (
              <p className="text-white/60 text-sm mt-1 text-center">{creator.headline}</p>
            )}

            <div className="flex items-center gap-2 text-xs text-white/60 mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Canal oficial ativo
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {creator.verificado && (
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-[10px] font-bold">
                  VERIFICADO
                </span>
              )}

              {creator.instituicaoOficial && (
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 text-[10px] font-bold">
                  INST. OFICIAL
                </span>
              )}

              <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 text-[10px] font-bold">
                CREATOR
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 w-full max-w-md mt-5">
              <div className="bg-white/10 border border-white/10 rounded-xl p-3 text-center">
                <div className="font-bold text-lg">{compact(metricas.seguidores)}</div>
                <div className="text-[10px] text-white/50">Seguidores</div>
              </div>
              <div className="bg-white/10 border border-white/10 rounded-xl p-3 text-center">
                <div className="font-bold text-lg">{metricas.cursos}</div>
                <div className="text-[10px] text-white/50">Cursos</div>
              </div>
              <div className="bg-white/10 border border-white/10 rounded-xl p-3 text-center">
                <div className="font-bold text-lg">{compact(metricas.alunos)}</div>
                <div className="text-[10px] text-white/50">Usuários assinantes</div>
              </div>
            </div>

            <div className="flex gap-2 w-full max-w-md mt-3">
              <button
                disabled={seguindo === null}
                onClick={() => {
                if (isOwnCreator) {
                    window.location.href = "/perfil";
                    return;
                }

                toggleSeguirCreator();
                }}
                className={`flex-1 rounded-xl py-2 text-sm font-bold ${
                    seguindo || followPendente || isOwnCreator
                    ? "bg-white/10 border border-white/20 text-white"
                    : "bg-emerald-500 text-white"
                }`}
                >
                {isOwnCreator
                    ? "Seu perfil"
                    : seguindo === null
                    ? "..."
                    : seguindo
                    ? "Seguindo"
                    : followPendente
                    ? "Solicitação enviada"
                    : "Seguir"}
              </button>
              <button
                onClick={() => (window.location.href = `/minha-rede?returnTo=${encodeURIComponent(creatorReturnUrl)}`)}
                className="flex-1 border border-white/20 rounded-xl py-2 text-sm"
              >
                Rede
              </button>
              <button
                onClick={() => (window.location.href = `/configuracoes?returnTo=${encodeURIComponent(creatorReturnUrl)}`)}
                className="flex-1 border border-white/20 rounded-xl py-2 text-sm flex items-center justify-center gap-1"
              >
                <Settings size={14} />
                Config.
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 flex overflow-x-auto">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setAba(key as any)}
              className={
                aba === key
                  ? "px-4 py-3 text-sm font-bold text-emerald-900 border-b-2 border-emerald-500"
                  : "px-4 py-3 text-sm text-slate-500"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        {aba === "visao" && (
          <>
            <section className="bg-white rounded-2xl border p-5 shadow-sm">
              <h2 className="font-bold text-emerald-950 mb-4">
                {institucional ? "Alcance da instituição" : "Impacto do Creator"}
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Metric icon={<Users />} value={compact(metricas.alunos)} label="Usuarios Assinantes" />
                <Metric icon={<Star />} value={avaliacaoMedia ? avaliacaoMedia.toFixed(1) : "0.0"} label="Avaliação" />
                <Metric icon={<BookOpen />} value={metricas.cursos} label="Conteúdos" />
                <Metric icon={<Eye />} value={compact(metricas.views ?? 0)} label="Views" />
                <Metric icon={<Coins />} value={money(metricas.ganhoCreator)} label="Ganhos" />
                <Metric icon={<BadgeCheck />} value={conteudos.filter((c) => c.geraCertificado).length} label="Certificados" />
              </div>
            </section>

            <section className="bg-white rounded-2xl border p-5 shadow-sm">
              <h2 className="font-bold text-emerald-950 mb-4">Conteúdo no Learning</h2>

              <div className="grid md:grid-cols-2 gap-4">
                {conteudos.slice(0, 4).map((item) => (
                  <CreatorCard
                    key={`${item.origem}-${item.id}`}
                    {...item}
                    onClick={() => {
                        const origem = item.origem === "PREMIUM" ? "avulsa" : "learning";
                        window.location.href = `/learning/${item.id}?origem=${origem}`;
                    }}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {aba === "conteudo" && (
            <section className="space-y-5">
                {isOwnCreator && (
                <section className="bg-white rounded-2xl border p-5 shadow-sm">
                    <h2 className="font-bold text-emerald-950 mb-2">
                    Criar novo conteúdo
                    </h2>

                    <p className="text-slate-500 text-sm mb-4">
                    Publique metodologias, cursos, módulos ou conteúdos premium para aparecerem no seu perfil Creator.
                    </p>

                    <button
                    type="button"
                    onClick={() => {
                        window.location.href = "/learning/create";
                    }}
                    className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-bold shadow-sm hover:bg-emerald-700"
                    >
                    + Criar conteúdo
                    </button>
                </section>
                )}

                <section className="bg-white rounded-2xl border p-5 shadow-sm">
                <h2 className="font-bold text-emerald-950 mb-4">
                    Conteúdos publicados
                </h2>

                {conteudos.length === 0 ? (
                    <p className="text-slate-500 text-sm">
                    Nenhum conteúdo publicado ainda.
                    </p>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {conteudos.map((item) => (
                        <CreatorCard
                        key={`${item.origem}-${item.id}`}
                        {...item}
                        onClick={() => {
                            const origem =
                            item.origem === "PREMIUM" ? "avulsa" : "learning";
                            window.location.href = `/learning/${item.id}?origem=${origem}`;
                        }}
                        />
                    ))}
                    </div>
                )}
                </section>
            </section>
        )}

        {aba === "ganhos" && (
          <section className="bg-white rounded-2xl border p-5 shadow-sm">
            <h2 className="font-bold text-emerald-950 mb-4">Ganhos públicos</h2>
            <div className="space-y-3 text-sm">
              <Line label="Receita bruta gerada" value={money(metricas.receitaBruta)} />
              <Line label="Ganho estimado do Creator" value={money(metricas.ganhoCreator)} />
              <Line label="Comissão FootEra" value="15%" />
              <Line label="Repasse Creator" value="85%" />
            </div>
          </section>
        )}

        {aba === "eventos" && (
          <section className="bg-white rounded-2xl border p-5 shadow-sm">
            <h2 className="font-bold text-emerald-950 mb-2">Próximos eventos</h2>
            <p className="text-slate-500 text-sm mb-4">
            Eventos e lives do Creator aparecerão aqui.
            </p>

            {institucional && (
            <button
                onClick={() => {
                const clubeId = creator.perfilOriginal?.clube?.id;
                const escolinhaId = creator.perfilOriginal?.escolinha?.id;

                if (clubeId) {
                    window.location.href = `/eventos/clubes/${clubeId}/novo`;
                    return;
                }

                if (escolinhaId) {
                    window.location.href = `/eventos/escolas/${escolinhaId}/novo`;
                    return;
                }

                alert("Não foi possível identificar a organização deste Creator.");
                }}
                className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-bold"
            >
                + Criar evento
            </button>
            )}
          </section>
        )}

        {aba === "postagens" && (
            <section className="mt-4">
                <ProfilePostsSection usuarioId={creator.usuarioId} />
            </section>
        )}

        {aba === "sobre" && (
            <section className="bg-white rounded-2xl border p-5 shadow-sm">
                <h2 className="font-bold text-emerald-950 mb-4">Sobre</h2>

                <div className="space-y-2 text-sm text-slate-700">
                <p>
                    <strong>Nome:</strong> {creator.nomePublico}
                </p>

                {creator.perfilOriginal?.clube?.descricao && (
                    <p>
                        <strong>Descrição do clube:</strong>{" "}
                        {creator.perfilOriginal.clube.descricao}
                    </p>
                )}

                {creator.perfilOriginal?.escolinha?.descricao && (
                    <p>
                        <strong>Descrição da escolinha:</strong>{" "}
                        {creator.perfilOriginal.escolinha.descricao}
                    </p>
                )}

                {creator.bio && (
                    <p>
                    <strong>Bio:</strong> {creator.bio}
                    </p>
                )}

                {creator.nicho && (
                    <p>
                    <strong>Nicho:</strong> {creator.nicho}
                    </p>
                )}

                {creator.perfilOriginal?.email && (
                    <p>
                    <strong>Email:</strong> {creator.perfilOriginal.email}
                    </p>
                )}

                {creator.perfilOriginal?.clube?.cidade && (
                    <p>
                    <strong>Localização:</strong>{" "}
                    {creator.perfilOriginal.clube.cidade}
                    {creator.perfilOriginal.clube.estado
                        ? `, ${creator.perfilOriginal.clube.estado}`
                        : ""}
                    {creator.perfilOriginal.clube.pais
                        ? `, ${creator.perfilOriginal.clube.pais}`
                        : ""}
                    </p>
                )}

                {creator.perfilOriginal?.clube?.siteOficial && (
                    <p>
                    <strong>Site:</strong> {creator.perfilOriginal.clube.siteOficial}
                    </p>
                )}

                {Array.isArray(creator.perfilOriginal?.clube?.categorias) &&
                creator.perfilOriginal.clube.categorias.length > 0 && (
                    <p>
                    <strong>Categorias:</strong>{" "}
                    {creator.perfilOriginal.clube.categorias.join(", ")}
                    </p>
                )}

                {Array.isArray(creator.perfilOriginal?.escolinha?.categorias) &&
                creator.perfilOriginal.escolinha.categorias.length > 0 && (
                    <p>
                    <strong>Categorias:</strong>{" "}
                    {creator.perfilOriginal.escolinha.categorias.join(", ")}
                    </p>
                )}
                </div>
            </section>
            )}
      </main>
    </div>
  );
}

function Metric({ icon, value, label }: { icon: any; value: any; label: string }) {
  return (
    <div className="rounded-xl bg-[#f5f7f3] p-4">
      <div className="text-emerald-600 mb-1 [&_svg]:w-4 [&_svg]:h-4">{icon}</div>
      <div className="font-extrabold text-emerald-950">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b pb-2">
      <span className="text-slate-500">{label}</span>
      <strong className="text-emerald-900">{value}</strong>
    </div>
  );
}

function BadgeCount({ count }: { count: number }) {
  if (!count || count <= 0) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
      {count > 99 ? "99+" : count}
    </span>
  );
}