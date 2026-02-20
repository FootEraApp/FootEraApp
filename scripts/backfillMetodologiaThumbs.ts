import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), "server", ".env") });

import { spawn } from "child_process";
import fs from "fs";
import ffmpegPath from "ffmpeg-static";
import { PrismaClient, MetodologiaConteudoTipo, Prisma } from "@prisma/client";
import ffmpegStatic from "ffmpeg-static";

function getFfmpegBin() {
  const p = ffmpegStatic as unknown as string | { default?: string } | null;
  if (typeof p === "string" && p) return p;
  if (p && typeof (p as any).default === "string") return (p as any).default;
  return "ffmpeg";
}

const prisma = new PrismaClient();

const PROJECT_ROOT = process.cwd();
const UPLOADS_ROOT = path.resolve(PROJECT_ROOT, "uploads");

// ✅ thumbs devem ir pra uploads/thumbs/metodologias
const OUT_DIR = path.join(UPLOADS_ROOT, "thumbs", "metodologias");
const PUBLIC_PREFIX = "/uploads/thumbs/metodologias";

const BATCH_SIZE = 50;
const MAX_ITEMS = Number(process.env.MAX_ITEMS ?? "0") || null;
const START_AT_SECONDS = Number(process.env.THUMB_SS ?? "1");

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function isHttpUrl(u: string) {
  return /^https?:\/\//i.test(u);
}

function normalizeVideoUrl(videoUrl: string) {
  return videoUrl
    .replace("/asseets/", "/assets/")
    .replace("C:\\Ussers\\", "C:\\Users\\");
}

// tenta achar um arquivo pelo nome dentro de uploads/metodologias/videos
function tryFindInUploadsByBasename(videoUrlOrPath: string) {
  const base = path.basename(videoUrlOrPath);
  const candidate = path.join(UPLOADS_ROOT, "metodologias", "videos", base);
  return fs.existsSync(candidate) ? candidate : null;
}

function resolveVideoInput(videoUrlRaw: string) {
  if (!videoUrlRaw) return videoUrlRaw;

  const videoUrl = normalizeVideoUrl(videoUrlRaw);

  if (isHttpUrl(videoUrl)) return videoUrl;

  // 1) /uploads/... -> ./uploads/...
  if (videoUrl.startsWith("/uploads/")) {
    const rel = videoUrl.replace("/uploads/", "");
    return path.join(UPLOADS_ROOT, rel);
  }

  // 2) /assets/... -> client/public/assets/...
  if (videoUrl.startsWith("/assets/")) {
    const rel = videoUrl.replace("/assets/", "");
    const p = path.join(PROJECT_ROOT, "client", "public", "assets", rel);

    // se não existir no assets, tenta procurar pelo nome em uploads/metodologias/videos
    if (!fs.existsSync(p)) {
      const found = tryFindInUploadsByBasename(videoUrl);
      if (found) return found;
    }
    return p;
  }

  // 3) caminho absoluto salvo errado com /server/uploads/... -> remapeia para ./uploads/...
  const marker = `${path.sep}server${path.sep}uploads${path.sep}`;
  if (videoUrl.includes(marker)) {
    const idx = videoUrl.indexOf(marker);
    const rel = videoUrl.slice(idx + marker.length);
    const p = path.join(UPLOADS_ROOT, rel);
    if (!fs.existsSync(p)) {
      const found = tryFindInUploadsByBasename(videoUrl);
      if (found) return found;
    }
    return p;
  }

  // 4) uploads/... -> ./uploads/...
  if (videoUrl.startsWith("uploads/")) {
    const rel = videoUrl.replace(/^uploads\//, "");
    return path.join(UPLOADS_ROOT, rel);
  }

  // fallback + tentativa por basename
  if (!fs.existsSync(videoUrl)) {
    const found = tryFindInUploadsByBasename(videoUrl);
    if (found) return found;
  }
  return videoUrl;
}

function runFfmpegGenerateThumb(input: string, outputJpg: string) {
  return new Promise<void>((resolve, reject) => {
    ensureDir(path.dirname(outputJpg));

    const args = [
      "-y",
      "-ss",
      String(START_AT_SECONDS),
      "-i",
      input,
      "-frames:v",
      "1",
      "-vf",
      "scale=640:-1",
      "-q:v",
      "2",
      outputJpg,
    ];

    const bin = getFfmpegBin();
    const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

    let err = "";
    proc.stderr.on("data", (d) => (err += d.toString()));

    proc.on("error", (e) => {
      reject(new Error(`Não consegui executar ffmpeg.\nErro: ${e.message}`));
    });

    proc.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg saiu com code=${code}. stderr:\n${err}`));
    });
  });
}

type MetodologiaItemThumbRow = Prisma.MetodologiaItemGetPayload<{
  select: { id: true; videoUrl: true };
}>;

async function main() {
  ensureDir(OUT_DIR);

  let processed = 0;
  let lastId: string | null = null;

  console.log("🔎 Buscando MetodologiaItem VIDEO sem thumbUrl...");

  while (true) {
    const items: MetodologiaItemThumbRow[] =
      await prisma.metodologiaItem.findMany({
        where: {
          tipo: MetodologiaConteudoTipo.VIDEO,
          thumbUrl: null,
          videoUrl: { not: null },
        },
        take: BATCH_SIZE,
        ...(lastId ? { skip: 1, cursor: { id: lastId } } : {}),
        orderBy: { id: "asc" },
        select: { id: true, videoUrl: true },
      });

    if (items.length === 0) break;

    for (const it of items) {
      lastId = it.id;
      if (!it.videoUrl) continue;

      const outFile = path.join(OUT_DIR, `${it.id}.jpg`);
      const publicUrl = `${PUBLIC_PREFIX}/${it.id}.jpg`;

      try {
        const input = resolveVideoInput(it.videoUrl);

        if (!isHttpUrl(input) && !fs.existsSync(input)) {
          console.warn(`⚠️  Video não encontrado no disco: ${input} (item=${it.id})`);
          continue;
        }

        await runFfmpegGenerateThumb(input, outFile);

        await prisma.metodologiaItem.update({
          where: { id: it.id },
          data: { thumbUrl: publicUrl },
        });

        processed++;
        console.log(`✅ [${processed}] thumb gerada p/ item=${it.id}`);

        if (MAX_ITEMS && processed >= MAX_ITEMS) {
          console.log(`🛑 MAX_ITEMS atingido (${MAX_ITEMS}). Parando.`);
          await prisma.$disconnect();
          return;
        }
      } catch (e: any) {
        console.error(`❌ Falhou item=${it.id}:`, e?.message ?? e);
      }
    }
  }

  console.log(`🎉 Finalizado. Total processado: ${processed}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});