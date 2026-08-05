import { toast } from "@/lib/toast";
import React, { useEffect, useMemo, useRef, useState, useCallback} from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DroppableProps,
} from "@hello-pangea/dnd";
import axios from "axios";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { ArrowLeft, Plus, X, ListFilter, Trash2 } from "lucide-react";
import Avatar from "../components/shared/Avatar.js";

const ELENCOS_BASE = `${API.BASE_URL}/api/elencos`;
const PONTOS_BASE  = `${API.BASE_URL}/api/treinos/pontuacoes`;
const TURMAS_BASE  = `${API.BASE_URL}/api/turmas/minhas`;
const FALLBACK_AVATAR = "/assets/usuarios/footera-logo-fundo-verde.png";

type PontuacaoDTO = {
  atletaId: string;
  total: number;
  performance: number;
  disciplina: number;
  responsabilidade: number;
  mediaGeral: number;
  ultimaAtualizacao: string;
};

interface Atleta {
  id: string;
  atletaId: string;
  nome: string;
  foto?: string | null;
  idade?: number | null;
  posicao?: string | null;
}

type PosicaoCampo =
  | "GOL"
  | "LD"    
  | "LE"    
  | "ZD"  
  | "ZC"   
  | "ZE"   
  | "ALA_D"
  | "ALA_E" 
  | "VOL1"
  | "VOL2"
  | "MC1" 
  | "MC2"  
  | "MEI"     
  | "MEI_D"    
  | "MEI_E"   
  | "MD"      
  | "ME"     
  | "PD"  
  | "PE"  
  | "SA"  
  | "CA";  

const POSICOES: { id: PosicaoCampo; label: string }[] = [
  { id: "GOL",   label: "Goleiro" },
  { id: "LD",    label: "Lateral Dir." },
  { id: "LE",    label: "Lateral Esq." },
  { id: "ZD",    label: "Zagueiro Dir." },
  { id: "ZC",    label: "Zagueiro Central" },
  { id: "ZE",    label: "Zagueiro Esq." },
  { id: "ALA_D", label: "Ala Dir." },
  { id: "ALA_E", label: "Ala Esq." },
  { id: "VOL1",  label: "Volante" },
  { id: "VOL2",  label: "Volante" },
  { id: "MC1",   label: "Meia Central" },
  { id: "MC2",   label: "Meia Central" },
  { id: "MEI",   label: "Meia Ofensivo" },
  { id: "MEI_D", label: "Meia Ofensivo Dir." },
  { id: "MEI_E", label: "Meia Ofensivo Esq." },
  { id: "MD",    label: "Meia Direita" },
  { id: "ME",    label: "Meia Esquerda" },
  { id: "PD",    label: "Ponta Direita" },
  { id: "PE",    label: "Ponta Esquerda" },
  { id: "SA",    label: "Segundo Atacante" },
  { id: "CA",    label: "Centroavante" },
];

const DEF_BASE: PosicaoCampo[] = [
  "LD", "ZD", "ZC", "ZE", "LE", "ALA_D", "ALA_E",
];

const MID_BASE: PosicaoCampo[] = [
  "VOL1", "MC1", "MEI", "MC2", "VOL2", "MD", "ME", "MEI_D", "MEI_E",
];

const ATT_BASE: PosicaoCampo[] = [
  "PD", "SA", "CA", "PE",
];

const posSlotCurta = (pos: PosicaoCampo) =>
  pos
    .replace(/_\w+$/g, "")  
    .replace(/\d+$/g, "");   

const posicaoParaSigla = (pos?: string | null) => {
  const p = String(pos ?? "").trim();
  if (!p) return "";

  const up = p.toUpperCase();

  if (["GOL","GK","LD","LE","MC","VOL","MEI","ME","MD","PD","PE","CA","SA","ZAG","ZC","ATA"].includes(up)) {
    return up === "GK" ? "GOL" : up;
  }

  if (up.includes("GOLE")) return "GOL";
  if (up.includes("VOL")) return "VOL";
  if (up.includes("MEIA") || up.includes("MEI")) return "MEI";
  if (up.includes("CENTROAV") || up.includes("CENTRO") || up.includes("9")) return "CA";
  if (up.includes("ATAC")) return "ATA";
  if (up.includes("ZAG")) return "ZAG";
  if (up.includes("LATERAL")) return "LAT";
  if (up.includes("PONTA") || up.includes("EXTREMO")) return "PON";

  return up.slice(0, 3);
};

function getDefPositions(qtd: number): PosicaoCampo[] {
  switch (qtd) {
    case 0: return [];
    case 1: return ["ZC"];
    case 2: return ["ZD", "ZE"];
    case 3: return ["LD", "ZC", "LE"];
    case 4: return ["LD", "ZD", "ZE", "LE"];
    case 5: return ["LD", "ZD", "ZC", "ZE", "LE"];
    case 6: return ["ALA_D", "LD", "ZD", "ZE", "LE", "ALA_E"]; 
    case 7: return ["ALA_D", "LD", "ZD", "ZC", "ZE", "LE", "ALA_E"];
    default:
      return DEF_BASE.slice(0, qtd);
  }
}

function getMidPositions(qtd: number): PosicaoCampo[] {
  switch (qtd) {
    case 0: return [];
    case 1: return ["MEI"]; 
    case 2: return ["MC1", "MC2"];
    case 3: return ["VOL1", "MEI", "VOL2"]; 
    case 4: return ["VOL1", "MC1", "MC2", "VOL2"];
    case 5: return ["VOL1", "MC1", "MEI", "MC2", "VOL2"];
    case 6: return ["MD", "VOL1", "MC1", "MC2", "VOL2", "ME"];
    case 7: return ["MD", "VOL1", "MC1", "MEI", "MC2", "VOL2", "ME"];
    case 8: return ["MD", "VOL1", "MC1", "MEI", "MC2", "VOL2", "ME", "MEI_D"];
    case 9: return ["MD", "VOL1", "MC1", "MEI", "MC2", "VOL2", "ME", "MEI_D", "MEI_E"];
    default:
      return MID_BASE.slice(0, qtd);
  }
}

function getAttPositions(qtd: number): PosicaoCampo[] {
  switch (qtd) {
    case 0: return [];
    case 1: return ["CA"]; 
    case 2: return ["PD", "PE"]; 
    case 3: return ["PD", "SA", "PE"]; 
    case 4: return ["PD", "SA", "CA", "PE"];
    default:
      return ATT_BASE.slice(0, qtd);
  }
}

type EscalaItem = {
  atletaId: string;
  usuarioId: string;
  nome: string;
  foto?: string | null;
  idade?: number | null;
  posicao?: string | null;
};

type ElencoServidor = {
  id: string;
  nome: string;
  maxJogadores: number;
  escala?: Record<PosicaoCampo, string | null>;
  atletasElenco?: { atletaId: string; posicao: PosicaoCampo }[];
};

type FormacaoElenco = {
  atacantes: number;
  meio: number;
  defesa: number;
};

const FORMACAO_PADRAO: FormacaoElenco = {
  atacantes: 3,
  meio: 3,
  defesa: 4,
};

type ElencoUI = {
  id: string | null;
  nome: string;
  maxJogadores: number;
  posicoes: Record<PosicaoCampo, Atleta | null>;
  livres: Atleta[];
  reservasIds: string[];
  formacao: FormacaoElenco;
};

type TurmaOpcao = {
  id: string;
  nome: string;
  categoria?: string | string[] | null;
  origemTipo?: "Clube" | "Escolinha" | "Professor" | null;
  origemNome?: string | null;
};

const isLikelyValidFoto = (v?: string | null) => {
  const s = String(v ?? "").trim();
  if (!s) return false;
  if (s.startsWith("http://") || s.startsWith("https://")) return true;
  if (s.startsWith("data:image/")) return true;
  if (s.startsWith("/")) return true;
  return false;
};

const resolveFoto = (v?: string | null) => (isLikelyValidFoto(v) ? String(v).trim() : FALLBACK_AVATAR);

