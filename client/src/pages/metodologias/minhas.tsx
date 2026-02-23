import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ChevronLeft,
  Search,
  Loader2,
  Trash2,
  Pencil,
  Star as StarIcon,
} from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import BottomNav from "@/components/layout/BottomNav.js";

type Metodologia = {
  id: string;
  titulo: string;
  descricao?: string | null;
  logoUrl?: string | null;
  capaUrl?: string | null;
  categorias?: string[];
  pontosBadge?: string | null;
  pontosPorSemanaLabel?: string | null;
  publicoAlvo?: string | null;
  totalAssinantes?: number;
  mediaAvaliacao?: number | null;
  totalReviews?: number;
  pontosTotal?: number;
  assinada?: boolean;
  ativo?: boolean;
  criadorUsuario?: { id: string; nome: string; foto?: string | null; parceiro?: boolean };
};

function getToken() {
  return (
    (Storage as any).token ??
    localStorage.getItem("token") ??
    sessionStorage.getItem("token") ??
    ""
  );
}

function normalizeImgUrl(raw?: string | null) {
  if (!raw) return null;
  const u = String(raw).trim();
  if (!u || u === "null" || u === "undefined") return null;

  if (u.startsWith("http://") || u.startsWith("https://")) return u;

  // ✅ assets locais do frontend
  if (u.startsWith("/assets/")) return u;

  // ✅ uploads/api
  if (u.startsWith("/uploads/") || u.startsWith("/exercicios/")) return `${API.BASE_URL}${u}`;

  // ✅ qualquer outro caminho com "/"
  if (u.startsWith("/")) return `${API.BASE_URL}${u}`;

  // ✅ "uploads/..." sem barra
  return `${API.BASE_URL}/${u}`;
}

