// server/routes/termRoutes.ts
import { Router } from "express";
import {
  index,
  politicaDePrivacidade,
  regulamento,
  termosDeUso,
} from "../controllers/termoController";

const router = Router();

router.get("/", index);
router.get("/politica-de-privacidade", politicaDePrivacidade);
router.get("/regulamento", regulamento);
router.get("/termos-de-uso", termosDeUso);

export default router;
