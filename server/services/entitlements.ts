// server/services/entitlements.ts
import type { TipoUsuario } from "@prisma/client";

export type Plano = "FREE" | "PRO" | "ORG";
export type Papel =
  | "atleta"
  | "professor"
  | "olheiro"
  | "escolinha"
  | "admin";

export type UserContext = {
  id: string;
  tipo: TipoUsuario | Papel;      // aceito enum do Prisma ou minúsculo
  plano: Plano;
  isAdmin?: boolean;
};

type Capability =
  | "treinos.semana"
  | "desafios.mes"
  | "biblioteca.salvos"
  | "planos.ativos"
  | "templates"
  | "templates:criar"
  | "agendamento.pessoal"
  | "agendamento.lote"
  | "perfisPorDia"
  | "analytics.meses"
  | "org.atletas"
  | "org.assentosCoach"
  | "org.turmas"
  | "org.templates"
  | "org.agendamentosMes";

type EntTable = {
  [papel in Papel]?: {
    [plano in Plano]?: Partial<Record<Capability, number | boolean>>;
  };
};

const ENTITLEMENTS: EntTable = {
  atleta: {
    FREE:  { "treinos.semana": 3, "desafios.mes": 2, "biblioteca.salvos": 5, "agendamento.pessoal": false, "analytics.meses": 1 },
    PRO:   { "treinos.semana": Infinity, "desafios.mes": Infinity, "biblioteca.salvos": Infinity, "agendamento.pessoal": true, "analytics.meses": 12 },
  },
  professor: {
    FREE:  { "planos.ativos": 5, "templates": 10, "templates:criar": false, "agendamento.pessoal": false, "agendamento.lote": false },
    PRO:   { "planos.ativos": 1000, "templates": 500, "templates:criar": true,  "agendamento.pessoal": true,  "agendamento.lote": true },
  },
  olheiro: {
    FREE:  { "perfisPorDia": 20, "templates": 0, "templates:criar": false },
    PRO:   { "perfisPorDia": 200, "templates": 0, "templates:criar": false },
  },
  escolinha: {
    ORG:   { "org.atletas": 600, "org.assentosCoach": 30, "org.turmas": 30, "org.templates": 5000, "org.agendamentosMes": 20000, "analytics.meses": 12, "agendamento.lote": true, "templates:criar": true },
  },
  admin: {
    FREE:  { "agendamento.lote": true, "templates:criar": true },
    PRO:   { "agendamento.lote": true, "templates:criar": true },
    ORG:   { "agendamento.lote": true, "templates:criar": true },
  }
} as const;

function normPapel(t: TipoUsuario | string): Papel {
  const s = String(t).toLowerCase();
  if (s === "professor") return "professor";
  if (s === "escolinha") return "escolinha";
  if (s === "clube")     return "escolinha"; // clube se comporta como org nas regras (ajuste se quiser separar)
  if (s === "olheiro")   return "olheiro";
  if (s === "admin")     return "admin";
  return "atleta";
}

export function can(user: UserContext, cap: Capability, want = 1): boolean {
  if (user?.isAdmin) return true;
  const papel = normPapel(user?.tipo || "atleta");
  const caps = ENTITLEMENTS[papel]?.[user?.plano || "FREE"];
  if (!caps) return false;
  const entry = caps[cap];
  if (entry === true) return true;
  if (entry === false || entry == null) return false;
  const lim = Number(entry);
  return lim === Infinity || want <= lim;
}

export function canDetailed(user: UserContext, cap: Capability, want = 1) {
  const ok = can(user, cap, want);
  if (ok) return { ok: true, http: 200 as const, reason: "ok" };

  // heurística simples p/ http
  const needPlan = (user.plano === "FREE") && ["agendamento.pessoal","agendamento.lote","templates:criar","templates"].includes(cap);
  return {
    ok: false,
    http: (needPlan ? 402 : 403) as 402 | 403,
    reason: needPlan ? "upgrade_required" : "forbidden",
  };
}
