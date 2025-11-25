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
  checkExpiringSubscriptions
} from "../controllers/billingController.js";

const router = Router();
router.get("/plans", getPlans);
router.get("/me", getMyBilling);

// manter a antiga se você quiser:
router.post("/coupon", applyCoupon);
// e adicionar a que o front usa:
router.post("/coupon/apply", applyCoupon);

router.post("/checkout", startCheckout);
router.post("/gift/redeem", redeemGift);

// rotas que o front usa:
router.post("/cancel", cancelSubscription);
router.post("/renew", renewSubscription);
router.post("/switch-plan", switchPlan);

router.post("/mercadopago/webhook", mercadoPagoWebhook); // sem auth
router.get("/check-expiring", checkExpiringSubscriptions);

router.post("/webhook/provider", providerWebhook);

export default router;