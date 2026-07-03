import type { Response } from "express";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Erros lançados de propósito (ex.: assertAdmin) trazem err.status já definido
// e a mensagem é segura pra mostrar ao usuário. Exceptions inesperadas (Prisma,
// bugs etc.) não têm err.status — nesses casos escondemos err.message do cliente
// e só logamos no servidor, pra não vazar nome de tabela/coluna/stack.
export function sendError(res: Response, err: any, fallbackMessage: string) {
  console.error(fallbackMessage, err);

  // Alguns controllers usam err.status, outros err.statusCode — aceitamos os dois.
  const status = Number(err?.status ?? err?.statusCode);
  const isExpectedClientError = Number.isFinite(status) && status >= 400 && status < 500;

  if (isExpectedClientError) {
    return res.status(status).json({ message: err?.message || fallbackMessage });
  }

  return res.status(500).json({ message: fallbackMessage });
}
