import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { getIO } from "../socket.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";


type UserCtx = {
  id: string;
  tipo: "Atleta" | "Professor" | "Clube" | "Escolinha" | "Admin" | "Olheiro";
  tipoUsuarioId?: string | null;
  isAdmin?: boolean;
};

function ensureUser(req: Request): UserCtx {
  const u: any = (req as AuthenticatedRequest).user || {};
  return {
    id: String(u.id || ""),
    tipo: u.tipo || "Professor",
    tipoUsuarioId: u.tipoUsuarioId || null,
    isAdmin: !!u.isAdmin,
  };
}

function gerarChaveamento(participantes: string[]) {
  const nextPow2 = (n: number) => 1 << (32 - Math.clz32(Math.max(1, n - 1)));
  const totalSlots = nextPow2(participantes.length);
  const byes = totalSlots - participantes.length;
  const seeds = [...participantes, ...Array(byes).fill(null)];

  const rounds: { fase: number; pares: Array<[string | null, string | null]> }[] = [];
  const r1: Array<[string | null, string | null]> = [];
  for (let i = 0; i < totalSlots; i += 2) {
    r1.push([seeds[i], seeds[i + 1]]);
  }
  rounds.push({ fase: 1, pares: r1 });

  let size = r1.length;
  let fase = 2;
  while (size > 1) {
    const arr: Array<[null, null]> = Array.from({ length: Math.ceil(size / 2) }, () => [null, null]);
    rounds.push({ fase, pares: arr as any });
    size = Math.ceil(size / 2);
    fase++;
  }

  return rounds;
}

function podeEditarEvento(user: UserCtx, ev: any) {
  if (user.isAdmin) return true;
  if (ev.ownerTipo === "Professor" && user.tipo === "Professor" && user.tipoUsuarioId === ev.ownerId) return true;
  if (ev.ownerTipo === "Escolinha" && (user.tipo === "Escolinha" || user.tipo === "Professor")) {
    return true;
  }
  if (ev.ownerTipo === "Clube" && (user.tipo === "Clube" || user.tipo === "Professor")) {
    return true;
  }
  return false;
}

export const criarEvento = async (req: Request, res: Response) => {
  try {
    const user = ensureUser(req);
    const { titulo, tipo, participantes } = req.body as { titulo: string; tipo: "MATA_MATA"; participantes: string[] };

    if (!Array.isArray(participantes) || participantes.length < 2) {
      return res.status(400).json({ message: "Informe pelo menos 2 elencos." });
    }

    const rounds = gerarChaveamento(participantes);

    const evento = await prisma.eventoElenco.create({
      data: {
        titulo,
        tipo: "MATA_MATA",
        status: "EM_ANDAMENTO", 
        participantes,
        ownerTipo: user.tipo,
        ownerId: user.tipoUsuarioId || user.id,
      },
    });

    const partidasCriadas: any[] = [];
    for (const r of rounds) {
      let ordem = 1;
      for (const [a, b] of r.pares) {
        const p = await prisma.partidaElenco.create({
          data: {
            eventoId: evento.id,
            fase: r.fase,
            ordem: ordem++,
            elencoAId: a,
            elencoBId: b,
            placarA: 0,
            placarB: 0,
            faltasA: 0,
            faltasB: 0,
            status: "PENDENTE",
          },
        });
        partidasCriadas.push(p);
      }
    }

    const byFase = (f: number) => partidasCriadas.filter((x) => x.fase === f).sort((a, b) => a.ordem - b.ordem);
    let f = 1;
    while (byFase(f).length > 1) {
      const atual = byFase(f);
      const prox = byFase(f + 1);
      for (let i = 0; i < prox.length; i++) {
        const pA = atual[i * 2];
        const pB = atual[i * 2 + 1];
        if (pA) await prisma.partidaElenco.update({ where: { id: pA.id }, data: { proximaPartidaId: prox[i].id, proximaPartidaSlot: "A" } });
        if (pB) await prisma.partidaElenco.update({ where: { id: pB.id }, data: { proximaPartidaId: prox[i].id, proximaPartidaSlot: "B" } });
      }
      f++;
    }

    const partidas = await prisma.partidaElenco.findMany({ where: { eventoId: evento.id }, orderBy: [{ fase: "asc" }, { ordem: "asc" }] });
    const elencos = await prisma.elenco.findMany({ where: { id: { in: participantes } }, select: { id: true, nome: true, maxJogadores: true } });

    res.json({ evento, partidas, elencos });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao criar evento", e });
  }
};

export const obterEvento = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const evento = await prisma.eventoElenco.findUnique({ where: { id } });
    if (!evento) return res.status(404).json({ message: "Evento não encontrado" });
    const partidas = await prisma.partidaElenco.findMany({ where: { eventoId: id }, orderBy: [{ fase: "asc" }, { ordem: "asc" }] });
    res.json({ evento, partidas });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao obter evento" });
  }
};

