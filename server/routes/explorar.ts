import express from "express";
import { buscarExplorar } from "../controllers/explorarController";
const router = express.Router();

router.get("/", buscarExplorar);

export default router;
