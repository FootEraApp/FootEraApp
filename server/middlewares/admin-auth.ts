import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "footera_secret";

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Token não fornecido" });
  }

  const [, token] = authHeader.split(" ");

  try {
    const decoded: any = jwt.verify(token, SECRET);

    const isAdmin =
      decoded?.tipo === "Admin" ||
      decoded?.tipoUsuario === "Admin" ||
      decoded?.role === "admin" ||
      decoded?.isAdmin === true;

    if (!isAdmin) {
      return res.status(403).json({ message: "Somente administradores." });
    }

    (req as any).user = decoded;
    next();
  } catch (err) {
    console.error("erro adminAuth", err);
    return res.status(401).json({ message: "Token inválido" });
  }
}
