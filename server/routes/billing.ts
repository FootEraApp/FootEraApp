import express from "express";
import {
  getMyBilling,
  getPlans,
  startCheckout,
  applyCoupon,
  redeemGift,
  cancelSubscription,
  renewSubscription,
  switchPlan
} from "../controllers/billingController.js";
import { authenticateToken } from "server/middlewares/auth.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/me", getMyBilling);
router.get("/plans", getPlans);
router.post("/checkout", startCheckout);
router.post("/coupon/apply", applyCoupon);
router.post("/gift/redeem", redeemGift);
router.post("/cancel", cancelSubscription);
router.post("/renew", renewSubscription);
router.post("/switch-plan", switchPlan);

export default router;