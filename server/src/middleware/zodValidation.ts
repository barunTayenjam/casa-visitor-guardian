import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger.js';

/**
 * Express middleware that validates req.body against a Zod schema.
 * On success, replaces req.body with the parsed (and transformed) value.
 * On failure, returns 400 with structured error details.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));
      logger.warn(
        `Body validation failed: ${details.map((d) => `${d.field}: ${d.message}`).join(', ')}`,
        'Validation',
      );
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details,
      });
      return;
    }
    // Replace body with parsed (coerced/transformed) values
    req.body = result.data;
    next();
  };
}

/**
 * Express middleware that validates req.query against a Zod schema.
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      logger.warn(
        `Query validation failed: ${details.map((d) => `${d.field}: ${d.message}`).join(', ')}`,
        'Validation',
      );
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details,
      });
      return;
    }
    // Mutate query in-place if possible, or use validatedQuery
    Object.assign(req.query, result.data);
    (req as any).validatedQuery = result.data;
    next();
  };
}

/**
 * Express middleware that validates req.params against a Zod schema.
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      logger.warn(
        `Params validation failed: ${details.map((d) => `${d.field}: ${d.message}`).join(', ')}`,
        'Validation',
      );
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details,
      });
      return;
    }
    next();
  };
}
