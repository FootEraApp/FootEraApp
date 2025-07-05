// server/routes/login.routes.ts
import { Router } from "express";
import { login, logout } from "../controllers/loginController";

const router = Router();

router.post("/", login);      // POST /api/login
router.post("/logout", logout); // POST /api/login/logout

export default router;
