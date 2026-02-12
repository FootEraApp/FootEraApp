import React, { useEffect, useMemo, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { ArrowLeft, Lock, Play, CheckCircle2 } from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API, APP } from "../../config.js";

const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

type ItemTipo = "VIDEO" | "TREINO" | string;

type MetodologiaItem = {
  id: string;
  semana: number;
  ordem: number;
  titulo: string;
  descricao?: string | null;
  tipo: ItemTipo;
  pontos?: number | null;

  // video
  videoUrl?: string | null;
  thumbUrl?: string | null;
  duracaoMin?: number | null;

  // treino
  treinoProgramadoId?: string | null;
  treinoProgramado?: { id: string; nome: string; imagemUrl?: string | null } | null;

  publicado?: boolean;
};

type MetodologiaDetalhe = {
  id: string;
  titulo: string;
  descricao?: string | null;
  capaUrl?: string | null;

  publicoAlvo?: "ATLETAS" | "PROFISSIONAIS" | "AMBOS" | string;
  totalSemanas?: number | null;

  totalAssinantes?: number;
  mediaAvaliacao?: number | null;
  totalReviews?: number;

  pontosTotal?: number; // vindo do backend (soma dos itens)
  criadorNome?: string | null;

  itens: MetodologiaItem[];

  // estado do usuário (backend decide)
  viewer: {
    isAssinante: boolean;
    podeAssinarAgora: boolean;
    motivoBloqueio?: string | null; // ex: "PRECISA_LEARNING", "LIMITE_MES", "JA_ESCOLHIDA_NO_MES"
    progresso: {
      concluidos: string[]; // ids de itens concluídos
    };
  };
};

function normalizeMediaUrl(raw?: string | null) {
  if (!raw) return null;
  const u = String(raw).trim();
  if (!u) return null;

  // já é absoluta
  if (u.startsWith("http://") || u.startsWith("https://")) return u;

  // se vier "uploads/arquivo.png" -> vira "/uploads/arquivo.png"
  if (u.startsWith("uploads/")) return `${API.BASE_URL}/${u}`;

  // se vier "/uploads/arquivo.png" ou "/assets/..."
  if (u.startsWith("/")) return `${API.BASE_URL}${u}`;

  return u; // fallback
}

function Stars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, value || 0));
  const full = Math.round(v); // simples
  return (
    <div className="flex items-center gap-[2px]">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < full ? "text-amber-500" : "text-gray-300"}>
          ★
        </span>
      ))}
    </div>
  );
}

