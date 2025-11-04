import { useEffect, useMemo, useState } from "react";
import { API } from "../config.js";
import { formatarUrlFoto } from "../utils/formatarFoto.js";

type ModeracaoItem = {
  id: string;
  criadoEm: string;
  videoUrl?: string | null;
  observacao?: string | null;
  resultado?: string | number | null;
  resultadoDeclarado?: string | number | null;
  unidadeResultado?: string | null;
  tempoMs?: number | null;
  conteudoJson?: any;
  atleta: { id: string | null; nome: string; foto: string | null };
  desafio: { id: string | null; titulo: string; pontuacao: number };
  aprovado?: boolean | null;
};

function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}
function authHeaders(extra: Record<string, string> = {}) {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

function toAbsoluteUrl(raw?: string | null) {
  if (!raw) return null;
  const v = String(raw).trim();
  if (v.startsWith("http") || v.startsWith("data:")) return v;
  if (v.startsWith("/assets/") || v.startsWith("/videos/")) return v;
  if (v.startsWith("assets/") || v.startsWith("videos/")) return `/${v}`;
  if (v.startsWith("/uploads/")) return `${API.BASE_URL}${v}`;
  if (v.startsWith("uploads/")) return `${API.BASE_URL}/${v}`;
  if (/^[\w-]{11}$/.test(v)) return `https://www.youtube.com/watch?v=${v}`;
  return `${API.BASE_URL}${v.startsWith("/") ? v : `/${v}`}`;
}
function toPlayer(raw?: string | null) {
  if (!raw) return null;
  const url = toAbsoluteUrl(raw) || raw;
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return { kind: "video" as const, src: url };
  const yt1 = url.match(/youtube\.com\/watch\?v=([^&]+)/i);
  const yt2 = url.match(/youtu\.be\/([^?]+)/i);
  if (yt1?.[1]) return { kind: "iframe" as const, src: `https://www.youtube.com/embed/${yt1[1]}` };
  if (yt2?.[1]) return { kind: "iframe" as const, src: `https://www.youtube.com/embed/${yt2[1]}` };
  return { kind: "iframe" as const, src: url };
}

function formatResultado(it: ModeracaoItem) {
  const r =
    it.resultado ??
    it.resultadoDeclarado ??
    (it as any).resultado_atleta ??
    (it as any).valor ??
    it.conteudoJson?.resultado ??
    null;

  const unidade =
    it.unidadeResultado ??
    (it as any).unidade ??
    it.conteudoJson?.unidade ??
    null;

  if (r === null || r === undefined || r === "") return "—";
  const msLike =
    typeof it.tempoMs === "number"
      ? it.tempoMs
      : unidade === "ms"
      ? Number(r)
      : null;

  if (typeof msLike === "number" && Number.isFinite(msLike)) {
    const min = Math.floor(msLike / 60000);
    const sec = Math.floor((msLike % 60000) / 1000);
    const cent = Math.floor((msLike % 1000) / 10);
    return min
      ? `${min}:${String(sec).padStart(2, "0")}.${String(cent).padStart(2, "0")}`
      : `${sec}.${String(cent).padStart(2, "0")}s`;
  }
  if (unidade === "s") return `${r}s`;
  return unidade ? `${r} ${unidade}` : String(r);
}

export default function ValidacaoVideo() {
  const [items, setItems] = useState<ModeracaoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(false);
  const [player, setPlayer] = useState<{ src: string; kind: "video" | "iframe" } | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPlayer(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

async function load(p = 1) {
  setLoading(true);
  try {
    const params1 = new URLSearchParams();
    params1.set("page", String(p));
    params1.set("pageSize", String(pageSize));
    params1.set("status", "invalido");

    let res = await fetch(`${API.BASE_URL}/api/admin/moderacao/desafios?${params1}`, {
      headers: authHeaders(),
    });
    let json = await res.json();
    let arr: ModeracaoItem[] = Array.isArray(json.items) ? json.items : [];

    if (arr.length === 0) {
      const params2 = new URLSearchParams();
      params2.set("page", String(p));
      params2.set("pageSize", String(pageSize));
      params2.set("status", "todos");
      params2.set("aprovado", "false");

      res = await fetch(`${API.BASE_URL}/api/admin/moderacao/desafios?${params2}`, {
        headers: authHeaders(),
      });
      json = await res.json();
      const raw = Array.isArray(json.items) ? json.items : [];
      arr = raw.filter((it: any) => {
        const v = (it?.aprovado ?? null);
        if (typeof v === "boolean") return v === false;
        const s = String(v).toLowerCase();
        return s === "false" || s === "0";
      });
    }

    setItems(arr);
    setTotal(json.total ?? arr.length);
    setPage(p);
    setSelected({});
  } finally {
    setLoading(false);
  }
}

  useEffect(() => { load(1).catch(() => {}); }, []);

  function toggleAllPage() {
    if (selectedIds.length === items.length) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const it of items) next[it.id] = true;
    setSelected(next);
  }

  async function aprovarUm(id: string) {
    await fetch(`${API.BASE_URL}/api/admin/moderacao/desafios/${id}/aprovar`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ aprovado: true }),
    });
  }

  async function aprovarSelecionados() {
    if (selectedIds.length === 0) return;
    setBusy(true);
    try {
      const queue = [...selectedIds];
      const workers = Math.min(5, queue.length);
      const run = async () => {
        while (queue.length) {
          const id = queue.shift()!;
          try { await aprovarUm(id); } catch {}
        }
      };
      await Promise.all(Array.from({ length: workers }, run));
      await load(page);
      alert("Submissões selecionadas aprovadas!");
    } finally {
      setBusy(false);
    }
  }

  async function aprovarTodosPendentes() {
    if (!confirm("Aprovar TODAS as submissões pendentes? Esta ação aprovará em lote.")) return;
    setBusy(true);
    try {
      let p = 1;
      for (;;) {
        const params = new URLSearchParams();
        params.set("page", String(p));
        params.set("pageSize", "100");
        params.set("status", "pendente");
        const res = await fetch(`${API.BASE_URL}/api/admin/moderacao/desafios?${params}`, {
          headers: authHeaders(),
        });
        const json = await res.json();
        const batch: ModeracaoItem[] = Array.isArray(json.items) ? json.items : [];
        if (batch.length === 0) break;

        const queue = [...batch.map((b) => b.id)];
        const workers = Math.min(6, queue.length);
        const run = async () => {
          while (queue.length) {
            const id = queue.shift()!;
            try { await aprovarUm(id); } catch {}
          }
        };
        await Promise.all(Array.from({ length: workers }, run));

        const totalRows = json.total ?? 0;
        const lastPage = Math.ceil(totalRows / 100) || 1;
        if (p >= lastPage) break;
        p += 1;
      }
      await load(1);
      alert("Todas as submissões pendentes foram aprovadas (quando possível).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-bold">Validar desafios</h3>
        <div className="flex gap-2">
          <button
            onClick={() => load(page)}
            className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
            disabled={loading || busy}
          >
            Recarregar
          </button>
          <button
            onClick={toggleAllPage}
            className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
            disabled={loading || items.length === 0}
            title="Selecionar todos da página"
          >
            {selectedIds.length === items.length ? "Limpar seleção" : "Selecionar página"}
          </button>
          <button
            onClick={aprovarSelecionados}
            className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
            disabled={busy || selectedIds.length === 0}
          >
            Aprovar selecionados
          </button>
          <button
            onClick={aprovarTodosPendentes}
            className="px-3 py-1 rounded bg-green-800 text-white disabled:opacity-50"
            disabled={busy}
            title="Busca e aprova em lote todas as submissões com status pendente"
          >
            Aprovar TODOS pendentes
          </button>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2"><input
                type="checkbox"
                onChange={toggleAllPage}
                checked={items.length > 0 && selectedIds.length === items.length}
                aria-label="selecionar todos"
              /></th>
              <th className="px-3 py-2 text-left">Atleta</th>
              <th className="px-3 py-2 text-left">Desafio</th>
              <th className="px-3 py-2 text-left">Resultado</th>
              <th className="px-3 py-2 text-left">Enviado</th>
              <th className="px-3 py-2 text-left">Vídeo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const fotoAtleta = formatarUrlFoto(it.atleta.foto, "usuarios") || "/default-profile.png";
              const marcado = !!selected[it.id];
              return (
                <tr key={it.id} className="border-t">
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={(e) => setSelected((s) => ({ ...s, [it.id]: e.target.checked }))}
                      aria-label="selecionar linha"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <img src={fotoAtleta} className="w-8 h-8 rounded-full object-cover border" />
                      <div className="font-medium">{it.atleta.nome}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {it.desafio.titulo}{" "}
                    <span className="text-xs text-gray-600">({it.desafio.pontuacao} pts)</span>
                  </td>
                  <td className="px-3 py-2">
                    <div>{formatResultado(it)}</div>
                    {it.observacao && <div className="text-xs text-gray-500">{it.observacao}</div>}
                  </td>
                  <td className="px-3 py-2">{new Date(it.criadoEm).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2">
                    {it.videoUrl ? (
                      <button
                        className="text-blue-600 underline"
                        onClick={() => {
                          const p = toPlayer(it.videoUrl);
                          if (p) setPlayer(p);
                        }}
                      >
                        ver vídeo
                      </button>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await aprovarUm(it.id);
                          setItems((arr) => arr.filter((x) => x.id !== it.id));
                          setSelected((s) => {
                            const n = { ...s };
                            delete n[it.id];
                            return n;
                          });
                        } finally { setBusy(false); }
                      }}
                    >
                      Aprovar
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  Nenhuma submissão pendente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3">
        <button
          disabled={page <= 1 || loading}
          onClick={() => load(page - 1)}
          className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
        >
          Anterior
        </button>
        <div className="text-sm text-gray-600">
          {loading ? "Carregando…" : `Página ${page} • ${total} pendentes`}
        </div>
        <button
          disabled={(page * pageSize) >= total || items.length < pageSize || loading}
          onClick={() => load(page + 1)}
          className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
        >
          Próxima
        </button>
      </div>

      {player && (
        <div className="fixed inset-0 z-[70] grid place-items-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPlayer(null)} />
          <div className="relative z-10">
            {player.kind === "video" ? (
              <video
                src={player.src}
                controls
                autoPlay
                className="block max-w-[92vw] max-h-[90vh] rounded-lg shadow-xl"
              />
            ) : (
              <div className="rounded-lg shadow-xl overflow-hidden">
                <iframe
                  src={player.src}
                  className="block w-[min(92vw,calc(90vh*16/9))] h-[min(90vh,calc(92vw*9/16))]"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  referrerPolicy="no-referrer"
                  allowFullScreen
                />
              </div>
            )}
            <button
              onClick={() => setPlayer(null)}
              className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full shadow p-2"
              title="Fechar"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
