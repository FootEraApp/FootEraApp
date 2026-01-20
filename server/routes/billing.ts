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
  mercadoPagoWebhook,
  checkExpiringSubscriptions,
  setPreferredPaymentMethod,
  startTrial,
} from "../controllers/billingController.js";

const router = Router();
router.get("/plans", getPlans);
router.get("/me", getMyBilling);
router.post("/coupon/apply", applyCoupon);
router.post("/coupon", applyCoupon);
router.post("/checkout", startCheckout);
router.post("/gift/redeem", redeemGift);
router.post("/cancel", cancelSubscription);
router.post("/renew", renewSubscription);
router.post("/switch-plan", switchPlan);
router.post("/mercadopago/webhook", mercadoPagoWebhook);
router.get("/check-expiring", checkExpiringSubscriptions);
router.post("/webhook/provider", providerWebhook);
router.post("/preferred-method", setPreferredPaymentMethod);
router.post("/start-trial", startTrial);

export default router;