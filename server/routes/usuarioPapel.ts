// server/routes/usuarioPapel.ts
import { Router } from "express";
import {
  adicionarPapel,
  alterarPapelAtivo,
  concluirPapel,
  listarMeusPapeis,
  alterarContextoAtivo,
  listarMeusContextos,
  excluirMeuPapel,
  salvarPerfilRecuperacao,
  consultarRecuperacaoAtleta,
  solicitarResponsavelRecuperacaoAtleta,
  criarOrganizacaoRecuperacao,
  criarOrganizacaoContaAtiva,
} from "../controllers/usuarioPapelController.js";
import {
  authenticateToken,
} from "../middlewares/auth.js";

const router = Router();

router.use(authenticateToken);

router.get("/me/papeis", listarMeusPapeis);
router.get(
  "/me/contextos",
  listarMeusContextos
);
router.get(
  "/me/papeis/Atleta/recuperacao",
  consultarRecuperacaoAtleta
);
router.post(
  "/me/papeis/Atleta/recuperacao/responsavel",
  solicitarResponsavelRecuperacaoAtleta
);
router.patch(
  "/me/contexto-ativo",
  alterarContextoAtivo
);
router.post("/me/papeis", adicionarPapel);
router.post(
  "/me/organizacao-recuperacao",
  criarOrganizacaoRecuperacao
);
router.post(
  "/me/organizacoes",
  criarOrganizacaoContaAtiva
);
router.post(
  "/me/papeis/:papel/perfil-recuperacao",
  salvarPerfilRecuperacao
);
router.patch("/me/papeis/:papel/concluir", concluirPapel);
router.patch("/me/papel-ativo", alterarPapelAtivo);
router.delete(
  "/me/papeis/:papel",
  excluirMeuPapel,
);

export default router;