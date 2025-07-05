import express from "express";
import multer from "multer";
import {
  escolha,
  loginView,
  index,
  indexLogin,
  curtir,
  comentar,
  postar,
  faleConosco
} from "../controllers/homeController";

const router = express.Router();
const upload = multer({ dest: "public/uploads/posts" });

router.get("/escolha", escolha);
router.get("/login", loginView);
router.get("/", index);
router.post("/login", indexLogin);
router.post("/curtir", curtir);
router.post("/comentar", comentar);
router.post("/postar", upload.single("file"), postar);
router.post("/fale-conosco", faleConosco);

export default router;