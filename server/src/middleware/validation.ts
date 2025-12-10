import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';

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

// Common validation schemas
export const commonSchemas = {
  // Camera validation schemas
  cameraId: {
    params: {
      id: {
        type: 'string',
        required: true,
        pattern: /^[a-zA-Z0-9_-]+$/
      }
    }
  },

  createCamera: {
    body: {
      name: {
        type: 'string' as const,
        required: true,
        minLength: 1,
        maxLength: 100
      },
      rtspUrl: {
        type: 'url' as const,
        required: true,
        custom: (value: string) => {
          if (!value.startsWith('rtsp://') && !value.startsWith('rtsps://')) {
            return 'RTSP URL must start with rtsp:// or rtsps://';
          }
          return true;
        }
      },
      username: {
        type: 'string' as const,
        required: false,
        maxLength: 100
      },
      password: {
        type: 'string' as const,
        required: false,
        maxLength: 100
      },
      frameRate: {
        type: 'number' as const,
        required: false,
        min: 1,
        max: 60
      },
      resolution: {
        type: 'string' as const,
        required: false,
        pattern: /^\d+x\d+$/
      },
      nightMode: {
        type: 'boolean' as const,
        required: false
      }
    }
  },

  updateCamera: {
    params: {
      id: {
        type: 'string',
        required: true,
        pattern: /^[a-zA-Z0-9_-]+$/
      }
    },
    body: {
      name: {
        type: 'string',
        required: false,
        minLength: 1,
        maxLength: 100
      },
      rtspUrl: {
        type: 'url',
        required: false,
        custom: (value: string) => {
          if (value && !value.startsWith('rtsp://') && !value.startsWith('rtsps://')) {
            return 'RTSP URL must start with rtsp:// or rtsps://';
          }
          return true;
        }
      },
      username: {
        type: 'string',
        required: false,
        maxLength: 100
      },
      password: {
        type: 'string',
        required: false,
        maxLength: 100
      },
      frameRate: {
        type: 'number',
        required: false,
        min: 1,
        max: 60
      },
      resolution: {
        type: 'string',
        required: false,
        pattern: /^\d+x\d+$/
      },
      nightMode: {
        type: 'boolean',
        required: false
      }
    }
  },

  // Motion detection schemas
  motionSettings: {
    params: {
      cameraId: {
        type: 'string',
        required: true,
        pattern: /^[a-zA-Z0-9_-]+$/
      }
    },
    body: {
      enabled: {
        type: 'boolean',
        required: false
      },
      sensitivity: {
        type: 'number',
        required: false,
        min: 0.1,
        max: 1.0
      },
      minArea: {
        type: 'number',
        required: false,
        min: 100,
        max: 10000
      },
      cooldownPeriod: {
        type: 'number',
        required: false,
        min: 1000,
        max: 300000
      }
    }
  },

  // Pagination schemas
  pagination: {
    query: {
      page: {
        type: 'number',
        required: false,
        min: 1
      },
      pageSize: {
        type: 'number',
        required: false,
        min: 1,
        max: 100
      }
    }
  },

  // Event filtering schemas
  eventFilter: {
    query: {
      cameraId: {
        type: 'string',
        required: false,
        pattern: /^[a-zA-Z0-9_-]+$/
      },
      startDate: {
        type: 'string',
        required: false,
        pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
      },
      endDate: {
        type: 'string',
        required: false,
        pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
      },
      limit: {
        type: 'number',
        required: false,
        min: 1,
        max: 1000
      }
    }
  }
};

// Express-validator specific validation chains
export const validateCameraId = param('id')
  .isString()
  .withMessage('Camera ID must be a string')
  .isLength({ min: 1, max: 50 })
  .withMessage('Camera ID must be between 1 and 50 characters')
  .matches(/^[a-zA-Z0-9_-]+$/)
  .withMessage('Camera ID can only contain letters, numbers, underscores, and hyphens');

export const validateCameraCreation = [
  body('id')
    .isString()
    .withMessage('Camera ID must be a string')
    .isLength({ min: 1, max: 50 })
    .withMessage('Camera ID must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Camera ID can only contain letters, numbers, underscores, and hyphens'),
  
  body('name')
    .isString()
    .withMessage('Camera name must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Camera name must be between 1 and 100 characters')
    .trim()
    .escape(),
  
  body('rtspUrl')
    .isString()
    .withMessage('RTSP URL must be a string')
    .isURL({ protocols: ['rtsp', 'rtsps'], require_protocol: true })
    .withMessage('RTSP URL must be a valid RTSP/RTSPS URL')
    .trim(),
  
  body('username')
    .optional()
    .isString()
    .withMessage('Username must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Username must be between 1 and 100 characters')
    .trim(),
  
  body('password')
    .optional()
    .isString()
    .withMessage('Password must be a string')
    .isLength({ min: 1, max: 200 })
    .withMessage('Password must be between 1 and 200 characters'),
  
  body('frameRate')
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage('Frame rate must be between 1 and 60 FPS'),
  
  body('resolution')
    .optional()
    .isString()
    .withMessage('Resolution must be a string')
    .matches(/^\d+x\d+$/)
    .withMessage('Resolution must be in format WIDTHxHEIGHT (e.g., 1920x1080)'),
  
  body('nightMode')
    .optional()
    .isBoolean()
    .withMessage('Night mode must be a boolean')
];

export const validateUserRegistration = [
  body('username')
    .isString()
    .withMessage('Username must be a string')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
  
  body('email')
    .isEmail()
    .withMessage('Must provide a valid email address')
    .normalizeEmail(),
  
  body('password')
    .isString()
    .withMessage('Password must be a string')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
  
  body('role')
    .optional()
    .isIn(['admin', 'user', 'viewer'])
    .withMessage('Role must be one of: admin, user, viewer')
];

export const validateUserLogin = [
  body('username')
    .isString()
    .withMessage('Username must be a string')
    .isLength({ min: 1, max: 50 })
    .withMessage('Username must be between 1 and 50 characters')
    .trim(),
  
  body('password')
    .isString()
    .withMessage('Password must be a string')
    .isLength({ min: 1, max: 128 })
    .withMessage('Password must be between 1 and 128 characters')
];

// Validation result handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`Validation failed: ${errors.array().map(e => e.msg).join(', ')}`, 'Validation');
    res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      }))
    });
    return;
  }
  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Remove potentially dangerous HTML/JS from string inputs
  const sanitizeString = (str: string): string => {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  };

  // Sanitize query parameters
  for (const key in req.query) {
    if (typeof req.query[key] === 'string') {
      req.query[key] = sanitizeString(req.query[key] as string).trim();
    }
  }
  
  // Sanitize body parameters
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]).trim();
      }
    }
  }
  
  next();
};

// Generic validation middleware for express-validator
export const validateWithExpress = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    
    logger.warn(`Validation failed: ${errors.array().map(e => e.msg).join(', ')}`, 'Validation');
    res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      }))
    });
  };
};

export default validate;