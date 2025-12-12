import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Volleyball,
  User,
  CirclePlus,
  Search,
  House,
  Award,
  Trophy,
  UploadCloud,
  ImagePlay,
  X,
  Check,
  ShieldCheck,
  Flag,
} from "lucide-react";
import { criarPost } from "@/services/feedService.js";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";
import { ALL_ACHIEVEMENTS, type AchievementLite } from "../../lib/achievementsCatalog.js";

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

function SportButton({
  onClick,
  disabled,
  children,
  variant = "primary",
  icon,
  className = "",
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: "primary" | "outline" | "ghost";
  icon?: React.ReactNode;
  className?: string;
}) {
  const base =
    "w-full rounded-2xl px-4 py-3 font-semibold transition active:scale-[0.98] select-none";
  const styles: Record<string, string> = {
    primary:
      "bg-gradient-to-b from-emerald-600 to-green-700 text-white shadow-[0_8px_20px_rgba(22,156,54,.35)] hover:from-emerald-500 hover:to-green-600",
    outline:
      "border-2 border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50",
    ghost:
      "text-emerald-800/90 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${styles[variant]} disabled:opacity-60 ${className}`}
    >
      <span className="flex items-center justify-center gap-2">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="truncate">{children}</span>
      </span>
    </button>
  );
}

function Chip({
  children,
  color = "emerald",
}: {
  children: React.ReactNode;
  color?: "emerald" | "amber" | "sky" | "gray";
}) {
  const maps = {
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    sky: "bg-sky-50 text-sky-800 border-sky-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 border rounded-md ${maps[color]}`}>
      {children}
    </span>
  );
}

