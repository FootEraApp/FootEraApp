// server/routes/eventos.ts
import { Router } from "express";
import * as ctrl from "../controllers/eventosController.js";

const r = Router();

// --- LISTAGEM POR DONO ---

// Listar todos os eventos públicos
r.get("/", ctrl.listarPublicos);

// Clube
r.get("/clubes/:clubeId", ctrl.listarDoClube);

// Escolinha
r.get("/escolas/:escolinhaId", ctrl.listarDaEscolinha);

// --- MINHA AGENDA / EVENTOS DO ATLETA ---

r.get("/minha-agenda", ctrl.auth, ctrl.minhaAgenda);
r.get("/atleta/:atletaId", ctrl.auth, ctrl.eventosDoAtleta);

// --- CRUD DO EVENTO ---

// Criar evento para CLUBE
r.post(
  "/clubes/:clubeId",
  ctrl.auth,
  ctrl.ehDonoDoClubeOuAdmin,
  ctrl.criar
);

// Criar evento para ESCOLINHA
r.post(
  "/escolas/:escolinhaId",
  ctrl.auth,
  ctrl.ehDonoDaEscolinhaOuAdmin,
  ctrl.criar
);

// Obter por id (tem que vir depois das rotas específicas /clubes /escolas)
r.get("/:id", ctrl.obter);

export default r;