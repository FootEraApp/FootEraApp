import { Router, Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import multer from "multer";
import { authenticateToken } from "../middlewares/auth.js";
import { adminAuth } from "../middlewares/admin-auth.js";

import {
  getFeedPosts,
  seguirUsuario,
  postar,
  deletarPostagem,
  getPerfil,
  deletarUsuario,
} from "../controllers/feedController.js";

const router = Router();
const upload = multer({ dest: "public/uploads/posts" });

interface AuthedRequest extends Request {
  userId?: string;
}

function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const h = req.headers?.authorization;
  if (h?.startsWith("Bearer ")) {
    try {
      const token = h.slice(7);
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload | string;
      if (typeof payload === "object" && payload) {
        req.userId = (payload as any).id ?? (payload as any).userId ?? undefined;
      }
    } catch {
    }
  }
  next();
}

router.get("/", optionalAuth, getFeedPosts); 
router.get("/perfil/:id", authenticateToken, getPerfil);
router.delete("/usuario/:id", adminAuth, deletarUsuario);

router.post("/seguir", authenticateToken, seguirUsuario);
router.post("/postar", authenticateToken, upload.single("arquivo"), postar);
router.delete("/posts/:id", authenticateToken, deletarPostagem);

export default router;