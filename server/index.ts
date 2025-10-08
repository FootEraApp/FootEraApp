// server/index.ts
import express from "express";
import cors from "cors";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cron from "node-cron";
import http from "http";
import qrcode from "qrcode-terminal";
import * as fs from "fs";

import { setupSocket } from "./socket.js";
import { UPLOADS_ROOT, ensureUploadDirs } from "./utils/uploads.js";
import { gerarSnapshotRanking } from "./jobs/rankingSnapshot.js";

// rotas
import adminRoutes from "./routes/admin.js";
import adminModeracaoRoutes from "./routes/adminModeracao.js";
import atletaRoutes from "./routes/atleta.js";
import authRoutes from "./routes/auth.js";
import amigosRoutes from "./routes/amigos.js";
import cadastroRoutes from "./routes/cadastro.js";
import clubeRoutes from "./routes/clube.js";
import configuracoesRoutes from "./routes/configuracoes.js";
import conquistaRoutes from "./routes/conquista.js";
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
// import loginRoutes from "./routes/login.js"; // (evite; use /api/auth)
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
// import conquistasRouter from "./routes/conquistas.js"; // duplicava /api/conquistas
import relacoesRoutes from "./routes/relacoes.js";
import elencosRoutes from "./routes/elencos.js";
import formadoresRoutes from "./routes/formadores.js";
import scoutNotesRoutes from "./routes/scoutNotes.js";
import checklistRoutes from "./routes/checklists.js";

import { startExpiredTrainingsJob } from "./jobs/expiredTrainings.js";
import { authenticateToken } from "./middlewares/auth.js"; // ⬅️ IMPORTANTE

// ---------------- ENV ----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envCandidates = [
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
// -------------------------------------

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const io = setupSocket(server);

ensureUploadDirs();
startExpiredTrainingsJob();

// ---------- Configs ----------
const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = Number(process.env.PORT) || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const LOCAL_IP = process.env.LOCAL_IP || "192.168.18.8";
const FRONT_PORT = Number(process.env.FRONT_PORT) || 5173;

// ---------- Middlewares ----------
app.use(
  cors({
    origin: [FRONTEND_URL, "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// Uploads e assets
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

// ---------- ROTAS PÚBLICAS (SEM TOKEN) ----------
app.use("/api/auth", authRoutes);        // /login, /refresh etc.
app.use("/api/cadastro", cadastroRoutes);
app.use("/api/termos", termoRoutes);

// Health check público para o Load Balancer
app.get("/api/health", (_req, res) => res.status(200).json({ ok: true }));

// Health & util públicos
app.get("/", (_req, res) => res.send("FootEra API está ativa!"));
app.get("/resetar-senha", (req, res) => {
  const qs = req.originalUrl.split("?")[1] || "";
  const dest = `${FRONTEND_URL.replace(/\/+$/, "")}/resetar-senha${qs ? "?" + qs : ""}`;
  res.redirect(302, dest);
});

// ---------- GUARD GLOBAL (DAQUI PRA BAIXO EXIGE TOKEN) ----------
app.use(authenticateToken);

// ---------- ROTAS PROTEGIDAS ----------
app.use("/api/admin", adminRoutes);
app.use("/api/admin/moderacao", adminModeracaoRoutes);
app.use("/api/atletas", atletaRoutes);
app.use("/api/amigos", amigosRoutes);
app.use("/api/categorias", categoriasRoutes);
app.use("/api/clubes", clubeRoutes);
app.use("/api/configuracoes", configuracoesRoutes);
app.use("/api/conquistas", conquistaRoutes);
app.use("/api/desafios", desafiosRoutes);
app.use("/api/desafios/em-grupo", desafiosEmGrupoRoutes);
app.use("/api/desempenho", desempenhoRoutes);
app.use("/api/escolinhas", escolinhaRoutes);
app.use("/api/eventos", eventosRoutes);
app.use("/api/explorar", explorarRoutes);
app.use("/api/exercicios", exerciciosRoutes);
app.use("/api/favoritos", favoritosRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/grupos", gruposRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/logerro", logErroRoutes);
app.use("/api/mensagem", mensagemRoutes);
app.use("/api/midias", midiaRoutes);
app.use("/api/notificacoes", notificacoesRoutes);
app.use("/api/perfil", perfilRoutes);
app.use("/api/pontuacao", pontuacaoRoutes);
app.use("/api/post", postRoutes);
app.use("/api/professores", professorRoutes);
app.use("/api/ranking", rankingRoutes);
app.use("/api/seguidores/mutuos", rotaSeguidorMutuo);
app.use("/api/seguidores", seguirRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/solicitacoes-treino", solicitacaoTreinoRoutes);
app.use("/api/submissoes", submissoesRoutes);
// app.use("/api/termos", termoRoutes);  // já está nas públicas
app.use("/api/treinos", treinoRoutes);
app.use("/api/treino-unico", treinoUnicoRoutes);
app.use("/api/treinoslivres", treinoLivreRoutes);
app.use("/api/treinosprogramados", treinoProgramadoRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/vinculo", vinculoRoutes);
app.use("/api/observados", observadosRoutes);
app.use("/api/gerenciar", gerenciarAtletasRoutes);
app.use("/api/indicacoes", indicacoesRouter);
app.use("/api/olheiros", olheirosRouter);
app.use("/api/relacoes", relacoesRoutes);
app.use("/api/elencos", elencosRoutes);
app.use("/api/formadores", formadoresRoutes);
app.use("/api", scoutNotesRoutes);
app.use("/api/checklists", checklistRoutes);

// Exercícios (estático com range)
app.use(
  "/exercicios",
  express.static(path.join(process.cwd(), "public", "exercicios"), {
    setHeaders: (res) => res.setHeader("Accept-Ranges", "bytes"),
  })
);

// ---------- Server ----------
server.listen({ port: PORT, host: "0.0.0.0" }, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
  if (NODE_ENV !== "production") {
    const frontendURL = `http://${LOCAL_IP}:${FRONT_PORT}`;
    try { qrcode.generate(frontendURL, { small: true }); } catch {}
    console.log(`🔗 Front-end (dev): ${frontendURL}`);
  }
});

// ---------- Cron ----------
cron.schedule("0 2 * * *", async () => {
  try {
    await gerarSnapshotRanking();
    console.log("🗂️ Snapshot de ranking gerado");
  } catch (e) {
    console.error("❌ Falha snapshot ranking", e);
  }
});

// ---------- Safety ----------
process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err));
