import { Router } from "express";
import * as ctrl from "../controllers/eventosController.js";
import { authenticateToken } from "../middlewares/auth.js";
import {
  getConvocacaoEvento,
  upsertConvocacaoEvento,
} from "../controllers/eventoConvocacaoController.js";

const r = Router();

r.get("/minha-agenda", ctrl.auth, ctrl.minhaAgenda);
r.get("/atleta", ctrl.auth, ctrl.eventosDoAtleta);

r.get("/creator/me", ctrl.auth, ctrl.listarMeusEventosCreator);
r.post("/creator", ctrl.auth, ctrl.criarEventoCreator);

r.get("/creator/:id", ctrl.auth, ctrl.getEventoCreatorById);
r.put("/creator/:id", ctrl.auth, ctrl.atualizarEventoCreator);
r.delete("/creator/:id", ctrl.auth, ctrl.deletarEventoCreator);
r.get("/clubes/:clubeId", ctrl.listarDoClube);
r.get("/escolas/:escolinhaId", ctrl.listarDaEscolinha);

r.post(
  "/clubes/:clubeId",
  ctrl.auth,
  ctrl.ehDonoDoClubeOuAdmin,
  ctrl.criar
);

r.post(
  "/escolas/:escolinhaId",
  ctrl.auth,
  ctrl.ehDonoDaEscolinhaOuAdmin,
  ctrl.criar
);

r.get("/:eventoId/convocacao", authenticateToken, getConvocacaoEvento);
r.put("/:eventoId/convocacao", authenticateToken, upsertConvocacaoEvento);

r.get("/:id", ctrl.obter);
r.get("/", ctrl.listarPublicos);

export default r;