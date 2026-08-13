import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// Validation schema interface
export interface ValidationSchema {
  body?: Record<string, ValidationRule>;
  query?: Record<string, ValidationRule>;
  params?: Record<string, ValidationRule>;
}

export interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'object' | 'array';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: string[];
  custom?: (value: unknown) => boolean | string;
}

// Validation error class
export class ValidationError extends Error {
  constructor(public field: string, public message: string) {
    super(`Validation failed for ${field}: ${message}`);
    this.name = 'ValidationError';
  }
}

// Main validation middleware
export function validate(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors: ValidationError[] = [];

      // Validate request body
      if (schema.body) {
        validateObject(req.body, schema.body, 'body', errors);
      }

      // Validate query parameters
      if (schema.query) {
        validateObject(req.query, schema.query, 'query', errors);
      }

      // Validate route parameters
      if (schema.params) {
        validateObject(req.params, schema.params, 'params', errors);
      }

      if (errors.length > 0) {
        logger.warn(`Validation failed: ${errors.map(e => e.message).join(', ')}`, 'Validation');
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.map(e => ({ field: e.field, message: e.message }))
        });
      }

      next();
    } catch (error) {
      logger.error(`Validation middleware error: ${error}`, 'Validation');
      return res.status(500).json({
        success: false,
        error: 'Internal server error during validation'
      });
    }
  };
}

// Validate object against schema
function validateObject(
  obj: Record<string, unknown>,
  schema: Record<string, ValidationRule>,
  context: string,
  errors: ValidationError[]
) {
  for (const [field, rule] of Object.entries(schema)) {
    const value = obj?.[field];

    // Check if required field is missing
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(new ValidationError(`${context}.${field}`, `${field} is required`));
      continue;
    }

    // Skip validation if field is not provided and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Type validation
    if (!validateType(value, rule.type)) {
      errors.push(new ValidationError(`${context}.${field}`, `${field} must be of type ${rule.type}`));
      continue;
    }

    // String validations
    if (rule.type === 'string') {
      const strValue = String(value);

      if (rule.minLength !== undefined && strValue.length < rule.minLength) {
        errors.push(new ValidationError(`${context}.${field}`, `${field} must be at least ${rule.minLength} characters long`));
      }

      if (rule.maxLength !== undefined && strValue.length > rule.maxLength) {
        errors.push(new ValidationError(`${context}.${field}`, `${field} must be no more than ${rule.maxLength} characters long`));
      }

      if (rule.pattern && !rule.pattern.test(strValue)) {
        errors.push(new ValidationError(`${context}.${field}`, `${field} format is invalid`));
      }

      if (rule.enum && !rule.enum.includes(strValue)) {
        errors.push(new ValidationError(`${context}.${field}`, `${field} must be one of: ${rule.enum.join(', ')}`));
      }
    }

    // Number validations
    if (rule.type === 'number') {
      const numValue = Number(value);

      if (rule.min !== undefined && numValue < rule.min) {
        errors.push(new ValidationError(`${context}.${field}`, `${field} must be at least ${rule.min}`));
      }

      if (rule.max !== undefined && numValue > rule.max) {
        errors.push(new ValidationError(`${context}.${field}`, `${field} must be no more than ${rule.max}`));
      }
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(value);
      if (customResult !== true) {
        errors.push(new ValidationError(`${context}.${field}`, customResult as string));
      }
    }
  }
}

// Validate value type
function validateType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return !isNaN(Number(value)) && isFinite(Number(value));
    case 'boolean':
      return typeof value === 'boolean' || value === 'true' || value === 'false';
    case 'email':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'url':
      try {
        new URL(value as string);
        return true;
      } catch {
        return false;
      }
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      return true;
  }
}

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Remove potentially dangerous HTML/JS from string inputs
  const sanitizeString = (str: string): string => {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<\/?(?:script|iframe|object|embed|form|link|meta|style|title)\b[^>]*>/gi, '')
      .replace(/<[a-z][a-z0-9-]*(?:\s+[a-z0-9-]+=(?:"[^"]*"|'[^']*'|[^\s>]*))*\s*\/?>/gi, (tag) =>
        tag.replace(/\bon[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '').replace(/javascript:/gi, '')
      )
      .replace(/javascript:/gi, '')
      .replace(/\bon[a-z]+\s*=/gi, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  };

  const sanitizeValue = (value: unknown): unknown => {
    if (typeof value === 'string') return sanitizeString(value).trim();
    if (Array.isArray(value)) return value.map(sanitizeValue);
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(value)) {
        result[key] = sanitizeValue((value as Record<string, unknown>)[key]);
      }
      return result;
    }
    return value;
  };

  // Sanitize query parameters (query values can be strings or arrays)
  for (const key in req.query) {
    req.query[key] = sanitizeValue(req.query[key]) as never;
  }

  // Sanitize body parameters (recursively, including nested objects/arrays)
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }

  next();
};

export default validate;
