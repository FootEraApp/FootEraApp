import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

import adminRoutes from "./routes/admin";
import atletaRoutes from "./routes/atleta";
import authRoutes from "./routes/auth";
import amigosRoutes from "./routes/amigos";
import cadastroRoutes from "./routes/cadastro";
import clubeRoutes from "./routes/clube";
import desafiosRoutes from "./routes/desafios";
import escolinhaRoutes from "./routes/escolinha";
import exerciciosRoutes from "./routes/exercicios";
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
import professorRoutes from "./routes/professor";
import rankingRoutes from "./routes/ranking"
import searchRoutes from "./routes/search";
import termoRoutes from "./routes/termo";
import treinoRoutes from "./routes/treino";
import treinoLivreRoutes from "./routes/treinoLivre";
import treinoProgramadoRoutes from "./routes/treinoProgramado";
import uploadRoutes from "./routes/upload";
import vinculoRoutes from "./routes/vinculo";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Rotas agrupadas
app.use("/api/admin", adminRoutes);
app.use("/api/atletas", atletaRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/amigos", amigosRoutes);
app.use("/api/cadastro", cadastroRoutes);
app.use("/api/clubes", clubeRoutes);
app.use("/api/desafios", desafiosRoutes);
app.use("/api/escolinhas", escolinhaRoutes);
app.use("/api/exercicios", exerciciosRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/grupos", gruposRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/logerro", logErroRoutes);
app.use("/api/login", loginRoutes);
app.use("/api/mensagens", mensagemRoutes);
app.use("/api/midias", midiaRoutes);
app.use("/api/perfil", perfilRoutes);
app.use("/api/pontuacao", pontuacaoRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/professores", professorRoutes);
app.use("/api/ranking", rankingRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/termos", termoRoutes);
app.use("/api/treinos", treinoRoutes);
app.use("/api/treinoslivres", treinoLivreRoutes);
app.use("/api/treinosprogramados", treinoProgramadoRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/vinculo", vinculoRoutes);

app.get("/", (req, res) => {
  res.send("FootEra API está ativa!");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
