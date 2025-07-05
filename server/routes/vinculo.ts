import { Router } from "express";
import { vinculoController } from "../controllers/vinculoController";

const router = Router();

router.post("/vinculo/solicitar", vinculoController.solicitarVinculo);
router.post("/vinculo/responder", vinculoController.responderSolicitacao);
router.get("/vinculo/pendentes/:entidadeId/:tipo", vinculoController.pendentes);

export default router;
