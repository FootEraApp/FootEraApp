import { Router } from "express";
import { authenticateToken, optionalAuthenticateToken } from "../middlewares/auth.js";
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

/* WEBHOOKS — públicos */
router.post(
  "/mercadopago/webhook",
  mercadoPagoWebhook
);

router.post(
  "/webhook/provider",
  providerWebhook
);

router.get(
  "/plans",
  optionalAuthenticateToken,
  getPlans
);

router.get(
  "/metodologias-avulsas",
  optionalAuthenticateToken,
  getMetodologiasAvulsas
);

router.get(
  "/aulas-ao-vivo",
  getAulasAoVivoPagas
);

/*
 * DAQUI PARA BAIXO:
 * tudo exige autenticação.
 */
router.use(authenticateToken);

router.get(
  "/check-expiring",
  requireAdmin,
  checkExpiringSubscriptions
);

router.get(
  "/me",
  getMyBilling
);

router.post(
  "/coupon/apply",
  applyCoupon
);

router.post(
  "/coupon",
  applyCoupon
);

router.post(
  "/start-trial",
  startTrial
);

router.post(
  "/preferred-method",
  setPreferredPaymentMethod
);

router.post(
  "/checkout-bundle",
  startCheckoutBundle
);

router.post(
  "/checkout",
  startCheckout
);

router.post(
  "/gift/redeem",
  redeemGift
);

router.post(
  "/cancel",
  cancelSubscription
);

router.post(
  "/renew",
  renewSubscription
);

router.post(
  "/switch-plan",
  switchPlan
);

/*
 * Continua privado.
 * Não faz sentido visitante poder resetar.
 */
router.post(
  "/metodologias-avulsas/reset-dev",
  resetMetodologiasAvulsasDev
);

export default router;