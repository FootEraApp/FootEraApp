import {
  Router,
} from "express";
import {
  listarMeusAtletas,
  obterMeuAtleta,
  ativarMeuAtleta,
  obterMeuPerfilResponsavel,
  solicitarExclusaoContaAtleta,
  listarPostagensAtletaGerenciado,
  solicitarVinculoResponsavel,
  recusarVinculoAtleta,
  solicitarVinculoAtletaComoResponsavel,
  listarSolicitacoesNovosResponsaveis,
  aceitarNovoResponsavel,
  recusarNovoResponsavel,
  aceitarNovoResponsavelComoAtleta,
  recusarNovoResponsavelComoAtleta,
  redefinirSenhaAtleta,
  encerrarSessoesAtleta,
  desvincularGoogleAtleta,
  restaurarContaAtleta,
  listarMeusResponsaveisComoAtleta,
  desvincularResponsavelComoAtleta,
  listarResponsaveisDoAtleta,
  atualizarPermissoesResponsavelSecundario,
  desvincularResponsavelSecundarioComoPrincipal,
  desvincularMeuAtletaComoResponsavel,
} from "../controllers/responsaveisController.js";

const router =
  Router();

router.post(
  "/solicitacoes",
  solicitarVinculoResponsavel
);

router.post(
  "/solicitacoes/atleta",
  solicitarVinculoAtletaComoResponsavel
);

router.get(
  "/atleta/me/responsaveis",
  listarMeusResponsaveisComoAtleta
);

router.patch(
  "/atleta/me/solicitacoes-responsaveis/:vinculoId/aceitar",
  aceitarNovoResponsavelComoAtleta
);
router.patch(
  "/atleta/me/solicitacoes-responsaveis/:vinculoId/recusar",
  recusarNovoResponsavelComoAtleta
);

router.delete(
  "/atleta/me/responsaveis/:vinculoId",
  desvincularResponsavelComoAtleta
);

router.get(
  "/me/solicitacoes-responsaveis",
  listarSolicitacoesNovosResponsaveis
);

router.patch(
  "/me/solicitacoes-responsaveis/:vinculoId/aceitar",
  aceitarNovoResponsavel
);

router.patch(
  "/me/solicitacoes-responsaveis/:vinculoId/recusar",
  recusarNovoResponsavel
);

router.get(
  "/me/atletas",
  listarMeusAtletas
);

router.get(
  "/me/atletas/:atletaId",
  obterMeuAtleta
);

router.delete(
  "/me/atletas/:atletaId/vinculo",
  desvincularMeuAtletaComoResponsavel
);

router.get(
  "/me/atletas/:atletaId/responsaveis",
  listarResponsaveisDoAtleta
);

router.delete(
  "/me/atletas/:atletaId/responsaveis/:vinculoId",
  desvincularResponsavelSecundarioComoPrincipal
);

router.patch(
  "/me/atletas/:atletaId/responsaveis/:vinculoId/permissoes",
  atualizarPermissoesResponsavelSecundario
);

router.put(
  "/me/atletas/:atletaId/seguranca/senha",
  redefinirSenhaAtleta
);

router.post(
  "/me/atletas/:atletaId/seguranca/encerrar-sessoes",
  encerrarSessoesAtleta
);

router.delete(
  "/me/atletas/:atletaId/seguranca/google",
  desvincularGoogleAtleta
);

router.post(
  "/me/atletas/:atletaId/conta/restaurar",
  restaurarContaAtleta
);

router.get(
  "/me/atletas/:atletaId/postagens",
  listarPostagensAtletaGerenciado
);

router.delete(
  "/me/atletas/:atletaId/conta",
  solicitarExclusaoContaAtleta
);

router.patch(
  "/me/atletas/:atletaId/ativar",
  ativarMeuAtleta
);

router.patch(
  "/me/atletas/:atletaId/recusar",
  recusarVinculoAtleta
);

router.get(
  "/me",
  obterMeuPerfilResponsavel
);

export default router;