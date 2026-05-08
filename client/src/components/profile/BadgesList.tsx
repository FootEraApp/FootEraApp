import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog.js";
import { Button } from "../ui/button.js";
import { Textarea } from "../ui/textarea.js";
import { Share2, Pencil, Check, Star, StarOff } from "lucide-react";
import { Link } from "wouter";

type Earned = {
  id: string;
  entity: string;
  title: string;
  description: string;
  icon?: string;
  tier?: "bronze" | "prata" | "ouro" | "platina";
  group: string;
};

type LegacyBadge = {
  id: string;
  nome: string;
  icon: string;
  iconUrl?: string;
};

const HIDE_PATTERNS = [
  /disciplina/i,
  /responsabilidade/i,
  /pontualidade/i,
  /lideran[cç]a/i,
];

function isHiddenTitle(t: string) {
  return HIDE_PATTERNS.some((r) => r.test(t));
}
function tierScore(t?: Earned["tier"]) {
  if (t === "platina") return 4;
  if (t === "ouro") return 3;
  if (t === "prata") return 2;
  if (t === "bronze") return 1;
  return 0;
}
function extractNum(s: string) {
  const all = [...String(s).matchAll(/\d+/g)];
  if (!all.length) return 0;
  return Math.max(...all.map((m) => parseInt(m[0], 10)));
}
function chooseHardest(list: Earned[], k = 6) {
  const filtered = list.filter((b) => !isHiddenTitle(b.title));
  return filtered
    .sort((a, b) => {
      const tb = tierScore(b.tier) - tierScore(a.tier);
      if (tb !== 0) return tb;
      const nb = extractNum(b.title) || extractNum(b.id);
      const na = extractNum(a.title) || extractNum(a.id);
      return nb - na;
    })
    .slice(0, k);
}
function extractTierFromDescricao(desc?: string | null): Earned["tier"] {
  if (!desc) return undefined;
  const m = desc.match(/Tier:\s*(bronze|prata|ouro|platina)/i);
  const t = (m?.[1] || "").toLowerCase();
  if (t === "bronze" || t === "prata" || t === "ouro" || t === "platina") return t;
  return undefined;
}

function extractGrupoFromDescricao(desc?: string | null): string | null {
  if (!desc) return null;
  const m = desc.match(/Grupo:\s*([^\n\r•]+)/i);
  const g = m?.[1]?.trim();
  return g ? g : null;
}

function groupLabelFromTipo(tipo?: string | null): string {
  const t = String(tipo || "").toUpperCase();
  if (t === "TREINO") return "Treinos";
  if (t === "DESAFIO") return "Desafios";
  if (t === "PERFIL") return "Pontuação";
  if (t === "ORGANIZACAO") return "Gestão";
  if (t === "EVENTO") return "Eventos";
  if (t === "METODOLOGIA") return "Metodologias";
  return "Outros";
}

function entityLabelFromOwnerTipo(ownerTipo?: string | null): string {
  const t = String(ownerTipo || "").toLowerCase();

  if (t === "learning") return "Learning";
  if (t === "marca") return "Marca";
  if (t === "federacao") return "Federação";
  if (t === "atleta") return "Atleta";
  if (t === "professor") return "Professor";
  if (t === "clube") return "Clube";
  if (t === "escolinha") return "Escolinha";

  return "Perfil";
}

function BadgeIcon({
  emoji,
  img,
  alt,
}: {
  emoji?: string;
  img?: string;
  alt: string;
}) {
  const [err, setErr] = useState(false);
  if (img && !err) {
    return (
      <img
        src={img}
        alt={alt}
        className="w-12 h-12 mb-2"
        onError={() => setErr(true)}
      />
    );
  }
  return <span className="text-2xl mb-2">{emoji || "🏆"}</span>;
}

