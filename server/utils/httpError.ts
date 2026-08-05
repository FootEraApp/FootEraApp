import type { Response } from "express";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function sendError(res: Response, err: any, fallbackMessage: string) {
  console.error(fallbackMessage, err);

  const status = Number(err?.status ?? err?.statusCode);
  const isExpectedClientError = Number.isFinite(status) && status >= 400 && status < 500;

  if (isExpectedClientError) {
    return res.status(status).json({ message: err?.message || fallbackMessage });
  }

  return res.status(500).json({ message: fallbackMessage });
}
