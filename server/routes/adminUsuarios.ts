import { Router } from "express";
import { adminAuth } from "../middlewares/admin-auth.js";
import {
  listAdminUsers,
  getAdminUserDetail,
} from "../controllers/adminUsersController.js";

const router = Router();

router.get("/:id", adminAuth, getAdminUserDetail);
router.get("/", adminAuth, listAdminUsers);

export default router;