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
  getCheckoutOperacao,
  getMeuCupomAniversario,
} from "../controllers/billingController.js";
import {
  validarWebhookMercadoPago,
} from "../middlewares/validarWebhookMercadoPago.js";

const router = Router();

router.post(
  "/mercadopago/webhook",
  validarWebhookMercadoPago,
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
  "/aniversario",
  getMeuCupomAniversario
);

router.get(
  "/checkout-operacao/:chaveCliente",
  getCheckoutOperacao
);

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
  requireAdmin,
  resetMetodologiasAvulsasDev
);

export default router;