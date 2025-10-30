import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { TipoUsuario } from "@prisma/client";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  tipo?: TipoUsuario | string;
  isAdmin?: boolean;
  user?: any;
}

const SECRET = process.env.JWT_SECRET || "footera_secret";

export const authenticateToken: RequestHandler = (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!token) return res.status(401).json({ message: "Missing token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET! ) as any;
    req.userId = payload.id || payload.sub;
    if (!req.userId) return res.status(401).json({ message: "Invalid token payload" });
    return next();
  } catch (err: any) {
    console.error("JWT verify fail:", err.name, err.message);
    return res.status(401).json({ message: "Invalid/expired token" });
  }
};