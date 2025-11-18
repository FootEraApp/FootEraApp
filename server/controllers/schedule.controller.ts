import { Request, Response } from "express";

export async function createPersonalSchedule(_req: Request, res: Response) {
  return res.status(201).json({ ok: true });
}