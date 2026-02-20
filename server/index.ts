import express from "express";
import cors from "cors";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cron from "node-cron";
import http from "http";
import qrcode from "qrcode-terminal";
import * as fs from "fs";
import helmet from "helmet";

import { requireAdmin } from "./middlewares/guards.js";
import { processarRenovacoesDiarias } from "./services/billingscheduler.js";
import { runColdStorageJob } from "./jobs/coldStorageJob.js";
import { setupSocket } from "./socket.js";
import { UPLOADS_ROOT, ensureUploadDirs } from "./utils/uploads.js";
import { gerarSnapshotRanking } from "./jobs/rankingSnapshot.js";
import { startExpiredTrainingsJob } from "./jobs/expiredTrainings.js";
import { authenticateToken } from "./middlewares/auth.js";
import { limparTreinosSalvosExpirados } from "./controllers/treinosSalvosController.js";
import { PrismaClient } from "@prisma/client";
import { purgeDeletedAccounts } from "./jobs/purgeDeletedAccounts.js";

import adminUsuariosRoutes from "./routes/adminUsuarios.js";
import adminRoutes from "./routes/admin.js";
import adminModeracaoRoutes from "./routes/adminModeracao.js";
import atletaRoutes from "./routes/atleta.js";
import authRoutes from "./routes/auth.js";
import amigosRoutes from "./routes/amigos.js";
import cadastroRoutes from "./routes/cadastro.js";
import clubeRoutes from "./routes/clube.js";
import configuracoesRoutes from "./routes/configuracoes.js";
import conquistasRoutes from "./routes/conquistas.js";
import categoriasRoutes from "./routes/categorias.js";
import desafiosRoutes from "./routes/desafios.js";
import desafiosEmGrupoRoutes from "./routes/desafiosEmGrupo.js";
import escolinhaRoutes from "./routes/escolinha.js";
import eventosRoutes from "./routes/eventos.js";
import exerciciosRoutes from "./routes/exercicios.js";
import explorarRoutes from "./routes/explorar.js";
import favoritosRoutes from "./routes/favorito.js";
import feedRoutes from "./routes/feed.js";
import gruposRoutes from "./routes/grupos.js";
import homeRoutes from "./routes/home.js";
import logErroRoutes from "./routes/logErro.js";
import mensagemRoutes from "./routes/mensagem.js";
import midiaRoutes from "./routes/midia.js";
import notificacoesRoutes from "./routes/notificacoes.js";
import perfilRoutes from "./routes/perfil.js";
import pontuacaoRoutes from "./routes/pontuacao.js";
import postRoutes from "./routes/post.js";
import professorRoutes from "./routes/professores.js";
import rankingRoutes from "./routes/ranking.js";
import seguirRoutes from "./routes/seguir.js";
import rotaSeguidorMutuo from "./routes/seguidorMutuo.js";
import solicitacaoTreinoRoutes from "./routes/solicitacaoTreino.js";
import submissoesRoutes from "./routes/submissoes.js";
import termoRoutes from "./routes/termo.js";
import treinoRoutes from "./routes/treinos.js";
import treinoUnicoRoutes from "./routes/treinoUnico.js";
import treinoLivreRoutes from "./routes/treinoLivre.js";
import treinoProgramadoRoutes from "./routes/treinoProgramado.js";
import uploadRoutes from "./routes/upload.js";
import usuarioRoutes from "./routes/usuario.js";
import vinculoRoutes from "./routes/vinculo.js";
import observadosRoutes from "./routes/observados.js";
import gerenciarAtletasRoutes from "./routes/gerenciarAtletas.js";
import indicacoesRouter from "./routes/indicacoes.js";
import olheirosRouter from "./routes/olheiros.js";
import desempenhoRoutes from "./routes/desempenho.js";
import relacoesRoutes from "./routes/relacoes.js";
import elencosRoutes from "./routes/elencos.js";
import formadoresRoutes from "./routes/formadores.js";
import scoutNotesRoutes from "./routes/scoutNotes.js";
import checklistRoutes from "./routes/checklists.js";
import catalogoRoutes from "./routes/catalogo.js";
import legalRoutes from "./routes/legal.js";
import organizacoesRoutes from "./routes/organizacoes.js";
import turmasRoutes from "./routes/turmas.js";
import treinosElencosRoutes from "./routes/treinosElencos.js";
import adminAdminsRoutes from "./routes/adminAdmins.js";
import analisesRoutes from "./routes/analises.js";
import adminAssinantesRoutes from "./routes/adminAssinantes.js";
import assinaturasRoutes from "./routes/assinaturas.js";
import treinosSalvosRoutes from "./routes/treinosSalvos.js";
import analyticsRoutes from "./routes/analytics.js"
import billingRoutes from "./routes/billing.js"
import jogosElencoRoutes from "./routes/jogosElencoRoutes.js";
import scheduleRoutes from "./routes/schedule.routes.js";
import templatesRoutes from "./routes/templates.js";
import usageRouter from './routes/usage.js';
import agendamentosRouter from './routes/agendamentos.js';
import listasOlheiroRoutes from './routes/listaOlheiro.js';
import auditoriaRouter from "./routes/auditoria.js";
import adsRoutes from "./routes/ads.js";
import consentimentoRoutes from "./routes/consentimento.js";
import metricsRoutes from "./routes/metrics.js";
import treinarJuntosRoute from "./routes/treinarJuntos.js";
import sessoesTurmaRoutes from "./routes/sessoesTurma.js";
import feedbackRoutes from "./routes/feedback.js";
import statusRoutes from "./routes/status.js";
import comentariosRoutes from "./routes/comentarios.js";
import estatisticasRoutes from "./routes/estatisticas.js";
import configuracoesPerfilRoutes from "./routes/configuracoesPerfil.js";
import presencaRoutes from "./routes/presenca.js";
import metodologiasRoutes from "./routes/metodologiasRoutes.js";
import metodologiasUploadRoutes from "./routes/uploadMetodologias.js";
import adminMetodologiasRoutes from "./routes/adminMetodologiasRoutes.js";

