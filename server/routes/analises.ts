// server/routes/analises.ts
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import * as ctrl from "../controllers/analisesController.js";

const r = Router();

// todas protegidas e visíveis só para Admin
r.get("/overview", authenticateToken, ctrl.overview);
r.get("/users/active", authenticateToken, ctrl.activeUsersSeries);
r.get("/engagement/summary", authenticateToken, ctrl.engagementSummary);
r.get("/engagement/timeseries", authenticateToken, ctrl.engagementSeries);
r.get("/conversion/escolinha", authenticateToken, ctrl.convEscolinha);
r.get("/conversion/clube", authenticateToken, ctrl.convClube);
r.get("/invites/summary", authenticateToken, ctrl.invitesSummary);
r.get("/heatmap/activity-by-uf", authenticateToken, ctrl.activityByUf);

// assinaturas (precisa do model Assinatura no schema)
r.get("/subscriptions/active", authenticateToken, ctrl.subscriptionsActive);
r.get("/subscriptions/churn", authenticateToken, ctrl.subscriptionsChurn);

export default r;
