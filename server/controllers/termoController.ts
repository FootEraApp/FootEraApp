import { Request, Response } from "express";

export const index = (req: Request, res: Response) => {
  res.send("Página principal dos Termos.");
};

export const politicaDePrivacidade = (req: Request, res: Response) => {
  res.send("Conteúdo da Política de Privacidade.");
};

export const regulamento = (req: Request, res: Response) => {
  res.send("Conteúdo do Regulamento.");
};

export const termosDeUso = (req: Request, res: Response) => {
  res.send("Conteúdo dos Termos de Uso.");
};