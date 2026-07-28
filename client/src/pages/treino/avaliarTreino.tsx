import { toast } from "@/lib/toast";
import { useMemo, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

export default function AvaliarTreino() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const treinoAgendadoId = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("treinoAgendadoId") || "";
  }, []);

  const submissaoTreinoId = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("submissaoTreinoId") || "";
  }, []);

  const tituloParam = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("titulo") || "";
  }, []);

  const [titulo, setTitulo] = useState<string>(tituloParam || "Treino");
  const [nota, setNota] = useState<number>(0);
  const [comentario, setComentario] = useState<string>("");
  const [enviando, setEnviando] = useState(false);
  const [sentimento, setSentimento] = useState<"ruim" | "medio" | "otimo" | "">("");
  const podeEnviar = nota > 0 && sentimento !== "" && !enviando;

  useEffect(() => {
    if (tituloParam) setTitulo(tituloParam);
  }, [tituloParam]);

  useEffect(() => {
    async function carregarTitulo() {
      try {
        if (tituloParam && tituloParam !== "Treino") {
          setTitulo(tituloParam);
          return;
        }

        if (!treinoAgendadoId) return;

        const token = getToken();
        if (!token) return;

        const r = await fetch(`${API.BASE_URL}/api/treinos/agendados`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;

        const js = await r.json();
        const listaRaw: any[] = Array.isArray(js) ? js : js.items ?? [];

        const item = listaRaw.find(
          (x) => String(x?.id ?? "").trim() === String(treinoAgendadoId).trim()
        );
        if (!item) return;

        const snap =
          item?.titulo ??
          item?.treinoTituloSnapshot ??
          item?.treinoProgramado?.nome ??
          item?.treinoProgramado?.titulo ??
          "";

        if (snap && snap !== "Treino") {
          setTitulo(String(snap));
          return;
        }

        const tpId = String(item?.treinoProgramadoId ?? "");
        if (!tpId) {
          setTitulo("Treino");
          return;
        }

        const candidates = [
          `${API.BASE_URL}/api/treinosprogramados/${tpId}`,
          `${API.BASE_URL}/api/treinos/programados/${tpId}`,
          `${API.BASE_URL}/api/treinos/programados/id/${tpId}`,
        ];

        for (const url of candidates) {
          const r2 = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!r2.ok) continue;

          const tp = await r2.json().catch(() => null);
          const nome =
            tp?.nome ?? tp?.titulo ?? tp?.treino?.nome ?? tp?.treino?.titulo ?? "";

          if (nome) {
            setTitulo(String(nome));
            return;
          }
        }

        setTitulo("Treino");
      } catch (e) {
        console.warn("[AvaliarTreino] falha ao carregar título:", e);
      }
    }

    carregarTitulo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treinoAgendadoId, tituloParam]);

  async function atualizarPerfilAposTreino() {
    await Promise.all([
      qc.invalidateQueries({
        queryKey: ["treinosAgendados"],
      }),

      qc.invalidateQueries({
        queryKey: ["perfilResumoTreinos"],
      }),

      qc.invalidateQueries({
        queryKey: ["pontuacaoPerfil"],
      }),

      qc.invalidateQueries({
        queryKey: ["perfilAtividades"],
      }),

      qc.invalidateQueries({
        queryKey: ["conquistas-earned"],
      }),
    ]);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("treino:concluido"));
      window.dispatchEvent(new Event("treino:avaliado"));
      window.dispatchEvent(new Event("perfil:refresh"));
    }
  }

  async function enviar() {
    try {
      const token = getToken();
      if (!token) {
        toast.error("Você precisa estar logado.");
        return;
      }

      if (!treinoAgendadoId) {
        toast.error("TreinoAgendadoId não encontrado na URL.");
        return;
      }

      if (nota <= 0) {
        toast.error("Escolha uma nota com estrelas.");
        return;
      }

      if (!sentimento) {
        toast.error("Escolha como foi o treino.");
        return;
      }
      setEnviando(true);

      const payload = {
        treinoAgendadoId,
        submissaoTreinoId: submissaoTreinoId || null,
        nota, 
        sentimento,
        comentario: comentario.trim() || null,
        concluiu: true,
        teveDificuldade: false,
        dificuldadeMotivo: null,
        motivoNaoConcluiu: null,
        motivoNaoConcluiuOutro: null
      };

      const r = await fetch(`${API.BASE_URL}/api/treinos/avaliacoes`, {
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

      await atualizarPerfilAposTreino();
      
      toast.success("Avaliação enviada! ✅");
      navigate("/treinos");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao enviar avaliação");
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
            Avaliação do Treino
          </div>

          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-5">
        <div className="bg-transparent rounded-2xl shadow-sm border p-5">
          <div className="text-lg text-gray-500 mb-1 font-semibold">Treino</div>
          <div className="text-xl font-extrabold text-green-900 mb-4">
            {titulo}
          </div>

          <div className="border rounded-xl p-4 bg-neutral-50">
            <div className="text-base font-bold mb-2">Como você avalia esse treino?*</div>
            <Stars value={nota} onChange={setNota} />

            <div className="mt-5 text-base font-bold">Comentário (opcional)</div>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Escreva um comentário sobre o treino..."
              className="mt-2 w-full min-h-[96px] rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-green-200"
            />

            <div className="mt-4">
              <div className="text-base font-bold mb-3">
                Como foi o treino?*
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "ruim", emoji: "😞", label: "Ruim" },
                  { key: "medio", emoji: "😐", label: "Médio" },
                  { key: "otimo", emoji: "😄", label: "Ótimo" },
                ].map((op) => (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => setSentimento(op.key as any)}
                    className={`rounded-xl border p-4 text-center transition ${
                      sentimento === op.key
                        ? "border-green-800 bg-green-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="text-4xl">{op.emoji}</div>
                    <div className="mt-2 text-sm font-semibold">{op.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={!podeEnviar}
              onClick={enviar}
              className={`mt-7 w-full h-12 rounded-xl text-white font-semibold ${
                podeEnviar
                  ? "bg-green-800 hover:bg-green-900"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {enviando ? "Enviando..." : "Enviar"}
            </button>

            <div className="mt-3 text-center">
              <Link href="/treinos" className="text-sm text-gray-500 underline">
                Pular avaliação
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}