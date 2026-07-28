import { useState } from "react";
import { Copy, Pencil, Star, Plus, Trash2, Play } from "lucide-react";
import { API } from "../../config.js";
import CoverImage from "../shared/CoverImage.js";

export type ExercicioItem = {
  id: string;
  codigo?: string;
  nome: string;
  descricao?: string | null;
  nivel?: string | null;
  tipo?: string | null;
  objetivo?: string | null;
  faixaEtaria?: string[] | null;
  duracaoMin?: number | null;
  duracao?: string | null;
  descanso?: string | null;
  repeticoes?: string | null;
  series?: number | null;
  modoExecucao?: string | null;
  videoDemonstrativoUrl?: string | null;
  capaUrl?: string | null;
  categorias?: string[];
  tags?: string[];
  favorito?: boolean;
  usadoEmTreinos?: number;
  quantidadeAtletas?: string | null;
  materiaisNecessarios?: string | null;
  espacoNecessario?: string | null;
};

type Props = {
  item: ExercicioItem;
  onDuplicar: (id: string) => void | Promise<void>;
  onEditar: (id: string) => void;
  onFavoritar: (id: string, favoritoAtual: boolean) => void | Promise<void>;
  onExcluir: (id: string) => void | Promise<void>;
  onUsarNoTreino: (item: ExercicioItem) => void;
};

function resolveVideoUrl(raw?: string | null) {
  const media = String(raw || "").trim().replace(/\\/g, "/");

  if (!media || media === "null" || media === "undefined") return "";

  if (
    media.startsWith("blob:") ||
    media.startsWith("data:") ||
    media.startsWith("http://") ||
    media.startsWith("https://")
  ) {
    return media;
  }

  if (media.startsWith("/assets/") || media.startsWith("assets/")) {
    return media.startsWith("/") ? media : `/${media}`;
  }

  if (media.startsWith("/uploads/") || media.startsWith("/upload/")) {
    return `${API.BASE_URL}${media}`;
  }

  if (media.startsWith("uploads/") || media.startsWith("upload/")) {
    return `${API.BASE_URL}/${media}`;
  }

  if (media.startsWith("/exercicios/")) {
    return `${API.BASE_URL}${media}`;
  }

  if (media.startsWith("exercicios/")) {
    return `${API.BASE_URL}/${media}`;
  }

  if (media.startsWith("/")) {
    return `${API.BASE_URL}${media}`;
  }

  return `${API.BASE_URL}/${media}`;
}

function formatarFaixas(faixas?: string[] | null) {
  if (!Array.isArray(faixas) || faixas.length === 0) return "";

  const mapa: Record<string, string> = {
    Sub3: "Sub-3",
    Sub5: "Sub-5",
    Sub7: "Sub-7",
    Sub9: "Sub-9",
    Sub11: "Sub-11",
    Sub13: "Sub-13",
    Sub15: "Sub-15",
    Sub16: "Sub-16",
    Livre: "Livre",
  };

  return faixas.map((faixa) => mapa[faixa] || faixa).join(", ");
}

function formatarResumoExecucao(item: ExercicioItem) {
  const descanso = item.descanso?.trim() || "";
  const repeticoes = item.repeticoes?.trim() || "";
  const duracao = item.duracao?.trim() || "";
  const series =
    typeof item.series === "number" && item.series > 0
      ? item.series
      : null;

  const comDescanso = (base: string) => {
    return descanso
      ? `${base} • descanso: ${descanso}`
      : base;
  };

  const textoSeries = series
    ? `${series} série${series > 1 ? "s" : ""}`
    : "";

  if (item.modoExecucao === "Tempo") {
    const base = duracao || "Sem duração";
    return comDescanso(base);
  }

  if (item.modoExecucao === "SeriesRepeticoes") {
    if (repeticoes) {
      const base = textoSeries
        ? `${textoSeries} x ${repeticoes} repetições`
        : `${repeticoes} repetições`;

      return comDescanso(base);
    }

    if (duracao) {
      const base = textoSeries
        ? `${textoSeries} x ${duracao}`
        : duracao;

      return comDescanso(base);
    }

    if (textoSeries) {
      return comDescanso(textoSeries);
    }

    return "Sem execução definida";
  }

  if (item.modoExecucao === "LivreOrientativo") {
    const base = duracao || "Livre / orientativo";
    return comDescanso(base);
  }

  if (repeticoes) {
    const base = textoSeries
      ? `${textoSeries} x ${repeticoes} repetições`
      : `${repeticoes} repetições`;

    return comDescanso(base);
  }

  if (duracao) {
    const base = textoSeries
      ? `${textoSeries} x ${duracao}`
      : duracao;

    return comDescanso(base);
  }

  if (textoSeries) {
    return comDescanso(textoSeries);
  }

  return "Sem execução definida";
}

function temMaisInformacoes(item: ExercicioItem) {
  return !!(
    item.quantidadeAtletas?.trim() ||
    item.materiaisNecessarios?.trim() ||
    item.espacoNecessario?.trim() ||
    (Array.isArray(item.tags) && item.tags.length > 0)
  );
}

