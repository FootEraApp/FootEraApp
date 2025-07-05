import express from "express";
import { login, logout, validateToken } from "../controllers/authController";

const router = express.Router();

router.post("/login", login);
router.post("/logout", logout);
router.get("/validate-token", validateToken);

export default router;
