import express from "express";
import {
  getAllAtletas,
  getAtletaById,
  createAtleta,
  updateAtleta,
  deleteAtleta,
  getMidiasAtleta,
  uploadMidiaAtleta,
  getProfessorDoAtleta,
  vinculosBasic,
} from "../controllers/atletaController.js";
import { authenticateToken } from "server/middlewares/auth.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

router.get("/:id/vinculos-basic", authenticateToken, vinculosBasic);
router.get("/:id/midias", getMidiasAtleta);
router.post("/:id/midias", uploadMidiaAtleta);
router.get("/:atletaId/professor", authenticateToken, getProfessorDoAtleta);
router.get("/:id", getAtletaById);
router.patch("/:id", updateAtleta);
router.delete("/:id", deleteAtleta);
router.get("/", getAllAtletas);
router.post("/", createAtleta);

export default router;