export default function ExercicioCard({
  item,
  onDuplicar,
  onEditar,
  onFavoritar,
  onExcluir,
  onUsarNoTreino,
}: Props) {
  const [videoModalAberto, setVideoModalAberto] = useState(false);
  const [maisInfosAberto, setMaisInfosAberto] = useState(false);
  
  const chips = [
    item.tipo,
    item.nivel,
    ...(item.tags || []),
  ]
    .filter(Boolean)
    .map((v) => String(v).trim())
    .filter(Boolean);

  const chipsUnicos = Array.from(new Set(chips)).slice(0, 6);

  const videoUrl = resolveVideoUrl(item.videoDemonstrativoUrl);
  const capaUrl = item.capaUrl || null;
  const faixasFormatadas = formatarFaixas(item.faixaEtaria);
  const resumoExecucao = formatarResumoExecucao(item);
  const temVideo = !!videoUrl;
  const mostrarMaisInfos = temMaisInformacoes(item);

  return (
    <>
      <div className="rounded-[24px] border border-gray-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="w-full shrink-0 sm:w-[190px]">
            <div className="relative h-[140px] w-full overflow-hidden rounded-[18px] border border-gray-100 bg-white">
              {temVideo ? (
                  <>
                    {capaUrl ? (
                      <CoverImage
                        src={capaUrl}
                        alt={item.nome}
                        pasta="exercicios"
                        className="h-full w-full"
                      />
                    ) : (
                      <video
                        src={videoUrl}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => setVideoModalAberto(true)}
                      className="absolute inset-0 flex items-center justify-center bg-black/10"
                      title="Ver vídeo"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white">
                        <Play size={22} fill="currentColor" />
                      </span>
                    </button>
                  </>
                ) : (
                  <CoverImage
                    src={capaUrl}
                    alt={item.nome}
                    pasta="exercicios"
                    className="h-full w-full"
                  />
                )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[18px] font-semibold leading-tight text-[#173D34] sm:text-[20px]">
                  {item.nome}
                </h3>

                {item.objetivo ? (
                  <p className="mt-1 text-[14px] text-[#50625A] line-clamp-2">
                    {item.objetivo}
                  </p>
                ) : null}

                <p className="mt-2 text-[14px] text-gray-700">
                  {resumoExecucao}
                </p>

                {mostrarMaisInfos ? (
                  <button
                    type="button"
                    onClick={() => setMaisInfosAberto((prev) => !prev)}
                    className="mt-2 text-[13px] font-medium text-[#0D6A43] underline underline-offset-2"
                  >
                    {maisInfosAberto ? "Ocultar informações extras" : "Visualizar mais informações"}
                  </button>
                ) : null}

                {maisInfosAberto && mostrarMaisInfos ? (
                  <div className="mt-3 text-[13px] text-[#41534C]">
                    <div className="space-y-2">
                      <div>
                        <span className="font-semibold text-[#173D34]">Quantidade de atletas:</span>{" "}
                        {item.quantidadeAtletas || "-"}
                      </div>

                      <div>
                        <span className="font-semibold text-[#173D34]">Materiais:</span>{" "}
                        {item.materiaisNecessarios || "-"}
                      </div>

                      <div>
                        <span className="font-semibold text-[#173D34]">Espaço:</span>{" "}
                        {item.espacoNecessario || "-"}
                      </div>

                      {Array.isArray(item.tags) && item.tags.length > 0 ? (
                        <div>
                          <span className="font-semibold text-[#173D34]">Tags:</span>{" "}
                          {item.tags.join(", ")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              {faixasFormatadas ? (
                <span className="shrink-0 rounded-full bg-[#F1F5F2] px-4 py-2 text-[13px] text-[#5D6B63]">
                  {faixasFormatadas}
                </span>
              ) : null}
            </div>

            {chipsUnicos.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {chipsUnicos.map((chip) => (
                  <span
                    key={`${item.id}-${chip}`}
                    className="rounded-full bg-[#F1F5F2] px-3 py-1 text-[12px] text-[#4E5C54]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-5 text-[#3B4A42]">
                <button
                  type="button"
                  onClick={() => onEditar(item.id)}
                  className="inline-flex items-center gap-2 transition hover:text-[#0D6A43]"
                  title="Editar"
                >
                  <Pencil size={20} />
                </button>

                <button
                  type="button"
                  onClick={() => onFavoritar(item.id, !!item.favorito)}
                  className={`inline-flex items-center gap-2 transition ${
                    item.favorito ? "text-[#0D6A43]" : "hover:text-[#0D6A43]"
                  }`}
                  title="Favoritar"
                >
                  <Star size={20} fill={item.favorito ? "currentColor" : "none"} />
                </button>

                <button
                  type="button"
                  onClick={() => onDuplicar(item.id)}
                  className="inline-flex items-center gap-2 transition hover:text-[#0D6A43]"
                  title="Duplicar"
                >
                  <Copy size={20} />
                </button>

                <button
                  type="button"
                  onClick={() => onExcluir(item.id)}
                  className="inline-flex items-center gap-2 transition hover:text-red-600"
                  title="Excluir"
                >
                  <Trash2 size={20} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => onUsarNoTreino(item)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0D6A43] px-5 py-3 text-[15px] font-medium text-white transition hover:bg-[#0B5A39]"
              >
                <Plus size={20} />
                Usar no treino
              </button>
            </div>
          </div>
        </div>
      </div>

      {videoModalAberto && temVideo && (
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
              src={videoUrl}
              controls
              autoPlay
              className="max-h-[70vh] w-full rounded-xl bg-black"
            />
          </div>
        </div>
      )}
    </>
  );
}