"use client";

import { useEffect, useState } from "react";
import { API } from "../../config.js";

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

type Props = {
  exercicioId?: string | null;
  returnTo?: string;
};

const OPCOES_TIPO = [
  { value: "Tecnico", label: "Técnico" },
  { value: "Fisico", label: "Físico" },
  { value: "Tatico", label: "Tático" },
  { value: "Mental", label: "Mental" },
];

const OPCOES_NIVEL = [
  { value: "Base", label: "Base" },
  { value: "Avancado", label: "Avançado" },
  { value: "Performance", label: "Performance" },
];

const OPCOES_FAIXA = [
  { value: "Sub3", label: "Sub-3" },
  { value: "Sub5", label: "Sub-5" },
  { value: "Sub7", label: "Sub-7" },
  { value: "Sub9", label: "Sub-9" },
  { value: "Sub11", label: "Sub-11" },
  { value: "Sub13", label: "Sub-13" },
  { value: "Sub15", label: "Sub-15" },
  { value: "Sub16", label: "Sub-16" },
  { value: "Livre", label: "Livre" },
];

const OPCOES_ESPACO = [
  { value: "Pequeno", label: "Pequeno" },
  { value: "Medio", label: "Médio" },
  { value: "Grande", label: "Grande" },
];

export default function FormExercicioTreinos({
  exercicioId = null,
  returnTo,
}: Props) {
  const [loading, setLoading] = useState(!!exercicioId);
  const [submitting, setSubmitting] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [tipo, setTipo] = useState("");
  const [nivel, setNivel] = useState("");
  const [faixasEtarias, setFaixasEtarias] = useState<string[]>([]);
  const [modoExecucao, setModoExecucao] = useState<
    "Tempo" | "SeriesRepeticoes" | "LivreOrientativo" | ""
  >("");
  const [series, setSeries] = useState("");
  const [repeticoes, setRepeticoes] = useState("");
  const [duracao, setDuracao] = useState("");
  const [descanso, setDescanso] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [novaTag, setNovaTag] = useState("");
  const [quantidadeAtletas, setQuantidadeAtletas] = useState("");
  const [materiaisNecessarios, setMateriaisNecessarios] = useState("");
  const [espacoNecessario, setEspacoNecessario] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [videoNome, setVideoNome] = useState("");
  const [mostrarInfosAdicionais, setMostrarInfosAdicionais] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [videoModalAberto, setVideoModalAberto] = useState(false);
  const [videoExistenteUrl, setVideoExistenteUrl] = useState("");
  const [removerVideoExistente, setRemoverVideoExistente] = useState(false);

  const query =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;

  const returnToFromQuery = query?.get("returnTo") || "";
  const returnToFinal =
    returnTo ||
    returnToFromQuery ||
    "/treinos?aba=exercicios";
  
  useEffect(() => {
    if (!exercicioId) return;

    setLoading(true);

    fetch(`${API.BASE_URL}/api/exercicios/${exercicioId}`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Erro ao carregar exercício");
        return json;
      })
      .then((data) => {
        setCodigo(data.codigo || "");
        setNome(data.nome || "");
        setObjetivo(data.objetivo || "");
        setTipo(
          data.tipo === "Tecnico" ||
          data.tipo === "Fisico" ||
          data.tipo === "Tatico" ||
          data.tipo === "Mental"
            ? data.tipo
            : ""
        );
        setNivel(
          data.nivel === "Base" ||
          data.nivel === "Avancado" ||
          data.nivel === "Performance" 
            ? data.nivel
            : ""
        );
        setFaixasEtarias(
          Array.isArray(data.faixaEtaria) && data.faixaEtaria.length > 0
            ? data.faixaEtaria
            : []
        );
        setModoExecucao(
          data.modoExecucao === "Tempo" ||
          data.modoExecucao === "SeriesRepeticoes" ||
          data.modoExecucao === "LivreOrientativo"
            ? data.modoExecucao
            : ""
        );
        setSeries(data.series ? String(data.series) : "");
        setRepeticoes(data.repeticoes || "");
        setDuracao(data.duracao || "");
        setDescanso(data.descanso || "");
        setTags(Array.isArray(data.tags) ? data.tags : []);
        setQuantidadeAtletas(data.quantidadeAtletas || "");
        setMateriaisNecessarios(data.materiaisNecessarios || "");
        setEspacoNecessario(
          data.espacoNecessario === "Pequeno" ||
          data.espacoNecessario === "Medio" ||
          data.espacoNecessario === "Grande"
            ? data.espacoNecessario
            : ""
        );
        
        const videoUrlCompleta = data.videoDemonstrativoUrl
          ? data.videoDemonstrativoUrl.startsWith("http://") || data.videoDemonstrativoUrl.startsWith("https://")
            ? data.videoDemonstrativoUrl
            : `${API.BASE_URL}${data.videoDemonstrativoUrl}`
          : "";

        setVideoExistenteUrl(videoUrlCompleta);
        setVideoPreviewUrl(videoUrlCompleta);
        setVideoNome(
          data.videoDemonstrativoUrl
            ? data.videoDemonstrativoUrl.split("/").pop() || ""
            : ""
        );

        const temInfosAdicionais =
          (Array.isArray(data.tags) && data.tags.length > 0) ||
          !!data.quantidadeAtletas ||
          !!data.materiaisNecessarios ||
          !!data.espacoNecessario;

        setMostrarInfosAdicionais(temInfosAdicionais);
        setRemoverVideoExistente(false);
      })
      .catch((err) => {
        alert(err?.message || "Erro ao carregar exercício");
      })
      .finally(() => setLoading(false));
  }, [exercicioId]);

  useEffect(() => {
    if (modoExecucao === "Tempo") {
      setSeries("");
      setRepeticoes("");
    }

    if (modoExecucao === "LivreOrientativo") {
      setSeries("");
      setRepeticoes("");
    }
  }, [modoExecucao]);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl && video) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl, video]);

  const gerarCodigoAutomatico = () => {
    if (!nome.trim()) return "";
    const base = nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toUpperCase();

    return `${base}-${Date.now().toString().slice(-5)}`;
  };

  const handleAddTag = () => {
    const limpa = novaTag.trim();
    if (!limpa) return;
    if (tags.some((t) => t.toLowerCase() === limpa.toLowerCase())) {
      setNovaTag("");
      return;
    }
    setTags((prev) => [...prev, limpa]);
    setNovaTag("");
  };

  const handleRemoveTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const validarDuracaoVideo = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const videoEl = document.createElement("video");

      videoEl.preload = "metadata";
      videoEl.src = url;
      videoEl.muted = true;
      videoEl.playsInline = true;

      videoEl.onloadedmetadata = () => {
        const duration = videoEl.duration;
        URL.revokeObjectURL(url);
        resolve(duration);
      };

      videoEl.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível ler a duração do vídeo."));
      };
    });
  };

  const handleVideoChange = async (file: File | null) => {
    if (!file) {
      if (videoPreviewUrl && videoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(videoPreviewUrl);
      }

      setVideo(null);
      setVideoNome("");
      setVideoPreviewUrl("");
      setVideoExistenteUrl("");
      setRemoverVideoExistente(!!videoExistenteUrl);
      return;
    }

    try {
      const duracaoSegundos = await validarDuracaoVideo(file);

      if (duracaoSegundos > 60) {
        setVideo(null);
        setVideoNome("");
        setVideoPreviewUrl("");
        setVideoExistenteUrl("");
        alert("Esse vídeo é muito longo. O máximo permitido é 60 segundos.");
        return;
      }

      setVideo(file);
      setVideoNome(file.name);
      setVideoExistenteUrl("");
      setRemoverVideoExistente(false);

      if (videoPreviewUrl && videoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(videoPreviewUrl);
      }

      const preview = URL.createObjectURL(file);
      setVideoPreviewUrl(preview);
    } catch (err: any) {
      alert(err?.message || "Não foi possível validar o vídeo selecionado.");
    }
  };

  const handleRemoverVideo = () => {
    if (videoPreviewUrl && videoPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    setVideo(null);
    setVideoNome("");
    setVideoPreviewUrl("");
    setVideoExistenteUrl("");
    setRemoverVideoExistente(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const token = getToken();
    if (!token) {
      alert("Você precisa estar logado.");
      window.location.href = "/login";
      return;
    }

    if (!nome.trim()) {
      alert("Informe o nome do exercício.");
      return;
    }

    const codigoFinal = codigo.trim() || gerarCodigoAutomatico();

    if (!codigoFinal) {
      alert("Não foi possível gerar o código do exercício.");
      return;
    }

    if (!tipo) {
      alert("Escolha o tipo do exercício.");
      return;
    }

    if (!nivel) {
      alert("Escolha o nível do exercício.");
      return;
    }

    if (faixasEtarias.length === 0) {
      alert("Selecione pelo menos uma faixa etária.");
      return;
    }

    if (!modoExecucao) {
      alert("Escolha como o exercício é executado.");
      return;
    }

    if (video) {
      try {
        const duracaoSegundos = await validarDuracaoVideo(video);
        if (duracaoSegundos > 60) {
          alert("Esse vídeo é muito longo. O máximo permitido é 60 segundos.");
          return;
        }
      } catch {
        alert("Não foi possível validar a duração do vídeo.");
        return;
      }
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append("codigo", codigoFinal);
      formData.append("nome", nome.trim());
      formData.append("objetivo", objetivo.trim());
      formData.append("descricao", objetivo.trim());
      formData.append("categorias", JSON.stringify(faixasEtarias));
      formData.append("tipo", tipo);
      formData.append("nivel", nivel);
      formData.append("faixaEtaria", JSON.stringify(faixasEtarias));
      formData.append("modoExecucao", modoExecucao);
      if (modoExecucao === "Tempo") {
        formData.append("duracao", duracao.trim());
        formData.append("series", "");
        formData.append("repeticoes", "");
        formData.append("descanso", descanso.trim());
      } else if (modoExecucao === "SeriesRepeticoes") {
        formData.append("series", series.trim());
        formData.append("repeticoes", repeticoes.trim());
        formData.append("duracao", duracao.trim());
        formData.append("descanso", descanso.trim());
      } else if (modoExecucao === "LivreOrientativo") {
        formData.append("duracao", duracao.trim());
        formData.append("series", "");
        formData.append("repeticoes", "");
        formData.append("descanso", descanso.trim());
      }
      formData.append("tags", JSON.stringify(tags));
      formData.append("quantidadeAtletas", quantidadeAtletas.trim());
      formData.append("materiaisNecessarios", materiaisNecessarios.trim());
      formData.append("espacoNecessario", espacoNecessario);

      if (removerVideoExistente) {
        formData.append("removerVideo", "true");
      }

      if (video) formData.append("video", video);

      const endpoint = exercicioId
        ? `${API.BASE_URL}/api/exercicios/${exercicioId}`
        : `${API.BASE_URL}/api/exercicios/personalizados`;

      const res = await fetch(endpoint, {
        method: exercicioId ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          json?.message || `Erro ao ${exercicioId ? "editar" : "criar"} exercício.`
        );
      }

      alert(`Exercício ${exercicioId ? "atualizado" : "criado"} com sucesso!`);
      window.location.href = returnToFinal;
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar dados.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        Carregando exercício...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h1 className="text-[22px] font-semibold text-[#163D34]">
          {exercicioId ? "Editar Exercício" : "Novo Exercício"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
        <div>
          <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
            Nome do exercício*
          </label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
            placeholder="Passe e controle orientado"
          />
        </div>

        <div>
          <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
            Objetivo/Descrição (opcional)
          </label>
          <textarea
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
            placeholder="Melhorar domínio orientado e passe rápido em espaço curto"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
              Tipo*
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
            >
              <option value="">Selecione</option>
              {OPCOES_TIPO.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
              Nível*
            </label>
            <select
              value={nivel}
              onChange={(e) => setNivel(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
            >
              <option value="">Selecione</option>
              {OPCOES_NIVEL.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
            Faixa etária*
          </label>

          <div className="flex flex-wrap gap-3">
            {OPCOES_FAIXA.map((op) => {
              const checked = faixasEtarias.includes(op.value);

              return (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => {
                    setFaixasEtarias((prev) =>
                      checked
                        ? prev.filter((v) => v !== op.value)
                        : [...prev, op.value]
                    );
                  }}
                  className={`rounded-full border px-5 py-2 text-[15px] font-medium transition ${
                    checked
                      ? "border-[#16A34A] bg-[#F0FDF4] text-[#166534]"
                      : "border-[#D1D5DB] bg-white text-[#374151] hover:border-[#9CA3AF]"
                  }`}
                >
                  {op.value}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-3 block text-[15px] font-medium text-[#243B35]">
            Como esse exercício é executado?
          </label>

          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <label className="flex items-center gap-2 text-[16px] text-[#243B35]">
              <input
                type="radio"
                name="modoExecucao"
                checked={modoExecucao === "Tempo"}
                onChange={() => setModoExecucao("Tempo")}
                className="h-5 w-5 accent-[#0D6A43]"
              />
              Por tempo
            </label>

            <label className="flex items-center gap-2 text-[16px] text-[#243B35]">
              <input
                type="radio"
                name="modoExecucao"
                checked={modoExecucao === "SeriesRepeticoes"}
                onChange={() => setModoExecucao("SeriesRepeticoes")}
                className="h-5 w-5 accent-[#0D6A43]"
              />
              Por séries/repetições
            </label>

            <label className="flex items-center gap-2 text-[16px] text-[#243B35]">
              <input
                type="radio"
                name="modoExecucao"
                checked={modoExecucao === "LivreOrientativo"}
                onChange={() => setModoExecucao("LivreOrientativo")}
                className="h-5 w-5 accent-[#0D6A43]"
              />
              Livre / orientativo
            </label>
          </div>

          {modoExecucao === "Tempo" && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
                  Duração
                </label>
                <input
                  value={duracao}
                  onChange={(e) => setDuracao(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
                  placeholder="Ex: 30s, 1min, 2min30"
                />
              </div>

              <div>
                <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
                  Descanso
                </label>
                <input
                  value={descanso}
                  onChange={(e) => setDescanso(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
                  placeholder="Ex: 30s, 1min"
                />
              </div>
            </div>
          )}

          {modoExecucao === "SeriesRepeticoes" && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
                  Séries
                </label>
                <input
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
                  placeholder="Ex: 3"
                />
              </div>

              <div>
                <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
                  Repetições
                </label>
                <input
                  value={repeticoes}
                  onChange={(e) => setRepeticoes(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
                  placeholder="Ex: 10, 12, 15"
                />
              </div>

              <div>
                <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
                  Duração / observação
                </label>
                <input
                  value={duracao}
                  onChange={(e) => setDuracao(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
                  placeholder="Ex: 2min, até errar, por lado..."
                />
              </div>

              <div>
                <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
                  Descanso
                </label>
                <input
                  value={descanso}
                  onChange={(e) => setDescanso(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
                  placeholder="Ex: 30s, 1min"
                />
              </div>
            </div>
          )}

          {modoExecucao === "LivreOrientativo" && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
                  Duração / série
                </label>
                <input
                  value={duracao}
                  onChange={(e) => setDuracao(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
                  placeholder="Ex: 2 min, 15 repetições, livre, até errar..."
                />
              </div>

              <div>
                <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
                  Descanso
                </label>
                <input
                  value={descanso}
                  onChange={(e) => setDescanso(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
                  placeholder="Ex: 30s, sem descanso, livre"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
            Vídeo (opcional)
          </label>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <input
                id="video-exercicio"
                type="file"
                accept="video/*"
                onChange={(e) => handleVideoChange(e.target.files?.[0] || null)}
                className="hidden"
              />

              <label
                htmlFor="video-exercicio"
                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-[15px] text-[#243B35] hover:bg-gray-50"
              >
                {videoPreviewUrl ? "Trocar vídeo" : "Escolher arquivo"}
              </label>

              {videoNome && (
                <p className="truncate text-sm text-gray-500">{videoNome}</p>
              )}
            </div>

            {videoPreviewUrl && (
              <>
                <div className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-gray-200 bg-black">
                  <video
                    src={videoPreviewUrl}
                    className="h-[220px] w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />

                  <button
                    type="button"
                    onClick={() => setVideoModalAberto(true)}
                    className="absolute inset-0 flex items-center justify-center bg-black/20"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-2xl text-white">
                      ▶
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRemoverVideo}
                    className="text-[15px] text-red-600 underline"
                  >
                    Remover vídeo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200">
          <button
            type="button"
            onClick={() => setMostrarInfosAdicionais((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-4 text-left"
          >
            <span className="text-[16px] font-semibold text-[#163D34]">
              Informações adicionais (opcional)
            </span>

            <span
              className={`text-[20px] text-[#163D34] transition-transform ${
                mostrarInfosAdicionais ? "rotate-180" : ""
              }`}
            >
              ▾
            </span>
          </button>

          {mostrarInfosAdicionais && (
            <div className="space-y-5 border-t border-gray-100 px-4 pb-4 pt-4">
              <div>
                <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
                  Tags (opcional)
                </label>

                {tags.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <div
                        key={tag}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#D9E3DE] bg-[#EEF3F0] px-3 py-1 text-[15px] text-[#30443F]"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="flex h-4 w-4 items-center justify-center rounded-full text-[11px] leading-none text-[#30443F] hover:bg-[#DCE6E1]"
                          title={`Remover tag ${tag}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={novaTag}
                    onChange={(e) => setNovaTag(e.target.value)}
                    placeholder="Adicionar tag Ex: passe, domínio, agilidade"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="rounded-xl border border-[#D9E3DE] bg-white px-4 py-3 text-[16px] text-[#30443F]"
                  >
                    + Adicionar tag
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
                  Quantidade de atletas (opcional)
                </label>
                <input
                  value={quantidadeAtletas}
                  onChange={(e) => setQuantidadeAtletas(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
                  placeholder="4+"
                />
              </div>

              <div>
                <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
                  Materiais necessários (opcional)
                </label>
                <input
                  value={materiaisNecessarios}
                  onChange={(e) => setMateriaisNecessarios(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
                  placeholder="Cones, bolas, mini barreiras"
                />
              </div>

              <div className="max-w-[360px]">
                <label className="mb-2 block text-[15px] font-medium text-[#243B35]">
                  Espaço necessário (opcional)
                </label>
                <select
                  value={espacoNecessario}
                  onChange={(e) => setEspacoNecessario(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[16px] outline-none focus:border-[#0D6A43]"
                >
                  <option value="">Selecione</option>
                  {OPCOES_ESPACO.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <input type="hidden" value={codigo} readOnly />

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => (window.location.href = returnToFinal)}
            className="rounded-xl bg-[#E5E7EB] px-5 py-3 text-[15px] font-medium text-[#374151]"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-[#0D6A43] px-5 py-3 text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Salvando..." : exercicioId ? "Salvar" : "Salvar exercício"}
          </button>
        </div>
      </form>

      {videoModalAberto && videoPreviewUrl && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-[28px] bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setVideoModalAberto(false)}
                className="text-[16px] font-medium text-[#243B35]"
              >
                Fechar
              </button>
            </div>

            <video
              src={videoPreviewUrl}
              controls
              autoPlay
              className="max-h-[70vh] w-full rounded-xl bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
}