import express from "express";
import { createTreino, updateTreino, deleteTreino, getTreinos } from "../controllers/treinosController";

const router = express.Router();
router.post("/", createTreino);
router.put("/:id", updateTreino);
router.delete("/:id", deleteTreino);
router.get("/", getTreinos);

export default router;
