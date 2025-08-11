import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cron from "node-cron";
import http from "http";
import { initSocket } from "./socket";

import adminRoutes from "./routes/admin";
import atletaRoutes from "./routes/atleta";
import authRoutes from "./routes/auth";
import amigosRoutes from "./routes/amigos";
import cadastroRoutes from "./routes/cadastro";
import clubeRoutes from "./routes/clube";
import configuracoesRoutes from "./routes/configuracoes";
import categoriasRoutes from "./routes/categorias"
import desafiosRoutes from "./routes/desafios";
import escolinhaRoutes from "./routes/escolinha";
import exerciciosRoutes from "./routes/exercicios";
import explorarRoutes from "./routes/explorar";
import feedRoutes from "./routes/feed";
import gruposRoutes from "./routes/grupos";
import homeRoutes from "./routes/home";
import logErroRoutes from "./routes/logErro";
import loginRoutes from "./routes/login";
import mensagemRoutes from "./routes/mensagem";
import midiaRoutes from "./routes/midia";
import perfilRoutes from "./routes/perfil";
import pontuacaoRoutes from "./routes/pontuacao";
import postRoutes from "./routes/post";
import professorRoutes from "./routes/professores";
import rankingRoutes from "./routes/ranking";
import seguirRoutes from "./routes/seguir";
import rotaSeguidorMutuo from "./routes/seguidorMutuo";
import solicitacaoTreinoRoutes from "./routes/solicitacaoTreino";
import submissoesRoutes from "./routes/submissoes";
import termoRoutes from "./routes/termo";
import treinoRoutes from "./routes/treinos";
import treinoLivreRoutes from "./routes/treinoLivre";
import treinoProgramadoRoutes from "./routes/treinoProgramado";
import uploadRoutes from "./routes/upload";
import usuarioRoutes from "./routes/usuario";
import vinculoRoutes from "./routes/vinculo";

import { removerTreinosExpirados } from "./routes/removerTreinosExpirados";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = http.createServer(app);
const io = initSocket(server);

dotenv.config();

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

app.use("/api/admin", adminRoutes);
app.use("/api/atletas", atletaRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/amigos", amigosRoutes);
app.use("/api/cadastro", cadastroRoutes);
app.use("/api/categorias", categoriasRoutes)
app.use("/api/clubes", clubeRoutes);
app.use("/api/configuracoes", configuracoesRoutes);
app.use("/api/desafios", desafiosRoutes);
app.use("/api/escolinhas", escolinhaRoutes);
app.use("/api/explorar", explorarRoutes);
app.use("/api/exercicios", exerciciosRoutes);
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
app.use("/api/seguidores", seguirRoutes);
app.use("/api/seguidores/mutuo", rotaSeguidorMutuo);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/solicitacoes-treino", solicitacaoTreinoRoutes);
app.use("/api/submissoes", submissoesRoutes);
app.use("/api/termos", termoRoutes);
app.use("/api/treinos", treinoRoutes);
app.use("/api/treinoslivres", treinoLivreRoutes);
app.use("/api/treinosprogramados", treinoProgramadoRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/vinculo", vinculoRoutes);

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/assets", express.static("client/public/assets/")); 

app.get("/api/health", (_req, res) => res.send("ok"));
app.get("/", (req, res) => {
  res.send("FootEra API está ativa!");
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

cron.schedule("*/10 * * * *", async () => {
  console.log("Verificando treinos expirados...");
  await removerTreinosExpirados();
});