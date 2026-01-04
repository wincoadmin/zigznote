import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

/**
 * Handles requests to non-existent routes
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next(
    new AppError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    })
  );
};
