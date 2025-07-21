import { Router } from "express";
import { login, logout } from "../controllers/loginController";

const router = Router();

router.post("/", login);      
router.post("/logout", logout); 

export default router;
