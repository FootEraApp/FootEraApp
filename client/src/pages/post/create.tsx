import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Volleyball, User, CirclePlus, Search, House, Award } from "lucide-react";
import { criarPost } from "@/services/feedService.js";
import { API } from "../../config.js";
import { formatarUrlFoto } from "@/utils/formatarFoto.js";
import Storage from "../../../../server/utils/storage.js";
import { ALL_ACHIEVEMENTS, type AchievementLite } from "../../lib/achievementsCatalog.js";

function normalizeMediaUrl(raw: string): string {
  let s = (raw || "").trim();
  if (!s) return "";

  if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) {
    return s.replace(/\/assets\/usuarios\//, "/uploads/").replace(/\/assets\//, "/uploads/");
  }

  s = s.replace(/^\/?assets\/usuarios\//, "/uploads/").replace(/^\/?assets\//, "/uploads/");

  if (s.startsWith("/uploads/")) return `${API.BASE_URL}${s}`;
  if (s.startsWith("uploads/")) return `${API.BASE_URL}/${s}`;

  if (!s.startsWith("/")) s = `/${s}`;
  return `${API.BASE_URL}/uploads${s}`;
}

type EarnedFromApi = {
  id: string;
  entity: string;
  title: string;
  description: string;
  icon?: string;
  tier?: "bronze" | "prata" | "ouro" | "platina";
  group: string;
};

function getUsuarioId(): string | null {
  return (
    (Storage as any)?.usuarioId ||
    localStorage.getItem("usuarioId") ||
    sessionStorage.getItem("usuarioId") ||
    null
  );
}

export default function PaginaPostagem() {
  const [, navigate] = useLocation();

  const [descricao, setDescricao] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const [earned, setEarned] = useState<EarnedFromApi[]>([]);
  const [selectedAchId, setSelectedAchId] = useState<string>("");

  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const catalogMap = useMemo(
    () =>
      new Map<string, AchievementLite>(
        (ALL_ACHIEVEMENTS as AchievementLite[]).map((a: AchievementLite) => [a.id, a])
      ),
    []
  );

  const selectedAch: AchievementLite | null = useMemo(() => {
    if (!selectedAchId) return null;
    const fromCat = catalogMap.get(selectedAchId);
    if (fromCat) return fromCat;
    const fromApi = earned.find((e) => e.id === selectedAchId);
    return fromApi
      ? {
          id: fromApi.id,
          entity: fromApi.entity as any,
          title: fromApi.title,
          description: fromApi.description,
          icon: fromApi.icon,
          tier: fromApi.tier,
          group: fromApi.group as any,
        }
      : null;
  }, [selectedAchId, earned, catalogMap]);

  const temUrl = useMemo(() => !!(imagemUrl.trim() || videoUrl.trim()), [imagemUrl, videoUrl]);
  const temArquivo = !!arquivo;
  const temConquista = !!selectedAch;
  const temDescricao = !!descricao.trim();

  const ach = selectedAchId
    ? (ALL_ACHIEVEMENTS as AchievementLite[]).find((a: AchievementLite) => a.id === selectedAchId)
    : undefined;

   useEffect(() => {
    const usuarioId = getUsuarioId();
    if (!usuarioId) return;

    const base = (API?.BASE_URL ? String(API.BASE_URL).replace(/\/+$/, "") : "") || "";
    const url = `${base}/api/conquistas/${usuarioId}`;

    fetch(url, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Falha ao carregar conquistas (${r.status})`);
        const json = await r.json();
        setEarned(Array.isArray(json?.earned) ? json.earned : []);
      })
      .catch((e) => {
        console.warn("Conquistas: fallback vazio.", e);
        setEarned([]);
      });
  }, []);

  async function handleEnviar() {
    setMensagem("");

    if (!temDescricao && !temConquista && !temUrl && !temArquivo) {
      setMensagem("Escreva algo, selecione uma conquista ou anexe uma mídia (URL/arquivo).");
      return;
    }

    if (temUrl && temArquivo) {
      setMensagem("Use URL ou arquivo, não os dois ao mesmo tempo.");
      return;
    }

    setCarregando(true);
    try {
      const img = imagemUrl.trim() ? normalizeMediaUrl(imagemUrl) : undefined;
      const vid = videoUrl.trim() ? normalizeMediaUrl(videoUrl) : undefined;

      const partes: string[] = [];
      if (selectedAch) {
        const icon = selectedAch.icon || "🏆";
        partes.push(`🏆 Conquista: ${selectedAch.title} — ${selectedAch.description} ${icon} [${selectedAch.id}]`);
      }
      if (descricao.trim()) partes.push(descricao.trim());

      const descricaoFinal = partes.join("\n\n");

      await criarPost({
        descricao: descricaoFinal || "(post sem texto)",
        imagemUrl: img,
        videoUrl: vid,
        arquivo: arquivo || undefined,
      });

      setMensagem("Postagem enviada com sucesso!");
      setDescricao("");
      setImagemUrl("");
      setVideoUrl("");
      setArquivo(null);
      setSelectedAchId("");

      navigate("/feed");
    } catch (err: any) {
      console.error(err);
      setMensagem(err?.message || "Erro ao enviar a postagem.");
    } finally {
      setCarregando(false);
    }
  }

  const previewMidia = (() => {
    if (arquivo) {
      const isVideo = arquivo.type?.startsWith("video/");
      const url = URL.createObjectURL(arquivo);
      return isVideo ? (
        <video src={url} controls className="w-full rounded-lg shadow mb-3" />
      ) : (
        <img src={url} className="w-full rounded-lg shadow mb-3 object-cover" />
      );
    }
    if (imagemUrl.trim()) {
      return <img src={formatarUrlFoto(imagemUrl)} className="w-full rounded-lg shadow mb-3 object-cover" />;
    }
    if (videoUrl.trim()) {
      return <video src={normalizeMediaUrl(videoUrl)} controls className="w-full rounded-lg shadow mb-3" />;
    }
    return null;
  })();

  const previewConquista = selectedAch ? (
    <div className="mt-2 rounded-lg border bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-green-50 border text-xl">
          <span>{selectedAch.icon || "🏆"}</span>
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-green-900">Conquista: {selectedAch.title}</div>
          <div className="text-sm text-gray-600">{selectedAch.description}</div>
          {selectedAch.tier && (
            <span className="mt-1 inline-block text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
              {selectedAch.tier[0].toUpperCase() + selectedAch.tier.slice(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-green-900">Nova Postagem</h1>
        <textarea
          className="w-full border rounded p-3 mb-4"
          rows={4}
          placeholder="Escreva algo sobre sua postagem..."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />

        <div className="mb-2 text-sm text-gray-700 flex items-center gap-2">
          <Award className="h-4 w-4 text-amber-600" />
          Compartilhar conquista concluída (opcional)
        </div>
        <select
          className="w-full border rounded p-2"
          value={selectedAchId}
          onChange={(e) => setSelectedAchId(e.target.value)}
        >
          <option value="">— Selecionar conquista —</option>
          {earned.map((e) => {
            const meta: AchievementLite | undefined = catalogMap.get(e.id);
            const label = meta ? `${meta.title}` : e.title || e.id;
            return (
              <option key={e.id} value={e.id}>
                {label}
              </option>
            );
          })}
        </select>
        {previewConquista}

        <input
          type="text"
          className="w-full border rounded p-3 mt-4 mb-2"
          placeholder="URL da imagem (ex.: https://... ou /uploads/minha-imagem.jpg)"
          value={imagemUrl}
          onChange={(e) => setImagemUrl(e.target.value)}
          disabled={!!arquivo}
        />

        <input
          type="text"
          className="w-full border rounded p-3 mb-4"
          placeholder="URL do vídeo (opcional)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          disabled={!!arquivo}
        />

        <div className="text-sm text-gray-600 mb-2">— ou —</div>

        <div className="flex items-center gap-3 mb-4">
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            disabled={temUrl}
          />
          {arquivo && (
            <button type="button" onClick={() => setArquivo(null)} className="text-xs text-red-600 underline">
              Remover arquivo
            </button>
          )}
        </div>

        {previewMidia}

        {mensagem && (
          <p
            className={`mb-4 text-sm text-center ${
              mensagem.toLowerCase().includes("sucesso") ? "text-green-700" : "text-red-600"
            }`}
          >
            {mensagem}
          </p>
        )}

        <button
          onClick={handleEnviar}
          disabled={carregando}
          className="w-full bg-green-800 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {carregando ? "Enviando..." : "Publicar"}
        </button>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed" className="hover:underline">
          <House />
        </Link>
        <Link href="/explorar" className="hover:underline">
          <Search />
        </Link>
        <Link href="/post" className="hover:underline">
          <CirclePlus />
        </Link>
        <Link href="/treinos" className="hover:underline">
          <Volleyball />
        </Link>
        <Link href="/perfil" className="hover:underline">
          <User />
        </Link>
      </nav>
    </div>
  );
}
