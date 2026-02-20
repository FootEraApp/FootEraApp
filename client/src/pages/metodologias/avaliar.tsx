// client/src/pages/metodologias/avaliar.tsx
import React, { useMemo, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Star as StarIcon, ArrowLeft, Volleyball } from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";

const getToken = () =>
  (Storage as any).token ??
  localStorage.getItem("token") ??
  sessionStorage.getItem("token") ??
  "";

function Stars({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: 5 }).map((_, i) => {
        const v = i + 1;
        const filled = v <= value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className="p-1"
            aria-label={`Nota ${v}`}
          >
            <StarIcon
              className={`w-8 h-8 ${
                filled ? "text-amber-500 fill-amber-500" : "text-gray-300"
              }`}
            />
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onChange(0)}
        className="ml-2 text-xs text-gray-500 underline"
      >
        zerar
      </button>
    </div>
  );
}

export default function AvaliarMetodologia() {
  const [, navigate] = useLocation();
  const [location] = useLocation();

  const params = useMemo(() => {
    const q = location.split("?")[1] ?? "";
    return new URLSearchParams(q);
  }, [location]);

  const metodologiaId = useMemo(() => params.get("metodologiaId") || "", [params]);

  // opcional: se você tiver uma tabela tipo "MetodologiaUsuario" (assinatura/progresso),
  // pode passar esse id também na URL e salvar junto no backend.
  const metodologiaUsuarioId = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("metodologiaUsuarioId") || "";
  }, []);

  const [titulo, setTitulo] = useState<string>("Metodologia");
  const [nota, setNota] = useState<number>(0);
  const [comentario, setComentario] = useState<string>("");

  // “ocorreu tudo certo” vs “teve problema”
  const [ocorreuTudoCerto, setOcorreuTudoCerto] = useState<boolean>(true);
  const [teveProblema, setTeveProblema] = useState<boolean>(false);
  const [problemaTexto, setProblemaTexto] = useState<string>("");

  // extras parecidos com treino (se você quiser manter)
  const [teveDificuldade, setTeveDificuldade] = useState<boolean>(false);
  const [dificuldadeMotivo, setDificuldadeMotivo] = useState<string>("");

  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    async function carregarTituloPorId() {
        try {
        if (!metodologiaId) return;

        const token = getToken();
        if (!token) return;

        // ✅ prefira o /detalhe pq você já tem ele no backend
        const candidates = [
            `${API.BASE_URL}/api/metodologias/${metodologiaId}/detalhe`,
            `${API.BASE_URL}/api/metodologias/${metodologiaId}`,
        ];

        for (const url of candidates) {
            const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!r.ok) continue;

            const js = await r.json().catch(() => null);

            // /detalhe retorna { titulo: ... }
            // /:id retorna { item: { titulo: ... } }
            const t = js?.titulo ?? js?.item?.titulo ?? js?.metodologia?.titulo;
            if (t) {
            setTitulo(String(t));
            return;
            }
        }

        setTitulo("Metodologia");
        } catch (e) {
        console.warn("[AvaliarMetodologia] falha ao carregar título:", e);
        }
    }

    carregarTituloPorId();
  }, [metodologiaId]);

  async function enviar() {
    try {
      const token = getToken();
      if (!token) {
        alert("Você precisa estar logado.");
        return;
      }

      if (!metodologiaId) {
        alert("metodologiaId não encontrado na URL.");
        return;
      }

      setEnviando(true);

      const payload = {
        metodologiaId,
        nota,
        comentario: comentario.trim() || null,
      };

      const r = await fetch(`${API.BASE_URL}/api/metodologias/avaliacoes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const js = await r.json().catch(() => null);
        throw new Error(js?.error || js?.message || "Falha ao salvar avaliação");
      }

      alert("Avaliação enviada! ✅");
      localStorage.setItem(`metodologia:avaliada:${metodologiaId}`, "1");
      navigate("/treinos");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Erro ao enviar avaliação");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="h-20 bg-green-900 text-white">
        <div className="max-w-3xl mx-auto h-full px-4 flex items-center justify-between">
          <Link
            href="/treinos"
            aria-label="Voltar para treinos"
            className="inline-flex h-10 w-10 items-center justify-center
              rounded-full border border-green-800 bg-white text-green-900
              shadow-sm hover:bg-green-50 focus:outline-none
              focus:ring-2 focus:ring-green-700/30 mt-2 ml-2 mb-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="flex items-center gap-2 font-extrabold tracking-wide">
            <Volleyball className="w-5 h-5 opacity-80 " />
            Avaliação da Metodologia
          </div>

          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-5">
        <div className="bg-transparent rounded-2xl shadow-sm border p-5">
          <div className="text-lg text-gray-500 mb-1 font-semibold">
            Metodologia
          </div>
          <div className="text-xl font-extrabold text-green-900 mb-4">
            {titulo}
          </div>

          <div className="border rounded-xl p-4 bg-neutral-50">
            <div className="text-base font-bold mb-2">
              Como você avalia essa metodologia?
            </div>
            <Stars value={nota} onChange={setNota} />

            <div className="mt-5 text-base font-bold">
              Ocorreu tudo certo?
            </div>
            <div className="mt-2">
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="radio"
                  checked={ocorreuTudoCerto === true}
                  onChange={() => {
                    setOcorreuTudoCerto(true);
                    setTeveProblema(false);
                    setProblemaTexto("");
                  }}
                />
                <span>Sim, tudo certo ✅</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={ocorreuTudoCerto === false}
                  onChange={() => {
                    setOcorreuTudoCerto(false);
                    setTeveProblema(true);
                  }}
                />
                <span>Não, tive algum problema ⚠️</span>
              </label>

              {(!ocorreuTudoCerto || teveProblema) && (
                <textarea
                  value={problemaTexto}
                  onChange={(e) => setProblemaTexto(e.target.value)}
                  placeholder="Descreva o que aconteceu (bug, conteúdo faltando, vídeo não abriu, etc.)"
                  className="mt-3 w-full min-h-[90px] rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-green-200"
                />
              )}
            </div>

            <div className="mt-6">
              <div className="text-base font-bold mb-2">
                Teve alguma dificuldade para acompanhar?
              </div>

              <label className="flex items-center gap-2 mb-2">
                <input
                  type="radio"
                  checked={teveDificuldade === false}
                  onChange={() => setTeveDificuldade(false)}
                />
                <span>Não</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={teveDificuldade === true}
                  onChange={() => setTeveDificuldade(true)}
                />
                <span>Sim</span>
              </label>

              {teveDificuldade && (
                <input
                  value={dificuldadeMotivo}
                  onChange={(e) => setDificuldadeMotivo(e.target.value)}
                  placeholder="Qual foi a dificuldade?"
                  className="mt-3 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-green-200"
                />
              )}
            </div>

            <div className="mt-6 text-base font-bold">Comentário</div>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Escreva um comentário sobre a metodologia..."
              className="mt-2 w-full min-h-[96px] rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-green-200"
            />

            <button
              disabled={enviando}
              onClick={enviar}
              className={`mt-7 w-full h-12 rounded-xl text-white font-semibold ${
                enviando ? "bg-gray-300" : "bg-green-800 hover:bg-green-900"
              }`}
            >
              {enviando ? "Enviando..." : "Enviar"}
            </button>

            <div className="mt-3 text-center">
              <Link
                href="/treinos"
                className="text-sm text-gray-500 underline"
              >
                Pular avaliação
              </Link>
            </div>

            {!metodologiaId && (
              <div className="mt-4 text-xs text-red-600">
                ⚠️ metodologiaId não veio na URL. Abra assim:
                <br />
                <span className="break-all">
                  /metodologias/avaliar?metodologiaId=SEU_ID
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}