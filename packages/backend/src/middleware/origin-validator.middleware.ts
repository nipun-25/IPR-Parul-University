import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler.middleware.js';

export function createOriginValidator(allowedOrigin: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Only state-changing methods undergo strict origin checking
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
      return next();
    }

    const origin = req.headers.origin;
    if (!origin || origin !== allowedOrigin) {
      return next(new AppError({
        statusCode: 403,
        code: 'ORIGIN_FORBIDDEN',
        title: 'Origin Not Allowed',
        detail: origin
          ? `Request origin "${origin}" is not authorized.`
          : 'Missing Origin header on state-changing authentication request.'
      }));
    }

    next();
  };
}