function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth <= breakpointPx : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onResize = () => {
      setIsMobile(window.innerWidth <= breakpointPx);
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
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

const SHIELD_W_DESK = 150;
const SHIELD_H_DESK = 210;
const SHIELD_W_MOB  = 112;
const SHIELD_H_MOB  = 156;

const SHIELD_PATH =
  "M92 6 C120 6 146 10 168 18 C168 22 168 26 174 30 C178 33 182 34 184 34 L184 188 C184 197 139 204 115 212 C98 218 88 228 92 254 C86 240 74 233 48 224 C21 215 0 209 0 196 L0 34 C2 34 6 33 10 30 C16 26 16 22 16 18 C38 10 64 6 92 6 Z";

const GOLDEN_MIN_OVR = 100;
const isGolden = (ovr?: number, min = GOLDEN_MIN_OVR) =>
  (Number.isFinite(ovr) ? Number(ovr) : 0) >= min;

const CardAtletaShield: React.FC<{
  atleta: Atleta;
  slotPos?: PosicaoCampo;
  ovr?: number; perf?: number; disc?: number; resp?: number;
  size?: { w: number; h: number };
  goldenMinOVR?: number;
}> = ({ atleta, slotPos, ovr, perf, disc, resp, size, goldenMinOVR }) => {
  const W = size?.w ?? SHIELD_W_DESK;
  const H = size?.h ?? SHIELD_H_DESK;
  const clipId = `shieldClip-${atleta.atletaId || atleta.id}-${W}x${H}`;
  const fotoUrl = resolveFoto(atleta.foto);
  const posShow = slotPos ? posSlotCurta(slotPos) : posicaoParaSigla(atleta.posicao);
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
        <linearGradient id="goldOverlay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#daa520" stopOpacity="0.45" />
          <stop offset="55%" stopColor="#daa520" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#daa520" stopOpacity="0.10" />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <image
          href={fotoUrl}
          x="0"
          y="-10"
          width="184"
          height="280"
          preserveAspectRatio="xMidYMid slice"
          onError={(e) => {
            const el = e.currentTarget as any;
            if (el?.dataset?.fallbackApplied) return;
            if (el?.dataset) el.dataset.fallbackApplied = "1";
            el.setAttribute("href", FALLBACK_AVATAR);
          }}
        />
        <rect x="0" y="0" width="184" height="260" fill="url(#cardGrad)" />
        {golden && <rect x="0" y="0" width="184" height="260" fill="url(#goldOverlay)" />}
      </g>

      {golden && <path d={SHIELD_PATH} fill="none" stroke="#daa520" strokeWidth="3.5" />}
      <path d={SHIELD_PATH} fill="none" stroke="url(#gold)" strokeWidth="3" />
      <path d={SHIELD_PATH} fill="none" stroke="#13244b" strokeWidth="1" />

      <text x="18" y="50" fontSize="28" fontWeight={800} fill="#F7D87C">{ovrShow}</text>
      <text
        x={184 - 18}
        y="50"
        textAnchor="end"
        fontSize="14"
        fontWeight={700}
        fill="#d8e6ff"
      >
        {posShow}
      </text>

      <g>
        <rect x={24} y={160} rx="8" ry="8" width="44" height="28" fill="rgba(10,18,40,0.55)" stroke="#d7b46a" strokeWidth="0.6" />
        <text x={34} y={178} fontSize="12" fontWeight={800} fill="#F7D87C">P</text>
        <text x={62}  y={178} textAnchor="end" fontSize="12" fontWeight={700} fill="#ffffff">{perfShow}</text>

        <rect x={70} y={160} rx="8" ry="8" width="44" height="28" fill="rgba(10,18,40,0.55)" stroke="#d7b46a" strokeWidth="0.6" />
        <text x={80} y={178} fontSize="12" fontWeight={800} fill="#F7D87C">D</text>
        <text x={108} y={178} textAnchor="end" fontSize="12" fontWeight={700} fill="#ffffff">{discShow}</text>

        <rect x={116} y={160} rx="8" ry="8" width="44" height="28" fill="rgba(10,18,40,0.55)" stroke="#d7b46a" strokeWidth="0.6" />
        <text x={126} y={178} fontSize="12" fontWeight={800} fill="#F7D87C">R</text>
        <text x={154} y={178} textAnchor="end" fontSize="12" fontWeight={700} fill="#ffffff">{respShow}</text>
      </g>

      <text x="92" y="204" textAnchor="middle" fontSize="13" fontWeight={700} fill="#ffffff">
        {atleta.nome?.toUpperCase()}
      </text>
      <line x1={68} x2={116} y1={224} y2={224} stroke="#d7b46a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

const CardAtleta: React.FC<{ atleta: Atleta }> = ({ atleta }) => {
  const sigla = posicaoParaSigla(atleta.posicao);

  return (
    <div className="p-2 bg-white rounded-md shadow w-[180px] sm:w-[200px] flex items-center gap-3 will-change-transform">
      <Avatar
        foto={atleta.foto}
        alt={atleta.nome}
        className="w-10 h-10"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-medium text-sm truncate">{atleta.nome}</p>

          {sigla && (
            <span
              title={atleta.posicao ?? ""}
              className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-green-300 bg-green-50 text-green-900 font-extrabold"
            >
              {sigla}
            </span>
          )}
        </div>

        {typeof atleta.idade === "number" && (
          <p className="text-xs opacity-70">{atleta.idade} anos</p>
        )}
      </div>
    </div>
  );
};

const safeUUID = () => {
  try {
    const c: any = (globalThis as any).crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
};

function normalizeAtletas(raw: any): Atleta[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.atletas)
    ? raw.atletas
    : Array.isArray(raw?.alunos)
    ? raw.alunos
    : [];

  return list.map((a: any) => {
    const pos =
      a?.posicao ??
      a?.atleta?.posicao ??
      a?.Atleta?.posicao ??
      a?.usuario?.posicao ??          
      a?.usuario?.atleta?.posicao ??
      a?.usuario?.Atleta?.posicao ??
      a?.aluno?.posicao ??
      a?.aluno?.atleta?.posicao ??
      null;

    return {
      id: String(a.id ?? a.usuarioId ?? a.atletaId ?? safeUUID()),
      atletaId: String(a.atletaId ?? a.usuarioId ?? a.id ?? ""),
      nome: a.nome ?? a.usuario?.nome ?? a.atleta?.nome ?? "",
      foto: a.foto ?? a.usuario?.foto ?? a.atleta?.foto ?? null,
      idade: a.idade ?? a.usuario?.idade ?? a.atleta?.idade ?? null,
      posicao: pos,
    };
  });
}

const emptyPosicoes = (): Record<PosicaoCampo, Atleta | null> =>
  POSICOES.reduce((acc, p) => {
    acc[p.id] = null;
    return acc;
  }, {} as Record<PosicaoCampo, Atleta | null>);

type LinhaFormacao = "atacantes" | "meio" | "defesa";

type ModoTela = "elenco" | "convocacao";

type PaginaElencoProps = {
  modo?: ModoTela;
  titulo?: string;
  backHref?: string;
  permitirReservas?: boolean;
  eventoId?: string;
  onSalvar?: (payload: {
    turmaId: string;
    nome: string;
    formacao: string;
    escala: Record<PosicaoCampo, string | null>;
    reservasIds: string[];
  }) => Promise<void> | void;
};

type ConvocacaoDraft = {
  nome: string;
  formacao: string;
  escala: Record<PosicaoCampo, string | null>;
  reservasIds: string[];
};

const convKey = (eventoId: string, turmaId: string) =>
  `footera:convocacao:${eventoId}:${turmaId}`;

const parseFormacaoStr = (s: string) => {
  const [defesa, meio, atacantes] = String(s || "").split("-").map(n => Number(n));
  if ([defesa, meio, atacantes].some(n => !Number.isFinite(n))) {
    return { defesa: 4, meio: 3, atacantes: 3 };
  }
  return { defesa, meio, atacantes };
};

export default function PaginaElenco({
  modo = "elenco",
  titulo,
  backHref,
  permitirReservas = true,
  eventoId,
  onSalvar,
}: PaginaElencoProps) {
  const isMobile = useIsMobile();

  const [turmas, setTurmas] = useState<TurmaOpcao[]>([]);
  const [turmaId, setTurmaId] = useState<string>("");
  const [pontos, setPontos] = useState<Record<string, PontuacaoDTO>>({});
  const [loading, setLoading] = useState<boolean>(true);

  const [todosAtletas, setTodosAtletas] = useState<Atleta[]>([]);
  const [elencos, setElencos] = useState<ElencoUI[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const MAX_TITULARES = 11;
  const MAX_RESERVAS = 11;
  const MAX_SELECIONADOS = MAX_TITULARES + MAX_RESERVAS;

  const ativo = elencos[activeIndex];

  const reservasIds =
    ativo?.reservasIds ?? [];

  const formacao =
    ativo?.formacao ?? FORMACAO_PADRAO;

  const setReservasIds = (
    acao: React.SetStateAction<string[]>
  ) => {
    setElencos((anteriores) => {
      if (!anteriores[activeIndex]) {
        return anteriores;
      }

      const resultado = [...anteriores];
      const elencoAtual = resultado[activeIndex];

      const novoValor =
        typeof acao === "function"
          ? acao(elencoAtual.reservasIds)
          : acao;

      resultado[activeIndex] = {
        ...elencoAtual,
        reservasIds: novoValor,
      };

      return resultado;
    });
  };

  const setFormacao = (
    acao: React.SetStateAction<FormacaoElenco>
  ) => {
    setElencos((anteriores) => {
      if (!anteriores[activeIndex]) {
        return anteriores;
      }

      const resultado = [...anteriores];
      const elencoAtual = resultado[activeIndex];

      const novoValor =
        typeof acao === "function"
          ? acao(elencoAtual.formacao)
          : acao;

      resultado[activeIndex] = {
        ...elencoAtual,
        formacao: novoValor,
      };

      return resultado;
    });
  };

  const posicoesAtivas =
    ativo?.posicoes ?? emptyPosicoes();

  const posicoesDaFormacao = useMemo<PosicaoCampo[]>(
    () => [
      "GOL",
      ...getDefPositions(formacao.defesa),
      ...getMidPositions(formacao.meio),
      ...getAttPositions(formacao.atacantes),
    ],
    [
      formacao.defesa,
      formacao.meio,
      formacao.atacantes,
    ]
  );

  const elencoAtual = useMemo(() => {
    const vistos = new Set<string>();
    const titulares: Atleta[] = [];

    for (const posicao of posicoesDaFormacao) {
      const atleta = posicoesAtivas[posicao];

      if (!atleta?.atletaId) continue;
      if (vistos.has(atleta.atletaId)) continue;

      vistos.add(atleta.atletaId);
      titulares.push(atleta);
    }

    return titulares;
  }, [posicoesAtivas, posicoesDaFormacao]);

  const atletasLivresAtivo = (
    ativo?.livres ?? []
  ).filter((atleta) => {
    if (!filtro) return true;

    const termo = filtro.toLowerCase();

    return (
      atleta.nome?.toLowerCase().includes(termo) ||
      atleta.posicao?.toLowerCase().includes(termo)
    );
  });

  const reservas = useMemo(() => {
    if (!permitirReservas) return [];

    const atletasDaTurma = new Map(
      todosAtletas.map((atleta) => [
        atleta.atletaId,
        atleta,
      ])
    );

    const titularesIds = new Set(
      elencoAtual.map((atleta) => atleta.atletaId)
    );

    const vistos = new Set<string>();
    const lista: Atleta[] = [];

    for (const reservaId of reservasIds) {
      if (vistos.has(reservaId)) continue;
      if (titularesIds.has(reservaId)) continue;

      const atleta = atletasDaTurma.get(reservaId);

      if (!atleta) continue;

      vistos.add(reservaId);
      lista.push(atleta);
    }

    return lista.slice(0, MAX_RESERVAS);
  }, [
    reservasIds,
    todosAtletas,
    permitirReservas,
    elencoAtual,
  ]);

  const reservasDisponiveis = useMemo(() => {
    if (!permitirReservas) return [];

    const titularesIds = new Set(
      elencoAtual.map((atleta) => atleta.atletaId)
    );

    const reservasSet = new Set(
      reservas.map((atleta) => atleta.atletaId)
    );

    return atletasLivresAtivo.filter(
      (atleta) =>
        !titularesIds.has(atleta.atletaId) &&
        !reservasSet.has(atleta.atletaId)
    );
  }, [
    permitirReservas,
    atletasLivresAtivo,
    elencoAtual,
    reservas,
  ]);

  const totalTitulares = elencoAtual.length;
  const totalReservas = reservas.length;
  const totalSelecionados = totalTitulares + totalReservas;

  const nomesTurmasDuplicados = useMemo(() => {
    const quantidades = new Map<
      string,
      number
    >();

    for (const turma of turmas) {
      const nomeNormalizado =
        turma.nome.trim().toLowerCase();

      quantidades.set(
        nomeNormalizado,
        (quantidades.get(nomeNormalizado) ??
          0) + 1
      );
    }

    return new Set(
      Array.from(quantidades.entries())
        .filter(([, quantidade]) =>
          quantidade > 1
        )
        .map(([nome]) => nome)
    );
  }, [turmas]);

  const fetchPontuacoes = async (ids: string[]) => {
    const token = Storage.token;
    const faltando = ids.filter(id => !pontos[id]);
    if (!faltando.length || !token) return;
    try {
      const res = await axios.get<PontuacaoDTO[]>(PONTOS_BASE, {
        params: { atletaIds: faltando.join(",") },
        headers: { Authorization: `Bearer ${token}` },
      });
      const map = Object.fromEntries(res.data.map((r) => [r.atletaId, r]));
      setPontos((prev) => ({ ...prev, ...map }));
    } catch (e) {
      console.error("Erro ao buscar pontuações:", e);
    }
  };

  function buildElencoUI(
    raw: ElencoServidor | { id?: string; nome?: string; maxJogadores?: number; escala?: any },
    baseAtletas: Atleta[]
  ): ElencoUI {
    const posicoesPreenchidas: Record<PosicaoCampo, Atleta | null> = emptyPosicoes();
    const usados = new Set<string>();

    const escalaBruta =
      (raw as any).escala ?? {};

    const reservasDoElenco =
      Array.isArray(
        escalaBruta.__reservasIds
      )
        ? escalaBruta.__reservasIds
            .map(String)
            .filter((id: string) =>
              baseAtletas.some(
                (atleta) =>
                  atleta.atletaId === id
              )
            )
            .slice(0, MAX_RESERVAS)
        : [];

    const formacaoDoElenco =
      typeof (raw as any).formacao === "string"
        ? parseFormacaoStr(
            (raw as any).formacao
          )
        : FORMACAO_PADRAO;

    const tryFillFromEscala = (esc: Record<PosicaoCampo, any>) => {
      POSICOES.forEach(({ id }) => {
        const v = esc?.[id];
        let a: Atleta | null = null;

        if (v && typeof v === "object") {
          const item = v as EscalaItem;
          a =
            baseAtletas.find(x => x.atletaId === String(item.atletaId)) ||
            baseAtletas.find(x => x.id === String(item.usuarioId)) ||
            {
              id: String(item.usuarioId ?? item.atletaId ?? safeUUID()),
              atletaId: String(item.atletaId ?? item.usuarioId ?? ""),
              nome: item.nome ?? "",
              foto: item.foto ?? null,
              idade: item.idade ?? null,
              posicao: item.posicao ?? null,
            };
        } else if (typeof v === "string") {
          a = baseAtletas.find(x => x.atletaId === v) || null;
        } else if (v != null) {
          const s = String(v);
          a = baseAtletas.find(x => x.atletaId === s) || null;
        }

        posicoesPreenchidas[id] = a;
        if (a) usados.add(a.atletaId);
      });
    };

    if ((raw as any).escala) {
      tryFillFromEscala((raw as any).escala as Record<PosicaoCampo, any>);
    } else if (Array.isArray((raw as any).atletasElenco)) {
      const built: Record<PosicaoCampo, string | null> = POSICOES.reduce(
        (acc, p) => {
          acc[p.id] = null;
          return acc;
        },
        {} as Record<PosicaoCampo, string | null>
      );

      const elencoArray = (raw as any).atletasElenco as {
        atletaId?: string | null;
        posicao?: string | null;
      }[];

      for (const v of elencoArray) {
        const pos = v.posicao as PosicaoCampo | undefined;

        if (!pos) continue;
        if (!POSICOES.some((p) => p.id === pos)) continue;

        built[pos] = v.atletaId ?? null;
      }

      tryFillFromEscala(built as any);
    }

    const livres = baseAtletas.filter(a => !usados.has(a.atletaId));
    if (usados.size) fetchPontuacoes(Array.from(usados));

    return {
      id: (raw as any).id ?? null,
      nome: (raw as any).nome ?? "Elenco",
      maxJogadores: (raw as any).maxJogadores ?? 11,
      posicoes: posicoesPreenchidas,
      livres,
      reservasIds: reservasDoElenco,
      formacao: formacaoDoElenco,
    };
  }

  function filterReservasForTurma(baseAtletas: Atleta[], prev: string[]) {
    const baseIds = new Set(baseAtletas.map(a => a.atletaId));
    return prev.filter(id => baseIds.has(id));
  }
  
  function rebuildElencosKeepingLayout(prevElencos: ElencoUI[], baseAtletas: Atleta[]) {
    const baseIds = new Set(baseAtletas.map(a => a.atletaId));

    return prevElencos.map((old) => {
      const escala: Record<PosicaoCampo, string | null> = POSICOES.reduce((acc, p) => {
        const a = old.posicoes[p.id];
        acc[p.id] = a && baseIds.has(a.atletaId) ? a.atletaId : null;
        return acc;
      }, {} as Record<PosicaoCampo, string | null>);

      return buildElencoUI(
        {
          id: old.id ?? null,
          nome: old.nome,
          maxJogadores: old.maxJogadores,
          escala,
        } as any,
        baseAtletas
      );
    });
  }

  useEffect(() => {
    const t = String((Storage as any).tipoSalvo || "").toLowerCase();
    if (t === "atleta") {
      window.location.replace("/treinos");
    }
  }, []);

  const carregarTurmas = useCallback(async () => {
  try {
    const token = Storage.token;
    const tipoUsuarioId =
      Storage.tipoUsuarioId;

    if (!token || !tipoUsuarioId) {
      setTurmas([]);
      setTurmaId("");
      setTodosAtletas([]);
      setElencos([]);
      setLoading(false);
      return;
    }

    const resposta = await axios.get(
      TURMAS_BASE,
      {
        params: {
          tipoUsuarioId,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const recebidas = Array.isArray(
      resposta.data?.items
    )
      ? resposta.data.items
      : Array.isArray(resposta.data)
      ? resposta.data
      : [];

    const mapaTurmas =
      new Map<string, TurmaOpcao>();

    for (const turma of recebidas) {
      if (!turma?.id) continue;
      if (turma?.ativo === false) continue;

      const id = String(turma.id);

      if (mapaTurmas.has(id)) continue;

      mapaTurmas.set(id, {
        id,
        nome: String(
          turma.nome ??
            turma.titulo ??
            "Turma"
        ),

        categoria:
          turma.categoria ?? null,

        origemTipo:
          turma.origemTipo ?? null,

        origemNome:
          turma.origemNome ?? null,
      });
    }

    const unicasPorId = Array.from(
      mapaTurmas.values()
    );

    setTurmas(unicasPorId);

    setTurmaId((atual) => {
      const aindaExiste =
        unicasPorId.some(
          (turma) => turma.id === atual
        );

      if (aindaExiste) {
        return atual;
      }

      return unicasPorId[0]?.id ?? "";
    });

    if (unicasPorId.length === 0) {
      setTodosAtletas([]);
      setElencos([]);
      setActiveIndex(0);
      setLoading(false);
    }
  } catch (erro) {
    console.error(
      "Erro ao listar turmas:",
      erro
    );

    setLoading(false);
  }
  }, []);

  const carregarAtletasDaTurmaAtual =
    useCallback(async () => {
      const token = Storage.token;

      if (!token || !turmaId) {
        return;
      }

      try {
        const resposta =
          await axios.get(
            `${API.BASE_URL}/api/turmas/${turmaId}/alunos`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const alunosValidos =
          Array.isArray(
            resposta.data?.alunos
          )
            ? resposta.data.alunos.filter(
                (aluno: any) =>
                  aluno?.inTurma === true &&
                  aluno?.vinculado === true &&
                  Boolean(
                    aluno?.atletaId
                  )
              )
            : resposta.data;

        const novosAtletas =
          normalizeAtletas(
            alunosValidos
          );

        setTodosAtletas(
          (atletasAnteriores) => {
            const criarAssinatura = (
              lista: Atleta[]
            ) =>
              lista
                .map(
                  (atleta) =>
                    [
                      atleta.atletaId,
                      atleta.nome,
                      atleta.posicao ?? "",
                      atleta.foto ?? "",
                    ].join(":")
                )
                .sort()
                .join("|");

            const anterior =
              criarAssinatura(
                atletasAnteriores
              );

            const nova =
              criarAssinatura(
                novosAtletas
              );

            if (anterior === nova) {
              return atletasAnteriores;
            }

            return novosAtletas;
          }
        );
      } catch (error) {
        console.error(
          "Erro ao atualizar atletas da turma:",
          error
        );
      }
    }, [turmaId]);

  useEffect(() => {
    void carregarTurmas();
  }, [carregarTurmas]);

  useEffect(() => {
    function atualizarTurmasEAtletas() {
      void carregarTurmas();
      void carregarAtletasDaTurmaAtual();
    }

    function atualizarSomenteAtletas() {
      void carregarAtletasDaTurmaAtual();
    }

    window.addEventListener(
      "footera:turma-alterada",
      atualizarTurmasEAtletas
    );

    window.addEventListener(
      "footera:vinculo-treino-alterado",
      atualizarSomenteAtletas
    );

    return () => {
      window.removeEventListener(
        "footera:turma-alterada",
        atualizarTurmasEAtletas
      );

      window.removeEventListener(
        "footera:vinculo-treino-alterado",
        atualizarSomenteAtletas
      );
    };
  }, [
    carregarTurmas,
    carregarAtletasDaTurmaAtual,
  ]);

  useEffect(() => {
    if (loading || !turmaId) {
      return;
    }

    const atletasValidos = new Map(
      todosAtletas.map((atleta) => [
        atleta.atletaId,
        atleta,
      ])
    );

    setElencos((anteriores) =>
      anteriores.map((elenco) => {
        const posicoesPermitidas =
          new Set<PosicaoCampo>([
            "GOL",

            ...getDefPositions(
              elenco.formacao.defesa
            ),

            ...getMidPositions(
              elenco.formacao.meio
            ),

            ...getAttPositions(
              elenco.formacao.atacantes
            ),
          ]);

        const novasPosicoes =
          emptyPosicoes();

        const titularesUsados =
          new Set<string>();

        for (const { id: posicao } of POSICOES) {
          const atletaSalvo =
            elenco.posicoes[posicao];

          if (!atletaSalvo?.atletaId) {
            continue;
          }

          const atletaAtual =
            atletasValidos.get(
              atletaSalvo.atletaId
            );

          if (!atletaAtual) {
            continue;
          }

          if (
            !posicoesPermitidas.has(posicao)
          ) {
            continue;
          }

          if (
            titularesUsados.has(
              atletaAtual.atletaId
            )
          ) {
            continue;
          }

          novasPosicoes[posicao] =
            atletaAtual;

          titularesUsados.add(
            atletaAtual.atletaId
          );
        }

        const reservasIdsValidas =
          Array.from(
            new Set(
              elenco.reservasIds
            )
          )
            .filter(
              (atletaId) =>
                atletasValidos.has(atletaId) &&
                !titularesUsados.has(
                  atletaId
                )
            )
            .slice(0, MAX_RESERVAS);

        const livres =
          todosAtletas.filter(
            (atleta) =>
              !titularesUsados.has(
                atleta.atletaId
              )
          );

        return {
          ...elenco,
          posicoes:
            novasPosicoes,
          reservasIds:
            reservasIdsValidas,
          livres,
        };
      })
    );
  }, [
    loading,
    turmaId,
    todosAtletas,
  ]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = Storage.token;

      if (!token || !turmaId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const res = await axios.get(
          `${API.BASE_URL}/api/turmas/${turmaId}/alunos`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (cancelled) return;

        const alunosValidos =
          Array.isArray(res.data?.alunos)
            ? res.data.alunos.filter(
                (aluno: any) =>
                  aluno?.inTurma === true &&
                  aluno?.vinculado === true &&
                  Boolean(aluno?.atletaId)
              )
            : res.data;

        const baseAtletas = normalizeAtletas(alunosValidos);
        const rElencos = await axios.get(ELENCOS_BASE, {
          params: { tipoUsuarioId: Storage.tipoUsuarioId, turmaId },
          headers: { Authorization: `Bearer ${token}` },
        });

        const salvos = Array.isArray(rElencos.data) ? rElencos.data : [];
        const salvosDaTurma = salvos.filter((e: any) => String(e.turmaId) === String(turmaId));

        if (salvosDaTurma.length) {
          const elencoAtivoIdAntes =
            elencos[activeIndex]?.id ??
            null;

          const indiceAtivoAntes =
            activeIndex;

          const montados =
            salvosDaTurma.map(
              (elencoSalvo: any) =>
                buildElencoUI(
                  elencoSalvo,
                  baseAtletas
                )
            );

          setTodosAtletas(
            baseAtletas
          );

          setElencos(
            montados
          );

          const indicePeloId =
            elencoAtivoIdAntes
              ? montados.findIndex(
                  (elenco) =>
                    elenco.id ===
                    elencoAtivoIdAntes
                )
              : -1;

          if (indicePeloId >= 0) {
            setActiveIndex(
              indicePeloId
            );
          } else {
            setActiveIndex(
              Math.min(
                indiceAtivoAntes,
                montados.length - 1
              )
            );
          }

          return;
        }

        if (modo === "convocacao" && eventoId) {
          try {
            const raw = localStorage.getItem(convKey(eventoId, turmaId));
            if (raw) {
              const draft =
                JSON.parse(raw) as ConvocacaoDraft;

              const reservasValidas =
                filterReservasForTurma(
                  baseAtletas,
                  Array.isArray(draft.reservasIds)
                    ? draft.reservasIds
                    : []
                ).slice(0, MAX_RESERVAS);

              const elencoRestaurado =
                buildElencoUI(
                  {
                    id: null,
                    nome:
                      draft.nome ||
                      "Elenco 1",
                    maxJogadores: 11,

                    escala: {
                      ...draft.escala,
                      __reservasIds:
                        reservasValidas,
                    },

                    formacao:
                      draft.formacao,
                  } as any,

                  baseAtletas
                );

              setTodosAtletas(baseAtletas);
              setElencos([
                elencoRestaurado,
              ]);
              setActiveIndex(0);

              return;
            }
          } catch (e) {
            console.error("Falha ao restaurar convocacao do localStorage:", e);
          }
        }

        setTodosAtletas(baseAtletas);
        setElencos([
        {
          id: null,
          nome: "Elenco 1",
          maxJogadores: 11,
          posicoes: emptyPosicoes(),
          livres: baseAtletas.slice(),
          reservasIds: [],
          formacao: {
            ...FORMACAO_PADRAO,
          },
        },
      ]);

      setActiveIndex(0);
      } catch (e) {
        console.error("Erro ao carregar membros da turma:", e);
        if (cancelled) return;

        console.error(
          "Não foi possível atualizar a turma."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaId]);

  const fieldBox = useSize<HTMLDivElement>();

  const BASE_W = isMobile ? SHIELD_W_MOB : SHIELD_W_DESK;
  const BASE_H = isMobile ? SHIELD_H_MOB : SHIELD_H_DESK;
  const BASE_SLOT_EXTRA = isMobile ? 40 : 64;

  const baseSlotW = BASE_W + 12;
  const maxCols = 4;
  const needW = maxCols * baseSlotW + (maxCols - 1) * 8;

  const availW = Math.max(0, fieldBox.size.w - 8);
  const minScale = isMobile ? 0.48 : 0.6;
  const scale = Math.max(minScale, Math.min(availW / needW, 1));
  const SHIELD_W = Math.round(BASE_W * scale);
  const SHIELD_H = Math.round(BASE_H * scale);
  const SLOT_EXTRA_H = Math.round(BASE_SLOT_EXTRA * scale);

  const addElenco = () => {
    if (elencos.length >= 10) {
      toast.success("Você já possui 10 elencos. Exclua um para criar outro.");
      return;
    }
    setElencos(prev => {
      const novo: ElencoUI = {
        id: null,
        nome: `Elenco ${prev.length + 1}`,
        maxJogadores: 11,
        posicoes: emptyPosicoes(),
        livres: todosAtletas.slice(),
        reservasIds:[],
        formacao: {
          ...FORMACAO_PADRAO,
        },
      };
      const arr = [...prev, novo];
      setActiveIndex(arr.length - 1);
      return arr;
    });
  };

  const removeElenco = (index: number) => {
    setElencos((anteriores) => {
      if (anteriores.length <= 1) {
        return anteriores;
      }

      const novos = anteriores.filter(
        (_, indice) => indice !== index
      );

      setActiveIndex((indiceAtual) => {
        if (index < indiceAtual) {
          return indiceAtual - 1;
        }

        if (index === indiceAtual) {
          return Math.min(
            indiceAtual,
            novos.length - 1
          );
        }

        return Math.min(
          indiceAtual,
          novos.length - 1
        );
      });

      return novos;
    });
  };

  const LIST_IDS = ["atletasDesk", "atletasMob"] as const;

  const isLista = (id: string) =>
    LIST_IDS.includes(id as (typeof LIST_IDS)[number]);
  const isPosicao = (id: string) => id.startsWith("pos:");

  const handleDragEnd = (result: DropResult) => {

    const { source, destination, reason } = result;

    if (!destination) {

      if (isPosicao(source.droppableId) && ativo) {
        const posId = source.droppableId.replace("pos:", "") as PosicaoCampo;

        setElencos((prev) => {
          const arr = [...prev];
          const e = { ...arr[activeIndex] };
          const atleta = e.posicoes[posId];
          if (!atleta) return prev;

          e.livres = [...e.livres, atleta];
          e.posicoes = { ...e.posicoes, [posId]: null };
          arr[activeIndex] = e;
          return arr;
        });
      }

      return;
    }

    if (!ativo) {
      return;
    }

    const fromId = source.droppableId;
    const toId = destination.droppableId;

    const fromLista = isLista(fromId);
    const toLista = isLista(toId);
    const fromPos = isPosicao(fromId);
    const toPos = isPosicao(toId);

    if (fromPos && toPos) {
      const from = fromId.replace("pos:", "") as PosicaoCampo;
      const to = toId.replace("pos:", "") as PosicaoCampo;
      if (from === to) return;

      setElencos((prev) => {
        const arr = [...prev];
        const e = { ...arr[activeIndex] };
        const a = e.posicoes[from];
        const b = e.posicoes[to];
        e.posicoes = { ...e.posicoes, [to]: a ?? null, [from]: b ?? null };
        arr[activeIndex] = e;
        return arr;
      });
      return;
    }

    if (fromPos && !toPos) {
      const posId = fromId.replace("pos:", "") as PosicaoCampo;

      setElencos((prev) => {
        const arr = [...prev];
        const e = { ...arr[activeIndex] };
        const atleta = e.posicoes[posId];
        if (!atleta) return prev;

        const livres = Array.from(e.livres);
        const insertIndex = Math.min(destination.index, livres.length);
        livres.splice(insertIndex, 0, atleta);

        e.posicoes = { ...e.posicoes, [posId]: null };
        e.livres = livres;
        arr[activeIndex] = e;
        return arr;
      });

      return;
    }

    if (fromLista && toPos) {
      const posId = toId.replace("pos:", "") as PosicaoCampo;
      const ocupados = elencoAtual.length;

      setElencos((prev) => {
        const arr = [...prev];
        const e = { ...arr[activeIndex] };

        if (ocupados >= e.maxJogadores && !e.posicoes[posId]) {
          toast.error(`O elenco já tem ${e.maxJogadores} jogadores.`);
          return prev;
        }

        const atletaArrastado =
          atletasLivresAtivo[source.index];

        if (!atletaArrastado) {
          return prev;
        }

        const livres = Array.from(
          e.livres
        );

        const indiceReal =
          livres.findIndex(
            (atleta) =>
              atleta.atletaId ===
              atletaArrastado.atletaId
          );

        if (indiceReal < 0) {
          return prev;
        }

        const [atleta] =
          livres.splice(
            indiceReal,
            1
          );

        if (!atleta) {
          return prev;
        }

        e.reservasIds =
          e.reservasIds.filter(
            (id) =>
              id !== atleta.atletaId
          );

        const anterior = e.posicoes[posId];
        e.posicoes = { ...e.posicoes, [posId]: atleta };
        if (anterior) livres.unshift(anterior);

        e.livres = livres;
        arr[activeIndex] = e;

        if (atleta && !pontos[atleta.atletaId]) {
          fetchPontuacoes([atleta.atletaId]);
        }

        return arr;
      });
      return;
    }

    if (fromLista && toLista) {
      if (filtro.trim()) {
        return;
      }

      setElencos((prev) => {
        const arr = [...prev];
        const e = {
          ...arr[activeIndex],
        };

        const nova =
          Array.from(e.livres);

        const [movido] =
          nova.splice(
            source.index,
            1
          );

        if (!movido) {
          return prev;
        }

        nova.splice(
          destination.index,
          0,
          movido
        );

        e.livres = nova;
        arr[activeIndex] = e;

        return arr;
      });
    }
  };

  const montarPayloadEscala = () => {
    const elencoAtivo = ativo;

    if (!elencoAtivo) {
      return null;
    }

    const escala =
      POSICOES.reduce(
        (resultado, posicao) => {
          resultado[posicao.id] =
            null;

          return resultado;
        },
        {} as Record<
          PosicaoCampo,
          string | null
        >
      );

    for (
      const posicao
      of posicoesDaFormacao
    ) {
      escala[posicao] =
        elencoAtivo
          .posicoes[posicao]
          ?.atletaId ??
        null;
    }

    const formacaoStr =
      `${formacao.defesa}-` +
      `${formacao.meio}-` +
      `${formacao.atacantes}`;

    return {
      nome:
        elencoAtivo.nome,

      escala,

      formacao:
        formacaoStr,

      reservasIds:
        permitirReservas
          ? reservasIds.slice()
          : [],
    };
  };

  const salvarElencoAtivo = async () => {
    const payloadOriginal =
      montarPayloadEscala();

    if (!payloadOriginal) return;

    const titularesIds = Array.from(
      new Set(
        Object.values(
          payloadOriginal.escala
        ).filter(
          (id): id is string =>
            typeof id === "string" &&
            id.trim().length > 0
        )
      )
    );

    const titularesSet = new Set(
      titularesIds
    );

    const reservasIdsValidas:
      string[] =
      permitirReservas
        ? Array.from(
            new Set<string>(
              payloadOriginal.reservasIds
            )
          )
            .filter(
              (id) =>
                !titularesSet.has(id)
            )
            .slice(0, MAX_RESERVAS)
        : [];

    const totalTitularesSalvar =
      titularesIds.length;

    const totalReservasSalvar =
      reservasIdsValidas.length;

    const totalSelecionadosSalvar =
      totalTitularesSalvar +
      totalReservasSalvar;

    if (
      totalTitularesSalvar >
      MAX_TITULARES
    ) {
      toast.error(
        "Você pode colocar no máximo 11 titulares."
      );

      return;
    }

    if (
      totalReservasSalvar >
      MAX_RESERVAS
    ) {
      toast.error(
        "Você pode colocar no máximo 11 reservas."
      );

      return;
    }

    if (totalSelecionadosSalvar < 2) {
      toast.error(
        "Adicione pelo menos 2 jogadores ao elenco antes de salvar."
      );

      return;
    }

    const payloadBase = {
      ...payloadOriginal,
      reservasIds: reservasIdsValidas,
    };

    if (modo === "convocacao") {
      if (!onSalvar) {
        toast.error("Tela em modo convocação mas não foi passado onSalvar.");
        return;
      }
      try {
        if (eventoId && turmaId) {
          const draft: ConvocacaoDraft = {
            nome: payloadBase.nome,
            formacao: payloadBase.formacao,
            escala: payloadBase.escala,
            reservasIds: payloadBase.reservasIds,
          };
          localStorage.setItem(convKey(eventoId, turmaId), JSON.stringify(draft));
        }

        await onSalvar({ ...payloadBase, turmaId });
      } catch (error: any) {
        console.error(
          "Erro ao salvar elenco:",
          error
        );

        toast.error(
          error?.response?.data?.error ||
            error?.response?.data?.message ||
            error?.message ||
            "Erro ao salvar elenco."
        );
      }
      return;
    }

    const token = Storage.token;
    const tipoUsuarioId = Storage.tipoUsuarioId;
    const tipoUsuarioRaw = Storage.tipoSalvo || "";
    const tipoUsuario = tipoUsuarioRaw.toLowerCase();

    if (!token) {
      toast.error("Você não está autenticado. Faça login novamente.");
      return;
    }
    if (!tipoUsuarioId || !tipoUsuario) {
      toast.error("Não foi possível identificar seu tipo de usuário.");
      return;
    }

    const donoRef =
      tipoUsuario === "professor"
        ? { professorId: tipoUsuarioId }
        : tipoUsuario === "clube"
        ? { clubeId: tipoUsuarioId }
        : tipoUsuario === "escolinha"
        ? { escolinhaId: tipoUsuarioId }
        : {};

    const payload = {
      nome: payloadBase.nome,
      ...donoRef,
      atletasIds: (POSICOES.map((p) => ativo!.posicoes[p.id]).filter(Boolean) as Atleta[]).map(
        (a) => a.atletaId
      ),
      maxJogadores: ativo!.maxJogadores,
      escala: payloadBase.escala,
      tipoUsuario,
      tipoUsuarioId,
      turmaId: turmaId || undefined,
      formacao: payloadBase.formacao,
      reservasIds: payloadBase.reservasIds,
    };

    try {
      if (ativo?.id) {
        await axios.put(`${ELENCOS_BASE}/${ativo.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Elenco atualizado com sucesso!");
      } else {
        const res = await axios.post(ELENCOS_BASE, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const newId = res.data?.id ?? null;
        setElencos((prev) => {
          const arr = [...prev];
          arr[activeIndex] = { ...arr[activeIndex], id: newId };
          return arr;
        });
        toast.success("Elenco criado com sucesso!");
      }
    } catch (error: any) {
      console.error(
        "Erro ao salvar elenco:",
        error
      );

      toast.error(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          "Erro ao salvar elenco."
      );
    }
  };

  const Slot: React.FC<{ pos: PosicaoCampo; label: string }> = ({ pos, label }) => {
    const a = posicoesAtivas[pos];
    const pts = a ? pontos[a.atletaId] : undefined;
    const ovr  = pts?.mediaGeral ?? 0;
    const perf = pts?.performance ?? 0;
    const disc = pts?.disciplina ?? 0;
    const resp = pts?.responsabilidade ?? 0;

    const WRAP_W = SHIELD_W + 12;
    const WRAP_H = SHIELD_H + SLOT_EXTRA_H;

    return (
      <div
        className="relative flex items-start justify-center"
        style={{
          width: WRAP_W,
          height: WRAP_H,
          flex: "0 0 auto",
        }}
      >
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-semibold opacity-80 pointer-events-none">
          {label}
        </span>

        <Droppable droppableId={`pos:${pos}`} type="ATLETA">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`mt-5 rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center
                transition-colors duration-200
                ${snapshot.isDraggingOver ? "bg-green-300/70" : "bg-green-100/70"}`}
              style={{
                width: SHIELD_W,
                height: SHIELD_H,
              }}
            >
              {a ? (
                <Draggable draggableId={String(a.atletaId)} index={0}>
                  {(provided2, snapshot2) => (
                    <div
                      ref={provided2.innerRef}
                      {...provided2.draggableProps}
                      {...provided2.dragHandleProps}
                      className={`transition-shadow duration-200 ${
                        snapshot2.isDragging ? "shadow-2xl z-50" : ""
                      } will-change-transform`}
                    >
                      <CardAtletaShield
                        atleta={a}
                        slotPos={pos}
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
                <div className="w-full h-full flex items-center justify-center text-[10px] sm:text-xs text-green-700/70">
                  Solte aqui
                </div>
              )}

              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    );
  };

  const contarJogadoresDoElenco = (
    elenco: ElencoUI
  ) => {
    const posicoesVisiveis: PosicaoCampo[] = [
      "GOL",

      ...getDefPositions(
        elenco.formacao.defesa
      ),

      ...getMidPositions(
        elenco.formacao.meio
      ),

      ...getAttPositions(
        elenco.formacao.atacantes
      ),
    ];

    const titularesIds = new Set<string>();

    for (const posicao of posicoesVisiveis) {
      const atleta =
        elenco.posicoes[posicao];

      if (atleta?.atletaId) {
        titularesIds.add(
          atleta.atletaId
        );
      }
    }

    const reservasIdsValidas = Array.from(
      new Set(elenco.reservasIds)
    )
      .filter(
        (atletaId) =>
          Boolean(atletaId) &&
          !titularesIds.has(atletaId)
      )
      .slice(0, MAX_RESERVAS);

    const titulares =
      titularesIds.size;

    const reservas =
      reservasIdsValidas.length;

    return {
      titulares,
      reservas,
      total:
        titulares + reservas,
    };
  };

  const ElencoPickerModal: React.FC<{
    open: boolean;
    onClose: () => void;
    elencos: ElencoUI[];
    activeIndex: number;
    onSelect: (idx: number) => void;
    onCreate: () => void;
    onDelete: (idx: number) => void;
  }> = ({ open, onClose, elencos, activeIndex, onSelect, onCreate, onDelete }) => {
    if (!open) return null;

    const canDelete = elencos.length > 1;

    return (
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div
          className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-4 sm:p-6 mx-0 sm:mx-4 max-h-[90dvh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold">Selecionar elenco</h3>
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 hover:bg-gray-50"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto pr-1 space-y-2 max-h-[60dvh]">
            {elencos.map((e, idx) => {
              const contagem = contarJogadoresDoElenco(e);

              return (
              <div
                key={e.id ?? `novo-${idx}`}
                className={`flex items-center justify-between gap-2 border rounded-lg px-3 py-2 ${
                  idx === activeIndex ? "border-green-600/70 bg-green-50" : "border-gray-200"
                }`}
              >
                <button
                  className="text-left flex-1 truncate"
                  title={e.nome}
                  onClick={() => onSelect(idx)}
                >
                  <div className="font-medium truncate">
                    {e.nome || `Elenco ${idx + 1}`}
                  </div>
                  <div className="text-xs text-gray-500">
                    {contagem.total}/{MAX_SELECIONADOS} jogadores selecionados
                  </div>

                  <div className="text-[11px] text-gray-400">
                    Titulares: {contagem.titulares}/{MAX_TITULARES}
                    {" • "}
                    Reservas: {contagem.reservas}/{MAX_RESERVAS}
                  </div>
                </button>

                <button
                  onClick={() => onDelete(idx)}
                  disabled={!canDelete}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm border ${
                    canDelete
                      ? "border-red-300 text-red-700 hover:bg-red-50"
                      : "border-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                  title={canDelete ? "Excluir elenco" : "Mantenha pelo menos 1 elenco"}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
              </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={onCreate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              <Plus className="h-4 w-4" />
              Novo elenco
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const direction: DroppableProps["direction"] = isMobile ? "horizontal" : "vertical";

const maxSlotsPorLinha: Record<LinhaFormacao, number> = {
  atacantes: ATT_BASE.length,
  meio: MID_BASE.length,
  defesa: DEF_BASE.length,
};

const excluirElencoSalvo = async (
  index: number
) => {
  const alvo = elencos[index];

  if (!alvo) return;

  try {
    if (alvo.id) {
      const token = Storage.token;

      await axios.delete(
        `${ELENCOS_BASE}/${alvo.id}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );
    }

    removeElenco(index);

    toast.success(
      "Elenco excluído com sucesso!"
    );
  } catch (error: any) {
    toast.error(
      error?.response?.data?.error ||
        "Não foi possível excluir o elenco."
    );
  }
};

const handleChangeLinha = (linha: LinhaFormacao, delta: 1 | -1) => {
  if (!ativo) return;

  if (delta === 1) {
    setFormacao((prev) => {
      const totalOutfield = prev.atacantes + prev.meio + prev.defesa;
      const limitOutfield = Math.min(10, (ativo.maxJogadores ?? 11) - 1);

      if (totalOutfield >= limitOutfield) {
        toast.error("A formação não pode ter mais de 11 jogadores no total.");
        return prev;
      }

      const atual = prev[linha];
      if (atual >= maxSlotsPorLinha[linha]) return prev;

      return { ...prev, [linha]: atual + 1 };
    });
  } else {
    const atual = formacao[linha];
    if (atual <= 0) return;

    const linhaPositions =
      linha === "defesa"
        ? getDefPositions(atual)
        : linha === "meio"
        ? getMidPositions(atual)
        : getAttPositions(atual);

    const posToClear = linhaPositions[linhaPositions.length - 1];

    setElencos((prevElencos) => {
      const arr = [...prevElencos];
      const e = { ...arr[activeIndex] };
      const jogador = e.posicoes[posToClear];

      if (jogador) e.livres = [...e.livres, jogador];

      e.posicoes = { ...e.posicoes, [posToClear]: null };
      arr[activeIndex] = e;
      return arr;
    });

    setFormacao((prev) => ({ ...prev, [linha]: prev[linha] - 1 }));
  }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-green-100">
        <span className="text-green-800 font-semibold">Carregando elencos...</span>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-green-100 flex flex-col">
      <div className="sticky top-0 z-20 bg-green-100/95 backdrop-blur supports-[backdrop-filter]:bg-green-100/80 border-b border-green-300">
        <div className="p-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (backHref) {
                window.location.href = backHref;
                return;
              }
              window.history.back();
            }}
            aria-label="Voltar"
            title="Voltar"
            className="inline-flex h-10 w-10 items-center justify-center
              rounded-full border border-green-800 bg-white text-green-900
              shadow-sm hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-700/30"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center">
            {titulo && (
              <h1 className="ml-3 text-lg font-bold text-green-900">
                {titulo}
              </h1>
            )}
          </div>

          <div className="ml-4 flex-1 flex items-center justify-center px-3 gap-2">
            {turmas.length > 0 && (
              <select
                value={turmaId}
                onChange={(e) => setTurmaId(e.target.value)}
                className="border rounded-full px-3 py-1 text-xs sm:text-sm bg-white"
                title="Turma"
              >
                {turmas.map((turma) => {
                  const nomeDuplicado =
                    nomesTurmasDuplicados.has(
                      turma.nome
                        .trim()
                        .toLowerCase()
                    );

                  const partes = [
                    turma.nome,

                    turma.origemNome
                      ? `${
                          turma.origemTipo ??
                          "Responsável"
                        }: ${turma.origemNome}`
                      : null,

                    nomeDuplicado
                      ? `ID ${turma.id.slice(0, 6)}`
                      : null,
                  ].filter(Boolean);

                  return (
                    <option
                      key={turma.id}
                      value={turma.id}
                    >
                      {partes.join(" • ")}
                    </option>
                  );
                })}
              </select>
            )}

            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm bg-white text-green-900 border-green-300 hover:bg-green-50"
              title="Selecionar elenco"
            >
              <ListFilter className="w-4 h-4" />
              {ativo?.nome ? `Elenco: ${ativo.nome}` : "Selecionar elenco"}
            </button>
          </div>

          <div className="w-10" />
        </div>

        {ativo && (
          <div className="px-3 pb-3 flex flex-wrap items-center gap-3 md:gap-4">
            <label htmlFor="elencoNome" className="sr-only">Nome do elenco</label>
            <input
              id="elencoNome"
              name="elencoNome"
              type="text"
              value={ativo.nome}
              onChange={(e) =>
                setElencos(prev => {
                  const arr = [...prev];
                  arr[activeIndex] = { ...arr[activeIndex], nome: e.target.value };
                  return arr;
                })
              }
              className="border rounded px-3 py-2 text-base md:text-lg font-bold bg-white"
              placeholder="Nome do elenco"
            />
            <span className="text-sm font-semibold text-green-900">
              {totalSelecionados}/{MAX_SELECIONADOS} jogadores selecionados
              {" • "}
              Titulares: {totalTitulares}/{MAX_TITULARES}
              {" • "}
              Reservas: {totalReservas}/{MAX_RESERVAS}
              {" • "}
              Formação: {formacao.defesa}-{formacao.meio}-{formacao.atacantes}
            </span>

            <button
              onClick={salvarElencoAtivo}
              className="ml-auto md:ml-0 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 active:scale-[0.99]"
            >
              {ativo.id ? "Atualizar" : "Salvar"}
            </button>
            <button
              onClick={() => setDrawerOpen(v => !v)}
              className="md:hidden bg-white border border-green-400 text-green-800 px-3 py-2 rounded-lg"
            >
              {drawerOpen ? "Ocultar atletas" : "Mostrar atletas"}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex md:flex-row flex-col">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="order-1 md:order-2 flex-1 flex flex-col items-center p-3 md:p-5">
            <div
              ref={fieldBox.ref}
              className="w-full flex-1 min-h-[360px] rounded-2xl p-3 md:p-5 bg-gradient-to-b from-green-300 to-green-600 shadow-inner
                         flex flex-col gap-3 md:gap-5 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+120px)] md:pb-0 transition-all"
            >
              <div className="flex items-center gap-2 md:gap-3">
                <button
                  type="button"
                  onClick={() => handleChangeLinha("atacantes", -1)}
                  className="h-9 w-9 rounded-full bg-white/80 text-green-900 text-xl font-bold flex items-center justify-center shadow-sm active:scale-95"
                  title="Diminuir atacantes"
                >
                  -
                </button>

<div className="flex-1 flex flex-wrap justify-center gap-2 md:gap-4 transition-all duration-200">
  {getAttPositions(formacao.atacantes).map((pos) => {
    const meta = POSICOES.find((p) => p.id === pos)!;
    return <Slot key={pos} pos={pos} label={meta.label} />;
  })}
</div>

                <button
                  type="button"
                  onClick={() => handleChangeLinha("atacantes", 1)}
                  className="h-9 w-9 rounded-full bg-white/80 text-green-900 text-xl font-bold flex items-center justify-center shadow-sm active:scale-95"
                  title="Aumentar atacantes"
                >
                  +
                </button>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                <button
                  type="button"
                  onClick={() => handleChangeLinha("meio", -1)}
                  className="h-9 w-9 rounded-full bg-white/80 text-green-900 text-xl font-bold flex items-center justify-center shadow-sm active:scale-95"
                  title="Diminuir meio-campo"
                >
                  -
                </button>

<div className="flex-1 flex flex-wrap justify-center gap-2 md:gap-4 transition-all duration-200">
  {getMidPositions(formacao.meio).map((pos) => {
    const meta = POSICOES.find((p) => p.id === pos)!;
    return <Slot key={pos} pos={pos} label={meta.label} />;
  })}
</div>


                <button
                  type="button"
                  onClick={() => handleChangeLinha("meio", 1)}
                  className="h-9 w-9 rounded-full bg-white/80 text-green-900 text-xl font-bold flex items-center justify-center shadow-sm active:scale-95"
                  title="Aumentar meio-campo"
                >
                  +
                </button>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                <button
                  type="button"
                  onClick={() => handleChangeLinha("defesa", -1)}
                  className="h-9 w-9 rounded-full bg-white/80 text-green-900 text-xl font-bold flex items-center justify-center shadow-sm active:scale-95"
                  title="Diminuir defesa"
                >
                  -
                </button>
                <div className="flex-1 flex flex-wrap justify-center gap-2 md:gap-3 transition-all duration-200">
                  {getDefPositions(formacao.defesa).map((pos) => {
                    const meta = POSICOES.find((p) => p.id === pos)!;
                    return <Slot key={pos} pos={pos} label={meta.label} />;
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => handleChangeLinha("defesa", 1)}
                  className="h-9 w-9 rounded-full bg-white/80 text-green-900 text-xl font-bold flex items-center justify-center shadow-sm active:scale-95"
                  title="Aumentar defesa"
                >
                  +
                </button>
              </div>

              <div className="grid grid-cols-1 place-items-center">
                <Slot pos="GOL" label={POSICOES.find(p => p.id === "GOL")?.label ?? "Goleiro"} />
              </div>
            </div>
          </div>

        {!isMobile && (
          <div className="w-full md:w-80 bg-white shadow-md p-4 border-l border-green-200">
            <h2 className="text-lg font-bold mb-3">Membros da Turma</h2>
            {permitirReservas && (
              <div className="mb-3 p-3 rounded-lg border border-yellow-300 bg-yellow-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-yellow-900">Reservas ({reservas.length})</h3>
                  <button
                    className="text-xs px-2 py-1 rounded border border-yellow-300 hover:bg-yellow-100"
                    onClick={() => setReservasIds([])}
                    type="button"
                  >
                    Limpar
                  </button>
                </div>

                <div className="mt-2 flex flex-col gap-2">
                  {reservas.map((a) => (
                    <div key={a.atletaId} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          foto={a.foto}
                          alt={a.nome}
                          className="w-10 h-10"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{a.nome}</div>
                         {posicaoParaSigla(a.posicao) && (
                            <div className="text-[11px] opacity-70">
                              {posicaoParaSigla(a.posicao)}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded border border-yellow-300 text-yellow-900 hover:bg-yellow-100"
                        onClick={() => setReservasIds(prev => prev.filter(id => id !== a.atletaId))}
                      >
                        Remover
                      </button>
                    </div>
                  ))}

                  {reservasDisponiveis.length === 0 && reservas.length === 0 && (
                    <div className="text-xs text-yellow-900/70">Selecione atletas na lista para virar reserva.</div>
                  )}
                </div>
              </div>
            )}

            <label htmlFor="buscaDesk" className="sr-only">Buscar por nome/posição</label>
            <input
              id="buscaDesk"
              name="buscaDesk"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar por nome/posição"
              className="w-full mb-3 border rounded px-3 py-2"
            />
            <Droppable droppableId="atletasDesk" type="ATLETA" direction="vertical">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100dvh-240px)] pr-1"
                >
                  {atletasLivresAtivo.map((atleta, index) => (
                    <Draggable
                      key={String(atleta.atletaId)}
                      draggableId={String(atleta.atletaId)}
                      index={index}
                    >
                      {(provided2, snapshot) => (
                        <div
                          ref={provided2.innerRef}
                          {...provided2.draggableProps}
                          {...provided2.dragHandleProps}
                          className={`cursor-grab ${
                            snapshot.isDragging ? "shadow-2xl z-50" : ""
                          } will-change-transform`}
                        >
                          <div className="flex items-center gap-2">
                            <CardAtleta atleta={atleta} />

                            {permitirReservas && (
                              <button
                                type="button"
                                disabled={
                                  reservasIds.includes(atleta.atletaId) ||
                                  reservasIds.length >= MAX_RESERVAS
                                }
                                className={`shrink-0 text-xs px-2 py-2 rounded-md border
                                  ${
                                    reservasIds.includes(atleta.atletaId)
                                      ? "border-gray-300 text-gray-400 cursor-not-allowed"
                                      : "border-yellow-300 text-yellow-900 hover:bg-yellow-50"
                                  }`}
                              onClick={() => {
                              if (reservasIds.length >= MAX_RESERVAS) {
                                toast.error("Você pode selecionar no máximo 11 reservas.");
                                return;
                              }
                              setReservasIds(prev =>
                                prev.includes(atleta.atletaId) ? prev : [...prev, atleta.atletaId]
                              );
                            }}
                                title="Adicionar como reserva"
                              >
                                Reserva
                              </button>
                            )}
                          </div>

                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        )}

        {isMobile && (
          <div
            className={`fixed left-0 right-0 z-30 transition-transform duration-200
              ${drawerOpen ? "translate-y-0" : "translate-y-[calc(100%_-_52px)]"}
              bottom-0`}
          >
            <div className="mx-3 rounded-t-2xl border border-green-300 bg-white shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]">
              <button
                onClick={() => setDrawerOpen(v => !v)}
                className="w-full py-2 active:opacity-80"
                aria-label="Alternar lista de atletas"
              >
                <div className="mx-auto h-1.5 w-12 rounded-full bg-green-300" />
              </button>

              <div className="px-3 pb-2 flex items-center gap-2">
                <h2 className="text-base font-bold">Membros da Turma</h2>
                {permitirReservas && reservas.length > 0 && (
                  <div className="px-3 pb-2">
                    <h3 className="text-sm font-bold text-yellow-900 mb-1">
                      Reservas ({reservas.length})
                    </h3>
                    <div className="flex gap-2 overflow-x-auto">
                      {reservas.map(a => (
                        <div key={a.atletaId} className="min-w-[120px] text-xs bg-yellow-100 border border-yellow-300 rounded p-2">
                          <div className="font-semibold truncate">{a.nome}</div>
                          <button
                            className="mt-1 text-[10px] text-red-600"
                            onClick={() => setReservasIds(prev => prev.filter(id => id !== a.atletaId))}
                          >
                            remover
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <span className="text-xs text-green-700/80">({atletasLivresAtivo.length})</span>
              </div>

              <div className="px-3 pb-2">
                <label htmlFor="buscaMob" className="sr-only">Buscar por nome/posição</label>
                <input
                  id="buscaMob"
                  name="buscaMob"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Buscar por nome/posição"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <Droppable droppableId="atletasMob" type="ATLETA" direction="horizontal">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex flex-row gap-3 overflow-x-auto px-3 py-2 snap-x snap-mandatory"
                  >
                    {atletasLivresAtivo.map((atleta, index) => (
                      <Draggable
                        key={String(atleta.atletaId)}
                        draggableId={String(atleta.atletaId)}
                        index={index}
                      >
                        {(provided2, snapshot) => (
                          <div
                            ref={provided2.innerRef}
                            {...provided2.draggableProps}
                            {...provided2.dragHandleProps}
                            className={`cursor-grab snap-start ${
                              snapshot.isDragging ? "shadow-2xl z-50" : ""
                            } will-change-transform`}
                          >
                          <div className="flex items-center gap-2">
                            <CardAtleta atleta={atleta} />

                            {permitirReservas && (
                              <button
                                type="button"
                                disabled={
                                  reservasIds.includes(atleta.atletaId) ||
                                  reservasIds.length >= MAX_RESERVAS
                                }
                               className={`shrink-0 text-xs px-2 py-2 rounded-md border
                                  ${
                                    reservasIds.includes(atleta.atletaId)
                                      ? "border-gray-300 text-gray-400 cursor-not-allowed"
                                      : "border-yellow-300 text-yellow-900 hover:bg-yellow-50"
                                  }`}
                                onClick={() => {
                                if (reservasIds.length >= MAX_RESERVAS) {
                                  toast.error("Você pode selecionar no máximo 11 reservas.");
                                  return;
                                }
                                setReservasIds(prev =>
                                  prev.includes(atleta.atletaId) ? prev : [...prev, atleta.atletaId]
                                );
                              }}
                                title="Adicionar como reserva"
                              >
                                Reserva
                              </button>
                            )}
                          </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
        )}

        </DragDropContext>
      </div>

      <ElencoPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        elencos={elencos}
        activeIndex={activeIndex}
        onSelect={(idx) => {
          setActiveIndex(idx);
          setPickerOpen(false);
        }}
        onCreate={() => {
          setPickerOpen(false);
          addElenco();
        }}
        onDelete={(idx) => {
          const alvo = elencos[idx];

          if (!alvo) return;
          if (elencos.length <= 1) return;

          if (
            confirm(
              `Excluir "${alvo.nome}"? Essa ação não poderá ser desfeita.`
            )
          ) {
            void excluirElencoSalvo(idx);
          }
        }}
      />
    </div>
  );
}