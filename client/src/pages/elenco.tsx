// client/src/pages/elenco.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DroppableProps,
} from "@hello-pangea/dnd";
import axios from "axios";
import Storage from "../../../server/utils/storage";
import { API } from "../config";

const ELENCOS_BASE = `${API.BASE_URL}/api/treinos/elencos`;
const PONTOS_BASE  = `${API.BASE_URL}/api/treinos/pontuacoes`;

// ----------------- TIPOS -----------------
type PontuacaoDTO = {
  atletaId: string;
  total: number;
  performance: number;
  disciplina: number;
  responsabilidade: number;
  mediaGeral: number; // OVR
  ultimaAtualizacao: string;
};

interface Atleta {
  id: string;        // id do USUÁRIO (para DnD/visual)
  atletaId: string;  // id da tabela Atleta (FK usada no backend)
  nome: string;
  foto?: string | null;
  idade?: number | null;
  posicao?: string | null;
}

type PosicaoCampo =
  | "GOL" | "LD" | "ZD" | "ZE" | "LE"
  | "VOL1" | "VOL2" | "MEI"
  | "PD" | "CA" | "PE";

const POSICOES: { id: PosicaoCampo; label: string }[] = [
  { id: "PD", label: "Atacante (PD)" },
  { id: "CA", label: "Atacante (CA)" },
  { id: "PE", label: "Atacante (PE)" },
  { id: "VOL1", label: "Volante" },
  { id: "MEI", label: "Meia" },
  { id: "VOL2", label: "Volante" },
  { id: "LE", label: "Lateral Esq." },
  { id: "ZE", label: "Zagueiro Esq." },
  { id: "ZD", label: "Zagueiro Dir." },
  { id: "LD", label: "Lateral Dir." },
  { id: "GOL", label: "Goleiro" },
];

interface ElencoSalvarPayload {
  id?: string;
  nome: string;
  professorId?: string;
  clubeId?: string;
  escolinhaId?: string;
  atletasIds: string[];
  maxJogadores: number;
  escala?: Record<PosicaoCampo, string | null>;
  tipoUsuario?: "professor" | "escolinha" | "clube";
  tipoUsuarioId?: string;
}

type ElencoServidor = {
  id: string;
  nome: string;
  maxJogadores: number;
  escala?: Record<PosicaoCampo, string | null>;
  atletasElenco?: { atletaId: string; posicao: PosicaoCampo }[];
};

// === escala enriquecida vinda do backend ===
type EscalaItem = {
  atletaId: string;
  usuarioId: string;
  nome: string;
  foto?: string | null;
  idade?: number | null;
  posicao?: string | null;
};
type EscalaEnriquecida = Record<PosicaoCampo, EscalaItem | null>;

