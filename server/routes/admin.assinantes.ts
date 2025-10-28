import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import * as admin from "../controllers/assinaturasAdminController.js";

const r = Router();
r.get("/", authenticateToken, admin.listar);
r.get("/overview", authenticateToken, admin.overview);
export default r;
