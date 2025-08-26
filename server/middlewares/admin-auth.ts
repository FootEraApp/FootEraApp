import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export async function adminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Token não fornecido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);

    if (decoded.tipo !== "Admin") {
      return res.status(403).json({ message: "Acesso restrito a administradores" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido" });
  }
}
