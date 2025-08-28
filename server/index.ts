import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import cron from "node-cron";
import http from "http";
import { setupSocket } from "./socket.js";
import qrcode from "qrcode-terminal";
import { APP } from "./config.js";

import adminRoutes from "./routes/admin.js";
import atletaRoutes from "./routes/atleta.js";
import authRoutes from "./routes/auth.js";
import amigosRoutes from "./routes/amigos.js";
import cadastroRoutes from "./routes/cadastro.js";
import clubeRoutes from "./routes/clube.js";
import configuracoesRoutes from "./routes/configuracoes.js";
import conquistaRoutes from "./routes/conquista.js";
import categoriasRoutes from "./routes/categorias.js"
import desafiosRoutes from "./routes/desafios.js";
    import desafiosEmGrupoRoutes from "./routes/desafiosEmGrupo.js";
import escolinhaRoutes from "./routes/escolinha.js";
import exerciciosRoutes from "./routes/exercicios.js";
import explorarRoutes from "./routes/explorar.js";
    import favoritosRoutes from "./routes/favorito.js";
import feedRoutes from "./routes/feed.js";
import gruposRoutes from "./routes/grupos.js";
import homeRoutes from "./routes/home.js";
import logErroRoutes from "./routes/logErro.js";
import loginRoutes from "./routes/login.js";
import mensagemRoutes from "./routes/mensagem.js";
import midiaRoutes from "./routes/midia.js";
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
import treinoLivreRoutes from "./routes/treinoLivre.js";
import treinoProgramadoRoutes from "./routes/treinoProgramado.js";
import uploadRoutes from "./routes/upload.js";
import usuarioRoutes from "./routes/usuario.js";
import vinculoRoutes from "./routes/vinculo.js";

import { startExpiredTrainingsJob } from "./jobs/expiredTrainings.js";
import { removerTreinosExpirados } from "./routes/removerTreinosExpirados.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = http.createServer(app);
const io = setupSocket(server);

dotenv.config();
startExpiredTrainingsJob();

app.use(cors());
app.use(express.json({limit: "10mb"}));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/admin", adminRoutes);
app.use("/api/atletas", atletaRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/amigos", amigosRoutes);
app.use("/api/cadastro", cadastroRoutes);
app.use("/api/categorias", categoriasRoutes)
app.use("/api/clubes", clubeRoutes);
app.use("/api/configuracoes", configuracoesRoutes);
app.use("/api/conquistas", conquistaRoutes);
app.use("/api/desafios", desafiosRoutes);
    app.use("/api/desafios/em-grupo", desafiosEmGrupoRoutes);
app.use("/api/escolinhas", escolinhaRoutes);
app.use("/api/explorar", explorarRoutes);
app.use("/api/exercicios", exerciciosRoutes);
    app.use("/api/favoritos", favoritosRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/grupos", gruposRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/logerro", logErroRoutes);
app.use("/api/login", loginRoutes);
app.use("/api/mensagem", mensagemRoutes);
app.use("/api/midias", midiaRoutes);
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
app.use("/api/termos", termoRoutes);
app.use("/api/treinos", treinoRoutes);
app.use("/api/treinoslivres", treinoLivreRoutes);
app.use("/api/treinosprogramados", treinoProgramadoRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/vinculo", vinculoRoutes);

app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

app.get("/", (req, res) => {
  res.send("FootEra API está ativa!");
});

app.get("/resetar-senha", (req, res) => {
  const qs = req.originalUrl.split("?")[1] || "";
  res.redirect(302, `${APP.FRONTEND_URL}/resetar-senha${qs ? "?" + qs : ""}`);
});

const PORT = process.env.PORT || 3001;
const FRONT_PORT = 5173;
const LOCAL_IP = "192.168.18.8";

server.listen({port: PORT, host: "0.0.0.0"}, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Servidor acessível na rede: http://192.168.18.8:${PORT}`);

  const frontendURL = `http://${LOCAL_IP}:${FRONT_PORT}`;
  qrcode.generate(frontendURL, { small: true });
  console.log(`QR Code para acessar o front-end: ${frontendURL}`);
});

cron.schedule("*/10 * * * *", async () => {
  console.log("Verificando treinos expirados...");
  await removerTreinosExpirados();
});