export function BadgesList({
  userId,
  badges = [],
}: {
  userId?: string | null;
  badges?: LegacyBadge[];
}) {
  const ownerId =
    userId || (Storage as any)?.usuarioId || (Storage as any)?.usuarioid || "";

  const [earned, setEarned] = useState<Earned[]>([]);
  const [loading, setLoading] = useState(true);
  const [openShare, setOpenShare] = useState(false);
  const [selected, setSelected] = useState<Earned | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [editMode, setEditMode] = useState(false);

  const LOCAL_KEY = useMemo(
    () => `profile.badgeHighlights:${ownerId || "me"}`,
    [ownerId]
  );
  const [highlightIds, setHighlightIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(highlightIds));
  }, [LOCAL_KEY, highlightIds]);

  useEffect(() => {
    let cancelled = false;

    async function fetchEarned() {
      setLoading(true);
      try {
        if (!ownerId) {
          setEarned([]);
          setLoading(false);
          return;
        }

        const url = `${API.BASE_URL.replace(/\/+$/, "")}/api/conquistas/${ownerId}?sync=1`;
        const r = await axios.get(url, {
          withCredentials: true,
          headers: (Storage as any)?.token
            ? { Authorization: `Bearer ${(Storage as any).token}` }
            : undefined,
        });
        if (cancelled) return;

        const ownerTipo = r.data?.ownerTipo;
        const entityLabel = entityLabelFromOwnerTipo(ownerTipo);
        const earnedRaw = Array.isArray(r.data?.earned) ? r.data.earned : [];
        const onlyDone = earnedRaw.filter((e: any) => Boolean(e?.concluida));

        setEarned(
          onlyDone.map((e: any) => {
            const c = e?.conquista || {};
            const desc = c?.descricao ?? null;

            const group =
              extractGrupoFromDescricao(desc) || groupLabelFromTipo(c?.tipo);

            const tier =
              extractTierFromDescricao(desc) ||
              (typeof c?.tier === "string" ? c.tier : undefined);

            return {
              id: String(c?.id ?? e?.conquistaId ?? e?.id ?? ""),
              title: String(c?.titulo ?? ""),
              description: String(c?.descricao ?? ""),
              icon: c?.icon ?? undefined,
              tier,
              group,
              entity: entityLabel,
            } as Earned;
          }).filter((x: Earned) => Boolean(x.id) && Boolean(x.title))
        );
      } catch (e) {
        setEarned([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchEarned();
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  const earnedFiltered = useMemo(
    () => earned.filter((b) => !isHiddenTitle(b.title)),
    [earned]
  );

  const highlightList = useMemo(() => {
    if (highlightIds.length > 0) {
      const map = new Set(highlightIds);
      const onlyOwned = earnedFiltered.filter((b) => map.has(b.id));
      const need = Math.max(0, 6 - onlyOwned.length);
      if (need === 0) return onlyOwned;
      const extra = chooseHardest(
        earnedFiltered.filter((b) => !map.has(b.id))
      ).slice(0, need);
      return [...onlyOwned, ...extra];
    }
    return chooseHardest(earnedFiltered, 6);
  }, [highlightIds, earnedFiltered]);

  const allOwnedSorted = useMemo(
    () => chooseHardest(earnedFiltered, Number.MAX_SAFE_INTEGER),
    [earnedFiltered]
  );

  async function handleShare() {
    if (!selected) return;
    try {
      await axios.post(
        `${API.BASE_URL}/api/conquistas/compartilhar`,
        { conquistaId: selected.id, mensagem },
        Storage?.token
          ? { headers: { Authorization: `Bearer ${Storage.token}` } }
          : undefined
      );
      setOpenShare(false);
      setMensagem("");
      alert("Conquista compartilhada no feed! 🎉");
    } catch (e) {
      console.error(e);
      alert("Não foi possível compartilhar. Tente novamente.");
    }
  }

  function toggleHighlight(id: string) {
    setHighlightIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const usingLegacy = false;
  const legacyToShow = useMemo(() => badges.slice(0, 6), [badges]);

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-green-900 text-xl">
          <Link
            href="/perfil/conquistas"
            className="hover:underline underline-offset-4 decoration-2 focus:outline-none focus:ring-2 focus:ring-green-600 rounded"
          >
            Conquistas
          </Link>
        </h1>

        {earnedFiltered.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant={editMode ? "default" : "secondary"}
              className="h-8 px-3 text-xs"
              onClick={() => setEditMode((v) => !v)}
              title={editMode ? "Concluir edição" : "Editar destaques"}
            >
              {editMode ? (
                <>
                  <Check className="w-4 h-4 mr-1" /> Concluir
                </>
              ) : (
                <>
                  <Pencil className="w-4 h-4 mr-1" /> Editar
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {!editMode && (
        <div className="p-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border p-3 flex flex-col items-center text-center animate-pulse bg-white"
                >
                  <div className="w-12 h-12 mb-2 rounded bg-gray-200" />
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : usingLegacy ? (
            <div className="grid grid-cols-3 gap-3">
              {legacyToShow.map((b) => (
                <div
                  key={b.id}
                  className="rounded-lg border p-3 flex flex-col items-center text-center bg-white"
                >
                  <BadgeIcon
                    img={b.iconUrl || `/assets/badges/${b.icon}.png`}
                    emoji="🏅"
                    alt={b.nome}
                  />
                  <span className="text-sm font-medium text-green-800">
                    {b.nome}
                  </span>
                </div>
              ))}
            </div>
          ) : highlightList.length ? (
            <div className="grid grid-cols-3 gap-3">
              {highlightList.map((b) => (
                <div
                  key={b.id}
                  className="rounded-lg border p-3 flex flex-col items-center text-center bg-white"
                >
                  <BadgeIcon emoji={b.icon} alt={b.title} />
                  <span className="text-sm font-medium text-green-800">
                    {b.title}
                  </span>
                  <Button
                    className="mt-2 h-8 text-xs bg-transparent border-gray-300 hover:bg-gray-100"
                    variant="secondary"
                    onClick={() => {
                      setSelected(b);
                      setOpenShare(true);
                    }}
                  >
                    <Share2 className="w-3.5 h-3.5 mr-1" /> Compartilhar
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground px-4">
              Nenhuma conquista por enquanto. Bora treinar e participar de
              desafios! 💪
            </p>
          )}
        </div>
      )}

      {editMode && (
        <div className="p-4">
          <p className="text-xs text-gray-600 mb-2">
            Selecione as conquistas que você quer exibir no seu perfil (até 6).
          </p>
          <div className="grid grid-cols-3 gap-3">
            {allOwnedSorted.map((b) => {
              const checked = highlightIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => toggleHighlight(b.id)}
                  className={
                    "rounded-lg border p-3 flex flex-col items-center text-center bg-white transition " +
                    (checked
                      ? "border-green-600 ring-2 ring-green-600/40"
                      : "border-gray-200")
                  }
                  title={b.title}
                >
                  <BadgeIcon emoji={b.icon} alt={b.title} />
                  <span className="text-sm font-medium text-green-800">
                    {b.title}
                  </span>
                  <span className="mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                    {b.tier ?? ""}
                  </span>
                  <div className="mt-2 flex items-center gap-1 text-xs">
                    {checked ? (
                      <>
                        <Star className="w-3.5 h-3.5" /> Destacado
                      </>
                    ) : (
                      <>
                        <StarOff className="w-3.5 h-3.5" /> Selecionar
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-gray-600">
            Selecionados: <b>{highlightIds.length}</b> / 6
          </div>
        </div>
      )}

      <div className="px-4 pb-2">
        <Link
          href={`/perfil/conquistas?usuarioId=${encodeURIComponent(ownerId || "")}`}
          className="text-sm text-green-800 hover:underline"
        >
          Ver todas as conquistas →
        </Link>
      </div>

      <Dialog open={openShare} onOpenChange={setOpenShare}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartilhar conquista</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3">
            {selected && (
              <>
                <div className="w-12 h-12 flex items-center justify-center text-2xl">
                  {selected.icon || "🏆"}
                </div>
                <div>
                  <div className="font-semibold">{selected.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Isso aparecerá no seu feed
                  </div>
                </div>
              </>
            )}
          </div>
          <Textarea
            placeholder={`Escreva algo sobre "${selected?.title}" (opcional)`}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={handleShare}>Postar no feed</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
