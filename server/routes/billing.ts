import { Router } from "express";
import {
  getPlans,
  getMyBilling,
  applyCoupon,
  startCheckout,
  redeemGift,
  cancelSubscription,
  renewSubscription,
  switchPlan,
  providerWebhook,
} from "../controllers/billingController.js";

const router = Router();

router.get("/plans", getPlans);
router.get("/me", getMyBilling);
router.post("/coupon", applyCoupon);
router.post("/checkout", startCheckout);
router.post("/gift/redeem", redeemGift);
router.post("/subscription/cancel", cancelSubscription);
router.post("/subscription/renew", renewSubscription);
router.post("/subscription/switch", switchPlan);

router.post("/webhook/provider", providerWebhook);

export default router;