import { mercadoPagoWebhook } from "./controllers/billingController.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

const envCandidates = [
  path.resolve(__dirname, ".env"),      
  path.resolve(__dirname, "../.env"),    
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../.env"),
];

for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const io = setupSocket(server);

ensureUploadDirs();
startExpiredTrainingsJob();

const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = Number(process.env.PORT) || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const LOCAL_IP = process.env.LOCAL_IP || "192.168.18.8";
const FRONT_PORT = Number(process.env.FRONT_PORT) || 5173;

app.use(helmet({ crossOriginResourcePolicy: false }));

const norm = (s?: string) => (s ? s.replace(/\/+$/, "") : s);
const fromEnv = norm(process.env.FRONTEND_URL);
const fromEnvWww = fromEnv ? fromEnv.replace("://", "://www.") : undefined;
const ALLOWED = new Set(
  [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://footera.app.br",
    "https://www.footera.app.br",
    fromEnv,
    fromEnvWww,
  ].filter(Boolean) as string[]
);

const allowedRegex = /^https:\/\/(www\.)?footera\.app\.br$/;

const corsConfig: cors.CorsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);

    const o = origin.replace(/\/+$/, "");

    if (allowedRegex.test(o)) return cb(null, true);
    if (ALLOWED.has(o)) return cb(null, true);

    console.log("[CORS BLOCKED]", { origin, normalized: o, allowed: Array.from(ALLOWED) });
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "x-tipo-usuario",
    "x-tipo-usuario-id",
    "x-user-id",
  ],

  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 204,
  preflightContinue: false,
};

app.use(cors(corsConfig));
app.options("*", cors(corsConfig));

app.use((err: any, _req: any, res: any, next: any) => {
  if (err && (err.message === "Not allowed by CORS" || err.message?.includes("CORS"))) {
    console.error("[CORS ERROR MIDDLEWARE]", err.message);
    return res.status(403).json({ ok: false, error: "CORS_BLOCKED" });
  }
  return next(err);
});

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

app.use(
  express.static(path.join(__dirname, "..", "public"))
);

