// File: server/src/utils/passwordSecurity.ts
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';

// Zod schemas for validation
export const PasswordPolicySchema = z.object({
  minLength: z.number().min(8).max(128),
  requireUppercase: z.boolean(),
  requireLowercase: z.boolean(),
  requireNumbers: z.boolean(),
  requireSpecialChars: z.boolean(),
  preventCommonPasswords: z.boolean(),
  preventUserInfoInclusion: z.boolean(),
  maxAge: z.number().min(1).max(365),
  historyCount: z.number().min(1).max(50)
});

export const PasswordValidationRequestSchema = z.object({
  password: z.string().min(1).max(256),
  userInfo: z.object({
    username: z.string().optional(),
    email: z.string().email().optional()
  }).optional()
});

export const PasswordHashRequestSchema = z.object({
  password: z.string().min(1).max(256),
  salt: z.string().optional()
});

export const PasswordVerifyRequestSchema = z.object({
  password: z.string().min(1).max(256),
  hash: z.string().min(1)
});

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventUserInfoInclusion: boolean;
  maxAge: number; // days
  historyCount: number; // prevent reuse of last N passwords
}

export const defaultPasswordPolicy: PasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventUserInfoInclusion: true,
  maxAge: 90,
  historyCount: 5
};

export class PasswordSecurityService {
  private policy: PasswordPolicy;
  private commonPasswords: Set<string>;

  constructor(policy: PasswordPolicy = defaultPasswordPolicy) {
    // Validate policy with Zod
    const validatedPolicy = PasswordPolicySchema.parse(policy);
    this.policy = validatedPolicy;
    this.commonPasswords = this.loadCommonPasswords();
  }

  async hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
    // Validate input with Zod
    const validated = PasswordHashRequestSchema.parse({ password, salt });
    
    const passwordSalt = validated.salt || crypto.randomBytes(16).toString('hex');
    const hash = await bcrypt.hash(validated.password, 14); // Increased rounds for security
    return { hash, salt: passwordSalt };
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    // Validate input with Zod
    const validated = PasswordVerifyRequestSchema.parse({ password, hash });
    return bcrypt.compare(validated.password, validated.hash);
  }

  generateSecurePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    
    // Ensure at least one character from each required category
    if (this.policy.requireUppercase) {
      password += this.getRandomChar('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    }
    if (this.policy.requireLowercase) {
      password += this.getRandomChar('abcdefghijklmnopqrstuvwxyz');
    }
    if (this.policy.requireNumbers) {
      password += this.getRandomChar('0123456789');
    }
    if (this.policy.requireSpecialChars) {
      password += this.getRandomChar('!@#$%^&*()_+-=[]{}|;:,.<>?');
    }
    
    // Fill remaining length
    for (let i = password.length; i < length; i++) {
      password += this.getRandomChar(charset);
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  validatePassword(password: string, userInfo?: { username?: string; email?: string }): {
    isValid: boolean;
    errors: string[];
  } {
    // Validate input with Zod
    const validated = PasswordValidationRequestSchema.parse({ password, userInfo });
    const errors: string[] = [];

    // Length check
    if (validated.password.length < this.policy.minLength) {
      errors.push(`Password must be at least ${this.policy.minLength} characters long`);
    }

    // Character requirements
    if (this.policy.requireUppercase && !/[A-Z]/.test(validated.password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.policy.requireLowercase && !/[a-z]/.test(validated.password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.policy.requireNumbers && !/\d/.test(validated.password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(validated.password)) {
      errors.push('Password must contain at least one special character');
    }

    // Common password check
    if (this.policy.preventCommonPasswords && this.commonPasswords.has(validated.password.toLowerCase())) {
      errors.push('Password is too common. Please choose a more secure password');
    }

    // User info inclusion check
    if (this.policy.preventUserInfoInclusion && validated.userInfo) {
      const lowerPassword = validated.password.toLowerCase();
      if (validated.userInfo.username && lowerPassword.includes(validated.userInfo.username.toLowerCase())) {
        errors.push('Password cannot contain your username');
      }
      if (validated.userInfo.email) {
        const emailLocal = validated.userInfo.email.split('@')[0].toLowerCase();
        if (lowerPassword.includes(emailLocal)) {
          errors.push('Password cannot contain parts of your email');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  isPasswordExpired(lastChanged: Date): boolean {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastChanged.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > this.policy.maxAge;
  }

  private loadCommonPasswords(): Set<string> {
    // Top 1000 common passwords (simplified list)
    const common = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', '1234567890', 'password1',
      '12345678', '123456789', 'dragon', 'baseball', 'football',
      'iloveyou', 'trustno1', 'superman', 'letmein', 'access',
      'master', 'sunshine', 'ashley', 'bailey', 'passw0rd',
      'shadow', 'mustang', 'freedom', 'superman', 'whatever',
      'qazwsx', 'qwert', 'abc123', 'p@ssw0rd', 'admin123',
      'welcome1', 'password!', '123123', 'adminadmin', 'drowssap'
    ];
    return new Set(common.map(p => p.toLowerCase()));
  }

  private getRandomChar(charset: string): string {
    return charset.charAt(Math.floor(Math.random() * charset.length));
  }

  // Additional security methods
  async checkPasswordHistory(userId: string, newPassword: string, passwordHistory: Array<{ passwordHash: string }>): Promise<boolean> {
    for (const entry of passwordHistory) {
      const isMatch = await this.verifyPassword(newPassword, entry.passwordHash);
      if (isMatch) {
        return true; // Password found in history
      }
    }
    return false; // Password not found in history
  }

  calculatePasswordStrength(password: string): {
    score: number; // 0-100
    strength: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    // Length scoring
    if (password.length >= 12) score += 25;
    else if (password.length >= 8) score += 15;
    else feedback.push('Use at least 12 characters');

    // Character variety scoring
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password);

    if (hasUpper) score += 15;
    else feedback.push('Add uppercase letters');

    if (hasLower) score += 15;
    else feedback.push('Add lowercase letters');

    if (hasNumber) score += 15;
    else feedback.push('Add numbers');

    if (hasSpecial) score += 15;
    else feedback.push('Add special characters');

    // Entropy bonus
    const uniqueChars = new Set(password).size;
    const entropy = uniqueChars / password.length;
    if (entropy > 0.7) score += 15;

    // Common password penalty
    if (this.commonPasswords.has(password.toLowerCase())) {
      score = Math.max(0, score - 50);
      feedback.push('Avoid common passwords');
    }

    // Cap score at 100
    score = Math.min(100, Math.max(0, score));

    let strength: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
    if (score < 20) strength = 'very-weak';
    else if (score < 40) strength = 'weak';
    else if (score < 60) strength = 'fair';
    else if (score < 80) strength = 'good';
    else if (score < 90) strength = 'strong';
    else strength = 'very-strong';

    return { score, strength, feedback };
  }

  generatePasswordResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  validateResetToken(token: string, expiresAt: Date): boolean {
    if (!token || token.length !== 64) return false;
    return new Date() < expiresAt;
  }

  hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}