import express from "express";
import { Categoria } from "@prisma/client";

const router = express.Router();

router.get("/", (req, res) => {
  const categorias = Object.values(Categoria);
  res.json(categorias);
});

export default router;
