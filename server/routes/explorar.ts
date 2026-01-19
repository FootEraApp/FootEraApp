import { Router } from "express";
import {
  explorar,
  buscarExplorar,
  listarAtletasExplorar,
} from "../controllers/explorarController.js";
import { authenticateToken } from "../middlewares/auth.js";

const r = Router();

r.get("/atletas", authenticateToken, listarAtletasExplorar);
r.get("/buscar", authenticateToken, buscarExplorar);
r.get("/", authenticateToken, explorar);

export default r;