export default function MetodologiaUnicaPage() {
  const [, params] = useRoute("/metodologias/:id");
  const [, navigate] = useLocation();

  const id = params?.id;
  const token = Storage.token;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MetodologiaDetalhe | null>(null);
  const [busy, setBusy] = useState(false);
  const [thumbFromVideo, setThumbFromVideo] = useState<Record<string, string>>({});

  async function gerarThumbDoVideo(itemId: string, videoUrl: string) {
    try {
        setThumbFromVideo((prev) => {
            if (prev[itemId]) return prev;
            return prev; // mantém igual por enquanto
        });

        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.src = normalizeMediaUrl(videoUrl) || videoUrl;
        video.muted = true;
        video.playsInline = true;

        await new Promise<void>((resolve, reject) => {
        video.addEventListener("loadeddata", () => resolve(), { once: true });
        video.addEventListener("error", () => reject(new Error("video error")), { once: true });
        });

        video.currentTime = 0.1;

        await new Promise<void>((resolve) => {
        video.addEventListener("seeked", () => resolve(), { once: true });
        });

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);

        setThumbFromVideo((prev) => ({ ...prev, [itemId]: dataUrl }));
    } catch {
        // se falhar, fica fallback
    }
    }

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API.BASE_URL}/api/metodologias/${id}/detalhe`, { headers });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          alert(j?.message || "Erro ao carregar metodologia");
          navigate("/treinos"); // ou /metodologias
          return;
        }
        setData(j);
      } catch (e) {
        console.error(e);
        alert("Erro ao carregar metodologia");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, headers, navigate]);

  const grouped = useMemo(() => {
    const itens = data?.itens || [];
    const map = new Map<number, MetodologiaItem[]>();
    for (const it of itens) {
      if (it.publicado === false) continue;
      const arr = map.get(it.semana) || [];
      arr.push(it);
      map.set(it.semana, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
      map.set(k, arr);
    }
    const weeks = Array.from(map.keys()).sort((a, b) => a - b);
    return weeks.map((w) => ({ semana: w, itens: map.get(w)! }));
  }, [data]);

  useEffect(() => {
    if (!data?.itens?.length) return;

    // pega todos os vídeos publicados que não têm thumbUrl
    const videosSemThumb = data.itens.filter((it) => {
        const isVideo = String(it.tipo).toUpperCase() === "VIDEO";
        return (
        isVideo &&
        it.publicado !== false &&
        !it.thumbUrl &&
        !!it.videoUrl
        );
    });

    // gera thumb para os que ainda não temos no state
    videosSemThumb.forEach((it) => {
        if (thumbFromVideo[it.id]) return;
        gerarThumbDoVideo(it.id, it.videoUrl!);
    });

    // NÃO coloque gerarThumbDoVideo nas deps; ela é função estável no mesmo render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, thumbFromVideo]);

  const concluIds = useMemo(() => new Set(data?.viewer?.progresso?.concluidos || []), [data]);
  const totalItens = useMemo(() => (data?.itens?.filter((i) => i.publicado !== false).length || 0), [data]);
  const totalConcluidos = useMemo(() => (data?.viewer?.progresso?.concluidos?.length || 0), [data]);

  const pct = totalItens > 0 ? Math.round((totalConcluidos / totalItens) * 100) : 0;

  async function assinarMetodologia() {
    if (!data || !id) return;

    // 1) Se o backend disser que não pode assinar agora, decide o destino certo:
    if (!data.viewer.podeAssinarAgora) {
        const motivo = String(data.viewer?.motivoBloqueio || "");
        const label =
        data.viewer?.isAssinante
            ? "✅ Assinada"
            : (motivo === "LIMITE_METODOLOGIAS" || motivo === "JA_ESCOLHIDA_NO_MES")
            ? "Ver minhas metodologias"
            : (motivo === "PRECISA_LEARNING" || motivo === "PRECISA_PAGAR")
                ? "Ativar Learning"
                : "Assinar metodologia";

        // A) Não tem Learning ativo -> vai pro pagamento (com return)
        if (motivo === "PRECISA_LEARNING" || motivo === "PRECISA_PAGAR") {
        navigate(`/pagamentos?produto=learning&returnTo=/metodologias/${id}`);
        return;
        }

        // B) Já atingiu limite (1/1 ou 3/3) -> vai pra Minhas Metodologias
        if (motivo === "LIMITE_METODOLOGIAS" || motivo === "JA_ESCOLHIDA_NO_MES") {
        alert("Você já atingiu o limite de metodologias do seu plano neste ciclo.");
        navigate("/metodologias/minhas");
        return;
        }

        // fallback
        navigate("/pagamentos");
        return;
    }

    // 2) Pode assinar: tenta “selecionar” essa metodologia
    try {
        setBusy(true);

        const r = await fetch(`${API.BASE_URL}/api/metodologias/${id}/assinar`, {
        method: "POST",
        headers,
        });

        const j = await r.json().catch(() => ({}));

        if (!r.ok) {
        // Se backend responder que precisa pagar, também joga pro pagamento
        if (j?.code === "PRECISA_PAGAR" || j?.code === "PRECISA_LEARNING") {
            navigate(`/pagamentos?produto=learning&returnTo=/metodologias/${id}`);
            return;
        }

        // Se backend responder limite
        if (j?.code === "LIMITE_METODOLOGIAS") {
            alert(j?.message || "Você já atingiu o limite do seu plano.");
            navigate("/metodologias/minhas");
            return;
        }

        alert(j?.message || "Não foi possível assinar");
        return;
        }

        // sucesso: redireciona para Minhas Metodologias (ou recarrega detalhe)
        alert("✅ Metodologia adicionada em 'Minhas Metodologias'!");
        navigate("/metodologias/minhas");
    } catch (e) {
        console.error(e);
        alert("Erro ao assinar");
    } finally {
        setBusy(false);
    }
    }

  function bloquearAcao(): boolean {
    return !(data?.viewer?.isAssinante);
  }

  if (loading) return <div className="p-6">Carregando metodologia...</div>;
  if (!data) return <div className="p-6">Metodologia não encontrada.</div>;

  const rating = Number(data.mediaAvaliacao ?? 0);
  const reviews = Number(data.totalReviews ?? 0);
  const pontosTotal = Number(data.pontosTotal ?? 0);
  const assinaturas = Number(data.totalAssinantes ?? 0);
  const capaHeader = normalizeMediaUrl(data.capaUrl) || AVATAR_FALLBACK;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <Link
        href="/treinos"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-green-800 bg-white text-green-900 shadow-sm hover:bg-green-50"
        aria-label="Voltar"
        title="Voltar"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      {/* HEADER */}
      <div className="mt-4 rounded-2xl border bg-white p-4 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <img
            src={capaHeader}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = AVATAR_FALLBACK;
            }}
            className="h-20 w-20 md:h-24 md:w-24 rounded-2xl border object-cover bg-white"
            alt={data.titulo}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-full text-[11px] font-semibold border bg-white">
                    {String(data.publicoAlvo ?? "AMBOS")}
                  </span>
                  <h1 className="text-xl md:text-2xl font-bold truncate">{data.titulo}</h1>
                </div>

                <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                  <Stars value={rating} />
                  <span className="font-semibold text-gray-800">{rating.toFixed(1)}</span>
                  <span>({reviews})</span>
                  <span className="text-gray-400">•</span>
                  <span><b>{assinaturas}</b> assinaturas</span>
                </div>

                <div className="mt-2 text-sm text-gray-700 space-y-1">
                <div>{data.totalSemanas ?? grouped.length} semanas</div>

                <div>
                    + <b>{pontosTotal}</b> pts no total
                </div>

                {data.criadorNome ? (
                    <div>
                    Criado por: <b>{data.criadorNome}</b>
                    </div>
                ) : null}
                </div>
                {data.descricao ? (
                  <p className="mt-3 text-sm text-gray-600">{data.descricao}</p>
                ) : null}
              </div>

              {/* CTA */}
              <div className="flex flex-col items-end gap-2">
                <button
                  disabled={busy || !!data?.viewer?.isAssinante}
                  onClick={assinarMetodologia}
                  className="px-4 py-2 rounded-full bg-green-800 text-white font-semibold hover:bg-green-900 disabled:opacity-60"
                >
                  {(() => {
                    const motivo = String(data.viewer?.motivoBloqueio || "");

                    if (data.viewer?.isAssinante) return "✅ Escolhida";
                    if (motivo === "PRECISA_LEARNING" || motivo === "PRECISA_PAGAR") return "Ativar Learning";
                    if (motivo === "LIMITE_METODOLOGIAS" || motivo === "JA_ESCOLHIDA_NO_MES") return "Ver minhas metodologias";
                    return "Assinar metodologia";
                   })()}

                </button>

                {!data.viewer?.isAssinante && (
                  <div className="text-xs text-gray-500 text-right max-w-[240px]">
                   {(() => {
                    const motivo = String(data.viewer?.motivoBloqueio || "");
                    const label =
                    data.viewer?.isAssinante
                        ? "✅ Assinada"
                        : (motivo === "LIMITE_METODOLOGIAS" || motivo === "JA_ESCOLHIDA_NO_MES")
                        ? "Ver minhas metodologias"
                        : (motivo === "PRECISA_LEARNING" || motivo === "PRECISA_PAGAR")
                            ? "Ativar Learning"
                            : "Assinar metodologia";

                    if (motivo === "PRECISA_LEARNING" || motivo === "PRECISA_PAGAR")
                        return "Para assinar, você precisa ativar o Learning. Clique para ir ao pagamento.";

                    if (motivo === "LIMITE_METODOLOGIAS" || motivo === "JA_ESCOLHIDA_NO_MES")
                        return "Você já atingiu o limite de metodologias do seu plano neste ciclo. Clique para ver 'Minhas Metodologias'.";

                    return "Assine para iniciar os conteúdos (vídeos/treinos).";
                    })()}

                  </div>
                )}
              </div>
            </div>

            {/* PROGRESSO */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>
                  {totalConcluidos}/{totalItens} concluídos
                </span>
                <span>{pct}%</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-green-700" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SEMANAS */}
      <div className="mt-6 space-y-4">
        {grouped.map((w) => (
          <div key={w.semana} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-gray-900">Semana {w.semana}</div>
              <div className="text-xs text-gray-600">
                {w.itens.filter((i) => concluIds.has(i.id)).length}/{w.itens.length} concluídos
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {w.itens.map((it) => {
                const isVideo = String(it.tipo).toUpperCase() === "VIDEO";
                const isTreino = String(it.tipo).toUpperCase() === "TREINO";
                const concluido = concluIds.has(it.id);
                const locked = bloquearAcao();
                const thumb =
                    (isVideo ? (normalizeMediaUrl(it.thumbUrl) || thumbFromVideo[it.id] || null) : null) ||
                    (isTreino ? normalizeMediaUrl(it.treinoProgramado?.imagemUrl) : null) ||
                    AVATAR_FALLBACK;

                return (
                  <div key={it.id} className="rounded-xl border p-3 flex items-center gap-3">
                    <img
                      src={thumb || AVATAR_FALLBACK}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = AVATAR_FALLBACK;
                      }}
                      className="h-16 w-28 rounded-lg border object-cover bg-white flex-shrink-0"
                      alt={it.titulo}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{it.titulo}</div>
                          {it.descricao ? (
                            <div className="text-sm text-gray-600 line-clamp-2">{it.descricao}</div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="px-2 py-1 rounded-full text-xs border bg-amber-50 text-amber-900">
                            + {Number(it.pontos ?? 0)} pts
                          </span>

                          {concluido ? (
                            <span className="px-2 py-1 rounded-full text-xs border bg-emerald-50 text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> Concluído
                            </span>
                          ) : locked ? (
                            <span className="px-2 py-1 rounded-full text-xs border bg-gray-50 text-gray-700 flex items-center gap-1">
                              <Lock className="w-4 h-4" /> Bloqueado
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="text-xs text-gray-500">
                          {isVideo && it.duracaoMin ? `${it.duracaoMin} min` : ""}
                        </div>

                        {/* BOTÕES */}
                        <div className="flex gap-2">
                          {isVideo && (
                            <button
                              disabled={locked}
                              className="px-3 py-2 rounded-lg bg-green-800 text-white text-sm font-semibold hover:bg-green-900 disabled:opacity-60"
                              onClick={() => {
                                if (locked) return;
                                // ✅ aqui você abre o player (modal ou rota)
                                // exemplo simples:
                                window.open(it.videoUrl || "#", "_blank");
                              }}
                            >
                              {concluido ? "Ver novamente" : "Assistir"}
                            </button>
                          )}

                          {isTreino && (
                            <button
                              disabled={locked}
                              className="px-3 py-2 rounded-lg bg-green-800 text-white text-sm font-semibold hover:bg-green-900 disabled:opacity-60 flex items-center gap-2"
                              onClick={() => {
                                if (locked) return;
                                // ✅ ir para treino
                                if (it.treinoProgramadoId) {
                                  navigate(`/treinos/unico?programadoId=${it.treinoProgramadoId}`);
                                }
                              }}
                            >
                              <Play className="w-4 h-4" />
                              {concluido ? "Ver novamente" : "Iniciar"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!data.viewer.isAssinante && (
              <div className="mt-3 text-xs text-gray-500">
                * Assine para desbloquear os conteúdos desta metodologia.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}