// ----------------- UTILS -----------------
function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth <= breakpointPx : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpointPx);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpointPx]);
  return isMobile;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.max(0, rect.width), h: Math.max(0, rect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

// ----------------- CARD EM FORMATO ESCUDO (SVG) -----------------
// tamanhos base
const SHIELD_W_DESK = 150;
const SHIELD_H_DESK = 210;
const SHIELD_W_MOB  = 112;
const SHIELD_H_MOB  = 156;

const SHIELD_PATH =
  "M92 6 C120 6 146 10 168 18 C168 22 168 26 174 30 C178 33 182 34 184 34 L184 188 C184 197 139 204 115 212 C98 218 88 228 92 254 C86 240 74 233 48 224 C21 215 0 209 0 196 L0 34 C2 34 6 33 10 30 C16 26 16 22 16 18 C38 10 64 6 92 6 Z";

// ==== Destaque Dourado (mude só este número) ====
const GOLDEN_MIN_OVR = 88; // mínimo para ativar o efeito dourado
const isGolden = (ovr?: number, min = GOLDEN_MIN_OVR) =>
  (Number.isFinite(ovr) ? Number(ovr) : 0) >= min;

type CardAtletaShieldProps = {
  atleta: Atleta;
  ovr?: number;
  perf?: number;
  disc?: number;
  resp?: number;
  size?: { w: number; h: number };
  goldenMinOVR?: number;
};

const CardAtletaShield: React.FC<CardAtletaShieldProps> = ({
  atleta,
  ovr,
  perf,
  disc,
  resp,
  size,
  goldenMinOVR,
}) => {
  const W = size?.w ?? SHIELD_W_DESK;
  const H = size?.h ?? SHIELD_H_DESK;
  const clipId = `shieldClip-${atleta.atletaId}`;
  const fotoUrl = atleta.foto ? `${API.BASE_URL}${atleta.foto}` : "/default-avatar.png";

  const ovrShow  = Number.isFinite(ovr)  ? Math.round(Number(ovr))  : 0;
  const perfShow = Number.isFinite(perf) ? Math.round(Number(perf)) : 0;
  const discShow = Number.isFinite(disc) ? Math.round(Number(disc)) : 0;
  const respShow = Number.isFinite(resp) ? Math.round(Number(resp)) : 0;
  const golden = isGolden(ovrShow, goldenMinOVR ?? GOLDEN_MIN_OVR);

  return (
    <svg width={W} height={H} viewBox="0 0 184 260" className="block select-none">
      <defs>
        <clipPath id={clipId}><path d={SHIELD_PATH} /></clipPath>

        <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(5,10,30,0.12)" />
          <stop offset="55%" stopColor="rgba(5,10,30,0.40)" />
          <stop offset="100%" stopColor="rgba(5,10,30,0.7)" />
        </linearGradient>

        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f3c969" />
          <stop offset="100%" stopColor="#9fc5ff" />
        </linearGradient>

        {/* overlay dourado por cima da foto */}
        <linearGradient id="goldOverlay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#daa520" stopOpacity="0.45" />
          <stop offset="55%" stopColor="#daa520" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#daa520" stopOpacity="0.10" />
        </linearGradient>

        {/* shimmer que atravessa 100% da largura */}
        <linearGradient id="goldShimmer" gradientUnits="userSpaceOnUse" x1="-184" y1="0" x2="0" y2="0">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%"  stopColor="#fff8dc" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          <animate attributeName="x1" values="-184; 184" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="x2" values="0; 368"  dur="2.4s" repeatCount="indefinite" />
        </linearGradient>

        <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Foto + overlays */}
      <g clipPath={`url(#${clipId})`}>
        <image href={fotoUrl} x="0" y="-10" width="184" height="280" preserveAspectRatio="xMidYMid slice" />
        <rect x="0" y="0" width="184" height="260" fill="url(#cardGrad)" />
        {golden && (
          <>
            <rect x="0" y="0" width="184" height="260" fill="url(#goldOverlay)" />
            <rect x="0" y="0" width="184" height="260" fill="url(#goldShimmer)" opacity="0.35" pointerEvents="none" />
          </>
        )}
      </g>

      {/* Molduras */}
      {golden && <path d={SHIELD_PATH} fill="none" stroke="#daa520" strokeWidth="3.5" filter="url(#goldGlow)" />}
      <path d={SHIELD_PATH} fill="none" stroke="url(#gold)" strokeWidth="3" />
      <path d={SHIELD_PATH} fill="none" stroke="#13244b" strokeWidth="1" />

      {/* Topo: OVR e posição */}
      <text x="18" y="50" fontSize="28" fontWeight={800} fill="#F7D87C" style={{ textShadow: "0 1px 2px rgba(0,0,0,.35)" }}>{ovrShow}</text>
      <text x={184 - 18} y="50" textAnchor="end" fontSize="14" fontWeight={700} fill="#d8e6ff">{atleta.posicao ?? ""}</text>

      {/* Subnotas */}
      <g>
        <rect x={24} y={160} rx="8" ry="8" width="44" height="28" fill="rgba(10,18,40,0.55)" stroke="#d7b46a" strokeWidth="0.6" />
        <text x={34} y={178} fontSize="12" fontWeight={800} fill="#F7D87C">P</text>
        <text x={62} y={178} textAnchor="end" fontSize="12" fontWeight={700} fill="#ffffff">{perfShow}</text>

        <rect x={70} y={160} rx="8" ry="8" width="44" height="28" fill="rgba(10,18,40,0.55)" stroke="#d7b46a" strokeWidth="0.6" />
        <text x={80} y={178} fontSize="12" fontWeight={800} fill="#F7D87C">D</text>
        <text x={108} y={178} textAnchor="end" fontSize="12" fontWeight={700} fill="#ffffff">{discShow}</text>

        <rect x={116} y={160} rx="8" ry="8" width="44" height="28" fill="rgba(10,18,40,0.55)" stroke="#d7b46a" strokeWidth="0.6" />
        <text x={126} y={178} fontSize="12" fontWeight={800} fill="#F7D87C">R</text>
        <text x={154} y={178} textAnchor="end" fontSize="12" fontWeight={700} fill="#ffffff">{respShow}</text>
      </g>

      {/* Nome */}
      <text x={92} y={204} textAnchor="middle" fontSize="13" fontWeight={700} fill="#ffffff">
        {atleta.nome?.toUpperCase()}
      </text>
      <line x1={68} x2={116} y1={224} y2={224} stroke="#d7b46a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

// ----------------- CARD RETANGULAR (lista) -----------------
const CardAtleta: React.FC<{ atleta: Atleta }> = ({ atleta }) => (
  <div className="p-2 bg-white rounded-md shadow w-[180px] sm:w-[200px] flex items-center gap-3">
    <img
      src={atleta.foto ? `${API.BASE_URL}${atleta.foto}` : "/default-avatar.png"}
      alt={atleta.nome}
      className="w-10 h-10 rounded-full object-cover"
    />
    <div className="min-w-0">
      <p className="font-medium text-sm truncate">{atleta.nome}</p>
      {atleta.posicao && <p className="text-xs opacity-70">{atleta.posicao}</p>}
      {typeof atleta.idade === "number" && <p className="text-xs opacity-70">{atleta.idade} anos</p>}
    </div>
  </div>
);

// ----------------- PÁGINA -----------------
export default function PaginaElenco() {
  const isMobile = useIsMobile();

  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [posicoes, setPosicoes] = useState<Record<PosicaoCampo, Atleta | null>>(
    () => POSICOES.reduce((acc, p) => ({ ...acc, [p.id]: null }), {} as Record<PosicaoCampo, Atleta | null>)
  );
  const [pontos, setPontos] = useState<Record<string, PontuacaoDTO>>({});
  const [maxElenco, setMaxElenco] = useState<number>(11);
  const [elencoNome, setElencoNome] = useState<string>("Elenco Principal");
  const [elencoId, setElencoId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const elencoAtual = useMemo(
    () => POSICOES.map((p) => posicoes[p.id]).filter(Boolean) as Atleta[],
    [posicoes]
  );

  // ---- BUSCA PONTUAÇÕES DOS ATLETAS ----
  const fetchPontuacoes = async (ids: string[]) => {
    const token = Storage.token;
    
    if (!ids.length || !token) return;
    try {
      const res = await axios.get<PontuacaoDTO[]>(PONTOS_BASE, {
        params: { atletaIds: ids.join(",") },
        headers: { Authorization: `Bearer ${token}` },
      });
      const map = Object.fromEntries(res.data.map((r) => [r.atletaId, r]));
      setPontos((prev) => ({ ...prev, ...map }));
    } catch (e) {
      console.error("Erro ao buscar pontuações:", e);
    }
  };

  // ---- Aplicadores de escala ----
  const aplicarEscalaNasPosicoes = (
    escala: Record<PosicaoCampo, string | null>,
    listaAtletas: Atleta[]
  ) => {
    const novoMapa: Record<PosicaoCampo, Atleta | null> = { ...posicoes };
    const usados = new Set<string>();

    POSICOES.forEach(({ id }) => {
      const atletaId = escala?.[id] ?? null;
      if (atletaId) {
        const a = listaAtletas.find((x) => x.atletaId === atletaId) || null;
        novoMapa[id] = a;
        if (a) usados.add(a.atletaId);
      } else {
        novoMapa[id] = null;
      }
    });

    const restantes = listaAtletas.filter((a) => !usados.has(a.atletaId));
    setPosicoes(novoMapa);
    setAtletas(restantes);
    fetchPontuacoes(Array.from(usados));
  };

  const aplicarEscalaEnriquecida = (
    escala: EscalaEnriquecida,
    listaAtletas: Atleta[]
  ) => {
    const novoMapa: Record<PosicaoCampo, Atleta | null> = { ...posicoes };
    const usados = new Set<string>();

    POSICOES.forEach(({ id }) => {
      const item = escala?.[id] ?? null;
      if (!item) { novoMapa[id] = null; return; }

      let a =
        listaAtletas.find((x) => x.atletaId === item.atletaId) ||
        listaAtletas.find((x) => x.id === item.usuarioId) ||
        null;

      if (!a) {
        a = {
          id: item.usuarioId,
          atletaId: item.atletaId,
          nome: item.nome,
          foto: item.foto ?? null,
          idade: item.idade ?? null,
          posicao: item.posicao ?? null,
        };
      }

      novoMapa[id] = a;
      usados.add(a.atletaId);
    });

    setPosicoes(novoMapa);
    setAtletas(listaAtletas.filter((a) => !usados.has(a.atletaId)));
    fetchPontuacoes(Array.from(usados));
  };

  // ---- Carregamento inicial ----
  useEffect(() => {
    (async () => {
      try {
        const tipoUsuarioId = Storage.tipoUsuarioId;
        const token = Storage.token;

        // (1) atletas vinculados
        const resAtletas = await axios.get(
          `${API.BASE_URL}/api/treinos/atletas-vinculados`,
          { params: { tipoUsuarioId }, headers: { Authorization: `Bearer ${token}` } }
        );
        const lista = resAtletas.data as Atleta[];

        // (2) escala pronta do dono
        const resEscala = await axios.get(`${ELENCOS_BASE}/escala-por-dono`, {
          params: { tipoUsuarioId },
          headers: { Authorization: `Bearer ${token}` },
        });

        setAtletas(lista);

        if (resEscala.data) {
          const { id, nome, maxJogadores, escala } = resEscala.data as {
            id: string;
            nome: string;
            maxJogadores: number;
            escala: EscalaEnriquecida;
          };
          setElencoId(id);
          setElencoNome(nome ?? "Elenco Principal");
          setMaxElenco(maxJogadores ?? 11);

          if (escala) {
            aplicarEscalaEnriquecida(escala, lista);
            setLoading(false);
            return;
          }
        }

        // (3) fallback antigo
        const resElenco = await axios.get(ELENCOS_BASE, {
          params: { tipoUsuarioId },
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = resElenco.data as ElencoServidor | ElencoServidor[] | null | undefined;
        const elencoExistente: ElencoServidor | null =
          Array.isArray(data)
            ? (data[0] ?? null)
            : data && (data as ElencoServidor).id
            ? (data as ElencoServidor)
            : null;

        if (elencoExistente) {
          setElencoId(elencoExistente.id);
          setElencoNome(elencoExistente.nome ?? "Elenco Principal");
          setMaxElenco(elencoExistente.maxJogadores ?? 11);

          let escalaToApply: Record<PosicaoCampo, string | null> | null = null;

          if (elencoExistente.escala) {
            escalaToApply = elencoExistente.escala;
          } else if (Array.isArray(elencoExistente.atletasElenco)) {
            const built = POSICOES.reduce((acc, p) => {
              acc[p.id] = null;
              return acc;
            }, {} as Record<PosicaoCampo, string | null>);

            for (const v of elencoExistente.atletasElenco) {
              built[v.posicao] = v.atletaId ?? null;
            }
            escalaToApply = built;
          }

          if (escalaToApply) {
            aplicarEscalaNasPosicoes(escalaToApply, lista);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar elenco/atletas:", err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------- AUTO-FIT DO CAMPO -----------------
  // A área verde é medida via ResizeObserver para caber todas as 4 linhas (3,3,4,1)
  const fieldBox = useSize<HTMLDivElement>();

  // grid: linhas/colunas fixas por seção (mantivemos seu layout)
  const rowsHeights = 4;           // 4 blocos/linhas de slots
  const maxCols = 4;               // a maior linha tem 4 slots
  const gapY = 20;                 // espaçamento vertical entre blocos
  const gapX = 12;                 // gap interno dos grids

  // tamanhos base por plataforma
  const BASE_W = isMobile ? SHIELD_W_MOB : SHIELD_W_DESK;
  const BASE_H = isMobile ? SHIELD_H_MOB : SHIELD_H_DESK;

  // rótulo + respiro do slot
  const BASE_SLOT_EXTRA = isMobile ? 48 : 64;

  // largura/altura efetiva do SLOT (escudo + rótulos/margens internas)
  const baseSlotW = BASE_W + 12;                  // 6px padding de cada lado
  const baseSlotH = BASE_H + BASE_SLOT_EXTRA;     // espaço pro rótulo e respiro

  // espaço necessário para caber o maior grid (4 colunas) + gaps horizontais
  const needW = maxCols * baseSlotW + (maxCols - 1) * gapX;
  // altura total das 4 faixas + gaps verticais entre elas
  const needH = rowsHeights * baseSlotH + (rowsHeights - 1) * gapY;

  // espaço disponível (com folga interna do container)
  const availW = Math.max(0, fieldBox.size.w - 8);
  const availH = Math.max(0, fieldBox.size.h - 8);

  // fator de escala para caber por largura E altura
  const scale = Math.max(0.6, Math.min(availW / needW, availH / needH));
  const SHIELD_W = Math.round(BASE_W * scale);
  const SHIELD_H = Math.round(BASE_H * scale);
  const SLOT_EXTRA_H = Math.round(BASE_SLOT_EXTRA * scale);

  // ---- DnD ----
  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;

    const isLista = (id: string) => id === "atletas";
    const isPosicao = (id: string) => id.startsWith("pos:");

    if (source.droppableId === "atletas" && destination.droppableId === "atletas") {
      const nova = Array.from(atletas);
      const [movido] = nova.splice(source.index, 1);
      nova.splice(destination.index, 0, movido);
      setAtletas(nova);
      return;
    }

    if (isLista(source.droppableId) && isPosicao(destination.droppableId)) {
      const posId = destination.droppableId.replace("pos:", "") as PosicaoCampo;
      const ocupados = elencoAtual.length;
      if (ocupados >= maxElenco && !posicoes[posId]) {
        alert(`O elenco já tem ${maxElenco} jogadores.`);
        return;
      }

      const origem = Array.from(atletas);
      const [atleta] = origem.splice(source.index, 1);

      setAtletas(origem);
      setPosicoes((prev) => {
        const anterior = prev[posId];
        const novo = { ...prev, [posId]: atleta };
        if (anterior) {
          setAtletas((lista) => [anterior, ...lista]);
        }
        return novo;
      });

      if (!pontos[atleta.atletaId]) fetchPontuacoes([atleta.atletaId]);
      return;
    }

    if (isPosicao(source.droppableId) && isLista(destination.droppableId)) {
      const posId = source.droppableId.replace("pos:", "") as PosicaoCampo;
      const atleta = posicoes[posId];
      if (!atleta) return;

      setPosicoes((prev) => ({ ...prev, [posId]: null }));
      setAtletas((lista) => {
        const nova = Array.from(lista);
        nova.splice(Math.min(destination.index, nova.length), 0, atleta);
        return nova;
      });
      return;
    }

    if (isPosicao(source.droppableId) && isPosicao(destination.droppableId)) {
      const from = source.droppableId.replace("pos:", "") as PosicaoCampo;
      const to = destination.droppableId.replace("pos:", "") as PosicaoCampo;
      if (from === to) return;

      setPosicoes((prev) => {
        const novo = { ...prev };
        const a = prev[from];
        const b = prev[to];
        novo[to] = a;
        novo[from] = b || null;
        return novo;
      });
      return;
    }
  };

  // ---- Salvar ----
  const salvarElenco = async () => {
    try {
      const token = Storage.token;

      const tipoUsuarioId = Storage.tipoUsuarioId;
      const tipoUsuario = (Storage.tipoSalvo || "").toLowerCase() as
        | "professor" | "escolinha" | "clube";

      if (!token) {
        alert("Você não está autenticado. Faça login novamente.");
        return;
      }
      if (!tipoUsuarioId || !tipoUsuario) {
        alert("Não foi possível identificar seu tipo de usuário.");
        return;
      }

      const escala: Record<PosicaoCampo, string | null> = POSICOES.reduce(
        (acc, p) => {
          acc[p.id] = posicoes[p.id]?.atletaId ?? null;
          return acc;
        },
        {} as Record<PosicaoCampo, string | null>
      );

      const payload: ElencoSalvarPayload = {
        nome: elencoNome,
        professorId: Storage.tipoSalvo === "Professor" ? tipoUsuarioId : undefined,
        clubeId: Storage.tipoSalvo === "Clube" ? tipoUsuarioId : undefined,
        escolinhaId: Storage.tipoSalvo === "Escolinha" ? tipoUsuarioId : undefined,
        atletasIds: (POSICOES.map((p) => posicoes[p.id]).filter(Boolean) as Atleta[]).map(
          (a) => a.atletaId
        ),
        maxJogadores: maxElenco,
        escala,
        tipoUsuario,
        tipoUsuarioId,
      };

      if (elencoId) {
        await axios.put(`${ELENCOS_BASE}/${elencoId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        alert("Elenco atualizado com sucesso!");
      } else {
        const res = await axios.post(ELENCOS_BASE, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.id) setElencoId(res.data.id);
        alert("Elenco criado com sucesso!");
      }
    } catch (err) {
      console.error("Erro ao salvar elenco:", err);
      alert("Erro ao salvar elenco.");
    }
  };

  // ----------------- SLOT (escudo no campo) -----------------
  const Slot: React.FC<{ pos: PosicaoCampo; label: string }> = ({ pos, label }) => {
    const a = posicoes[pos];
    const pts = a ? pontos[a.atletaId] : undefined;
    const ovr  = pts?.mediaGeral ?? 0;
    const perf = pts?.performance ?? 0;
    const disc = pts?.disciplina ?? 0;
    const resp = pts?.responsabilidade ?? 0;

    return (
      <Droppable droppableId={`pos:${pos}`} type="ATLETA">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`rounded-xl border-2 border-dashed overflow-hidden flex flex-col items-center justify-between p-1
              ${snapshot.isDraggingOver ? "bg-green-300/70" : "bg-green-100/70"}`}
            style={{ width: SHIELD_W + 12, height: SHIELD_H + SLOT_EXTRA_H }}
          >
            <span className="text-[10px] sm:text-xs font-semibold opacity-80">{label}</span>

            {a ? (
              <Draggable draggableId={a.id} index={0}>
                {(provided2, snapshot2) => (
                  <div
                    ref={provided2.innerRef}
                    {...provided2.draggableProps}
                    {...provided2.dragHandleProps}
                    className={`${snapshot2.isDragging ? "shadow-2xl scale-105 z-50" : ""}`}
                  >
                    <CardAtletaShield
                      atleta={a}
                      ovr={ovr}
                      perf={perf}
                      disc={disc}
                      resp={resp}
                      size={{ w: SHIELD_W, h: SHIELD_H }}
                      goldenMinOVR={GOLDEN_MIN_OVR}
                    />
                  </div>
                )}
              </Draggable>
            ) : (
              <div className="w-full flex-1 flex items-center justify-center text-[10px] sm:text-xs text-green-700/70">
                Solte aqui
              </div>
            )}

            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  };

  // ----------------- LAYOUT -----------------
  const listaClasses =
    (isMobile
      ? "flex flex-row gap-3 overflow-x-auto py-2"
      : "flex flex-col gap-3 overflow-y-auto") + " min-h-[100px]";

  const listaWrapperClasses = isMobile
    ? "w-full bg-white shadow-md p-3 order-2 md:order-1"
    : "w-full md:w-1/4 bg-white shadow-md p-4 order-1 md:h-full";

  const direction: DroppableProps["direction"] = isMobile ? "horizontal" : "vertical";

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-green-100">
        <span className="text-green-800 font-semibold">Carregando elenco...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-green-100">
      <DragDropContext onDragEnd={handleDragEnd}>
        {/* Campo tático */}
        <div className="order-1 md:order-2 flex-1 flex flex-col items-center p-3 md:p-5">
          <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-3 md:mb-5">
            <input
              type="text"
              value={elencoNome}
              onChange={(e) => setElencoNome(e.target.value)}
              className="border rounded p-1 text-base md:text-lg font-bold"
            />
            <div className="flex items-center gap-2">
              <label className="text-sm">Máximo:</label>
              <input
                type="number"
                value={maxElenco}
                min={5}
                max={30}
                onChange={(e) => setMaxElenco(Number(e.target.value))}
                className="w-16 border rounded p-1"
              />
            </div>
            <button
              onClick={salvarElenco}
              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              {elencoId ? "Atualizar" : "Salvar"}
            </button>
          </div>

          {/* Área do campo com auto-fit */}
          <div
            ref={fieldBox.ref}
            className="w-full flex-1 rounded-2xl p-3 md:p-5 bg-gradient-to-b from-green-300 to-green-600 shadow-inner flex flex-col justify-between"
          >
            <div className="grid grid-cols-3 gap-3 md:gap-4 place-items-center">
              <Slot pos="PD" label="Atacante (PD)" />
              <Slot pos="CA" label="Atacante (CA)" />
              <Slot pos="PE" label="Atacante (PE)" />
            </div>

            <div className="grid grid-cols-3 gap-3 md:gap-4 place-items-center" style={{ marginTop: gapY * scale }}>
              <Slot pos="VOL1" label="Volante" />
              <Slot pos="MEI" label="Meia" />
              <Slot pos="VOL2" label="Volante" />
            </div>

            <div className="grid grid-cols-4 gap-2 md:gap-3 place-items-center" style={{ marginTop: gapY * scale }}>
              <Slot pos="LE" label="Lateral Esq." />
              <Slot pos="ZE" label="Zagueiro Esq." />
              <Slot pos="ZD" label="Zagueiro Dir." />
              <Slot pos="LD" label="Lateral Dir." />
            </div>

            <div className="grid grid-cols-1 place-items-center" style={{ marginTop: gapY * scale }}>
              <Slot pos="GOL" label="Goleiro" />
            </div>
          </div>
        </div>

        {/* Lista de atletas (retangular) */}
        <div className={listaWrapperClasses}>
          <h2 className="text-base md:text-lg font-bold mb-2 md:mb-3">Atletas Vinculados</h2>
          <Droppable droppableId="atletas" type="ATLETA" direction={direction}>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className={listaClasses}>
                {atletas.map((atleta, index) => (
                  <Draggable key={atleta.id} draggableId={atleta.id} index={index}>
                    {(provided2, snapshot) => (
                      <div
                        ref={provided2.innerRef}
                        {...provided2.draggableProps}
                        {...provided2.dragHandleProps}
                        className={`cursor-grab ${snapshot.isDragging ? "shadow-2xl scale-105 z-50" : ""}`}
                      >
                        <CardAtleta atleta={atleta} />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </DragDropContext>
    </div>
  );
}
