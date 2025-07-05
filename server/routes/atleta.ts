import express from "express";
import {
  getAllAtletas,
  getAtletaById,
  createAtleta,
  updateAtleta,
  deleteAtleta,
  getMidiasAtleta,
  uploadMidiaAtleta
} from "../controllers/atletaController";

const router = express.Router();

router.get("/", getAllAtletas);
router.get("/:id", getAtletaById);
router.post("/", createAtleta);
router.patch("/:id", updateAtleta);
router.delete("/:id", deleteAtleta);

// Mídias
router.get("/:id/midias", getMidiasAtleta);
router.post("/:id/midias", uploadMidiaAtleta);

export default router;
