import { Router } from "express";
import {
  uploadMetodologiaVideoMulter,
  uploadVideoMetodologia,
} from "../controllers/uploadMetodologiasController.js";

const router = Router();

// POST /api/upload/metodologias/video
router.post(
  "/video",
  uploadMetodologiaVideoMulter.single("video"),
  uploadVideoMetodologia
);

export default router;
