import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import * as ctrl from "../controllers/analisesController.js";

const r = Router();

r.get("/overview", authenticateToken, ctrl.overview);
r.get("/users/active", authenticateToken, ctrl.activeUsersSeries);
r.get("/engagement/summary", authenticateToken, ctrl.engagementSummary);
r.get("/engagement/timeseries", authenticateToken, ctrl.engagementSeries);
r.get("/conversion/escolinha", authenticateToken, ctrl.convEscolinha);
r.get("/conversion/clube", authenticateToken, ctrl.convClube);
r.get("/invites/summary", authenticateToken, ctrl.invitesSummary);
r.get("/heatmap/activity-by-uf", authenticateToken, ctrl.activityByUf);

r.get("/subscriptions/active", authenticateToken, ctrl.subscriptionsActive);
r.get("/subscriptions/churn", authenticateToken, ctrl.subscriptionsChurn);

export default r;