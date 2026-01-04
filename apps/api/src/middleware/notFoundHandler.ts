import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '@zigznote/shared';

/**
 * Handles requests to non-existent routes
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next(new NotFoundError(`Route ${req.method} ${req.path}`));
};
