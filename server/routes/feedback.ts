// server/routes/feedback.ts
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import * as ctrl from "../controllers/feedbackController.js";

const r = Router();

r.post("/", authenticateToken, ctrl.create);

r.get("/me", authenticateToken, ctrl.listMine);

r.get("/", authenticateToken, ctrl.listAll);

r.patch("/:id/lido", authenticateToken, ctrl.marcarComoLido);

export default r;
