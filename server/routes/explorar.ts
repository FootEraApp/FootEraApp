// server/routes/explorar.ts
import { Router } from "express";
import {
  explorar,
  buscarExplorar,
  listarAtletasExplorar,
} from "../controllers/explorarController.js";
import { authenticateToken } from "../middlewares/auth.js";
// ou authenticateTokenIfPresent, se você tiver essa variante

const r = Router();

// Rota principal usada pela tela /explorar (todas as abas, inclusive Eventos)
r.get("/", authenticateToken, explorar);

// (Opcional) rota antiga só de atletas, se ainda estiver sendo usada em outro lugar
r.get("/atletas", authenticateToken, listarAtletasExplorar);

// Busca com texto
r.get("/buscar", authenticateToken, buscarExplorar);

export default r;
