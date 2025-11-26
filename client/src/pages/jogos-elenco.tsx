import React, { useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import axios from "axios";
import io, { Socket } from "socket.io-client";
import { Link } from "wouter";
import { Play, Square, Plus, Minus, FlagTriangleRight, FlagTriangleLeft, X, ArrowLeft, Trophy } from "lucide-react";

import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

type ElencoMin = { id: string; nome: string; maxJogadores?: number };
type Partida = {
  id: string;
  eventoId: string;
  fase: number;      
  ordem: number;      
  elencoAId?: string | null;
  elencoBId?: string | null;
  elencoA?: ElencoMin | null;
  elencoB?: ElencoMin | null;
  placarA: number;
  placarB: number;
  faltasA: number;
  faltasB: number;
  status: "PENDENTE" | "EM_ANDAMENTO" | "ENCERRADO";
  iniciadoEm?: string | null;
  finalizadoEm?: string | null;
  vencedorElencoId?: string | null;
  proximaPartidaId?: string | null;
  proximaPartidaSlot?: "A" | "B" | null;
};

type EventoElenco = {
  id: string;
  titulo: string;
  tipo: "MATA_MATA";
  status: "ABERTO" | "EM_ANDAMENTO" | "ENCERRADO";
  participantes: string[]; 
  rounds: Partida[][];    
};

const BASE = `${API.BASE_URL}/api/jogos-elenco`;
const ELENCOS_BASE = `${API.BASE_URL}/api/treinos/elencos`;

const safeGetToken = () => Storage.token || "";
const auth = () => ({ Authorization: `Bearer ${safeGetToken()}` });

function groupByRound(matches: Partida[]): Partida[][] {
  const by = new Map<number, Partida[]>();
  for (const m of matches) {
    if (!by.has(m.fase)) by.set(m.fase, []);
    by.get(m.fase)!.push(m);
  }
  const keys = Array.from(by.keys()).sort((a, b) => a - b);
  return keys.map((k) => by.get(k)!.sort((a, b) => a.ordem - b.ordem));
}

export default function JogosElencoPage() {
  const [elencos, setElencos] = useState<ElencoMin[]>([]);
  const [seed, setSeed] = useState<ElencoMin[]>([]);
  const [evento, setEvento] = useState<EventoElenco | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [partidaSel, setPartidaSel] = useState<Partida | null>(null);
  const [timerSec, setTimerSec] = useState<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const tipoUsuarioId = Storage.tipoUsuarioId;
    const token = safeGetToken();
    if (!tipoUsuarioId || !token) return;

    (async () => {
      try {
        const res = await axios.get(ELENCOS_BASE, { params: { tipoUsuarioId }, headers: auth() });
        const data = Array.isArray(res.data) ? res.data : [res.data].filter(Boolean);
        const base: ElencoMin[] = data.map((e: any) => ({ id: String(e.id), nome: String(e.nome ?? "Elenco"), maxJogadores: e.maxJogadores ?? 11 }));
        setElencos(base);
      } catch (e) {
        console.error("Falha ao carregar elencos:", e);
      }
    })();
  }, []);

  const onDragEnd = (r: DropResult) => {
    const { source, destination } = r;
    if (!destination) return;

    const fromList = source.droppableId;
    const toList = destination.droppableId;

    const copy = <T,>(arr: T[]) => arr.map((x) => x);

    if (fromList === "elencos" && toList === "seed") {
      const src = copy(elencos);
      const [item] = src.splice(source.index, 1);
      const tgt = copy(seed);
      tgt.splice(destination.index, 0, item);
      setElencos(src);
      setSeed(tgt);
      return;
    }

    if (fromList === "seed" && toList === "elencos") {
      const s = copy(seed);
      const [item] = s.splice(source.index, 1);
      const e = copy(elencos);
      e.splice(destination.index, 0, item);
      setSeed(s);
      setElencos(e);
      return;
    }

    if (fromList === "seed" && toList === "seed") {
      const s = copy(seed);
      const [item] = s.splice(source.index, 1);
      s.splice(destination.index, 0, item);
      setSeed(s);
      return;
    }

    if (fromList === "elencos" && toList === "elencos") {
      const e = copy(elencos);
      const [item] = e.splice(source.index, 1);
      e.splice(destination.index, 0, item);
      setElencos(e);
      return;
    }
  };

  const criarChaveamento = async () => {
    if (seed.length < 2) {
      alert("Selecione pelo menos 2 elencos para criar o chaveamento.");
      return;
    }
    try {
      const titulo = prompt("Título do evento (ex.: Copa Interna Sub-13)", "Copa Interna") || "Evento por Elencos";
      const body = {
        titulo,
        tipo: "MATA_MATA",
        participantes: seed.map((s) => s.id),
      };
      const res = await axios.post(`${BASE}/eventos`, body, { headers: auth() });
      const ev = res.data as { evento: any; partidas: Partida[]; elencos: ElencoMin[] };
      const rounds = groupByRound(ev.partidas);
      const hydrated: EventoElenco = { id: ev.evento.id, titulo: ev.evento.titulo, tipo: "MATA_MATA", status: ev.evento.status, participantes: ev.evento.participantes, rounds };
      setEvento(hydrated);

      const s = io(API.BASE_URL, { auth: { token: safeGetToken() }, transports: ["websocket"] });
      s.emit("jogos-elenco:join", { eventoId: ev.evento.id });
      s.on("jogos-elenco:update", (payload: any) => {
        if (payload?.eventoId !== ev.evento.id) return;
        if (payload.kind === "partida:update") {
          setEvento((prev) => {
            if (!prev) return prev;
            const newRounds = prev.rounds.map((round) =>
              round.map((m) => (m.id === payload.partida.id ? payload.partida : m))
            );
            return { ...prev, rounds: newRounds };
          });
          if (partidaSel && partidaSel.id === payload.partida.id) {
            setPartidaSel(payload.partida);
          }
        } else if (payload.kind === "evento:hydrate") {
          const rounds2 = groupByRound(payload.partidas);
          setEvento((prev) => (prev ? { ...prev, rounds: rounds2 } : prev));
        }
      });
      setSocket(s);
    } catch (err) {
      console.error(err);
      alert("Erro ao criar chaveamento.");
    }
  };

  const abrirPartida = (p: Partida) => {
    setPartidaSel(p);
    if (p.status === "EM_ANDAMENTO" && p.iniciadoEm) {
      const base = Date.now() - new Date(p.iniciadoEm).getTime();
      setTimerSec(Math.max(0, Math.floor(base / 1000)));
      iniciarLoopTimer();
    } else {
      pararLoopTimer();
      setTimerSec(0);
    }
  };
  const fecharPartida = () => {
    setPartidaSel(null);
    pararLoopTimer();
  };

  const tick = () => setTimerSec((s) => s + 1);
  const iniciarLoopTimer = () => {
    if (timerRef.current) return;
    timerRef.current = window.setInterval(tick, 1000);
  };
  const pararLoopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  async function acao(partidaId: string, op: string, extra?: any) {
    try {
      const res = await axios.patch(`${BASE}/partidas/${partidaId}`, { op, ...extra }, { headers: auth() });
      const upd = res.data as { partida: Partida };
      setEvento((prev) => {
        if (!prev) return prev;
        const newRounds = prev.rounds.map((rd) => rd.map((m) => (m.id === partidaId ? upd.partida : m)));
        return { ...prev, rounds: newRounds };
      });
      setPartidaSel(upd.partida);

      if (op === "start") iniciarLoopTimer();
      if (op === "finish") pararLoopTimer();
    } catch (e) {
      console.error(e);
      alert("Falha ao enviar ação da partida.");
    }
  }

  const nomeElenco = (id?: string | null) => {
    if (!id) return "—";
    const f = [...elencos, ...seed].find((x) => x.id === id);
    return f?.nome || `Elenco ${id.slice(0, 4)}…`;
  };

  const Coluna = ({ children, title }: { title: string; children: React.ReactNode }) => (
    <div className="flex-1 min-w-[260px]">
      <h3 className="text-sm font-bold text-green-900 mb-2">{title}</h3>
      <div className="bg-white rounded-xl p-2 shadow-sm border">{children}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-green-100">
      <div className="p-3">
        <Link
          href="/treinos/elenco"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-green-800 bg-white text-green-900 shadow-sm hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-700/30 mt-2 ml-2"
          title="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      <div className="px-3 md:px-6 pb-6">
        <h1 className="text-2xl font-extrabold text-green-900 flex items-center gap-2 mb-3">
          <Trophy className="w-6 h-6" /> Jogos por Elenco
        </h1>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Coluna title="Elencos disponíveis">
              <Droppable droppableId="elencos">
                {(p) => (
                  <div ref={p.innerRef} {...p.droppableProps} className="flex flex-col gap-2 min-h-[240px]">
                    {elencos.map((e, i) => (
                      <Draggable key={e.id} draggableId={`E-${e.id}`} index={i}>
                        {(pp, snap) => (
                          <div
                            ref={pp.innerRef}
                            {...pp.draggableProps}
                            {...pp.dragHandleProps}
                            className={`p-2 border rounded-lg bg-white hover:bg-green-50 flex justify-between items-center ${
                              snap.isDragging ? "shadow-2xl" : "shadow-sm"
                            }`}
                          >
                            <span className="font-medium">{e.nome}</span>
                            <span className="text-xs opacity-70">Max {e.maxJogadores ?? 11}</span>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {p.placeholder}
                  </div>
                )}
              </Droppable>
            </Coluna>

            <Coluna title="Seeds (arraste aqui na ordem)">
              <Droppable droppableId="seed">
                {(p) => (
                  <div ref={p.innerRef} {...p.droppableProps} className="flex flex-col gap-2 min-h-[240px]">
                    {seed.map((e, i) => (
                      <Draggable key={e.id} draggableId={`S-${e.id}`} index={i}>
                        {(pp, snap) => (
                          <div
                            ref={pp.innerRef}
                            {...pp.draggableProps}
                            {...pp.dragHandleProps}
                            className={`p-2 border rounded-lg bg-green-50 flex justify-between items-center ${
                              snap.isDragging ? "shadow-2xl" : "shadow-sm"
                            }`}
                          >
                            <span className="font-medium">
                              {i + 1}. {e.nome}
                            </span>
                            <span className="text-xs opacity-70">Max {e.maxJogadores ?? 11}</span>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {p.placeholder}
                  </div>
                )}
              </Droppable>

              <button
                onClick={criarChaveamento}
                className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2 flex items-center justify-center gap-2"
              >
                Criar chaveamento
              </button>
            </Coluna>

            <Coluna title={evento ? `Chaveamento • ${evento.titulo}` : "Chaveamento"}>
              {!evento ? (
                <p className="text-sm opacity-70">Monte os seeds e crie o chaveamento para visualizar as partidas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex gap-4">
                    {evento.rounds.map((round, idx) => (
                      <div key={idx} className="min-w-[240px]">
                        <div className="text-xs font-bold text-green-800 mb-1">
                          {idx === evento.rounds.length - 1 ? "Final" : `Fase ${idx + 1}`}
                        </div>
                        <div className="flex flex-col gap-3">
                          {round.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => abrirPartida(m)}
                              className="w-full text-left bg-white border rounded-lg p-2 shadow-sm hover:shadow-md"
                              title="Abrir controle da partida"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 font-semibold">
                                  {m.status === "PENDENTE" ? "Pendente" : m.status === "EM_ANDAMENTO" ? "Ao vivo" : "Encerrado"}
                                </span>
                                <span className="text-[11px] opacity-60">#{m.ordem}</span>
                              </div>
                              <div className="mt-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold">{nomeElenco(m.elencoAId)}</span>
                                  <span className="text-lg font-extrabold">{m.placarA}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold">{nomeElenco(m.elencoBId)}</span>
                                  <span className="text-lg font-extrabold">{m.placarB}</span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Coluna>
          </div>
        </DragDropContext>
      </div>

      {partidaSel && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-3">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-green-900">Controle da Partida</h2>
              <button className="h-9 w-9 rounded-full grid place-items-center hover:bg-black/5" onClick={fecharPartida}>
                <X />
              </button>
            </div>

            <div className="mt-2 text-xs opacity-70">Status: {partidaSel.status}</div>
            <div className="mt-2 text-center text-3xl font-mono">{String(Math.floor(timerSec / 60)).padStart(2, "0")}:{String(timerSec % 60).padStart(2, "0")}</div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="border rounded-xl p-3">
                <div className="font-bold">{nomeElenco(partidaSel.elencoAId)}</div>
                <div className="flex items-center gap-2 mt-2">
                  <button className="btnIcon" onClick={() => acao(partidaSel.id, "score", { team: "A", delta: -1 })}>
                    <Minus className="w-5 h-5" />
                  </button>
                  <div className="text-3xl font-extrabold">{partidaSel.placarA}</div>
                  <button className="btnIcon" onClick={() => acao(partidaSel.id, "score", { team: "A", delta: +1 })}>
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button className="btnIcon" onClick={() => acao(partidaSel.id, "foul", { team: "A", delta: -1 })}>
                    <FlagTriangleLeft className="w-5 h-5" />
                  </button>
                  <div className="text-sm font-semibold">Faltas: {partidaSel.faltasA}</div>
                  <button className="btnIcon" onClick={() => acao(partidaSel.id, "foul", { team: "A", delta: +1 })}>
                    <FlagTriangleRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="border rounded-xl p-3">
                <div className="font-bold">{nomeElenco(partidaSel.elencoBId)}</div>
                <div className="flex items-center gap-2 mt-2">
                  <button className="btnIcon" onClick={() => acao(partidaSel.id, "score", { team: "B", delta: -1 })}>
                    <Minus className="w-5 h-5" />
                  </button>
                  <div className="text-3xl font-extrabold">{partidaSel.placarB}</div>
                  <button className="btnIcon" onClick={() => acao(partidaSel.id, "score", { team: "B", delta: +1 })}>
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button className="btnIcon" onClick={() => acao(partidaSel.id, "foul", { team: "B", delta: -1 })}>
                    <FlagTriangleLeft className="w-5 h-5" />
                  </button>
                  <div className="text-sm font-semibold">Faltas: {partidaSel.faltasB}</div>
                  <button className="btnIcon" onClick={() => acao(partidaSel.id, "foul", { team: "B", delta: +1 })}>
                    <FlagTriangleRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                <button
                  className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold flex items-center gap-2 disabled:bg-gray-300"
                  disabled={partidaSel.status !== "PENDENTE"}
                  onClick={() => acao(partidaSel.id, "start")}
                >
                  <Play className="w-4 h-4" /> Iniciar
                </button>
                <button
                  className="px-3 py-2 rounded-lg bg-red-600 text-white font-semibold flex items-center gap-2 disabled:bg-gray-300"
                  disabled={partidaSel.status !== "EM_ANDAMENTO"}
                  onClick={() => acao(partidaSel.id, "finish")}
                >
                  <Square className="w-4 h-4" /> Finalizar
                </button>
              </div>

              {partidaSel.status === "ENCERRADO" && (
                <button
                  className="px-3 py-2 rounded-lg bg-blue-700 text-white font-semibold"
                  onClick={() => acao(partidaSel.id, "advance")}
                >
                  Avançar vencedor
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .btnIcon { border:1px solid #dcdcdc; width:36px; height:36px; border-radius:10px; display:grid; place-items:center; background:#fff; }
        .btnIcon:hover { background:#f5f5f5; }
      `}</style>
    </div>
  );
}
