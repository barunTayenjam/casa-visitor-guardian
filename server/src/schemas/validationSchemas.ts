import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

export const eventListQuerySchema = paginationSchema.extend({
  eventType: z.enum(['motion', 'object', 'face']).optional(),
  cameraId: z.enum(['cam1', 'cam2']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

export const eventIdSchema = z.object({
  id: uuidSchema
});

export const visitorIdSchema = z.object({
  id: uuidSchema
});

export const visitorListQuerySchema = paginationSchema.extend({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  tags: z.string().optional()
});

export const visitorUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(1000).optional()
});

export const detectionRedoSchema = z.object({
  eventIds: z.array(uuidSchema).min(1).max(100),
  detectionTypes: z.array(z.enum(['motion', 'object', 'face'])).min(1)
});

export const batchDetectionSchema = z.object({
  eventIds: z.array(uuidSchema).min(1).max(500),
  options: z.object({
    detectObjects: z.boolean().default(true),
    detectFaces: z.boolean().default(true),
    saveResults: z.boolean().default(true)
  }).optional()
});

export const reviewSegmentListSchema = paginationSchema.extend({
  status: z.enum(['pending', 'dismissed', 'confirmed']).optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

export const reviewSegmentIdSchema = z.object({
  id: uuidSchema
});

export const timelineQuerySchema = dateRangeSchema.extend({
  limit: z.coerce.number().int().positive().max(1000).default(100)
});

export const userRegisterSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  password: z.string().min(12).max(256),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100)
});

export const userLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const userUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(256)
});

export const cameraSnapshotSchema = z.object({
  id: z.enum(['cam1', 'cam2'])
});

export const mfaVerifySchema = z.object({
  token: z.string().regex(/^\d{6}$/)
});
