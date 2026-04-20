import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import * as ctrl from "../controllers/sessoesTurmaController.js";

const r = Router();

r.get("/minhas", authenticateToken, ctrl.listarSessoesInstrutor);
r.patch("/:id/iniciar", authenticateToken, ctrl.iniciarSessao);
r.patch("/:id/progresso", authenticateToken, ctrl.atualizarProgresso);
r.patch("/:id/finalizar", authenticateToken, ctrl.finalizarSessao);
r.post("/:id/videos-execucao", authenticateToken, ctrl.salvarVideosExecucaoSessao);
r.patch("/:id/remarcar", authenticateToken, ctrl.remarcarSessao);
r.delete("/:id", authenticateToken, ctrl.excluirSessao);
r.get("/:id", authenticateToken, ctrl.obterSessao);
r.post("/", authenticateToken, ctrl.criarSessao);

export default r;