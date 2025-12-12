import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import * as ctrl from "../controllers/sessoesTurmaController.js";

const r = Router();

r.post("/", authenticateToken, ctrl.criarSessao);
r.get("/minhas", authenticateToken, ctrl.listarSessoesInstrutor);
r.patch("/:id/iniciar", authenticateToken, ctrl.iniciarSessao);
r.patch("/:id/progresso", authenticateToken, ctrl.atualizarProgresso);
r.patch("/:id/finalizar", authenticateToken, ctrl.finalizarSessao);
r.patch("/:id/remarcar", authenticateToken, ctrl.remarcarSessao);
r.delete("/:id", authenticateToken, ctrl.excluirSessao);
r.get("/:id", authenticateToken, ctrl.obterSessao);

export default r;