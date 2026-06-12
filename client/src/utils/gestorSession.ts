export type GestorContext = {
  enabled: boolean; 
  org: {
    id: string;        
    tipo: "CLUBE" | "ESCOLINHA";
    ownerId: string;   
    nome?: string | null;
    logo?: string | null;
    cidade?: string | null;
    estado?: string | null;
    papel?: string | null;
    permissoes?: any | null;
    ativo?: boolean;
  } | null;
};

const KEY = "footera_gestor_ctx_v1";

export function loadGestorContext(): GestorContext {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { enabled: false, org: null };
    const parsed = JSON.parse(raw) as GestorContext;
    if (!parsed || typeof parsed !== "object") return { enabled: false, org: null };
    return {
      enabled: !!parsed.enabled,
      org: parsed.org ?? null,
    };
  } catch {
    return { enabled: false, org: null };
  }
}

export function saveGestorContext(next: GestorContext) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function clearGestorContext() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

export function setGestorOrg(org: GestorContext["org"]) {
  const cur = loadGestorContext();
  saveGestorContext({ ...cur, enabled: !!org, org: org ?? null });
}

export function setGestorEnabled(enabled: boolean) {
  const cur = loadGestorContext();
  saveGestorContext({ ...cur, enabled: !!enabled && !!cur.org });
}