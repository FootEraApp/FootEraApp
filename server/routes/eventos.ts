import { Router } from "express";
import * as ctrl from "../controllers/eventosController.js";

const r = Router();

r.get("/clubes/:clubeId", ctrl.listarDoClube);
r.get("/escolas/:escolinhaId", ctrl.listarDaEscolinha);
r.get("/minha-agenda", ctrl.auth, ctrl.minhaAgenda);
r.get("/atleta/:atletaId", ctrl.auth, ctrl.eventosDoAtleta);
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
r.get("/:id", ctrl.obter);
r.get("/", ctrl.listarPublicos);

export default r;