function StarsRating({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  const half = Math.round(v * 2) / 2; // 0.5 steps
  const full = Math.floor(half);
  const hasHalf = half - full === 0.5;

  return (
    <div className="flex items-center">
      {Array.from({ length: 5 }).map((_, i) => {
        const idx = i + 1;

        if (idx <= full) {
          return (
            <StarIcon
              key={i}
              className="w-4 h-4 text-amber-500"
              fill="currentColor"
            />
          );
        }

        if (idx === full + 1 && hasHalf) {
          return (
            <span key={i} className="relative inline-block w-4 h-4">
              <StarIcon
                className="absolute inset-0 w-4 h-4 text-gray-300"
                fill="currentColor"
              />
              <span className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
                <StarIcon className="w-4 h-4 text-amber-500" fill="currentColor" />
              </span>
            </span>
          );
        }

        return <StarIcon key={i} className="w-4 h-4 text-gray-300" fill="none" />;
      })}
    </div>
  );
}

function getUserId(): string | null {
  const s: any = Storage as any;
  const id =
    s?.user?.id ||
    s?.usuario?.id ||
    s?.usuarioLogado?.id ||
    localStorage.getItem("userId") ||
    sessionStorage.getItem("userId");

  return id ? String(id) : null;
}

function getPlanoIdLocal(): string | null {
  // ajuste aqui se você salva com outra chave
  return (
    localStorage.getItem("planoId") ||
    localStorage.getItem("produtoPlanoId") ||
    localStorage.getItem("assinaturaProdutoId") ||
    sessionStorage.getItem("planoId") ||
    sessionStorage.getItem("produtoPlanoId") ||
    sessionStorage.getItem("assinaturaProdutoId") ||
    null
  );
}

function getUserTipo(): string | null {
  const s: any = Storage as any;

  // 1) Storage (caso exista)
  const tipoStorage =
    s?.user?.tipo ||
    s?.usuario?.tipo ||
    s?.usuarioLogado?.tipo ||
    s?.tipoUsuario ||        // ✅ ADD
    s?.usuarioTipoRaw;       // ✅ ADD

  if (tipoStorage) return String(tipoStorage);

  // 2) localStorage/sessionStorage - chaves diretas (SEU CASO!)
  const tipoDireto =
    localStorage.getItem("tipoUsuario") ||
    localStorage.getItem("usuarioTipoRaw") ||
    sessionStorage.getItem("tipoUsuario") ||
    sessionStorage.getItem("usuarioTipoRaw");

  if (tipoDireto) return String(tipoDireto);

  // 3) JSON salvo como "user"/"usuario" etc (fallback)
  const raw =
    localStorage.getItem("user") ||
    localStorage.getItem("usuario") ||
    sessionStorage.getItem("user") ||
    sessionStorage.getItem("usuario");

  if (raw) {
    try {
      const js = JSON.parse(raw);
      const tipoJson =
        js?.tipo ||
        js?.user?.tipo ||
        js?.tipoUsuario ||     // ✅ ADD
        js?.usuarioTipoRaw;    // ✅ ADD
      if (tipoJson) return String(tipoJson);
    } catch {}
  }

  return null;
}

function isInstrutorTipo(tipo: string | null) {
  const t = (tipo || "").toLowerCase().trim();
  return (
    t === "professor" ||
    t === "clube" ||
    t === "escolinha" ||
    t === "instrutor" // se você usar essa string em algum lugar
  );
}

export default function MinhasMetodologias() {
  const [, navigate] = useLocation();

  const userTipo = getUserTipo();
  const isInstrutor = isInstrutorTipo(userTipo);
  
    // instrutor tem 2 abas
  const [tab, setTab] = useState<"assinadas" | "criadas">("assinadas");
  const [busca, setBusca] = useState("");
  const [assinadas, setAssinadas] = useState<Metodologia[]>([]);
  const [criadas, setCriadas] = useState<Metodologia[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ limite: number; usadasNoMes: number; restantes: number } | null>(null);
  const [canCriarMetodologia, setCanCriarMetodologia] = useState(false);
  const [checkingPerm, setCheckingPerm] = useState(true);

  const podeGerenciar = canCriarMetodologia; // <- aqui é o que manda

  async function checarPermissaoCriarMetodologia() {
    const tipo = (getUserTipo() || "").toLowerCase().trim();
    const token = getToken();

    // regra: só professor/clube/escolinha podem sequer tentar
    const isPossivelAutor =
      tipo === "professor" || tipo === "clube" || tipo === "escolinha";

    if (!isPossivelAutor) {
      setCanCriarMetodologia(false);
      setCheckingPerm(false);
      return;
    }

    // 1) tenta ler plano salvo localmente (rápido)
    const planoLocal = (getPlanoIdLocal() || "").toUpperCase();

    // ✅ IDs que você mostrou/quer
    const ORGANIZACOES_PRO = "ORGANIZACOES_PRO";
    const PROFESSOR_PRO = "PROFESSOR_PRO"; // <<< se no seu sistema tiver outro ID, troque aqui

    // Regra por tipo
    if (tipo === "clube" || tipo === "escolinha") {
      if (planoLocal === ORGANIZACOES_PRO) {
        setCanCriarMetodologia(true);
        setCheckingPerm(false);
        return;
      }
    }

    if (tipo === "professor") {
      // pode por plano professor_pro OU parceiro
      if (planoLocal === PROFESSOR_PRO) {
        setCanCriarMetodologia(true);
        setCheckingPerm(false);
        return;
      }
    }

    // 2) fallback robusto: pergunta pro backend quem é parceiro e qual plano está ativo
    // ✅ você vai criar esse endpoint no back (veja seção 2)
    if (!token) {
      setCanCriarMetodologia(false);
      setCheckingPerm(false);
      return;
    }

    try {
      const r = await fetch(`${API.BASE_URL}/api/permissoes/metodologias/criar`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json().catch(() => null);
      setCanCriarMetodologia(Boolean(j?.canCreate));
    } catch {
      setCanCriarMetodologia(false);
    } finally {
      setCheckingPerm(false);
    }
  }

  async function preencherPontosViaDetalhe(lista: Metodologia[], token: string) {
    const ids = lista.filter((m) => !Number(m.pontosTotal)).map((m) => m.id);
    if (!ids.length) return lista;

    const headers = { Authorization: `Bearer ${token}` };

    const detalhes = await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await fetch(`${API.BASE_URL}/api/metodologias/${id}/detalhe`, { headers });
          const j = await r.json().catch(() => null);
          if (!r.ok) return null;
          return { id, pontosTotal: Number(j?.pontosTotal ?? 0) };
        } catch {
          return null;
        }
      })
    );

    const map = new Map(detalhes.filter(Boolean).map((d: any) => [d.id, d.pontosTotal]));

    return lista.map((m) => ({
      ...m,
      pontosTotal: Number(m.pontosTotal) || Number(map.get(m.id) ?? 0),
    }));
  }

  async function carregarAssinadas(token: string) {
    // ✅ endpoint sugerido (metodologias assinadas)
    const r = await fetch(`${API.BASE_URL}/api/metodologias/minhas`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // fallback: alguns backends preferem /api/metodologias/assinadas
    if (r.status === 404) {
      const r2 = await fetch(`${API.BASE_URL}/api/metodologias/assinadas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const js2 = await r2.json().catch(() => null);
      if (!r2.ok) {
        const msg =
          js2?.message ||
          js2?.error ||
          "Não foi possível carregar suas metodologias assinadas (404).";
        throw new Error(msg);
      }
      const arr2: any[] = Array.isArray(js2) ? js2 : js2.items ?? [];
      const base = arr2.map((m: any) => ({
        id: String(m.id),
        titulo: m.titulo ?? m.nome ?? "Metodologia",
        descricao: m.descricao ?? m.item?.descricao ?? null,
        pontosBadge: m.pontosBadge ?? null,
        pontosPorSemanaLabel: m.pontosPorSemanaLabel ?? null,
        categorias: m.categorias ?? [],
        capaUrl: m.capaUrl ?? m.capa ?? null,
        logoUrl: m.logoUrl ?? null,
        assinada: m.assinada ?? true,
        publicoAlvo: m.publicoAlvo ?? m.item?.publicoAlvo ?? "AMBOS",
        totalAssinantes: Number(m.totalAssinantes ?? m._count?.assinantes ?? 0),
        mediaAvaliacao: Number(m.mediaAvaliacao ?? 0),
        totalReviews: Number(m.totalReviews ?? 0),
        criadorUsuario: m.criadorUsuario ?? m.item?.criadorUsuario ?? null,
        pontosTotal: Number(
          m.pontosTotal ??
          m.totalPontos ??
          m.pontos ??
          m.pontosSemana ??
          m.pontuacao ??
          0
        ),
      }));

      const final = await preencherPontosViaDetalhe(base, token);
      setAssinadas(final);

      return;
    }

    const js = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = js?.message || js?.error || "Falha ao carregar assinadas.";
      throw new Error(msg);
    }

    const arr: any[] = Array.isArray(js) ? js : js.items ?? [];

    if (!Array.isArray(js) && js?.quota) {
      setQuota({
        limite: Number(js.quota.limite ?? 0),
        usadasNoMes: Number(js.quota.usadasNoMes ?? 0),
        restantes: Number(js.quota.restantes ?? 0),
      });
    } else {
      setQuota(null);
    }

    const base = arr.map((m: any) => ({
      id: String(m.id),
      titulo: m.titulo ?? m.nome ?? "Metodologia",
      descricao: m.descricao ?? m.item?.descricao ?? null,
      pontosBadge: m.pontosBadge ?? null,
      pontosPorSemanaLabel: m.pontosPorSemanaLabel ?? null,
      categorias: m.categorias ?? [],
      capaUrl: m.capaUrl ?? m.capa ?? null,
      logoUrl: m.logoUrl ?? null,
      assinada: m.assinada ?? true,
      publicoAlvo: m.publicoAlvo ?? m.item?.publicoAlvo ?? "AMBOS",
      totalAssinantes: Number(m.totalAssinantes ?? m._count?.assinantes ?? 0),
      mediaAvaliacao: Number(m.mediaAvaliacao ?? 0),
      totalReviews: Number(m.totalReviews ?? 0),
      criadorUsuario: m.criadorUsuario ?? m.item?.criadorUsuario ?? null,
      pontosTotal: Number(
        m.pontosTotal ??
          m.totalPontos ??
          m.pontos ??
          m.pontosSemana ??
          m.pontuacao ??
          0
      ),
    }));

    const final = await preencherPontosViaDetalhe(base, token);
    setAssinadas(final);
  }

  async function carregarCriadas(token: string) {
    // ✅ sugestão: endpoint para metodologias criadas pelo instrutor
    let r = await fetch(`${API.BASE_URL}/api/metodologias/criadas`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // fallback 1
    if (r.status === 404) {
      r = await fetch(`${API.BASE_URL}/api/metodologias/minhas-criadas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    const js = await r.json().catch(() => null);
    if (!r.ok) {
      const msg =
        js?.message || js?.error || "Falha ao carregar metodologias criadas.";
      throw new Error(msg);
    }

    const arr: any[] = Array.isArray(js) ? js : js.items ?? [];
    const base = arr.map((m: any) => ({
      id: String(m.id),
      titulo: m.titulo ?? m.nome ?? "Metodologia",
      descricao: m.descricao ?? m.item?.descricao ?? null,
      pontosBadge: m.pontosBadge ?? null,
      pontosPorSemanaLabel: m.pontosPorSemanaLabel ?? null,
      categorias: m.categorias ?? [],
      capaUrl: m.capaUrl ?? m.capa ?? null,
      logoUrl: m.logoUrl ?? null,
      assinada: m.assinada ?? false,
      publicoAlvo: m.publicoAlvo ?? m.item?.publicoAlvo ?? "AMBOS",
      totalAssinantes: Number(m.totalAssinantes ?? m._count?.assinantes ?? 0),
      mediaAvaliacao: Number(m.mediaAvaliacao ?? 0),
      totalReviews: Number(m.totalReviews ?? 0),
      criadorUsuario: m.criadorUsuario ?? m.item?.criadorUsuario ?? null,
      pontosTotal: Number(
        m.pontosTotal ??
        m.totalPontos ??
        m.pontos ??
        m.pontosSemana ??
        m.pontuacao ??
        0
      ),
      ativo: Boolean(m.ativo ?? m.ativoCriacao ?? true), // para criadas, ativo pode vir como "ativo" ou "ativoCriacao"
    }));

    const final = await preencherPontosViaDetalhe(base, token);
    setCriadas(final);
  }

  async function carregar() {
    setErro(null);
    setLoading(true);

    const token = getToken();
    if (!token) {
      setErro("Sem token. Faça login novamente.");
      setLoading(false);
      return;
    }

    try {
      // sempre carrega assinadas
      await carregarAssinadas(token);

      // só instrutor carrega criadas
      if (canCriarMetodologia) {
        await carregarCriadas(token);
      } else {
        setCriadas([]);
      }
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar suas metodologias.");
      setAssinadas([]);
      setCriadas([]);
    } finally {
      setLoading(false);
    }
  }

  async function deletarMetodologia(id: string) {
    const token = getToken();
    if (!token) return;

    const ok = confirm("Tem certeza que deseja deletar esta metodologia?");
    if (!ok) return;

    try {
      const r = await fetch(
        `${API.BASE_URL}/api/metodologias/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const js = await r.json().catch(() => null);

      if (!r.ok) {
        alert(js?.message || js?.error || "Não foi possível deletar.");
        return;
      }

      setCriadas((prev) => prev.filter((m) => m.id !== id));
    } catch {
      alert("Erro ao deletar metodologia.");
    }
  }

  useEffect(() => {
    carregar();
    checarPermissaoCriarMetodologia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!canCriarMetodologia) return;
    const token = getToken();
    if (!token) return;
    carregarCriadas(token).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCriarMetodologia]);
  
  const listaAtiva = useMemo(() => {
    // atleta só usa assinadas
    if (!isInstrutor) return assinadas;
    return tab === "assinadas" ? assinadas : criadas;
  }, [isInstrutor, tab, assinadas, criadas]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return listaAtiva;

    return listaAtiva.filter((m) => {
      const t = (m.titulo || "").toLowerCase();
      const d = (m.descricao || "").toLowerCase();
      const c = (m.categorias || []).join(" ").toLowerCase();
      return t.includes(q) || d.includes(q) || c.includes(q);
    });
  }, [listaAtiva, busca]);

  const emptyMsg = useMemo(() => {
    if (!isInstrutor) return "Você ainda não assinou nenhuma metodologia.";
    if (tab === "assinadas") return "Você ainda não assinou nenhuma metodologia.";
    return "Você ainda não criou nenhuma metodologia.";
  }, [isInstrutor, tab]);

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="w-full px-3 sm:px-4 lg:px-8">
        {/* Header */}
        <div className="pt-3 sticky top-0 z-20 bg-neutral-50/90 backdrop-blur">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/treinos")}
              className="inline-flex items-center justify-center p-2 rounded-xl border bg-white hover:bg-gray-50"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-green-900">
                Minhas Metodologias
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">
                {isInstrutor ? "Assinadas e criadas por você." : "Tudo o que você assinou (ou tem acesso)."}
                {quota && quota.limite > 0 && (
                  <span className="ml-2 inline-flex items-center gap-2">
                    <span className="px-2 py-1 rounded-full border bg-white text-[11px] font-semibold">
                      {quota.usadasNoMes}/{quota.limite}
                    </span>
                    {quota.restantes === 0 && (
                      <span className="text-[11px] text-amber-700">
                        Limite atingido
                      </span>
                    )}
                  </span>
                )}
              </p>
            </div>

            {quota && quota.limite === 0 && (
              <button
                onClick={() => navigate("/pagamentos?produto=learning")}
                className="px-3 py-2 rounded-xl bg-green-800 text-white text-sm font-semibold hover:bg-green-900"
              >
                Ativar Learning
              </button>
            )}

            {checkingPerm ? null : canCriarMetodologia ? (
              <Link
                href="/treinos/Criar-Metodologia"
                className="px-3 py-2 rounded-xl bg-green-800 text-white text-sm font-semibold hover:bg-green-900"
              >
                Criar
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/pagamentos")} // ou /pagamentos?produto=...
                className="px-3 py-2 rounded-xl bg-gray-200 text-gray-600 text-sm font-semibold cursor-not-allowed"
                title="Disponível apenas para Professor Parceiro ou planos Pro"
                disabled
              >
                Criar
              </button>
            )}
          </div>

          {/* ✅ Abas SOMENTE para instrutores */}
          {isInstrutor && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setTab("assinadas")}
                className={`px-3 py-2 rounded-xl border text-sm font-semibold ${
                  tab === "assinadas"
                    ? "bg-green-800 text-white border-green-900"
                    : "bg-white hover:bg-gray-50"
                }`}
              >
                Assinadas ({assinadas.length})
              </button>

              <button
                type="button"
                onClick={() => setTab("criadas")}
                className={`px-3 py-2 rounded-xl border text-sm font-semibold ${
                  tab === "criadas"
                    ? "bg-green-800 text-white border-green-900"
                    : "bg-white hover:bg-gray-50"
                }`}
              >
                Criadas ({criadas.length})
              </button>
            </div>
          )}

          {/* Busca */}
          <div className="mt-3 flex items-center gap-2 bg-white border rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar em minhas metodologias..."
              className="w-full outline-none text-sm"
            />
          </div>
        </div>

        {/* Content */}
        <div className="mt-4 bg-white rounded-2xl border shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="text-sm text-gray-600">
              {loading ? "Carregando..." : `${filtrados.length} encontradas`}
            </div>
          </div>

          {erro && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
              {erro}
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Buscando suas metodologias...
            </div>
          )}

          {!loading && filtrados.length === 0 && (
            <div className="text-sm text-gray-600">{emptyMsg}</div>
          )}

          {!loading && filtrados.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtrados.map((m) => {
                const capa = normalizeImgUrl(m.capaUrl);
                const logo = normalizeImgUrl(m.logoUrl);
                const fallback = `${API.BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border shadow-sm bg-white p-4 flex items-center justify-between gap-4"
                  >
                    {/* ESQUERDA: logo + infos */}
                    <div className="flex items-start gap-4 min-w-0">
                      <img
                        src={capa || logo || fallback}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = fallback;
                        }}
                        className="h-16 w-16 rounded-2xl border object-cover bg-white flex-shrink-0"
                        alt={m.titulo}
                      />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded-full text-[11px] font-semibold border bg-white">
                            {String(m.publicoAlvo ?? "AMBOS")}
                          </span>

                          {/* ✅ ADD: badge de status quando estiver na aba "criadas" */}
                          {isInstrutor && tab === "criadas" && (
                            <span className={`px-2 py-1 rounded-full text-[11px] font-semibold border ${
                              m.ativo ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
                            }`}>
                              {m.ativo ? "Publicada" : "Aguardando validação"}
                            </span>
                          )}

                          <div className="font-semibold text-green-900 truncate">
                            {m.titulo}
                          </div>
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                          <StarsRating value={Number(m.mediaAvaliacao ?? 0)} />
                          <span className="font-semibold text-gray-800">
                            {(Number(m.mediaAvaliacao ?? 0)).toFixed(1)}
                          </span>
                          <span>({Number((m as any).totalAvaliacoes ?? m.totalReviews ?? 0)})</span>
                          <span className="text-gray-400">•</span>
                          <span>
                            <b>{Number(m.totalAssinantes ?? 0)}</b> assinaturas
                          </span>
                        </div>

                        {/* pontos + descrição */}
                        <div className="mt-1 text-sm text-gray-700">
                          + <b>{Number(m.pontosTotal ?? 0)}</b> pts
                        </div>

                        {m.criadorUsuario?.nome && (
                          <div className="mt-1 text-sm text-gray-700">
                            Criado por: <b>{m.criadorUsuario.nome}</b>
                          </div>
                        )}

                        {!!m.descricao && (
                          <div className="mt-1 text-sm text-gray-600 line-clamp-2">
                            {m.descricao}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* DIREITA: ações */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* ✅ CRIADAS: só editar/apagar (sem Acessar) */}
                      {isInstrutor && tab === "criadas" ? (
                        <>
                          <Link
                            href={`/treinos/Criar-Metodologia?id=${encodeURIComponent(
                              m.id
                            )}`}
                            className="p-2 rounded-xl border bg-white hover:bg-gray-50"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => deletarMetodologia(m.id)}
                            className="p-2 rounded-xl border bg-white hover:bg-red-50"
                            title="Deletar"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </>
                      ) : (
                        /* ✅ ASSINADAS: botão "Acessar" */
                        <button
                          type="button"
                          onClick={() => navigate(`/metodologias/${m.id}`)}
                          className="px-5 py-2 rounded-full bg-green-800 text-white font-semibold hover:bg-green-900"
                        >
                          Acessar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <BottomNav active="treinos" />
    </div>
  );
}
