import { Request, Response, NextFunction } from 'express';

/**
 * Global error handling middleware.
 * Must be registered after all routes.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(`[ClearPath Error] ${err.message}`);
  console.error(err.stack);

  res.status(500).json({
    error: err.message || 'Internal Server Error',
  });
}
