import {
  Router,
} from "express";
import {
  authenticateToken,
} from "../middlewares/auth.js";
import {
  canPermission,
  getPermissionSnapshot,
} from "../services/permissions.js";
import {
  getActiveContext,
} from "../services/activeContext.js";

const router =
  Router();

router.use(
  authenticateToken,
);


function getUserId(
  req: any,
) {
  return String(
    req.userId ??
      req.user?.id ??
      req.authUser?.id ??
      "",
  ).trim();
}


router.get(
  "/me",
  async (req: any, res) => {
    try {
      const userId =
        getUserId(req);

      if (!userId) {
        return res
          .status(401)
          .json({
            error:
              "Não autenticado.",
          });
      }

      const [
        permissions,
        activeContext,
      ] =
        await Promise.all([
          getPermissionSnapshot(
            userId
          ),

          getActiveContext(
            userId
          ),
        ]);

      return res.json({
        permissions,
        activeContext
      });
    } catch (error) {
      console.error(
        "[permissoes/me]",
        error,
      );

      return res
        .status(500)
        .json({
          error:
            "Não foi possível carregar as permissões.",
        });
    }
  },
);


router.get(
  "/metodologias/criar",
  async (req: any, res) => {
    try {
      const userId =
        getUserId(req);

      if (!userId) {
        return res
          .status(401)
          .json({
            canCreate:
              false,
          });
      }

      const canCreate =
        await canPermission(
          userId,
          "PUBLICAR_METODOLOGIA",
        );

      return res.json({
        canCreate,
        permission:
          "PUBLICAR_METODOLOGIA",
      });
    } catch (error) {
      console.error(
        "[permissoes/metodologias/criar]",
        error,
      );

      return res
        .status(500)
        .json({
          canCreate:
            false,
        });
    }
  },
);

export default router;