import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppDataSource } from '../database.js';
import { SecurityEvent, SecurityEventType } from '../models/SecurityEvent.js';
import { logger } from '../utils/logger.js';

type ValidationTarget = 'body' | 'query' | 'params';

export function validateRequest<T extends ZodSchema>(
  schema: T,
  target: ValidationTarget = 'body'
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dataToValidate = req[target];

      if (!dataToValidate || Object.keys(dataToValidate).length === 0) {
        res.status(400).json({
          error: 'Validation failed',
          message: `${target} is required`,
          details: []
        });
        return;
      }

      const validatedData = schema.parse(dataToValidate);

      req[target] = validatedData as typeof req[typeof target];

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        logger.warn(`Validation failed: ${validationErrors.map(e => e.message).join(', ')}`, 'Validation', {
          target,
          errors: validationErrors
        });

        if (AppDataSource.isInitialized) {
          const securityEventRepo = AppDataSource.getRepository(SecurityEvent);
          const securityEvent = securityEventRepo.create({
            eventType: SecurityEventType.VALIDATION_FAILED,
            userId: (req as any).user?.userId || null,
            ipAddress: req.ip,
            details: {
              target,
              errors: validationErrors,
              path: req.path
            }
          });
          await securityEventRepo.save(securityEvent).catch(() => {});
        }

        res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid input data',
          details: validationErrors
        });
      } else {
        logger.error('Unexpected validation error', 'Validation', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'An unexpected error occurred during validation'
        });
      }
    }
  };
}

export function validateBody<T extends ZodSchema>(schema: T) {
  return validateRequest(schema, 'body');
}

export function validateQuery<T extends ZodSchema>(schema: T) {
  return validateRequest(schema, 'query');
}

export function validateParams<T extends ZodSchema>(schema: T) {
  return validateRequest(schema, 'params');
}
