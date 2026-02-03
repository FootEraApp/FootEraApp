import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, Search, ExternalLink, Loader2 } from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import BottomNav from "@/components/layout/BottomNav.js";

type Metodologia = {
  id: string;
  titulo: string;
  descricao?: string | null;
  pontosBadge?: string | null;
  pontosPorSemanaLabel?: string | null;
  categorias?: string[] | null;
  logoUrl?: string | null;
  assinada?: boolean;
};

function getToken() {
  return (
    (Storage as any).token ??
    localStorage.getItem("token") ??
    sessionStorage.getItem("token") ??
    ""
  );
}

export default function MinhasMetodologias() {
  const [, navigate] = useLocation();

  const [busca, setBusca] = useState("");
  const [items, setItems] = useState<Metodologia[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
            "Não foi possível carregar suas metodologias (404).";
          throw new Error(msg);
        }
        const arr2: any[] = Array.isArray(js2) ? js2 : js2.items ?? [];
        setItems(
          arr2.map((m: any) => ({
            id: String(m.id),
            titulo: m.titulo ?? m.nome ?? "Metodologia",
            descricao: m.descricao ?? null,
            pontosBadge: m.pontosBadge ?? null,
            pontosPorSemanaLabel: m.pontosPorSemanaLabel ?? null,
            categorias: m.categorias ?? [],
            logoUrl: m.logoUrl ?? null,
            assinada: true,
          }))
        );
        return;
      }

      const js = await r.json().catch(() => null);
      if (!r.ok) {
        const msg =
          js?.message || js?.error || "Falha ao carregar metodologias.";
        throw new Error(msg);
      }

      const arr: any[] = Array.isArray(js) ? js : js.items ?? [];
      setItems(
        arr.map((m: any) => ({
          id: String(m.id),
          titulo: m.titulo ?? m.nome ?? "Metodologia",
          descricao: m.descricao ?? null,
          pontosBadge: m.pontosBadge ?? null,
          pontosPorSemanaLabel: m.pontosPorSemanaLabel ?? null,
          categorias: m.categorias ?? [],
          logoUrl: m.logoUrl ?? null,
          assinada: m.assinada ?? true,
        }))
      );
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar suas metodologias.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => {
      const t = (m.titulo || "").toLowerCase();
      const d = (m.descricao || "").toLowerCase();
      const c = (m.categorias || []).join(" ").toLowerCase();
      return t.includes(q) || d.includes(q) || c.includes(q);
    });
  }, [items, busca]);

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
                Tudo o que você assinou (ou tem acesso).
              </p>
            </div>

            <Link
              href="/metodologias/create"
              className="px-3 py-2 rounded-xl bg-green-800 text-white text-sm font-semibold hover:bg-green-900"
            >
              Criar
            </Link>
          </div>

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

            <button
              onClick={carregar}
              className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm font-semibold"
            >
              Atualizar
            </button>
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
            <div className="text-sm text-gray-600">
              Você ainda não assinou nenhuma metodologia.
            </div>
          )}

          {!loading && filtrados.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtrados.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border shadow-sm bg-white p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-green-900 line-clamp-2">
                          {m.titulo}
                        </h3>

                        {!!m.categorias?.length && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {m.categorias.slice(0, 3).map((c) => (
                              <span
                                key={c}
                                className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700"
                              >
                                {c}
                              </span>
                            ))}
                            {m.categorias.length > 3 && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700">
                                +{m.categorias.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {!!m.pontosBadge && (
                        <span className="text-xs px-2 py-1 rounded-full border bg-amber-50 text-amber-800 font-semibold shrink-0">
                          {m.pontosBadge}
                        </span>
                      )}
                    </div>

                    {!!m.descricao && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-3">
                        {m.descricao}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-600 line-clamp-1">
                      {m.pontosPorSemanaLabel || ""}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        // aqui você decide o destino:
                        // pode ser uma página detalhe: /metodologias/:id
                        // ou abrir dentro do tab "Metodologias"
                        navigate(`/metodologias/${m.id}`);
                      }}
                      className="px-4 py-2 rounded-xl bg-green-800 text-white font-semibold hover:bg-green-900 shrink-0 inline-flex items-center gap-2"
                    >
                      Acessar
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav active="treinos" />
    </div>
  );
}