if (NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    next();
  });
}

app.use("/uploads", express.static(path.resolve(process.cwd(), "server", "uploads")));
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));
app.use("/uploads", express.static(UPLOADS_ROOT, { maxAge: "1d" }));
{
  const candidates = [
    path.join(process.cwd(), "client/public/assets"),
    path.join(process.cwd(), "public/assets"),
    path.join(__dirname, "public/assets"),
  ];
  const found = candidates.find((dir) => fs.existsSync(dir));
  if (found) app.use("/assets", express.static(found));
}

app.use(
  "/exercicios",
  express.static(path.join(process.cwd(), "public", "exercicios"), {
    setHeaders: (res) => res.setHeader("Accept-Ranges", "bytes"),
  })
);

app.get("/api/health", (_req, res) => res.status(200).json({ ok: true }));
app.get("/", (_req, res) => res.send("FootEra API está ativa!"));
app.get("/resetar-senha", (req, res) => {
  const qs = req.originalUrl.split("?")[1] || "";
  const dest = `${FRONTEND_URL.replace(/\/+$/, "")}/resetar-senha${qs ? "?" + qs : ""}`;
  res.redirect(302, dest);
});

app.use("/api/auth/cadastro", cadastroRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cadastro", cadastroRoutes);
app.use("/api/termos", termoRoutes);
app.use("/api/ranking", rankingRoutes);    
app.use("/api/explorar", explorarRoutes);  
app.use("/api/legal", legalRoutes);
app.use("/api/catalogo", catalogoRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminAdminsRoutes);
app.use("/api/admin", metricsRoutes);
app.use("/api/admin/usuarios", adminUsuariosRoutes);
app.use("/api/admin/assinantes", adminAssinantesRoutes);
app.use("/api/admin/moderacao", authenticateToken, requireAdmin, adminModeracaoRoutes);
app.use("/api/admin/metodologias", adminMetodologiasRoutes);
app.use("/api/analises", analisesRoutes);
app.use("/api/assinaturas", assinaturasRoutes);
app.use("/api/comentarios", comentariosRoutes);
app.use("/api/olheiros", authenticateToken, olheirosRouter);
app.use("/api/atletas", authenticateToken, atletaRoutes);
app.use("/api/amigos", authenticateToken, amigosRoutes);
app.use("/api/categorias", authenticateToken, categoriasRoutes);
app.use("/api/clubes", authenticateToken, clubeRoutes);
app.use("/api/configuracoes-perfil", configuracoesPerfilRoutes);
app.use("/api/configuracoes", authenticateToken, configuracoesRoutes);
app.use("/api/conquistas", authenticateToken, conquistasRoutes);
app.use("/api/desafios", authenticateToken, desafiosRoutes);
app.use("/api/desafios/em-grupo", authenticateToken, desafiosEmGrupoRoutes);
app.use("/api/desempenho", authenticateToken, desempenhoRoutes);
app.use("/api/escolinhas", authenticateToken, escolinhaRoutes);
app.use("/api/eventos", authenticateToken, eventosRoutes);
app.use("/api/exercicios", authenticateToken, exerciciosRoutes);
app.use("/api/favoritos", authenticateToken, favoritosRoutes);
app.use("/api/feed", authenticateToken, feedRoutes);
app.use("/api/grupos", authenticateToken, gruposRoutes);
app.use("/api/home", authenticateToken, homeRoutes);
app.use("/api/logerro", authenticateToken, logErroRoutes);
app.use("/api/mensagem", authenticateToken, mensagemRoutes);
app.use("/api/midias", authenticateToken, midiaRoutes);
app.use("/api/notificacoes", authenticateToken, notificacoesRoutes);
app.use("/api/perfil", authenticateToken, perfilRoutes);
app.use("/api/pontuacao", authenticateToken, pontuacaoRoutes);
app.use("/api/post", authenticateToken, postRoutes);
app.use("/api/presenca", authenticateToken, presencaRoutes);
app.use("/api/professores", authenticateToken, professorRoutes);
app.use("/api/seguidores/mutuos", rotaSeguidorMutuo);
app.use("/api/seguidores", seguirRoutes);
app.use("/api/usuarios", authenticateToken, usuarioRoutes);
app.use("/api/solicitacoes-treino", authenticateToken, solicitacaoTreinoRoutes);
app.use("/api/submissoes", authenticateToken, submissoesRoutes);
app.use("/api/treinos", authenticateToken, treinoRoutes);
app.use("/api/treino-unico", authenticateToken, treinoUnicoRoutes);
app.use("/api/treinosprogramados", authenticateToken, treinoProgramadoRoutes);
app.use("/api/upload/metodologias", metodologiasUploadRoutes);
app.use("/api/upload", authenticateToken, uploadRoutes);
app.use("/api/vinculo", authenticateToken, vinculoRoutes);
app.use("/api/vinculos", authenticateToken, vinculoRoutes);
app.use("/api/observados", authenticateToken, observadosRoutes);
app.use("/api/gerenciar", authenticateToken, gerenciarAtletasRoutes);
app.use("/api/indicacoes", authenticateToken, indicacoesRouter);
app.use("/api/relacoes", authenticateToken, relacoesRoutes);
app.use("/api/elencos", authenticateToken, elencosRoutes);
app.use("/api/estatisticas", authenticateToken, estatisticasRoutes);
app.use("/api/formadores", authenticateToken, formadoresRoutes);
app.use("/api/checklists", authenticateToken, checklistRoutes);
app.use("/api/organizacoes", authenticateToken, organizacoesRoutes);
app.use("/api/turmas", authenticateToken, turmasRoutes);
app.use("/api/treinos-elencos", authenticateToken, treinosElencosRoutes);
app.use("/api/treinosSalvos", treinosSalvosRoutes);
app.use("/api/analytics", authenticateToken, analyticsRoutes);
app.post("/api/billing/webhook", mercadoPagoWebhook);
app.use("/api/billing", authenticateToken, billingRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/templates", templatesRoutes);
app.use('/api/usage', usageRouter);
app.use('/api/agendamentos', agendamentosRouter);
app.use("/api/olheiro/listas", listasOlheiroRoutes);
app.use("/api/auditoria", auditoriaRouter);
app.use("/api/ads", adsRoutes);
app.use("/api/consentimento", authenticateToken, consentimentoRoutes);
app.use("/api/jogos-elenco", jogosElencoRoutes);
app.use("/api/treinar-juntos", treinarJuntosRoute);
app.use("/api/sessoes-turma", sessoesTurmaRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/status", statusRoutes);
app.use("/api", authenticateToken, treinoLivreRoutes);
app.use("/api", authenticateToken, scoutNotesRoutes);
app.use("/api/metodologias", metodologiasRoutes);


server.listen({ port: PORT, host: "0.0.0.0" }, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
  if (NODE_ENV !== "production") {
    const frontendURL = `http://${LOCAL_IP}:${FRONT_PORT}`;
    try { qrcode.generate(frontendURL, { small: true }); } catch {}
    console.log(`🔗 Front-end (dev): ${frontendURL}`);
  }
});

cron.schedule("0 4 * * *", async () => {
  const now = new Date();
  await prisma.atletaHistoricoVinculo.deleteMany({
    where: { expiraEm: { lt: now } },
  });
});

cron.schedule("30 3 * * *", async () => {
  try {
    const n = await purgeDeletedAccounts();
    console.log(`[purgeDeletedAccounts] removidos: ${n}`);
  } catch (e) {
    console.error("[purgeDeletedAccounts] erro", e);
  }
});

cron.schedule("0 3 * * *", async () => {
  await processarRenovacoesDiarias();
  runColdStorageJob().catch((e) => console.error("Cold storage job failed", e));
});

cron.schedule("0 2 * * *", async () => {
  try {
    await gerarSnapshotRanking();
  } catch (e) {
    console.error("❌ Falha snapshot ranking", e);
  }
});

process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err));

setInterval(async () => {
  try { await limparTreinosSalvosExpirados({} as any, { json(){} } as any); } catch {}
}, 24 * 60 * 60 * 1000);