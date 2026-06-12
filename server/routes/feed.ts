// server/routes/feed.ts 
import express, { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { adminAuth } from "../middlewares/admin-auth.js";
import { uploadToS3 } from "../middlewares/s3Upload.js"; 
import {
  getFeedPosts,
  seguirUsuario,
  postar,
  deletarPostagem,
  getPerfil,
  deletarUsuario,
  repostPost,
  curtirPostagem,
  getPostById,
  compartilharPost,
} from "../controllers/feedController.js";

const router = Router();

router.use(authenticateToken);

router.post("/:id/repost", repostPost);
router.post("/:postId/like", curtirPostagem);
router.get("/perfil/:id", getPerfil);
router.delete("/usuario/:id", adminAuth, deletarUsuario);
router.post("/seguir", seguirUsuario);
router.post("/postar", uploadToS3.single("arquivo"), postar);
router.post("/post", uploadToS3.single("arquivo"), postar);
router.get("/post/visualizar/:id", getPostById);
router.post("/post/:id/compartilhar", compartilharPost);
router.delete("/posts/:id", deletarPostagem);
router.get("/", getFeedPosts);

export default router;