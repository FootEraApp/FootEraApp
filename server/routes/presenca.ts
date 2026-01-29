import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { getPresenca } from "../controllers/presencaController.js";

const r = Router();
r.use(authenticateToken);

r.get("/:id", getPresenca);

export default r;