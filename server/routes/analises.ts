import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { requireSuperAdmin } from "../middlewares/adminGuard.js";
import * as ctrl from "../controllers/analisesController.js";

const r = Router();

r.use(authenticateToken, requireSuperAdmin);

r.get("/overview", ctrl.overview);
r.get("/users/active", ctrl.activeUsersSeries);
r.get("/engagement/summary", ctrl.engagementSummary);
r.get("/engagement/timeseries", ctrl.engagementSeries);
r.get("/logins/summary", ctrl.loginsSummary);
r.get("/conversion/escolinha", ctrl.convEscolinha);
r.get("/conversion/clube", ctrl.convClube);
r.get("/invites/summary", ctrl.invitesSummary);
r.get("/heatmap/activity-by-uf", ctrl.activityByUf);
r.get("/users/new", ctrl.newUsersSeries);
r.get("/users/active-by-type", ctrl.activeByUserType);
r.get("/subscriptions/active", ctrl.subscriptionsActive);
r.get("/subscriptions/churn", ctrl.subscriptionsChurn);

export default r;