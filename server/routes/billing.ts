import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/guards.js";
import {
  getPlans,
  getMyBilling,
  applyCoupon,
  startCheckout,
  startCheckoutBundle,
  redeemGift,
  cancelSubscription,
  renewSubscription,
  switchPlan,
  providerWebhook,
  mercadoPagoWebhook,
  checkExpiringSubscriptions,
  setPreferredPaymentMethod,
  startTrial,
  getMetodologiasAvulsas,
  resetMetodologiasAvulsasDev,
  getAulasAoVivoPagas,
} from "../controllers/billingController.js";

const router = Router();

router.post("/mercadopago/webhook", mercadoPagoWebhook);
router.post("/webhook/provider", providerWebhook);

router.use(authenticateToken);

router.get("/check-expiring", requireAdmin, checkExpiringSubscriptions);

router.get("/plans", getPlans);
router.get("/me", getMyBilling);
router.post("/coupon/apply", applyCoupon);
router.post("/coupon", applyCoupon);
router.post("/start-trial", startTrial);
router.post("/preferred-method", setPreferredPaymentMethod);
router.post("/checkout-bundle", startCheckoutBundle); 
router.post("/checkout", startCheckout);
router.post("/gift/redeem", redeemGift);
router.post("/cancel", cancelSubscription);
router.post("/renew", renewSubscription);
router.post("/switch-plan", switchPlan);
router.get("/metodologias-avulsas", getMetodologiasAvulsas);
router.post("/metodologias-avulsas/reset-dev", resetMetodologiasAvulsasDev);
router.get("/aulas-ao-vivo", getAulasAoVivoPagas);

export default router;