import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Heart, MessageCircle, Share, Volleyball, User, CirclePlus, Search, House,
  ChevronDown, ChevronUp, X, Medal, Trophy,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import CardAtletaShield from "../components/cards/CardAtletaShield.js";
import { formatarUrlFoto } from "@/utils/formatarFoto.js";
import { FLAGS } from "../config.js";

const TODAS_CATEGORIAS = ["Sub9","Sub11","Sub13","Sub15","Sub17","Sub20","Livre"] as const;
const UFS_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;
const authHeaders = () => ({ Authorization: `Bearer ${Storage.token || localStorage.getItem("token") || ""}` });

function HeaderSlider({
  pos, setPos, onCommit, onDraggingChange,
}: {
  pos: number; setPos: (v: number) => void; onCommit: (target: "feed"|"desafios") => void; onDraggingChange?: (b: boolean)=>void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0); const startPos = useRef(0); const click = useRef({t:0,p:0});
  const clamp01 = (v:number)=>Math.max(0,Math.min(1,v));
  const px = Math.round(pos*width);

  useEffect(()=>{ const upd=()=>setWidth(trackRef.current?.clientWidth || window.innerWidth); upd(); window.addEventListener("resize",upd); return()=>window.removeEventListener("resize",upd);},[]);
  useEffect(()=>{ onDraggingChange?.(dragging); },[dragging,onDraggingChange]);

  const onDown:React.PointerEventHandler<HTMLButtonElement>=(e)=>{ (e.currentTarget as any).setPointerCapture?.(e.pointerId); setDragging(true); startX.current=e.clientX; startPos.current=pos; click.current={t:Date.now(),p:pos}; };
  const onMove:React.PointerEventHandler<HTMLButtonElement>=(e)=>{ if(!dragging) return; setPos(clamp01(startPos.current + (e.clientX-startX.current)/Math.max(1,width))); };
  const onUp:React.PointerEventHandler<HTMLButtonElement>=()=>{ setDragging(false); const dt=Date.now()-click.current.t; const dp=Math.abs(pos-click.current.p); if(dt<220&&dp<0.02) return; onCommit(pos>=0.5?"desafios":"feed"); };

  const houseOpacity = 1-pos; const trophyOpacity = pos;

  return (
    <div className="absolute inset-0 z-0">
      <div ref={trackRef} className="relative h-full w-full">
        <div
          className={`absolute inset-y-2 left-0 right-0 rounded-full border overflow-hidden transition-colors duration-150 ${
            dragging ? "bg-green-100/70 border-green-200 shadow-inner" : "bg-transparent border-transparent"
          }`}
        />
        <div
          className="absolute inset-y-2 left-0 rounded-full bg-green-200/60 transition-[width,opacity] duration-150"
          style={{ width: `${px}px`, opacity: dragging ? 1 : 0 }}
        />
        <div className={`absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-green-800/70 text-xs sm:text-sm transition-opacity duration-150 ${dragging ? "opacity-100" : "opacity-0"}`}>
          <House className="w-4 h-4"/><span className="hidden sm:inline">Feed</span>
        </div>
        <div className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-yellow-700/80 text-xs sm:text-sm transition-opacity duration-150 ${dragging ? "opacity-100" : "opacity-0"}`}>
          <span className="hidden sm:inline">Desafios</span><Trophy className="w-4 h-4"/>
        </div>

        <button
          aria-label="Trocar entre Feed e Desafios (arraste)"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          className="absolute top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white shadow-lg border active:scale-[0.98] touch-none"
          style={{ left: Math.max(6, Math.min(px-20, (width||0)-46)), transition: dragging?"none":"left 140ms ease" }}>
          <div className="relative w-full h-full flex items-center justify-center">
            <House className="absolute" style={{opacity:houseOpacity}}/>
            <Trophy className="absolute text-yellow-600" style={{opacity:trophyOpacity}}/>
          </div>
        </button>
      </div>
    </div>
  );
}

function normaliza(input: any[]): Submissao[] {
  const arr = Array.isArray(input) ? input : [];
  return arr.map((s: any) => {
    const isTreino = !!(s.treinoAgendadoId || s.treino || s.tipo === "TREINO");
    const desafio: Desafio = isTreino ? {
      id: s.treinoAgendado?.treinoProgramado?.id || s.treinoProgramadoId || String(s.id || "treino"),
      titulo: s.treinoTituloSnapshot || s.treinoAgendado?.treinoProgramado?.nome || s.titulo || "Treino",
      nivel: String(s.nivel || "base"),
      pontuacao: Number(s.pontuacaoSnapshot ?? s.pontosCreditados ?? 0),
      categoria: Array.isArray(s.categoria) ? s.categoria : [],
      imagemUrl: s.imagemUrl || s.treinoAgendado?.treinoProgramado?.imagemUrl || undefined,
    } : {
      id: s.desafio?.id || String(s.id),
      titulo: s.desafio?.titulo || s.titulo || "",
      nivel: s.desafio?.nivel || s.nivel || "base",
      pontuacao: Number(s.desafio?.pontuacao ?? s.pontuacao ?? 0),
      categoria: Array.isArray(s.desafio?.categoria) ? s.desafio.categoria : [],
      imagemUrl: s.desafio?.imagemUrl,
    };
    const usuarioId = s.usuarioId || s.atleta?.usuario?.id || s.atleta?.usuarioId || null;
    const atleta: Atleta = s.atleta && s.atleta.usuario ? s.atleta : {
      id: s.atleta?.id || s.atletaId || usuarioId || "",
      usuario: { id: usuarioId || "", nome: s.atleta?.nome || s.usuario?.nome || s.nome || "Atleta", foto: s.atleta?.foto || s.usuario?.foto || s.foto || undefined, },
    };
    return {
      id: String(s.id),
      desafio, atleta,
      midias: Array.isArray(s.midias) ? s.midias.map((m:any)=>({ id:String(m.id||m.url), url:m.url, tipo:m.tipo||"imagem"})) : [],
      createdAt: s.criadoEm || s.createdAt || new Date().toISOString(),
      usuarioId,
      curtidas: Array.isArray(s.curtidas) ? s.curtidas : [],
      curtidasCount: Number(s.curtidasCount ?? (s.curtidas?.length ?? 0)),
      comentariosCount: Number(s.comentariosCount ?? 0),
      viewerLiked: Boolean(s.viewerLiked ?? false),
      tipo: isTreino ? "TREINO" : "DESAFIO",
    } as Submissao;
  });
}
interface Midia { id: string; url: string; tipo: string; }
interface Desafio { id: string; titulo: string; nivel: string; pontuacao: number; categoria: string[]; imagemUrl?: string; }
interface Usuario { id: string; nome: string; foto?: string; }
interface Atleta { id: string; usuario: Usuario; }
interface Comentario { id: string; conteudo: string; dataCriacao: string; usuario: { id: string; nome: string; foto?: string }; }
interface Submissao {
  id: string; desafio: Desafio; atleta: Atleta; midias: Midia[]; createdAt: string;
  usuarioId: string | null; curtidas: { usuarioId: string }[]; curtidasCount: number; comentariosCount: number;
  viewerLiked: boolean; comentarios?: Comentario[]; tipo: "TREINO" | "DESAFIO";
}
function fullUrl(possiblyRelative?: string) {
  if (!possiblyRelative) return "";
  if (possiblyRelative.startsWith("http") || possiblyRelative.startsWith("data:")) return possiblyRelative;
  return `${API.BASE_URL}${possiblyRelative}`;
}
type RankItem = { rank: number; atletaId: string; nome: string; foto?: string|null; cidade?: string|null; estado?: string|null; pais?: string|null; categoria: string[]; pontuacaoTotal: number; performance: number; disciplina: number; responsabilidade: number; isViewer: boolean; };
type RankListResp = { total: number; items: RankItem[] };
type PosicaoResp = { atletaId: string; nome: string; foto?: string|null; cidade?: string|null; estado?: string|null; pais?: string|null; categoria: string[]; pontuacaoTotal: number; posicao: number; total: number; inTop100: boolean; isViewer: boolean; };
const calcOVR = (r: RankItem) => Math.round((Number(r.performance||0)+Number(r.disciplina||0)+Number(r.responsabilidade||0))/3);

const RankingGlobalTab: React.FC = () => {
  const token = Storage.token || localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  const [uf,setUf] = useState<string>(""); const [categoria,setCategoria]=useState<string>(""); const [qTop,setQTop]=useState<string>("");
  const [lista,setLista]=useState<RankItem[]>([]); const [total,setTotal]=useState(0); const [loading,setLoading]=useState(true);
  const [buscaNome,setBuscaNome]=useState(""); const [minhaPosicao,setMinhaPosicao]=useState<PosicaoResp|null>(null); const [buscandoPos,setBuscandoPos]=useState(false);
  const [cardModal,setCardModal]=useState<RankItem|null>(null);
  const openCardModal=(r:RankItem)=>{setCardModal(r);document.body.style.overflow="hidden";};
  const closeCardModal=()=>{setCardModal(null);document.body.style.overflow="";};
  useEffect(()=>{ const onKey=(e:KeyboardEvent)=>{ if(e.key==="Escape") closeCardModal(); }; window.addEventListener("keydown",onKey); return()=>window.removeEventListener("keydown",onKey);},[]);
  const carregar = async ()=>{ setLoading(true); try{
      const params:any={}; if(uf) params.estado=uf; if(categoria) params.categoria=categoria;
      const {data}=await axios.get<RankListResp>(`${API.BASE_URL}/api/ranking/global`,{headers:{Authorization:`Bearer ${token}`},params});
      setLista(Array.isArray(data.items)?data.items:[]); setTotal(Number(data.total??0));
    }catch(e){ console.error(e); setLista([]); setTotal(0); alert("Não foi possível carregar o ranking global."); } finally{ setLoading(false); } };
  useEffect(()=>{carregar();},[]);
  const aplicarFiltros=async()=>{ await carregar(); setMinhaPosicao(null); };
  const limparFiltros=async()=>{ setUf(""); setCategoria(""); await carregar(); setMinhaPosicao(null); };
  const listaFiltradaTop = useMemo(()=>{ const q=qTop.trim().toLowerCase(); if(!q) return lista; return lista.filter(x=>x.nome.toLowerCase().includes(q));},[lista,qTop]);
  const buscarMinhaPosicao=async()=>{ try{
      if(!buscaNome.trim()) return alert("Digite seu nome para procurar sua posição.");
      setBuscandoPos(true);
      const params:any={}; if(buscaNome.trim()) params.q=buscaNome.trim(); if(uf) params.estado=uf; if(categoria) params.categoria=categoria;
      const {data}=await axios.get<PosicaoResp>(`${API.BASE_URL}/api/ranking/posicao`,{headers:{Authorization:`Bearer ${token}`},params});
      setMinhaPosicao(data||null); if(data?.inTop100) setQTop(data.nome);
    }catch(e:any){ console.error(e?.response?.data||e); setMinhaPosicao(null); alert(e?.response?.data?.error||"Não foi possível encontrar a posição."); } finally{ setBuscandoPos(false);} };

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2"><Medal className="text-amber-600"/><div className="font-semibold">Ranking global (Top 100)</div></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className="block text-sm text-gray-700 mb-1">Estado (UF)</label>
            <select className="w-full border rounded px-3 py-2" value={uf} onChange={(e)=>setUf(e.target.value)}>
              <option value="">Todos</option>{UFS_BR.map((s)=>(<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <div><label className="block text-sm text-gray-700 mb-1">Categoria</label>
            <select className="w-full border rounded px-3 py-2" value={categoria} onChange={(e)=>setCategoria(e.target.value)}>
              <option value="">Todas</option>{TODAS_CATEGORIAS.map((c)=>(<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          <div className="self-end flex gap-2">
            <button onClick={aplicarFiltros} className="px-4 py-2 bg-green-700 text-white rounded">Aplicar</button>
            <button onClick={limparFiltros} className="px-4 py-2 bg-gray-200 rounded">Limpar</button>
          </div>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2"/>
            <input className="w-full border rounded pl-9 pr-3 py-2" placeholder="Buscar no Top 100…" value={qTop} onChange={(e)=>setQTop(e.target.value)}/>
          </div>
          <div className="flex-1"/>
          <div className="flex gap-2 w-full sm:w-auto">
            <input className="flex-1 border rounded px-3 py-2" placeholder="Seu nome (ex.: João Silva)" value={buscaNome} onChange={(e)=>setBuscaNome(e.target.value)}/>
            <button onClick={buscarMinhaPosicao} disabled={buscandoPos} className="px-4 py-2 bg-green-700 text-white rounded disabled:opacity-60">
              {buscandoPos?"Buscando...":"Ver minha posição"}
            </button>
          </div>
        </div>
      </div>

      {loading ? <div className="text-gray-600">Aguarde…</div> :
        (listaFiltradaTop.length===0 ? <div className="text-gray-600">Nenhum atleta encontrado para os filtros.</div> :
          <div className="space-y-2">
            {listaFiltradaTop.map((r)=>(
              <div key={r.atletaId} className={`bg-white border rounded-xl p-3 flex items-center gap-3 ${r.isViewer?"ring-2 ring-green-600":""}`}>
                <div className="w-10 text-center font-bold text-gray-800">#{r.rank}</div>
                <img src={formatarUrlFoto(r.foto,"usuarios")} className="w-10 h-10 rounded-full object-cover shrink-0" alt={r.nome}/>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.nome} {r.isViewer && <span className="text-xs text-green-700">(você)</span>}</div>
                  <div className="text-xs text-gray-500 truncate">{r.estado || ""}{r.pais?` • ${r.pais}`:""}</div>
                </div>
                <div className="text-right"><div className="text-[11px] uppercase tracking-wide text-gray-500">Pontos</div><div className="font-bold text-base">{r.pontuacaoTotal}</div></div>
              </div>
            ))}
          </div>
        )
      }

      {cardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) closeCardModal();}}>
          <div className="w-full max-w-md relative p-4">
            <button className="absolute top-3 right-3 p-2 rounded bg-black/40 text-white hover:bg-black/60" onClick={closeCardModal} aria-label="Fechar"><X className="text-white"/></button>
            <div className="w-full flex flex-col items-center">
              <CardAtletaShield atleta={{ id: cardModal.atletaId, nome: cardModal.nome, foto: cardModal.foto||undefined, posicao: `#${cardModal.rank}`}} ovr={calcOVR(cardModal)} perf={cardModal.performance} disc={cardModal.disciplina} resp={cardModal.responsabilidade} size={{w:320,h:448}} goldenMinOVR={88}/>
              <div className="mt-3 text-center text-white">
                <div className="text-xl font-bold">{cardModal.nome}</div>
                <div className="text-sm opacity-90">#{cardModal.rank} • {cardModal.pontuacaoTotal} pts</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function DesafiosInner() {
  const [submissoes, setSubmissoes] = useState<Submissao[]>([]);
  const [filtroSeguindo, setFiltroSeguindo] = useState(false);
  const [filtroNivel, setFiltroNivel] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [seguindoIds, setSeguindoIds] = useState<string[]>([]);
  const [comentarioTexto, setComentarioTexto] = useState<Record<string, string>>({});
  const [aba, setAba] = useState<"feed" | "ranking" | "rankingGlobal">("feed");
  const [subsDesafios, setSubsDesafios] = useState<Submissao[]>([]);
  const [subsTreinos, setSubsTreinos] = useState<Submissao[]>([]);

  const applyUpdate = (alvo: Submissao, patch: Partial<Submissao>) => {
    setSubsDesafios(prev => prev.map(s => s.id === alvo.id ? { ...s, ...patch } : s));
    setSubsTreinos(prev => prev.map(s => s.id === alvo.id ? { ...s, ...patch } : s));
    setSubmissoes(prev   => prev.map(s => s.id === alvo.id ? { ...s, ...patch } : s));
  };

  useEffect(() => {
    (async () => {
      try {
        const [r1, r2, seguindoRes] = await Promise.all([
          axios.get(`${API.BASE_URL}/api/desafios/submissoes`, { headers: authHeaders() }),
          axios.get(`${API.BASE_URL}/api/treinos/submissoes`,   { headers: authHeaders() }),
          axios.get(`${API.BASE_URL}/api/seguidores/meus-seguidos`, { headers: authHeaders() }),
        ]);

        const d1 = normaliza(r1.data); const d2 = normaliza(r2.data);
        setSubsDesafios(d1); setSubsTreinos(d2); setSubmissoes([...d1, ...d2]);

        const brutos = Array.isArray(seguindoRes.data) ? seguindoRes.data : [];
        const ids = brutos.map((x:any)=> (typeof x === "string" ? x : x?.seguidoUsuarioId ?? x?.id ?? x?.usuarioId ?? "")).filter(Boolean);
        setSeguindoIds(ids);
      } catch (err) { console.error(err); }
    })();
  }, []);

  const feed = useMemo(() => [...subsDesafios, ...subsTreinos].sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [subsDesafios, subsTreinos]);
  const seguindoSet = useMemo(() => new Set(seguindoIds.map(id => id.toLowerCase())), [seguindoIds]);
  const submissoesFiltradas = useMemo(() => {
    return feed.filter((s) => {
      const nivelLower = String(s.desafio?.nivel ?? "").toLowerCase();
      const nivelOk = !filtroNivel || nivelLower === filtroNivel;
      const categorias = Array.isArray(s.desafio?.categoria) ? s.desafio.categoria : [];
      const categoriaOk = !filtroCategoria || categorias.includes(filtroCategoria);
      const userIdLower = String(s.usuarioId ?? s.atleta?.usuario?.id ?? "").toLowerCase();
      const seguindoOk = !filtroSeguindo || (userIdLower && seguindoSet.has(userIdLower));
      return nivelOk && categoriaOk && seguindoOk;
    });
  }, [feed, filtroNivel, filtroCategoria, filtroSeguindo, seguindoSet]);

  const baseDeSub = (s: Submissao) => `${API.BASE_URL}${s.tipo === "TREINO" ? "/api/treinos/submissoes" : "/api/desafios/submissoes"}`;
  const toggleLike = async (sub: Submissao) => {
    try { const r = await axios.post(`${baseDeSub(sub)}/${sub.id}/like`, {}, { headers: authHeaders() }); const { liked, count } = r.data; applyUpdate(sub, { viewerLiked: liked, curtidasCount: count }); }
    catch { alert("Não foi possível curtir."); }
  };
  const enviarComentario = async (sub: Submissao) => {
    const txt = (comentarioTexto[sub.id] || "").trim(); if (!txt) return;
    try {
      const r = await axios.post(`${baseDeSub(sub)}/${sub.id}/comentarios`, { conteudo: txt }, { headers: authHeaders() });
      const { comentario, count } = r.data;
      applyUpdate(sub, { comentariosCount: count, comentarios: [ ...(sub.comentarios || []), comentario ] });
      setComentarioTexto((p) => ({ ...p, [sub.id]: "" }));
    } catch { alert("Não foi possível comentar."); }
  };
  const compartilhar = async (subId: string) => {
    const link = `${window.location.origin}/desafios?submissao=${subId}`;
    try { await navigator.clipboard.writeText(link); alert("Link da submissão copiado!"); } catch { alert("Não foi possível copiar o link."); }
  };

  const seteDiasAtras = useMemo(() => { const d=new Date(); d.setDate(d.getDate()-7); return d; }, []);
  type RankAgg = { atleta: Atleta; total: number; best?: Submissao };
  const rankingSemanal = useMemo<RankAgg[]>(() => {
    const recentes = feed.filter((s) => new Date(s.createdAt) >= seteDiasAtras);
    const porAtleta = new Map<string, RankAgg>();
    for (const s of recentes) {
      const atletaId = s.atleta?.id; if (!atletaId) continue;
      const atual = porAtleta.get(atletaId);
      if (!atual) porAtleta.set(atletaId, { atleta: s.atleta, total: s.curtidasCount || 0, best: s });
      else { atual.total += s.curtidasCount || 0; if (!atual.best || (s.curtidasCount || 0) > (atual.best.curtidasCount || 0)) atual.best = s; }
    }
    return Array.from(porAtleta.values()).sort((a,b)=>b.total-a.total).slice(0,20);
  }, [feed, seteDiasAtras]);

  return (
    <>
      <div className="flex gap-2 mb-3">
        <button onClick={()=>setAba("feed")} className={`px-3 py-1 rounded-full border ${aba==="feed"?"bg-green-700 text-white border-green-700":"bg-white text-green-700 border-green-700"}`}>Feed</button>
        <button onClick={()=>setAba("ranking")} className={`px-3 py-1 rounded-full border ${aba==="ranking"?"bg-green-700 text-white border-green-700":"bg-white text-green-700 border-green-700"}`}>Ranking semanal</button>
        <button onClick={()=>setAba("rankingGlobal")} className={`px-3 py-1 rounded-full border ${aba==="rankingGlobal"?"bg-green-700 text-white border-green-700":"bg-white text-green-700 border-green-700"}`}>Ranking global</button>
      </div>

      {aba === "feed" && (
        <>
          <button onClick={()=>setMostrarFiltros(!mostrarFiltros)} className="flex items-center gap-2 mb-2">
            {mostrarFiltros ? "Esconder filtros" : "Mostrar filtros"}
            {mostrarFiltros ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
          </button>

          {mostrarFiltros && (
            <div className="flex flex-wrap gap-4 mb-4 items-center">
              <button className={`px-4 py-2 rounded-full border ${filtroSeguindo ? "bg-green-500 text-white" : "bg-white text-gray-700"}`} onClick={()=>setFiltroSeguindo(v=>!v)}>
                {filtroSeguindo ? "Seguindo ✓" : "Seguindo"}
              </button>
              <select className="px-3 py-2 border rounded-full" value={filtroNivel ?? ""} onChange={(e)=>setFiltroNivel(e.target.value===""?null:e.target.value)}>
                <option value="">Todos os níveis</option><option value="base">Base</option><option value="avancado">Avançado</option><option value="performance">Performance</option>
              </select>
              <select className="px-3 py-2 border rounded-full" value={filtroCategoria ?? ""} onChange={(e)=>setFiltroCategoria(e.target.value===""?null:e.target.value)}>
                <option value="">Todas as categorias</option>{TODAS_CATEGORIAS.map((cat)=>(<option key={cat} value={cat}>{cat}</option>))}
              </select>
            </div>
          )}
        </>
      )}

      {aba === "ranking" ? (
        <div className="space-y-3">
          {rankingSemanal.length === 0 ? (
            <p className="text-gray-500">Sem submissões nesta semana.</p>
          ) : (
            rankingSemanal.map((r) => (
              <div key={r.atleta.id} className="bg-white border rounded-xl p-3 flex items-center gap-3">
                <img src={formatarUrlFoto(r.atleta.usuario.foto,"usuarios")} className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1">
                  <div className="font-semibold">{r.atleta.usuario.nome}</div>
                  <div className="text-sm text-gray-500">{r.total} curtidas (7d)</div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : aba === "rankingGlobal" ? (
        <RankingGlobalTab />
      ) : submissoesFiltradas.length === 0 ? (
        <p className="text-gray-500">Nenhuma submissão encontrada.</p>
      ) : (
        submissoesFiltradas.map((sub) => {
          const midia = sub.midias[0];
          const isVideo = String(midia?.tipo ?? "").toLowerCase() === "video";
          return (
            <div key={sub.id} className="bg-white shadow rounded-lg p-4 mb-6">
              <div className="flex items-center mb-2">
                <img src={ formatarUrlFoto(sub.atleta.usuario.foto, "usuarios") } alt="Perfil" className="w-10 h-10 rounded-full mr-3 object-cover"/>
                <div>
                  <p className="font-semibold">{sub.atleta.usuario.nome}</p>
                  <p className="text-sm text-gray-500">{new Date(sub.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              <h2 className="text-lg font-bold">{sub.desafio.titulo}</h2>
              <div className="flex flex-wrap gap-2 text-sm my-2">
                <span className="bg-gray-200 px-2 py-1 rounded">Nível: {sub.desafio.nivel}</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">{sub.desafio.pontuacao} pontos</span>
                {sub.desafio.categoria.map((cat, idx) => (<span key={idx} className="bg-green-100 text-green-800 px-2 py-1 rounded">{cat}</span>))}
              </div>
              {midia && (
                <div className="mt-3 mb-4">
                  <div className="w-full max-h-[60vh] overflow-hidden rounded-lg bg-black/5 flex items-center justify-center">
                    {isVideo ? (
                      <video src={fullUrl(midia.url)} controls playsInline className="w-full max-h-[60vh] object-contain" />
                    ) : (
                      <img src={fullUrl(midia.url)} alt="Submissão" loading="lazy" className="w-full max-h-[60vh] object-contain" />
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600 mt-2">
                <button onClick={()=>toggleLike(sub)} className="flex items-center gap-1 cursor-pointer" title={sub.viewerLiked ? "Remover gostei" : "Gostei"}>
                  <Heart className={`w-4 h-4 ${sub.viewerLiked ? "fill-red-600 text-red-600" : "text-gray-600"}`}/><span>{sub.curtidasCount}</span>
                </button>
                <button className="flex items-center gap-1 cursor-pointer" title="Ver comentários">
                  <MessageCircle className="w-4 h-4"/><span>{sub.comentariosCount}</span>
                </button>
                <button onClick={()=>compartilhar(sub.id)} className="flex items-center gap-1 cursor-pointer" title="Copiar link">
                  <Share className="w-4 h-4"/><span>Compartilhar</span>
                </button>
              </div>
              <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  value={comentarioTexto[sub.id] || ""}
                  onChange={(e)=>setComentarioTexto((p)=>({ ...p, [sub.id]: e.target.value }))}
                  placeholder="Adicionar comentário..."
                  className="w-full sm:flex-1 min-w-0 border rounded px-3 py-2 text-sm"
                />
                <button
                  onClick={()=>enviarComentario(sub)}
                  className="w-full sm:w-auto shrink-0 px-4 py-2 bg-green-700 text-white rounded"
                >
                  Enviar
                </button>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}

export default function DesafiosPage(): JSX.Element | null {
  const [, setLocation] = useLocation();
  const [pos, setPos] = useState(1); 
  const [dragging, setDragging] = useState(false);

  const HEADER_H_MOBILE = 64;
  const HEADER_H_DESKTOP = 80; 

  useEffect(() => {
    if (!FLAGS.DESAFIOS_ENABLED) setLocation("/feed");
  }, []);

  if (!FLAGS.DESAFIOS_ENABLED) return null;

  const onCommit = (target: "feed" | "desafios") => {
    const snap = target === "desafios" ? 1 : 0;
    setPos(snap);
    if (target === "feed") setTimeout(() => setLocation("/feed"), 120);
  };

  return (
    <div className="pt-6 pb-24 overflow-x-hidden">
      <div className="mx-auto w-full max-w-[430px] px-3 sm:max-w-3xl sm:px-0">
        <div
          className="relative mb-2 h-[var(--header-h)] sm:h-[var(--header-h-sm)] -mx-1 px-1 sm:mx-0"
          style={
            {
              "--header-h": `${HEADER_H_MOBILE}px`,
              "--header-h-sm": `${HEADER_H_DESKTOP}px`,
            } as React.CSSProperties
          }
        >
          <HeaderSlider
            pos={pos}
            setPos={setPos}
            onCommit={onCommit}
            onDraggingChange={setDragging}
          />
          <div className="relative z-10 h-full flex items-center justify-center pointer-events-none">
            <h1 className="text-2xl font-bold">Feed de Desafios</h1>
          </div>
        </div>
        <DesafiosInner />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed" className="hover:underline"><House /></Link>
        <Link href="/explorar" className="hover:underline"><Search /></Link>
        <Link href="/post" className="hover:underline"><CirclePlus /></Link>
        <Link href="/treinos" className="hover:underline"><Volleyball /></Link>
        <Link href="/perfil" className="hover:underline"><User /></Link>
      </nav>
    </div>
  );
}