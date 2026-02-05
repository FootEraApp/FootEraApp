// client/src/pages/metodologias/create.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ChevronLeft,
  Plus,
  X,
  Save,
  Video as VideoIcon,
  Dumbbell,
  Trash2,
  ChevronDown,
} from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import BottomNav from "@/components/layout/BottomNav.js";

type Nivel = "Base" | "Avancado" | "Performance" | "Livre";
type PublicoAlvo = "ATLETAS" | "INSTRUTORES" | "AMBOS";
type ItemTipo = "VIDEO" | "TREINO";

type TreinoProgramadoLite = {
  id: string;
  nome: string;
  pontuacao?: number | null;
};

type MetItemUI = {
  id: string; // local
  tipo: ItemTipo;
  titulo: string;
  descricao?: string;
  // VIDEO
  videoUrl?: string;
  thumbUrl?: string;
  // TREINO
  treinoProgramadoId?: string;
  treinoNome?: string;
  treinoPontuacao?: number;
  // pontuação exibida no item
  pontos: number;
};

type SemanaUI = {
  id: string; // local
  titulo: string; // ex: "Semana 1"
  itens: MetItemUI[];
};

function getToken() {
  return (
    (Storage as any).token ??
    localStorage.getItem("token") ??
    sessionStorage.getItem("token") ??
    ""
  );
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function pontosItemFromTipo(tipo: ItemTipo, treinoPontuacao?: number) {
  if (tipo === "VIDEO") return 15;
  return typeof treinoPontuacao === "number" ? treinoPontuacao : 0;
}

export default function CriarMetodologia() {
  const [, navigate] = useLocation();

  /** =========================
   * Campos do topo
   * ========================= */
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [capaUrl, setCapaUrl] = useState<string>("");

  const [nivel, setNivel] = useState<Nivel>("Base");
  const [publicoAlvo, setPublicoAlvo] = useState<PublicoAlvo>("AMBOS");

  /** =========================
   * Treinos para select
   * ========================= */
  const [treinos, setTreinos] = useState<TreinoProgramadoLite[]>([]);
  const [carregandoTreinos, setCarregandoTreinos] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let cancelled = false;
    (async () => {
      setCarregandoTreinos(true);
      try {
        const r = await fetch(`${API.BASE_URL}/api/treinosprogramados`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const js = await r.json().catch(() => null);
        if (!r.ok) return;

        const items =
          js?.items || js?.treinos || (Array.isArray(js) ? js : []) || [];

        const mapped: TreinoProgramadoLite[] = (items || []).map((t: any) => ({
          id: String(t.id),
          nome: String(t.nome ?? t.titulo ?? "Treino"),
          pontuacao:
            typeof t.pontuacao === "number"
              ? t.pontuacao
              : typeof t.pontuacao === "string"
              ? Number(t.pontuacao)
              : null,
        }));

        if (!cancelled) setTreinos(mapped);
      } catch {
        // silencioso
      } finally {
        if (!cancelled) setCarregandoTreinos(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** =========================
   * Semanas / Itens
   * ========================= */
  const [semanas, setSemanas] = useState<SemanaUI[]>(() => [
    { id: uid("semana"), titulo: "Semana 1", itens: [] },
  ]);

  // ✅ aba ativa (tipo Google)
  const [activeSemanaId, setActiveSemanaId] = useState<string>(() => {
    // garante que inicia na primeira semana
    const first = semanas?.[0]?.id;
    return first || "";
  });

  // se por algum motivo semanas mudar e active ficar inválida, corrige
  useEffect(() => {
    if (!semanas.length) return;
    const exists = semanas.some((s) => s.id === activeSemanaId);
    if (!exists) setActiveSemanaId(semanas[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanas]);

  function addSemana() {
    const newId = uid("semana");
    setSemanas((prev) => {
      const nextIndex = prev.length + 1;
      return [...prev, { id: newId, titulo: `Semana ${nextIndex}`, itens: [] }];
    });
    // ✅ ao criar, já seleciona a nova aba
    setActiveSemanaId(newId);
  }

  function removeSemana(semanaId: string) {
    setSemanas((prev) => {
      const idxRemovida = prev.findIndex((s) => s.id === semanaId);
      const next = prev.filter((s) => s.id !== semanaId);

      // renumera títulos
      const renum = next.map((s, idx) => ({ ...s, titulo: `Semana ${idx + 1}` }));

      // se removeu a semana ativa, escolhe outra pra ficar ativa
      if (activeSemanaId === semanaId) {
        const fallback =
          renum[Math.min(idxRemovida, renum.length - 1)] || renum[0];
        if (fallback?.id) setActiveSemanaId(fallback.id);
      }

      return renum;
    });
  }

  function addItem(semanaId: string, tipo: ItemTipo) {
    setSemanas((prev) =>
      prev.map((s) => {
        if (s.id !== semanaId) return s;

        const novo: MetItemUI = {
          id: uid("item"),
          tipo,
          titulo: tipo === "VIDEO" ? "Vídeo" : "Treino Programado",
          descricao: "",
          videoUrl: "",
          thumbUrl: "",
          treinoProgramadoId: "",
          treinoNome: "",
          treinoPontuacao: 0,
          pontos: tipo === "VIDEO" ? 15 : 0,
        };

        return { ...s, itens: [...s.itens, novo] };
      })
    );
  }

  function removeItem(semanaId: string, itemId: string) {
    setSemanas((prev) =>
      prev.map((s) =>
        s.id === semanaId
          ? { ...s, itens: s.itens.filter((i) => i.id !== itemId) }
          : s
      )
    );
  }

  function updateItem(
    semanaId: string,
    itemId: string,
    patch: Partial<MetItemUI>
  ) {
    setSemanas((prev) =>
      prev.map((s) => {
        if (s.id !== semanaId) return s;
        return {
          ...s,
          itens: s.itens.map((i) => {
            if (i.id !== itemId) return i;

            const merged = { ...i, ...patch };

            const treinoPont =
              merged.tipo === "TREINO" ? merged.treinoPontuacao : undefined;

            merged.pontos = pontosItemFromTipo(merged.tipo, treinoPont);

            return merged;
          }),
        };
      })
    );
  }

  const semanaAtiva = useMemo(() => {
    return semanas.find((s) => s.id === activeSemanaId) ?? semanas[0];
  }, [semanas, activeSemanaId]);

  /** =========================
   * Pontos totais / validações
   * ========================= */
  const pontosTotais = useMemo(() => {
    return semanas.reduce((acc, s) => {
      const sumSemana = s.itens.reduce((a, i) => a + (i.pontos || 0), 0);
      return acc + sumSemana;
    }, 0);
  }, [semanas]);

  const canSubmit = useMemo(() => {
    if (titulo.trim().length < 3) return false;
    if (!nivel) return false;
    if (!publicoAlvo) return false;
    return true;
  }, [titulo, nivel, publicoAlvo]);

  /** =========================
   * Salvar
   * ========================= */
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    setOkMsg(null);

    const token = getToken();
    if (!token) {
      setErro("Sem token. Faça login novamente.");
      return;
    }

    if (!canSubmit) {
      setErro("Preencha título e selecione público e nível.");
      return;
    }

    for (const s of semanas) {
      for (const item of s.itens) {
        if (!item.titulo?.trim()) {
          setErro(`Há um item sem título em ${s.titulo}.`);
          return;
        }
        if (item.tipo === "VIDEO") {
          if (!item.videoUrl?.trim()) {
            setErro(
              `No item "${item.titulo}" de ${s.titulo}, informe o vídeo (URL).`
            );
            return;
          }
        }
        if (item.tipo === "TREINO") {
          if (!item.treinoProgramadoId?.trim()) {
            setErro(
              `No item "${item.titulo}" de ${s.titulo}, selecione um treino programado.`
            );
            return;
          }
        }
      }
    }

    const descricaoFinal = [
      `[#publico:${publicoAlvo}]`,
      `[#nivel:${nivel}]`,
      (descricao || "").trim(),
    ]
      .filter(Boolean)
      .join("\n");

    const payloadMetodologia = {
      titulo: titulo.trim(),
      descricao: descricaoFinal || null,
      capaUrl: (capaUrl || "").trim() || null,
      nivel,
      categorias: [],
      totalSemanas: semanas.length,
    };

    setSalvando(true);
    try {
      const r = await fetch(`${API.BASE_URL}/api/metodologias`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payloadMetodologia),
      });

      const js = await r.json().catch(() => null);
      if (!r.ok) {
        const msg =
          js?.message ||
          js?.error ||
          "Não foi possível criar a metodologia (verifique o backend).";
        throw new Error(msg);
      }

      const metodologiaId = js?.item?.id;
      if (!metodologiaId) throw new Error("Metodologia criada mas não retornou ID.");

      const flatItems: Array<{
        semana: number;
        ordem: number;
        titulo: string;
        descricao?: string | null;
        tipo: "TREINO" | "VIDEO";
        videoUrl?: string | null;
        thumbUrl?: string | null;
        treinoProgramadoId?: string | null;
        pontos?: number | null;
        publicado?: boolean;
      }> = [];

      semanas.forEach((s, idxSemana) => {
        const semanaNum = idxSemana + 1;
        s.itens.forEach((it, idxItem) => {
          flatItems.push({
            semana: semanaNum,
            ordem: idxItem + 1,
            titulo: it.titulo.trim(),
            descricao: (it.descricao || "").trim() || null,
            tipo: it.tipo,
            videoUrl: it.tipo === "VIDEO" ? it.videoUrl?.trim() || null : null,
            thumbUrl: it.tipo === "VIDEO" ? it.thumbUrl?.trim() || null : null,
            treinoProgramadoId:
              it.tipo === "TREINO" ? it.treinoProgramadoId || null : null,
            pontos: it.pontos ?? null,
            publicado: true,
          });
        });
      });

      for (const item of flatItems) {
        const rr = await fetch(
          `${API.BASE_URL}/api/metodologias/${metodologiaId}/itens`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(item),
          }
        );

        const jsi = await rr.json().catch(() => null);
        if (!rr.ok) {
          const msg =
            jsi?.message ||
            jsi?.error ||
            `Falha ao criar item "${item.titulo}" (semana ${item.semana}).`;
          throw new Error(msg);
        }
      }

      setOkMsg("Metodologia criada com sucesso!");
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
              onClick={() => navigate("/metodologias/minhas")}
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
                Configure dados comuns no topo e monte as semanas abaixo.
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

        {/* ===== Topo: Dados comuns ===== */}
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
            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-gray-800">
                Nome da Metodologia *
              </label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Metodologia Base - Domínio e Passe"
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
              />
              <div className="text-xs text-gray-500 mt-1">
                Mínimo 3 caracteres.
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-800">
                Público-alvo *
              </label>
              <div className="mt-1 relative">
                <select
                  value={publicoAlvo}
                  onChange={(e) => setPublicoAlvo(e.target.value as PublicoAlvo)}
                  className="w-full appearance-none border rounded-xl px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-green-200 bg-white"
                >
                  <option value="ATLETAS">Para Atletas</option>
                  <option value="INSTRUTORES">Para Instrutores</option>
                  <option value="AMBOS">Para Ambos</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Serve para filtrar no catálogo (atletas/instrutores).
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-800">
                Nível *
              </label>
              <div className="mt-1 relative">
                <select
                  value={nivel}
                  onChange={(e) => setNivel(e.target.value as Nivel)}
                  className="w-full appearance-none border rounded-xl px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-green-200 bg-white"
                >
                  <option value="Base">Base</option>
                  <option value="Avancado">Avançado</option>
                  <option value="Performance">Performance</option>
                  <option value="Livre">Livre</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                (Base / Avançado / Performance / Livre)
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-gray-800">
                Descrição
              </label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Explique o que entrega, duração, recomendação..."
                className="mt-1 w-full min-h-[110px] border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-gray-800">
                Capa (URL) (opcional)
              </label>
              <input
                value={capaUrl}
                onChange={(e) => setCapaUrl(e.target.value)}
                placeholder="https://... ou /assets/..."
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
              />
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-2xl border bg-neutral-50 p-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    Pontos totais estimados
                  </div>
                  <div className="text-xs text-gray-500">
                    Vídeo = 15 pts / Treino = pontuação do treino programado
                  </div>
                </div>
                <div className="text-lg font-bold text-green-900">
                  +{pontosTotais} pts
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Baixo: Semanas (ABAS HORIZONTAIS) ===== */}
        <div className="mt-4 bg-white rounded-2xl border shadow-sm p-4 sm:p-6">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                Semanas e Conteúdos
              </h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Clique nas abas para alternar as semanas.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 overflow-x-auto">
                <div className="inline-flex items-center gap-2 pb-1">
                  {semanas.map((s, idx) => {
                    const isActive = s.id === activeSemanaId;
                    const pts = s.itens.reduce((a, i) => a + (i.pontos || 0), 0);

                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveSemanaId(s.id)}
                        className={[
                          "shrink-0 px-3 py-2 rounded-xl border text-sm font-semibold",
                          "transition",
                          isActive
                            ? "bg-green-800 text-white border-green-800"
                            : "bg-white hover:bg-gray-50 text-gray-800 border-gray-200",
                        ].join(" ")}
                        title={`${s.titulo} • +${pts} pts`}
                      >
                        {`Semana ${idx + 1}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={addSemana}
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-800 text-white font-semibold hover:bg-green-900"
              >
                <Plus className="w-4 h-4" />
                Semana
              </button>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              Dica: role horizontalmente se tiver muitas semanas.
            </div>
          </div>

          {/* Conteúdo da semana ativa */}
          {semanaAtiva ? (
            <div className="mt-4 rounded-2xl border bg-white">
              {/* Header Semana Ativa */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b">
                <div>
                  <div className="text-sm font-bold text-gray-900">
                    {semanaAtiva.titulo}
                  </div>
                  <div className="text-xs text-gray-500">
                    {semanaAtiva.itens.length} item(s) • +{semanaAtiva.itens.reduce((a, i) => a + (i.pontos || 0), 0)} pts
                  </div>
                </div>

                <div className="flex gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => addItem(semanaAtiva.id, "VIDEO")}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm font-semibold"
                  >
                    <VideoIcon className="w-4 h-4" />
                    Vídeo (+15)
                  </button>

                  <button
                    type="button"
                    onClick={() => addItem(semanaAtiva.id, "TREINO")}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm font-semibold"
                  >
                    <Dumbbell className="w-4 h-4" />
                    Treino
                  </button>

                  <button
                    type="button"
                    onClick={() => removeSemana(semanaAtiva.id)}
                    disabled={semanas.length === 1}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold
                      ${
                        semanas.length === 1
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white hover:bg-gray-50 text-red-700"
                      }`}
                    title={
                      semanas.length === 1
                        ? "Você precisa ter ao menos 1 semana"
                        : "Excluir semana"
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                </div>
              </div>

              {/* Itens da semana ativa */}
              <div className="p-4 space-y-3">
                {semanaAtiva.itens.length === 0 ? (
                  <div className="rounded-xl border bg-neutral-50 p-4 text-sm text-gray-600">
                    Nenhum item ainda. Use <b>Vídeo</b> ou <b>Treino</b>.
                  </div>
                ) : null}

                {semanaAtiva.itens.map((it, idxItem) => (
                  <div key={it.id} className="rounded-2xl border bg-white p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl border bg-neutral-50 flex items-center justify-center">
                          {it.tipo === "VIDEO" ? (
                            <VideoIcon className="w-4 h-4 text-gray-700" />
                          ) : (
                            <Dumbbell className="w-4 h-4 text-gray-700" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs px-2 py-1 rounded-full border bg-white">
                              {it.tipo === "VIDEO" ? "VÍDEO" : "TREINO"}
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full border bg-green-50 text-green-900">
                              +{it.pontos} pts
                            </span>
                            <span className="text-xs text-gray-400">
                              Item {idxItem + 1}
                            </span>
                          </div>

                          <div className="mt-2">
                            <label className="text-xs font-semibold text-gray-700">
                              Título do item *
                            </label>
                            <input
                              value={it.titulo}
                              onChange={(e) =>
                                updateItem(semanaAtiva.id, it.id, {
                                  titulo: e.target.value,
                                })
                              }
                              placeholder={
                                it.tipo === "VIDEO"
                                  ? "Ex: Aula 1 - Controle Orientado"
                                  : "Ex: Treino 1 - Fundamentos"
                              }
                              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(semanaAtiva.id, it.id)}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm font-semibold text-red-700"
                      >
                        <X className="w-4 h-4" />
                        Remover
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="lg:col-span-2">
                        <label className="text-xs font-semibold text-gray-700">
                          Descrição (opcional)
                        </label>
                        <textarea
                          value={it.descricao || ""}
                          onChange={(e) =>
                            updateItem(semanaAtiva.id, it.id, {
                              descricao: e.target.value,
                            })
                          }
                          placeholder="Instruções, objetivo, observações..."
                          className="mt-1 w-full min-h-[90px] border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
                        />
                      </div>

                      {it.tipo === "VIDEO" ? (
                        <>
                          <div className="lg:col-span-2">
                            <label className="text-xs font-semibold text-gray-700">
                              URL do vídeo *
                            </label>
                            <input
                              value={it.videoUrl || ""}
                              onChange={(e) =>
                                updateItem(semanaAtiva.id, it.id, {
                                  videoUrl: e.target.value,
                                })
                              }
                              placeholder="https://... (upload do instrutor) ou link"
                              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
                            />
                            <div className="text-[11px] text-gray-500 mt-1">
                              Cada vídeo vale <b>15 pontos</b>.
                            </div>
                          </div>

                          <div className="lg:col-span-2">
                            <label className="text-xs font-semibold text-gray-700">
                              Thumbnail (URL) (opcional)
                            </label>
                            <input
                              value={it.thumbUrl || ""}
                              onChange={(e) =>
                                updateItem(semanaAtiva.id, it.id, {
                                  thumbUrl: e.target.value,
                                })
                              }
                              placeholder="https://... (opcional)"
                              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
                            />
                          </div>
                        </>
                      ) : null}

                      {it.tipo === "TREINO" ? (
                        <div className="lg:col-span-2">
                          <label className="text-xs font-semibold text-gray-700">
                            Treino Programado *
                          </label>

                          <div className="mt-1 relative">
                            <select
                              value={it.treinoProgramadoId || ""}
                              onChange={(e) => {
                                const id = e.target.value;
                                const t = treinos.find((x) => x.id === id);

                                updateItem(semanaAtiva.id, it.id, {
                                  treinoProgramadoId: id,
                                  treinoNome: t?.nome || "",
                                  treinoPontuacao:
                                    typeof t?.pontuacao === "number"
                                      ? t?.pontuacao
                                      : 0,
                                });
                              }}
                              className="w-full appearance-none border rounded-xl px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-green-200 bg-white"
                            >
                              <option value="">
                                {carregandoTreinos
                                  ? "Carregando treinos..."
                                  : treinos.length
                                  ? "Selecione um treino"
                                  : "Nenhum treino disponível"}
                              </option>
                              {treinos.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.nome}
                                  {typeof t.pontuacao === "number"
                                    ? ` (+${t.pontuacao} pts)`
                                    : ""}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          <div className="text-[11px] text-gray-500 mt-1">
                            A pontuação é a do treino programado (campo{" "}
                            <b>pontuacao</b>).
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Footer actions */}
          <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => navigate("/metodologias/minhas")}
              className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 font-semibold"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={!canSubmit || salvando}
              onClick={salvar}
              className={`px-4 py-2 rounded-xl font-semibold inline-flex items-center justify-center gap-2
                ${
                  canSubmit && !salvando
                    ? "bg-green-800 text-white hover:bg-green-900"
                    : "bg-gray-300 text-gray-600 cursor-not-allowed"
                }`}
            >
              <Save className="w-4 h-4" />
              {salvando ? "Salvando..." : "Criar metodologia"}
            </button>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Dica: se você quiser salvar “público-alvo” no banco de forma correta,
            a gente adiciona um campo no schema (enum) e faz migration.
          </div>
        </div>
      </div>

      <BottomNav active="treinos" />
    </div>
  );
}
