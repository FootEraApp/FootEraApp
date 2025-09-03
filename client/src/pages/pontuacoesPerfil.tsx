import { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { Link, useLocation, useRoute } from "wouter";
import { BarChart2, Timer, KeyRound, Play, CheckCircle, AlertCircle, Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import CardAtletaShield from "../components/cards/CardAtletaShield.js";
import * as htmlToImage from "html-to-image";
import { publicImgUrl } from "@/utils/publicUrl.js";
import api from "@/lib/api.js";

type PerfilResp = {
  tipo: "Atleta" | "Professor" | "Escolinha" | "Clube" | null;
  usuario: { nome: string; email?: string; foto?: string | null };
  dadosEspecificos: any;
};

type PontuacaoWire = {
  performance?: number;
  disciplina?: number;
  responsabilidade?: number;
  ultimaAtualizacao?: string;
  historico?: any[];
  videos?: string[];
};

type PontuacaoDTO = {
  atletaId: string | null;
  total: number;
  performance: number;
  disciplina: number;
  responsabilidade: number;
  mediaGeral: number;
  ultimaAtualizacao: string;
};

type PosicaoAtualResp = {
  origem: "elenco" | "atleta";
  posicao: string | null;
  atletaId: string;
  usuarioId: string;
  elenco?: { id: string; nome: string; ativo: boolean };
  numeroCamisa?: number | null;
  updatedAt?: string | null;
};

const readToken = () => {
  const t1 = (Storage as any)?.token;
  const t2 =
    (typeof window !== "undefined" &&
      (localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        localStorage.getItem("jwt"))) ||
    null;
  const token = t1 || t2 || null;
  if (!token || token === "null" || token === "undefined") return null;
  return token;
};

api.interceptors.request.use((config) => {
  const token = readToken();
  if (token) {
    config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` } as any;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem("token");
          localStorage.removeItem("authToken");
          localStorage.removeItem("jwt");
        }
        if (Storage) (Storage as any).token = null;
      } catch {}
    }
    return Promise.reject(err);
  }
);

async function safeGet<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const res = await api.get<T>(url, { signal: signal as any, validateStatus: () => true, timeout: 10000, });
  if (res.status === 200) return res.data;
  if (res.status === 404) return null;
  if (res.status === 401) throw Object.assign(new Error("401"), { code: 401 });
  if (res.status >= 500) throw Object.assign(new Error("5xx"), { code: res.status });
  return null;
}

function fixFotoPath(f?: string | null) {
  if (!f) return null;
  if (/^https?:\/\//i.test(f)) return f;

  let rel = f.startsWith("/assets/") ? f : `/assets/usuarios/${f}`;
  rel = rel.replace(/\/\d+-([^/]+\.(?:png|jpe?g|webp|gif))$/i, "/$1");

  return `${API.BASE_URL}${rel}`;
}

export default function PontuacaoDetalhada() {
  const [, setLocation] = useLocation();
  const [matchedWithId, params] = useRoute<{ id: string }>("/perfil/:id/pontuacao");

  const [postando, setPostando] = useState(false);
  const IMG_PLACEHOLDER =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420"><rect width="100%" height="100%" fill="%23eee"/></svg>';
  const cardShotRef = useRef<HTMLDivElement | null>(null);

  const targetUserId: string =
    (matchedWithId && params?.id) ? params.id :
    ((Storage as any)?.usuarioId as string);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [perfil, setPerfil] = useState<{
    atletaId: string | null;
    nome: string;
    foto?: string | null;
    posicao?: string | null;
  }>({ atletaId: null, nome: "" });

  const [pontos, setPontos] = useState<PontuacaoDTO | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [videos, setVideos] = useState<string[]>([]);

  const isMobile = typeof window !== "undefined" ? window.innerWidth <= 768 : false;
  const CARD_SIZE = useMemo(() => {
    if (isMobile) {
      const w = (typeof window !== "undefined" ? window.innerWidth : 360) - 32;
      const h = (typeof window !== "undefined" ? window.innerHeight : 640) * 0.7;
      return { w, h };
    }
    return { w: 300, h: 420 };
  }, [isMobile]);

  async function preloadImgs(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll("img, image")) as (HTMLImageElement | SVGImageElement)[];
  await Promise.all(
    imgs.map((el) => new Promise<void>((resolve) => {
      const url = (el as any).src || (el as any).href?.baseVal || (el as any).href;
      if (!url) return resolve();
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve();
      im.onerror = () => resolve();
      im.src = url;
      if ((el as any).crossOrigin !== undefined) (el as any).crossOrigin = "anonymous";
      if (el instanceof HTMLImageElement && el.complete && el.naturalWidth) resolve();
    }))
  );
}

  useEffect(() => {
  const token = readToken();

  if (!token) {
    setLoading(false);
    setLocation("/login");
    return;
  }

  const rawUid = (Storage as any)?.usuarioId;
  const selfUid = !rawUid || rawUid === "null" || rawUid === "undefined" ? null : String(rawUid);
  const targetUid: string | null = (matchedWithId && params?.id) ? params.id : selfUid;

  if (!targetUid) {
    setLoading(false);
    setErro("Não foi possível identificar o usuário.");
    return;
  }

  setLoading(true);
  setErro(null);
  const controller = new AbortController();

  (async () => {
    try {
      const perfilResp = await safeGet<PerfilResp>(
        `/api/perfil/${encodeURIComponent(targetUid)}`,
        controller.signal
      );
      const nomeBase = perfilResp?.usuario?.nome ?? "";
      const fotoBase = perfilResp?.usuario?.foto ?? null;
      const tipo = perfilResp?.tipo ?? null;

      let atletaId: string | null = null;
      let posicaoPerfil: string | null = null;
      let foto: string | null | undefined = fotoBase;

      if (tipo === "Atleta" && perfilResp?.dadosEspecificos) {
        posicaoPerfil = perfilResp.dadosEspecificos.posicao ?? null;
        if (perfilResp.dadosEspecificos.foto) {
          foto = perfilResp.dadosEspecificos.foto;
        }
      }

      // defina uma flag: é o próprio usuário?
      const isMe = String(targetUid) === String((Storage as any)?.usuarioId);

      // POSIÇÃO ATUAL (mantém /me quando for você mesmo)
      const posUrl = isMe
        ? `/api/perfil/me/posicao-atual`
        : `/api/perfil/${encodeURIComponent(targetUid)}/posicao-atual`;

      console.log("[PosicaoAtual] GET:", posUrl);
      const posAtual = await safeGet<PosicaoAtualResp>(posUrl, controller.signal);

      // PONTUAÇÃO (use /me quando for você mesmo)
      const pontuacaoUrl = isMe
        ? `/api/perfil/me/pontuacao`
        : `/api/perfil/${encodeURIComponent(targetUid)}/pontuacao`;

      console.log("[Pontuacao] GET:", pontuacaoUrl);
      const wire = await safeGet<PontuacaoWire>(pontuacaoUrl, controller.signal);
      console.log("[Pontuacao] RES:", wire);


      let posicaoVigente: string | null | undefined = undefined;
      if (posAtual) {
        posicaoVigente = posAtual.posicao ?? null;
        if (!atletaId && posAtual.atletaId) {
          atletaId = posAtual.atletaId;
        }
      }

      const fotoAbs = publicImgUrl(foto) ?? fixFotoPath(foto);

      setPerfil({
        atletaId,
        nome: nomeBase,
        foto: fotoAbs,
        posicao: posicaoVigente ?? posicaoPerfil ?? undefined,
      });

      const perf = Number(wire?.performance ?? 0);
      const disc = Number(wire?.disciplina ?? 0);
      const resp = Number(wire?.responsabilidade ?? 0);
      const total = perf + disc + resp;
      const mediaGeral = Math.round(total / 3);

      setPontos({
        atletaId,
        total,
        performance: perf,
        disciplina: disc,
        responsabilidade: resp,
        mediaGeral,
        ultimaAtualizacao: wire?.ultimaAtualizacao || new Date().toISOString(),
      });

      setHistorico(Array.isArray(wire?.historico) ? wire!.historico! : []);
      setVideos(Array.isArray(wire?.videos) ? wire!.videos! : []);
    } catch (err: any) {
      console.error("[PontuacaoDetalhada] Falha geral", {
        msg: err?.message,
        code: err?.code,
        status: err?.response?.status,
        data: err?.response?.data,
      });
      if (!axios.isCancel(err)) {
        if (err?.code === 401 || (axios.isAxiosError(err) && err.response?.status === 401)) {
          setErro("Sua sessão expirou. Faça login novamente.");
          setLocation("/login");
        } else {
          setErro("Não foi possível carregar seu perfil agora. Tente novamente mais tarde.");
        }
      }
    } finally {
      setLoading(false);
    }
  })();

  return () => controller.abort();
}, [matchedWithId, params?.id, setLocation]);

  useEffect(() => {
    if (!loading && typeof window !== "undefined" && window.location.hash === "#detalhes") {
      const el = document.getElementById("detalhes");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading]);

  function buildForm(conteudo: string, blob: Blob) {
    const form = new FormData();
    form.append("conteudo", conteudo);
    form.append("imagem", new File([blob], "card.png", { type: "image/png" }));
    return form;
  }

 async function postarMeuCard() {
  if (postando) return;
  setPostando(true);
  try {
    const token = readToken();
    if (!token) { setLocation("/login"); return; }

    const perf = pontos?.performance ?? 0;
    const disc = pontos?.disciplina ?? 0;
    const resp = pontos?.responsabilidade ?? 0;
    const ovr  = pontos?.mediaGeral ?? Math.round((perf + disc + resp) / 3);

    const descricaoBase =
      `Meu Card FOOTERA\n` +
      `OVR: ${ovr}\n` +
      `Performance: ${perf} pts\n` +
      `Disciplina: ${disc} pts\n` +
      `Responsabilidade: ${resp} pts`;

    const descricao = `${descricaoBase}\u200D`;

    const node = cardShotRef.current;
    if (!node) { alert("Não consegui capturar o card."); return; }

    await preloadImgs(node);
    await new Promise(r => requestAnimationFrame(r as any));

    const dataUrl = await htmlToImage.toPng(node, {
      pixelRatio: 2,
      cacheBust: true,
      imagePlaceholder: IMG_PLACEHOLDER,
    });

    let res = await api.post("/api/post",
      { descricao, midiaBase64: dataUrl },
      { validateStatus: () => true }
    );

    if (res.status === 400) {
      res = await api.post("/api/post",
        { descricao, imagemBase64: dataUrl },
        { validateStatus: () => true }
      );
    }

    if (res.status === 400) {
      const blob = await (await fetch(dataUrl)).blob();

      const fdA = new FormData();
      fdA.append("descricao", descricao);
      fdA.append("midia", new File([blob], "card.png", { type: "image/png" }));
      res = await api.post("/api/post", fdA, { validateStatus: () => true });

      if (res.status === 400) {
        const fdB = new FormData();
        fdB.append("descricao", descricao);
        fdB.append("imagem", new File([blob], "card.png", { type: "image/png" }));
        res = await api.post("/api/post", fdB, { validateStatus: () => true });
      }
    }

    if (res.status >= 200 && res.status < 300) {
      const postId = res.data?.id || res.data?.post?.id || res.data?.postagem?.id || res.data?.data?.id;
      if (postId) setLocation(`/post/${postId}`); else alert("Post criado, mas sem ID para redirecionar.");
    } else {
      console.error("Falha ao criar post:", res.status, res.data);
      alert(res.data?.message || res.data?.error || "Não foi possível criar o post agora.");
    }
  } catch (e) {
    console.error(e);
    alert("Falha ao publicar seu card.");
  } finally {
    setPostando(false);
  }
}

  return (
    <div className="min-h-screen bg-transparent pb-28">
      <header className="bg-green-900 text-white text-center py-3 text-xl font-bold">FOOTERA</header>

      {loading && (
        <div className="mx-4 mt-4 rounded-md bg-yellow-50 text-yellow-900 border border-yellow-200 p-3 text-sm flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" fill="none" />
          </svg>
          Carregando perfil...
        </div>
      )}

      {erro && !loading && (
        <div className="mx-4 mt-4 rounded-md bg-red-50 text-red-900 border border-red-200 p-3 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {erro}
        </div>
      )}

      {!loading && (
        <>
          <section className="mx-4 mt-4">
            {perfil.atletaId ? (
              <div className="flex flex-col items-center gap-3">
                <div ref={cardShotRef}>
                  <CardAtletaShield
                    atleta={{
                      atletaId: perfil.atletaId,
                      nome: perfil.nome,
                      foto: perfil.foto,
                      posicao: perfil.posicao,
                      idade: null,
                    }}
                    ovr={pontos?.mediaGeral ?? 0}
                    perf={pontos?.performance ?? 0}
                    disc={pontos?.disciplina ?? 0}
                    resp={pontos?.responsabilidade ?? 0}
                    size={{ w: CARD_SIZE.w, h: CARD_SIZE.h }}
                    goldenMinOVR={88}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={postarMeuCard}
                    disabled={postando}
                    className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {postando ? "Publicando..." : "Postar meu card"}
                  </button>
                  <button
                    onClick={() => setLocation("/mensagens")}
                    className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Enviar em mensagens
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-md bg-white shadow p-4 text-sm text-gray-700">
                Não encontramos seu cadastro de atleta ainda.
              </div>
            )}
          </section>

          <h2 id="detalhes" className="text-green-900 font-bold text-lg px-4 mt-4 mb-2">
            Detalhes da Pontuação
          </h2>

          <section className="bg-green-900 mx-4 p-4 rounded-xl text-white text-center mb-4">
            <h3 className="font-bold mb-2">MINHA PONTUAÇÃO FOOTERA</h3>
            <div className="bg-white text-green-900 rounded-lg p-3 space-y-3">
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-2 font-semibold">
                  <BarChart2 /> PERFORMANCE
                </div>
                <div>{pontos?.performance ?? 0} pts</div>
              </div>
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Timer /> DISCIPLINA
                </div>
                <div>{pontos?.disciplina} pts</div>
              </div>
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-2 font-semibold">
                  <KeyRound /> RESPONSABILIDADE
                </div>
                <div>{pontos?.responsabilidade} pts</div>
              </div>
            </div>
            {pontos?.ultimaAtualizacao && (
              <p className="text-xs mt-2 opacity-80">
                Última atualização: {new Date(pontos.ultimaAtualizacao).toLocaleString()}
              </p>
            )}
          </section>

          <section className="bg-white mx-4 p-4 rounded-xl shadow mb-4">
            <h3 className="text-green-900 font-bold mb-2">Histórico Completo</h3>
            {historico.length === 0 && <p className="text-sm text-gray-500">Sem eventos por enquanto.</p>}
            {historico.map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  {item.tipo === "Desafio" ? (
                    <CheckCircle className="text-green-600" />
                  ) : (
                    <Play className="text-green-600" />
                  )}
                  <div>
                    <div className="font-semibold">
                      {item.titulo} - {item.tipo} {item.status}
                    </div>
                    <div className="text-sm text-gray-600">
                      {item.data}
                      {item.duracao ? ` • ${item.duracao}` : ""}{" "}
                      {typeof item.pontuacao === "number" ? `• +${item.pontuacao} pts` : ""}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="bg-white mx-4 p-4 rounded-xl shadow mb-4">
            <h3 className="text-green-900 font-bold mb-2">Galeria de Vídeos</h3>
            <div className="flex gap-2 overflow-x-auto">
              {videos.map((url, idx) =>
                url.includes(".mp4") || url.includes("youtube") ? (
                  <video key={idx} src={url} controls className="w-40 h-24 rounded-lg shadow" />
                ) : (
                  <img key={idx} src={url} alt={`Vídeo ${idx}`} className="w-40 h-24 rounded-lg shadow" />
                )
              )}
            </div>
          </section>

          <section className="bg-white mx-4 rounded-xl shadow mb-4">
            <button
              onClick={() => alert("Abrir conexões")}
              className="bg-white w-full p-4 text-left rounded-xl mb-2 text-green-900 font-semibold flex justify-between"
            >
              Conexões <span>›</span>
            </button>
            <button
              onClick={() => alert("Abrir info adicionais")}
              className="bg-white w-full p-4 text-left rounded-xl text-green-900 font-semibold flex justify-between"
            >
              Informações Adicionais <span>›</span>
            </button>
          </section>
        </>
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