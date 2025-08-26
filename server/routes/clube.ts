import express from "express";
import {
  getClubes,
  getClube,
  createClube,
  updateClube,
  deleteClube
} from "../controllers/clubesController.js";

const router = express.Router();

router.get("/", getClubes);
router.get("/:id", getClube);
router.post("/", createClube);
router.put("/:id", updateClube);
router.delete("/:id", deleteClube);

export default router;
