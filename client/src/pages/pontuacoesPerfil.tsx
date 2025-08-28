// client/src/pages/pontuacoesPerfil.tsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useLocation } from "wouter";
import { CalendarClock, Volleyball, User, CirclePlus, Search, House, CircleX, CircleCheck, Send, Share2, Trash2} from "lucide-react";
import { BarChart2, Timer, KeyRound, CheckCircle, Play, AlertCircle } from "lucide-react";
import Storage from "../../../server/utils/storage";
import { API } from "../config";
import CardAtletaShield from "../components/cards/CardAtletaShield";
import { formatarUrlFoto } from "@/utils/formatarFoto";

type PerfilResp = {
  tipo: "Atleta" | "Professor" | "Escolinha" | "Clube" | null;
  usuario: { nome: string; email?: string; foto?: string | null };
  dadosEspecificos: any;
};

type PontuacaoDTO = {
  atletaId: string;
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

// -------------------- Axios + token --------------------
const api = axios.create({ baseURL: API.BASE_URL || "http://localhost:3001" });

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

// -------------------- Helpers --------------------
async function safeGet<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const res = await api.get<T>(url, { signal: signal as any, validateStatus: () => true });
  if (res.status === 200) return res.data;
  if (res.status === 404) return null;
  if (res.status === 401) throw Object.assign(new Error("401"), { code: 401 });
  if (res.status >= 500) throw Object.assign(new Error("5xx"), { code: res.status });
  return null;
}

// tenta /me/* e cai pra /:id/* (id = userIdForRoutes)
async function getWithFallback<T>(
  meUrl: string,
  idUrl: string,
  signal?: AbortSignal
): Promise<T | null> {
  const me = await safeGet<T>(meUrl, signal);
  if (me !== null) return me;
  return await safeGet<T>(idUrl, signal);
}

// -------------------- Componente --------------------
export default function PontuacaoDetalhada() {
  const [, setLocation] = useLocation();

  // ⚠️ use sempre o id certo para rotas /:id/*:
  const userIdForRoutes: string | null =
    ((Storage as any)?.tipoUsuarioId as string) || ((Storage as any)?.usuarioId as string) || null;

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

  useEffect(() => {
    const token = readToken();

    if (!token) {
      setLoading(false);
      setLocation("/login");
      return;
    }

    if (!userIdForRoutes) {
      setLoading(false);
      setErro("Não foi possível identificar seu usuário.");
      return;
    }

    setLoading(true);
    setErro(null);
    const controller = new AbortController();

    (async () => {
      try {
        // 1) Perfil base (sempre por /:id)
        const perfilResp = await safeGet<PerfilResp>(`/api/perfil/${Storage.usuarioId}`, controller.signal);
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
          // geralmente o backend não retorna atletaId aqui
        }

        // 2) Posição vigente: tenta /me, cai para /:id (com userIdForRoutes)
        const posAtual = await getWithFallback<PosicaoAtualResp>(
          `/api/perfil/me/posicao-atual`,
          `/api/perfil/${userIdForRoutes}/posicao-atual`,
          controller.signal
        );
        let posicaoVigente: string | null | undefined = undefined;
        if (posAtual) {
          posicaoVigente = posAtual.posicao ?? null;
          if (!atletaId && posAtual.atletaId) {
            atletaId = posAtual.atletaId;
          }
        }

        setPerfil({
          atletaId,
          nome: nomeBase,
          foto,
          posicao: posicaoVigente ?? posicaoPerfil ?? undefined,
        });

        // 3) Pontuação/me: tenta /me, cai para /:id (com userIdForRoutes)
        const pontuacaoPerfil = await getWithFallback<any>(
          `/api/perfil/me/pontuacao`,
          `/api/perfil/${userIdForRoutes}/pontuacao`,
          controller.signal
        );

        // 4) Pontos agregados via /treinos (para OVR)
        if (atletaId) {
          const resPts = await api.get<PontuacaoDTO[]>(`/api/treinos/pontuacoes`, {
            params: { atletaIds: atletaId },
            signal: controller.signal as any,
            validateStatus: () => true,
          });

          if (resPts.status === 200 && Array.isArray(resPts.data) && resPts.data[0]) {
            setPontos(resPts.data[0]);
          } else if (pontuacaoPerfil) {
            const perf = Number(pontuacaoPerfil.performance || 0);
            const disc = Number(pontuacaoPerfil.disciplina || 0);
            const resp = Number(pontuacaoPerfil.responsabilidade || 0);
            const mediaGeral = Math.round((perf + disc + resp) / 3);
            setPontos({
              atletaId,
              total: perf + disc + resp,
              performance: perf,
              disciplina: disc,
              responsabilidade: resp,
              mediaGeral,
              ultimaAtualizacao: new Date().toISOString(),
            });
          } else {
            setPontos(null);
          }
        } else if (pontuacaoPerfil) {
          const perf = Number(pontuacaoPerfil.performance || 0);
          const disc = Number(pontuacaoPerfil.disciplina || 0);
          const resp = Number(pontuacaoPerfil.responsabilidade || 0);
          const mediaGeral = Math.round((perf + disc + resp) / 3);
          setPontos({
            atletaId: "",
            total: perf + disc + resp,
            performance: perf,
            disciplina: disc,
            responsabilidade: resp,
            mediaGeral,
            ultimaAtualizacao: new Date().toISOString(),
          });
        } else {
          setPontos(null);
        }

        // 5) Histórico/Vídeos
        setHistorico(Array.isArray(pontuacaoPerfil?.historico) ? pontuacaoPerfil!.historico : []);
        setVideos(Array.isArray(pontuacaoPerfil?.videos) ? pontuacaoPerfil!.videos : []);
      } catch (err: any) {
        if (!axios.isCancel(err)) {
          console.error("Erro ao carregar perfil/pontuação:", err);
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
  }, [userIdForRoutes, setLocation]);

  useEffect(() => {
    if (!loading && typeof window !== "undefined" && window.location.hash === "#detalhes") {
      const el = document.getElementById("detalhes");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading]);

  const perf = pontos?.performance ?? 0;
  const disc = pontos?.disciplina ?? 0;
  const resp = pontos?.responsabilidade ?? 0;
  const ovr = (pontos?.mediaGeral ?? Math.round((perf + disc + resp) / 3)) ?? 0;

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
              <div className="flex flex-col items-center">
                <CardAtletaShield
                  atleta={{
                    atletaId: perfil.atletaId,
                    nome: perfil.nome,
                    foto: formatarUrlFoto(perfil.foto),
                    posicao: perfil.posicao,
                    idade: null,
                  }}
                  ovr={ovr}
                  perf={perf}
                  disc={disc}
                  resp={resp}
                  size={{ w: CARD_SIZE.w, h: CARD_SIZE.h }}
                  goldenMinOVR={88}
                />
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
                <div>{perf} pts</div>
              </div>
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Timer /> DISCIPLINA
                </div>
                <div>{disc} pts</div>
              </div>
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-2 font-semibold">
                  <KeyRound /> RESPONSABILIDADE
                </div>
                <div>{resp} pts</div>
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

      {/* Barra de navegação fixa no rodapé */}
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
