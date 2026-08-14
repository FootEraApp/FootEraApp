import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  getIndicacoes,
  perfilOlheiro,
  getNota,
  setNota,
  patchColaboracao,
  getMinhaColaboracao,
  solicitarColaboracao,
  removerColaboracao,
  cancelarSolicitacaoColaboracao,
  aceitarSolicitacaoColaboracao,
  recusarSolicitacaoColaboracao,
} from "../controllers/olheirosController.js";
import { listarObservadosPorOlheiro } from "../controllers/atletaObservadoController.js";
import {
  criarLista,
  minhasListas,
  deletarLista,
  adicionarAtleta,
  removerAtleta,
} from "../controllers/listasOlheiroController.js";

const router = Router();

router.delete("/listas/:id", deletarLista);
router.post("/listas/:id/itens", adicionarAtleta);
router.delete("/listas/:id/itens/:atletaId", removerAtleta);
router.post("/listas", criarLista);
router.get("/listas", minhasListas);

router.get("/:id/indicacoes", getIndicacoes);
router.get("/perfil/olheiro/:id", authenticateToken, perfilOlheiro);
router.get("/:olheiroId/observados", authenticateToken, listarObservadosPorOlheiro);
router.get("/notas/:atletaId", authenticateToken, getNota);
router.put("/notas/:atletaId", authenticateToken, setNota);
router.get(
  "/:id/colaboracao",
  authenticateToken,
  getMinhaColaboracao
);

router.post(
  "/:id/colaboracao/solicitar",
  authenticateToken,
  solicitarColaboracao
);

router.delete(
  "/:id/colaboracao",
  authenticateToken,
  removerColaboracao
);

router.delete(
  "/:id/colaboracao/solicitacoes/:solicitacaoId",
  authenticateToken,
  cancelarSolicitacaoColaboracao
);

router.post(
  "/colaboracao/solicitacoes/:solicitacaoId/aceitar",
  authenticateToken,
  aceitarSolicitacaoColaboracao
);

router.post(
  "/colaboracao/solicitacoes/:solicitacaoId/recusar",
  authenticateToken,
  recusarSolicitacaoColaboracao
);
router.patch("/:id", authenticateToken, patchColaboracao);

export default router;
