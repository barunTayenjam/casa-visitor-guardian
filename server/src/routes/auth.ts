import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/zodValidation.js';
import { createAuthRateLimit, createMfaRateLimit, EnhancedRateLimit } from '../middleware/enhancedRateLimit.js';
import { authenticate } from '../middleware/auth.js';
import { authController } from '../controllers/AuthController.js';

const router = Router();

// Validation Schemas
const registerSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.string().email(),
  password: z.string()
    .min(8)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain uppercase, lowercase, number, and special character'),
  role: z.enum(['admin', 'user', 'viewer']).optional()
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(8)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain uppercase, lowercase, number, and special character'),
});

const authRateLimit = createAuthRateLimit();
const registerRateLimit = new EnhancedRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts, please try again after an hour',
}).middleware();

router.post('/register',
  registerRateLimit,
  authenticate({ roles: ['admin'] }),
  validateBody(registerSchema),
  (req, res) => authController.register(req, res)
);

router.post('/login',
  authRateLimit,
  validateBody(loginSchema),
  (req, res) => authController.login(req, res)
);

router.get('/profile',
  authenticate(),
  (req, res) => authController.getProfile(req, res)
);

router.post('/change-password',
  authenticate(),
  validateBody(changePasswordSchema),
  (req, res) => authController.changePassword(req, res)
);

router.post('/refresh',
  authenticate(),
  (req, res) => authController.refreshToken(req, res)
);

router.post('/mfa/challenge',
  createMfaRateLimit(),
  (req, res) => authController.mfaChallenge(req, res)
);

router.post('/logout',
  authenticate(),
  (req, res) => authController.logout(req, res)
);

router.get('/mfa/setup',
  authenticate(),
  (req, res) => authController.setupMfa(req, res)
);

router.post('/mfa/verify',
  authenticate(),
  (req, res) => authController.verifyMfa(req, res)
);

router.post('/mfa/disable',
  authenticate(),
  (req, res) => authController.disableMfa(req, res)
);

export default router;