export const reSeedEvento = async (req: Request, res: Response) => {
  try {
    const user = ensureUser(req);
    const { id } = req.params;
    const { participantes } = req.body as { participantes: string[] };

    const evento = await prisma.eventoElenco.findUnique({ where: { id } });
    if (!evento) return res.status(404).json({ message: "Evento não encontrado" });
    if (!podeEditarEvento(user, evento)) return res.status(403).json({ message: "Sem permissão" });

    const started = await prisma.partidaElenco.count({ where: { eventoId: id, status: { in: ["EM_ANDAMENTO", "ENCERRADO"] } } });
    if (started > 0) return res.status(400).json({ message: "Não é possível reseedar após partidas iniciadas." });

    await prisma.partidaElenco.deleteMany({ where: { eventoId: id } });

    const rounds = gerarChaveamento(participantes);
    await prisma.eventoElenco.update({ where: { id }, data: { participantes } });

    const partidasCriadas: any[] = [];
    for (const r of rounds) {
      let ordem = 1;
      for (const [a, b] of r.pares) {
        const p = await prisma.partidaElenco.create({
          data: {
            eventoId: id,
            fase: r.fase,
            ordem: ordem++,
            elencoAId: a,
            elencoBId: b,
            placarA: 0,
            placarB: 0,
            faltasA: 0,
            faltasB: 0,
            status: "PENDENTE",
          },
        });
        partidasCriadas.push(p);
      }
    }

    const byFase = (f: number) => partidasCriadas.filter((x) => x.fase === f).sort((a, b) => a.ordem - b.ordem);
    let f = 1;
    while (byFase(f).length > 1) {
      const atual = byFase(f);
      const prox = byFase(f + 1);
      for (let i = 0; i < prox.length; i++) {
        const pA = atual[i * 2];
        const pB = atual[i * 2 + 1];
        if (pA) await prisma.partidaElenco.update({ where: { id: pA.id }, data: { proximaPartidaId: prox[i].id, proximaPartidaSlot: "A" } });
        if (pB) await prisma.partidaElenco.update({ where: { id: pB.id }, data: { proximaPartidaId: prox[i].id, proximaPartidaSlot: "B" } });
      }
      f++;
    }

    const partidas = await prisma.partidaElenco.findMany({ where: { eventoId: id }, orderBy: [{ fase: "asc" }, { ordem: "asc" }] });
    getIO().to(`evento:${id}`).emit("jogos-elenco:update", { kind: "evento:hydrate", eventoId: id, partidas });
    res.json({ ok: true, partidas });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao reseedar evento" });
  }
};

export const atualizarPartida = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { op, team, delta } = req.body as { op: string; team?: "A" | "B"; delta?: number };

    let partida = await prisma.partidaElenco.findUnique({ where: { id } });
    if (!partida) return res.status(404).json({ message: "Partida não encontrada" });

    if (op === "start") {
      if (partida.status !== "PENDENTE") return res.status(400).json({ message: "Partida já iniciada/encerrada" });
      partida = await prisma.partidaElenco.update({ where: { id }, data: { status: "EM_ANDAMENTO", iniciadoEm: new Date() } });
    } else if (op === "finish") {
      if (partida.status !== "EM_ANDAMENTO") return res.status(400).json({ message: "Partida não está em andamento" });
      partida = await prisma.partidaElenco.update({ where: { id }, data: { status: "ENCERRADO", finalizadoEm: new Date() } });
    } else if (op === "score") {
      const d = Math.max(-99, Math.min(99, Number(delta || 0)));
      if (!team) return res.status(400).json({ message: "Informe o time (A/B)" });
      const field = team === "A" ? "placarA" : "placarB";
      const novo = Math.max(0, (partida as any)[field] + d);
      partida = await prisma.partidaElenco.update({ where: { id }, data: { [field]: novo } as any });
    } else if (op === "foul") {
      const d = Math.max(-99, Math.min(99, Number(delta || 0)));
      if (!team) return res.status(400).json({ message: "Informe o time (A/B)" });
      const field = team === "A" ? "faltasA" : "faltasB";
      const novo = Math.max(0, (partida as any)[field] + d);
      partida = await prisma.partidaElenco.update({ where: { id }, data: { [field]: novo } as any });
    } else if (op === "advance") {
      if (partida.status !== "ENCERRADO") return res.status(400).json({ message: "Finalize a partida primeiro." });

      const vencedorElencoId =
        (partida.placarA > partida.placarB && partida.elencoAId) ||
        (partida.placarB > partida.placarA && partida.elencoBId) ||
        partida.elencoAId || partida.elencoBId || null;

      partida = await prisma.partidaElenco.update({ where: { id }, data: { vencedorElencoId } });

      if (partida.proximaPartidaId && vencedorElencoId) {
        const slot = partida.proximaPartidaSlot === "B" ? { elencoBId: vencedorElencoId } : { elencoAId: vencedorElencoId };
        await prisma.partidaElenco.update({ where: { id: partida.proximaPartidaId }, data: slot });
      }
    } else {
      return res.status(400).json({ message: "Operação inválida" });
    }

    getIO().to(`evento:${partida.eventoId}`).emit("jogos-elenco:update", { kind: "partida:update", eventoId: partida.eventoId, partida });
    res.json({ partida });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao atualizar partida" });
  }
};