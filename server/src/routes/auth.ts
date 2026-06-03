import { Router } from 'express';
import { validate, validateUserRegistration, validatePasswordChange, validateWithExpress } from '../middleware/validation.js';
import { createAuthRateLimit, createMfaRateLimit, EnhancedRateLimit } from '../middleware/enhancedRateLimit.js';
import { authenticate } from '../middleware/auth.js';
import { authController } from '../controllers/AuthController.js';

const router = Router();

const authRateLimit = createAuthRateLimit();
const registerRateLimit = new EnhancedRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts, please try again after an hour',
}).middleware();

router.post('/register',
  registerRateLimit,
  authenticate({ roles: ['admin'] }),
  validateWithExpress(validateUserRegistration),
  (req, res) => authController.register(req, res)
);

router.post('/login',
  authRateLimit,
  validate({
    body: {
      username: { type: 'string' as const, required: true, minLength: 1 },
      password: { type: 'string' as const, required: true, minLength: 1 }
    }
  }),
  (req, res) => authController.login(req, res)
);

router.get('/profile',
  authenticate(),
  (req, res) => authController.getProfile(req, res)
);

router.post('/change-password',
  authenticate(),
  validateWithExpress(validatePasswordChange),
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