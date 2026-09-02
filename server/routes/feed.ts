// server/routes/feed.ts 
import express, { Router } from "express";
import {
  authenticateToken,
  optionalAuthenticateToken,
} from "../middlewares/auth.js";
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
router.post(
  "/:id/repost",
  authenticateToken,
  repostPost
);

router.post(
  "/:postId/like",
  authenticateToken,
  curtirPostagem
);

router.get(
  "/perfil/:id",
  authenticateToken,
  getPerfil
);

router.delete(
  "/usuario/:id",
  authenticateToken,
  adminAuth,
  deletarUsuario
);

router.post(
  "/seguir",
  authenticateToken,
  seguirUsuario
);

router.post(
  "/postar",
  authenticateToken,
  uploadToS3.single("arquivo"),
  postar
);

router.post(
  "/post",
  authenticateToken,
  uploadToS3.single("arquivo"),
  postar
);

router.get(
  "/post/visualizar/:id",
  optionalAuthenticateToken,
  getPostById
);

router.post(
  "/post/:id/compartilhar",
  authenticateToken,
  compartilharPost
);

router.delete(
  "/posts/:id",
  authenticateToken,
  deletarPostagem
);

router.get(
  "/",
  optionalAuthenticateToken,
  getFeedPosts
);

export default router;