export default function PaginaPostagem() {
  const [, navigate] = useLocation();

  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const [earned, setEarned] = useState<EarnedFromApi[]>([]);
  const [selectedAchId, setSelectedAchId] = useState<string>("");

  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [achPickerOpen, setAchPickerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const temArquivo = !!arquivo;
  const temConquista = !!selectedAch;
  const temDescricao = !!descricao.trim();

  useEffect(() => {
    const usuarioId = getUsuarioId();
    const perfil = String(
      (Storage as any)?.tipoSalvo ||
        localStorage.getItem("tipoUsuario") ||
        sessionStorage.getItem("tipoUsuario") ||
        ""
    ).trim().toLowerCase();

    if (!usuarioId || perfil !== "atleta") {
      setEarned([]);
      return;
    }

    const base = (API?.BASE_URL ? String(API.BASE_URL).replace(/\/+$/, "") : "") || "";
    const url = `${base}/api/conquistas/${usuarioId}`;

    const token =
      (Storage as any)?.token ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      "";

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    fetch(url, { headers })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Falha ao carregar conquistas (${r.status})`);
        const json = await r.json();
        setEarned(Array.isArray(json?.earned) ? json.earned : []);
      })
      .catch(() => setEarned([]));
  }, []);

  async function handleEnviar() {
    setMensagem("");

    if (!temDescricao && !temConquista && !temArquivo) {
      setMensagem("Escreva algo, selecione uma conquista ou anexe uma mídia (arquivo).");
      return;
    }

    setCarregando(true);
    try {
      const partes: string[] = [];
      if (selectedAch) {
        const icon = selectedAch.icon || "🏆";
        partes.push(`🏆 Conquista: ${selectedAch.title} — ${selectedAch.description} ${icon} [${selectedAch.id}]`);
      }
      if (descricao.trim()) partes.push(descricao.trim());

      const descricaoFinal = partes.join("\n\n");

      await criarPost({
        descricao: descricaoFinal || "(post sem texto)",
        imagemUrl: undefined,
        videoUrl: undefined,
        arquivo: arquivo || undefined,
      });

      setMensagem("Postagem enviada com sucesso!");
      setDescricao("");
      setArquivo(null);
      setSelectedAchId("");
      setAchPickerOpen(false);

      navigate("/feed");
    } catch (err: any) {
      console.error(err);
      setMensagem(err?.message || "Erro ao enviar a postagem.");
    } finally {
      setCarregando(false);
    }
  }

  const previewMidia = (() => {
    if (!arquivo) return null;
    const isVideo = arquivo.type?.startsWith("video/");
    const url = URL.createObjectURL(arquivo);
    return isVideo ? (
      <video src={url} controls className="w-full rounded-xl shadow mb-3" />
    ) : (
      <img src={url} className="w-full rounded-xl shadow mb-3 object-cover" />
    );
  })();

  const previewConquista = selectedAch ? (
    <div className="mt-3 rounded-xl border bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-emerald-50 border text-xl">
          <span>{selectedAch.icon || "🏆"}</span>
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-emerald-900">Conquista: {selectedAch.title}</div>
          <div className="text-sm text-gray-600">{selectedAch.description}</div>
          <div className="mt-2 flex items-center gap-2">
            <Chip color="emerald">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>ID {selectedAch.id}</span>
            </Chip>
            {selectedAch.tier && (
              <Chip color="amber">
                <Trophy className="h-3.5 w-3.5" />
                <span>{selectedAch.tier[0].toUpperCase() + selectedAch.tier.slice(1)}</span>
              </Chip>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const fileName = arquivo?.name ? arquivo.name : "";

  return (
    <div className="min-h-screen bg-[#FEFBE9] pb-24">

<div className="bg-green-900 text-white h-16 sm:h-20">
  <div className="max-w-xl mx-auto h-full px-6 flex items-center justify-center">
    <div className="flex items-center gap-3">
      <Flag className="h-7 w-7 opacity-90" />
      <h1 className="text-xl font-extrabold tracking-wide">
        Nova Postagem
      </h1>
    </div>
  </div>
</div>


      <div className="p-6 max-w-xl mx-auto">
        <label className="block text-sm font-semibold text-emerald-900 mb-2">Texto da postagem</label>
        <div className="rounded-2xl border bg-white shadow-sm focus-within:ring-2 ring-emerald-100 transition">
          <textarea
            className="w-full rounded-2xl p-4 outline-none"
            rows={4}
            placeholder="Conte sua história do treino, do desafio ou marque a conquista…"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <div className="px-4 pb-3 flex items-center justify-between text-xs text-gray-500">
            <span>{descricao.length}/1.000</span>
            <span className="italic">Dica: fale do objetivo, resultado e próxima meta.</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SportButton
            variant="ghost"
            onClick={() => setAchPickerOpen(true)}
            icon={<Award className="h-5 w-5" />}
          >
            Selecionar conquista
          </SportButton>

        <SportButton
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            icon={<UploadCloud className="h-5 w-5" />}
          >
            Enviar foto/vídeo
          </SportButton>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => setArquivo(e.target.files?.[0] || null)}
        />

        {(fileName || temConquista) && (
          <div className="mt-3 space-y-2">
            {fileName && (
              <div className="text-sm text-emerald-900 flex items-center gap-2">
                <ImagePlay className="h-4 w-4" />
                <span className="truncate">
                  Arquivo selecionado: <b>{fileName}</b>
                </span>
                <button
                  type="button"
                  className="ml-auto text-red-600 hover:underline"
                  onClick={() => setArquivo(null)}
                >
                  Remover
                </button>
              </div>
            )}
            {previewConquista}
          </div>
        )}

        {previewMidia}

        {mensagem && (
          <div
            className={`mt-4 rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
              mensagem.toLowerCase().includes("sucesso")
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {mensagem.toLowerCase().includes("sucesso") ? (
              <Check className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
            <span className="whitespace-pre-line">{mensagem}</span>
          </div>
        )}

        <div className="mt-6">
          <SportButton
            onClick={handleEnviar}
            disabled={carregando}
            variant="primary"
            icon={<Trophy className="h-5 w-5" />}
            className="shadow-[0_14px_34px_rgba(16,120,35,.35)]"
          >
            {carregando ? "Enviando..." : "Publicar"}
          </SportButton>
          <p className="mt-2 text-xs text-center text-gray-500">
            Ao publicar, você concorda com as diretrizes da comunidade.
          </p>
        </div>
      </div>

      {achPickerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setAchPickerOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 sm:top-[10%] sm:bottom-auto sm:mx-auto sm:max-w-xl">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 max-h-[80vh] overflow-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-700" />
                  <h2 className="font-bold text-emerald-900">Selecionar conquista</h2>
                </div>
                <button
                  onClick={() => setAchPickerOpen(false)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="mt-1 text-sm text-gray-600">
                Escolha uma conquista concluída para destacar na sua postagem.
              </p>

              <div className="mt-4 space-y-2">
                {earned.length === 0 && (
                  <div className="text-sm text-gray-500 border rounded-xl p-4">
                    Nenhuma conquista disponível agora.
                  </div>
                )}

                {earned.map((e) => {
                  const meta: AchievementLite | undefined = catalogMap.get(e.id);
                  const title = meta?.title || e.title || e.id;
                  const desc = meta?.description || e.description || "";
                  const tier = (meta?.tier || e.tier) as EarnedFromApi["tier"];

                  const picked = selectedAchId === e.id;

                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        setSelectedAchId(e.id);
                        setAchPickerOpen(false);
                      }}
                      className={`w-full text-left rounded-xl border px-4 py-3 hover:bg-emerald-50 transition ${
                        picked ? "border-emerald-400 bg-emerald-50" : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-emerald-50 border text-xl">
                          <span>{meta?.icon || e.icon || "🏆"}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-emerald-900">{title}</div>
                          <div className="text-xs text-gray-600 line-clamp-2">{desc}</div>
                          <div className="mt-2 flex items-center gap-2">
                            <Chip color="emerald">ID {e.id}</Chip>
                            {tier && (
                              <Chip color="amber">
                                <Trophy className="h-3.5 w-3.5" />
                                <span>{tier[0].toUpperCase() + tier.slice(1)}</span>
                              </Chip>
                            )}
                          </div>
                        </div>
                        {selectedAchId === e.id && (
                          <Check className="h-5 w-5 text-emerald-600 ml-auto mt-1" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

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
