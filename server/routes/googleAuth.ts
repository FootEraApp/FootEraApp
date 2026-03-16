// server/routes/googleAuth.ts
import { Router } from "express";
import {
  googleLogin,
  googleCompleteRegistration,
  googleLinkAccount,
} from "../controllers/googleAuthController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.post("/complete-registration", googleCompleteRegistration);
router.post("/link", authenticateToken, googleLinkAccount);
router.post("/", googleLogin);

export default router;