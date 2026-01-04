/**
 * Async handler wrapper to catch errors in async route handlers
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler to automatically catch and forward errors
 * Eliminates the need for try/catch in every route handler
 *
 * @param fn - Async route handler function
 * @returns Express middleware that handles errors
 *
 * @example
 * ```typescript
 * router.get('/meetings', asyncHandler(async (req, res) => {
 *   const meetings = await meetingService.list();
 *   res.json({ success: true, data: meetings });
 * }));
 * ```
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
