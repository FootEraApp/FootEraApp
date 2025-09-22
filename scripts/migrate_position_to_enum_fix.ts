import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function norm(s: string) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[-_]+/g, " ")
    .toLowerCase()
    .trim();
}

function mapToEnum(raw: string): string | null {
  const s = norm(raw);

  if (/(^|[^a-z])gk([^a-z]|$)/.test(s) || s.includes("goleir") || s.startsWith("gol")) return "GOL";

  if (s === "ld" || s.includes("lateral d") || s.includes("lat d") || s.includes("ala direit")) return "LD";
  if (s === "le" || s.includes("lateral e") || s.includes("lat e") || s.includes("ala esquerd")) return "LE";

  if (s === "zd" || s.includes("zagueiro d") || s.includes("zagueiro dir") || s.includes("zagueiro pela direit")) return "ZD";
  if (s === "ze" || s.includes("zagueiro e") || s.includes("zagueiro esq") || s.includes("zagueiro pela esquerd")) return "ZE";
  if (s.startsWith("zagueiro")) return "ZD";

  if (s.includes("volante 2") || s.includes("segundo volante") || /\bvol2\b/.test(s)) return "VOL2";
  if (s.includes("volante 1") || s.includes("primeiro volante") || /\bvol1\b/.test(s)) return "VOL1";
  if (s.includes("volante")) return "VOL1"; 

  if (
    s === "mei" ||
    s.includes("meia") ||
    s.includes("meio campo") ||
    s === "mc" ||
    s.includes("armador") ||
    s.includes("meio campista") ||
    s.includes("meio campis")
  ) return "MEI";

  if (s === "pd" || s.includes("ponta direit") || s.includes("extremo direit") || s.includes("ala ofensiva direit")) return "PD";
  if (s === "pe" || s.includes("ponta esquerd") || s.includes("extremo esquerd") || s.includes("ala ofensiva esquerd")) return "PE";

  if (s === "ca" || s.includes("centroavante") || /\b9\b/.test(s) || s.includes("atacante central")) return "CA";
  if (s.includes("atacante")) return "CA";

  return null;
}

async function run() {
  const rows: Array<{ id: string; pos: string | null }> = await prisma.$queryRaw`
    SELECT id, CAST(posicao AS TEXT) AS pos FROM "Atleta"
  `;

  let ok = 0, skipped = 0;
  const unknown: Array<{ id: string; pos: string | null }> = [];

  for (const r of rows) {
    if (!r.pos) { skipped++; continue; }
    const target = mapToEnum(r.pos);
    if (!target) { unknown.push({ id: r.id, pos: r.pos }); skipped++; continue; }

    try {
      await prisma.$executeRaw`UPDATE "Atleta" SET "posicao" = ${target} WHERE id = ${r.id}`;
    } catch {
      await prisma.$executeRawUnsafe(
        `UPDATE "Atleta" SET "posicao" = CAST($1 AS "PosicaoCampo") WHERE id = $2`,
        target,
        r.id
      );
    }
    ok++;
  }

  console.log(`✔️ Normalizados: ${ok} | Ignorados: ${skipped}`);
  if (unknown.length) {
    console.log("⚠️ Valores não mapeados (revise/amplie o mapeamento):");
    console.table(unknown.slice(0, 50));
  }
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
