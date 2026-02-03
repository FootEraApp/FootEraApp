import React, { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, Plus, X, Save } from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import BottomNav from "@/components/layout/BottomNav.js";

type CategoriaChip = string;

function getToken() {
  return (
    (Storage as any).token ??
    localStorage.getItem("token") ??
    sessionStorage.getItem("token") ??
    ""
  );
}

export default function CriarMetodologia() {
  const [, navigate] = useLocation();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [pontosBadge, setPontosBadge] = useState("+10 pts");
  const [pontosPorSemanaLabel, setPontosPorSemanaLabel] = useState(
    "+10 pts por semana"
  );
  const [logoUrl, setLogoUrl] = useState<string>("");

  const [categoriaInput, setCategoriaInput] = useState("");
  const [categorias, setCategorias] = useState<CategoriaChip[]>([
    "Base",
    "Mentalidade",
  ]);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return titulo.trim().length >= 3 && !salvando;
  }, [titulo, salvando]);

  function addCategoria(raw: string) {
    const v = raw.trim();
    if (!v) return;
    setCategorias((prev) => {
      const exists = prev.some((x) => x.toLowerCase() === v.toLowerCase());
      if (exists) return prev;
      return [...prev, v];
    });
    setCategoriaInput("");
  }

  function removeCategoria(label: string) {
    setCategorias((prev) => prev.filter((x) => x !== label));
  }

  async function salvar() {
    setErro(null);
    setOkMsg(null);

    const token = getToken();
    if (!token) {
      setErro("Sem token. Faça login novamente.");
      return;
    }

    if (!titulo.trim()) {
      setErro("Informe um título.");
      return;
    }

    const payload = {
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      pontosBadge: (pontosBadge || "").trim() || null,
      pontosPorSemanaLabel: (pontosPorSemanaLabel || "").trim() || null,
      categorias: categorias.length ? categorias : [],
      logoUrl: (logoUrl || "").trim() || null,
    };

    setSalvando(true);
    try {
      // ✅ endpoint sugerido
      const r = await fetch(`${API.BASE_URL}/api/metodologias`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const js = await r.json().catch(() => null);

      if (!r.ok) {
        const msg =
          js?.message ||
          js?.error ||
          "Não foi possível criar a metodologia (verifique o backend).";
        throw new Error(msg);
      }

      setOkMsg("Metodologia criada com sucesso!");
      // leve delay pra dar feedback
      setTimeout(() => navigate("/metodologias/minhas"), 700);
    } catch (e: any) {
      setErro(e?.message || "Erro ao salvar metodologia.");
    } finally {
      setSalvando(false);
    }
  }

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
                Criar Metodologia
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">
                Cadastre sua metodologia para aparecer no catálogo.
              </p>
            </div>

            <Link
              href="/metodologias/minhas"
              className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm font-semibold text-green-900"
            >
              Minhas
            </Link>
          </div>
        </div>

        {/* Card */}
        <div className="mt-4 bg-white rounded-2xl border shadow-sm p-4 sm:p-6">
          {erro && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
              {erro}
            </div>
          )}
          {okMsg && (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-2 text-sm">
              {okMsg}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Título */}
            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-gray-800">
                Título *
              </label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Metodologia Goleiros Pro"
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
              />
              <div className="text-xs text-gray-500 mt-1">
                Mínimo 3 caracteres.
              </div>
            </div>

            {/* Descrição */}
            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-gray-800">
                Descrição
              </label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Explique como funciona, pra quem é, o que entrega..."
                className="mt-1 w-full min-h-[120px] border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
              />
            </div>

            {/* Badges */}
            <div>
              <label className="text-sm font-semibold text-gray-800">
                Badge de pontos (opcional)
              </label>
              <input
                value={pontosBadge}
                onChange={(e) => setPontosBadge(e.target.value)}
                placeholder="+10 pts"
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-800">
                Label semanal (opcional)
              </label>
              <input
                value={pontosPorSemanaLabel}
                onChange={(e) => setPontosPorSemanaLabel(e.target.value)}
                placeholder="+10 pts por semana"
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
              />
            </div>

            {/* Logo */}
            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-gray-800">
                Logo URL (opcional)
              </label>
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://... ou /assets/..."
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
              />
              {logoUrl ? (
                <div className="mt-3 flex items-center gap-3">
                  <img
                    src={logoUrl}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover border bg-white"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                  <div className="text-xs text-gray-500">
                    Prévia (se a URL for válida).
                  </div>
                </div>
              ) : null}
            </div>

            {/* Categorias */}
            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-gray-800">
                Categorias / Tags
              </label>

              <div className="mt-2 flex flex-wrap gap-2">
                {categorias.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white text-sm"
                  >
                    {c}
                    <button
                      type="button"
                      onClick={() => removeCategoria(c)}
                      className="text-gray-500 hover:text-gray-800"
                      aria-label={`Remover ${c}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <input
                  value={categoriaInput}
                  onChange={(e) => setCategoriaInput(e.target.value)}
                  placeholder="Ex: Goleiros"
                  className="flex-1 border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCategoria(categoriaInput);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => addCategoria(categoriaInput)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-green-800 text-white font-semibold hover:bg-green-900"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar
                </button>
              </div>

              <div className="text-xs text-gray-500 mt-1">
                Use tags como “Goleiros”, “Base”, “Avançado”, “Mentalidade”.
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => navigate("/treinos")}
              className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 font-semibold"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={salvar}
              className={`px-4 py-2 rounded-xl font-semibold inline-flex items-center justify-center gap-2
                ${
                  canSubmit
                    ? "bg-green-800 text-white hover:bg-green-900"
                    : "bg-gray-300 text-gray-600 cursor-not-allowed"
                }`}
            >
              <Save className="w-4 h-4" />
              {salvando ? "Salvando..." : "Criar metodologia"}
            </button>
          </div>
        </div>
      </div>

      <BottomNav active="treinos" />
    </div>
  );
}
