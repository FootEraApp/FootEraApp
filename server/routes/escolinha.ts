import express from "express";
import {
  getEscolinhas,
  getEscolinhaById,
  createEscolinha,
  updateEscolinha,
  deleteEscolinha
} from "../controllers/escolinhasController";

const router = express.Router();

router.get("/", getEscolinhas);
router.get("/:id", getEscolinhaById);
router.post("/", createEscolinha);
router.put("/:id", updateEscolinha);
router.delete("/:id", deleteEscolinha);

export default router;
